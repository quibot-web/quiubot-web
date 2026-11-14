"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PublicacionOrganica } from "@/app/lib/contenido";
import type { Guion } from "@/video/guion.schema";
import type { MediosResueltos } from "@/video/escenas/tipos";

// Commit 4c del plan -- render en cola y subida. Vive en el calendario
// (no en la revisión): "apenas se aprueba una pieza, entra sola a la
// cola... mientras la marca sigue revisando las demás" -- el
// calendario es la única pantalla que ve "las demás" a la vez.
//
// Una pieza a la vez, nunca en paralelo (el spike del commit 1 ya
// confirmó que el render en sí sobrevive bien a que la pestaña se
// minimice/congele, pero igual solo un render corre por vez acá).

type FaseCola = "esperando" | "renderizando" | "subiendo" | "reintentar_subida" | "lista" | "error";

interface EstadoPiezaCola {
  fase: FaseCola;
  progreso: number; // 0-100, solo durante "renderizando"
  blobPendiente?: Blob;
  errorMsg?: string;
}

const LICENCIA_REMOTION = "free-license";

export default function ColaDeRender({
  piezasAprobadas,
  onPiezaLista,
}: {
  // Piezas con estado "aprobada" (todavía sin video) del calendario
  // actual -- el padre las filtra, este componente no vuelve a pedir
  // el calendario completo.
  piezasAprobadas: PublicacionOrganica[];
  onPiezaLista: () => void;
}) {
  const [estados, setEstados] = useState<Record<string, EstadoPiezaCola>>({});
  const [procesando, setProcesando] = useState(false);
  // Medido con el primer render real de esta sesión -- nunca un número
  // fijo (pedido explícito del plan). Antes de tener una medición real
  // no se muestra ningún tiempo estimado.
  const [segundosPorSegundoDeVideo, setSegundosPorSegundoDeVideo] = useState<number | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const procesandoRef = useRef(false);

  const actualizarEstado = useCallback((id: string, parcial: Partial<EstadoPiezaCola>) => {
    setEstados((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { fase: "esperando", progreso: 0 }), ...parcial } }));
  }, []);

  async function subirBlob(id: string, blob: Blob): Promise<"ok" | "reintentable" | "error"> {
    const formData = new FormData();
    formData.set("archivo", blob, "reel.mp4");
    try {
      const res = await fetch(`/api/contenido/${id}/video-listo`, { method: "POST", body: formData });
      if (res.ok) return "ok";
      const data = await res.json().catch(() => ({}));
      return data?.reintentable ? "reintentable" : "error";
    } catch {
      return "reintentable";
    }
  }

  const renderizarYSubir = useCallback(
    async (pieza: PublicacionOrganica) => {
      // Claim atómico -- si otra pestaña ya la tomó, se salta sin error.
      const claim = await fetch(`/api/contenido/${pieza.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "iniciar_render" }),
      });
      if (!claim.ok) return;

      actualizarEstado(pieza.id, { fase: "renderizando", progreso: 0 });

      try {
        const detalleRes = await fetch(`/api/contenido/${pieza.id}`);
        const detalle = await detalleRes.json();
        const guion = detalle.pieza.guion as Guion;
        const medios = (detalle.medios ?? {}) as MediosResueltos;

        const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer");
        const { Composicion, duracionEnCuadros } = await import("@/video/Composicion");

        const check = await canRenderMediaOnWeb({ width: 1080, height: 1920, container: "mp4", videoCodec: "h264", audioCodec: "aac" });
        if (!check.canRender) {
          actualizarEstado(pieza.id, { fase: "error", errorMsg: "Este navegador no puede preparar videos acá. Abre Quiubot desde un computador con Chrome." });
          return;
        }

        const duracionS = guion.escenas.reduce((acc, e) => acc + e.duracion_s, 0);
        const inicio = performance.now();

        const resultado = await renderMediaOnWeb({
          composition: {
            id: `cola-${pieza.id}`,
            component: Composicion,
            durationInFrames: duracionEnCuadros(guion),
            fps: guion.fps,
            width: 1080,
            height: 1920,
            defaultProps: { guion, medios, pistaUrl: null, mostrarZonaSegura: false },
          },
          inputProps: { guion, medios, pistaUrl: null, mostrarZonaSegura: false },
          container: "mp4",
          videoCodec: "h264",
          audioCodec: "aac",
          licenseKey: LICENCIA_REMOTION,
          onProgress: (p: { progress: number }) => actualizarEstado(pieza.id, { progreso: Math.round((p.progress ?? 0) * 100) }),
        });

        const blob = await resultado.getBlob();
        const segundosReales = (performance.now() - inicio) / 1000;
        setSegundosPorSegundoDeVideo(segundosReales / Math.max(duracionS, 1));

        actualizarEstado(pieza.id, { fase: "subiendo", progreso: 100 });
        const resultadoSubida = await subirBlob(pieza.id, blob);

        if (resultadoSubida === "ok") {
          actualizarEstado(pieza.id, { fase: "lista" });
          onPiezaLista();
        } else if (resultadoSubida === "reintentable") {
          // El blob se queda en memoria -- "Reintentar subida" lo
          // reenvía sin volver a renderizar.
          actualizarEstado(pieza.id, { fase: "reintentar_subida", blobPendiente: blob });
        } else {
          actualizarEstado(pieza.id, { fase: "error", errorMsg: "No se pudo subir el video después de reintentar." });
        }
      } catch (err) {
        actualizarEstado(pieza.id, { fase: "error", errorMsg: err instanceof Error ? err.message : "No se pudo renderizar este video." });
      }
    },
    [actualizarEstado, onPiezaLista]
  );

  const procesarCola = useCallback(
    async (pendientes: PublicacionOrganica[]) => {
      if (procesandoRef.current || pendientes.length === 0) return;
      procesandoRef.current = true;
      setProcesando(true);

      wakeLockRef.current = await navigator.wakeLock?.request("screen").catch(() => null) ?? null;
      const avisoAlCerrar = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "";
      };
      window.addEventListener("beforeunload", avisoAlCerrar);

      try {
        // Una a la vez, nunca en paralelo.
        for (const pieza of pendientes) {
          await renderizarYSubir(pieza);
        }
      } finally {
        window.removeEventListener("beforeunload", avisoAlCerrar);
        await wakeLockRef.current?.release().catch(() => {});
        wakeLockRef.current = null;
        procesandoRef.current = false;
        setProcesando(false);
      }
    },
    [renderizarYSubir]
  );

  // Apenas aparece una pieza "aprobada" sin procesar, arranca sola --
  // tanto la primera vez (justo después de aprobar, en el calendario)
  // como al volver a abrir la pestaña (retoma lo que quedó a medias).
  useEffect(() => {
    const pendientes = piezasAprobadas.filter((p) => {
      const estado = estados[p.id]?.fase;
      return !estado || estado === "esperando";
    });
    procesarCola(pendientes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piezasAprobadas]);

  async function reintentarSubida(pieza: PublicacionOrganica) {
    const estado = estados[pieza.id];
    if (!estado?.blobPendiente) return;
    actualizarEstado(pieza.id, { fase: "subiendo" });
    const resultado = await subirBlob(pieza.id, estado.blobPendiente);
    if (resultado === "ok") {
      actualizarEstado(pieza.id, { fase: "lista", blobPendiente: undefined });
      onPiezaLista();
    } else {
      // El servidor ya cuenta 2 intentos en total -- este reintento
      // manual es el segundo, así que si falla de nuevo ya queda en
      // "error" del lado del servidor.
      actualizarEstado(pieza.id, { fase: "error", blobPendiente: undefined, errorMsg: "No se pudo subir el video después de reintentar." });
    }
  }

  const entradas = Object.entries(estados).filter(([, e]) => e.fase !== "lista");
  if (entradas.length === 0 && !procesando) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e5e5", padding: 16, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 10 }}>
        Preparando videos{" "}
        {segundosPorSegundoDeVideo
          ? `(~${Math.round(segundosPorSegundoDeVideo)}x la duración real por pieza, medido en esta sesión)`
          : "(calculando tiempo…)"}
      </div>
      {entradas.map(([id, estado]) => {
        const pieza = piezasAprobadas.find((p) => p.id === id);
        return (
          <div key={id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginBottom: 4 }}>
              <span>{pieza ? pieza.receta_organica : id}</span>
              <span>
                {estado.fase === "renderizando" && `Renderizando… ${estado.progreso}%`}
                {estado.fase === "subiendo" && "Subiendo…"}
                {estado.fase === "reintentar_subida" && "No se pudo subir"}
                {estado.fase === "error" && (estado.errorMsg || "Error")}
                {estado.fase === "esperando" && "En fila…"}
              </span>
            </div>
            {estado.fase === "renderizando" && (
              <div style={{ height: 6, borderRadius: 999, background: "#eee", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${estado.progreso}%`, background: "#534AB7" }} />
              </div>
            )}
            {estado.fase === "reintentar_subida" && pieza && (
              <button
                type="button"
                onClick={() => reintentarSubida(pieza)}
                style={{ marginTop: 4, padding: "6px 12px", borderRadius: 8, border: "1px solid #534AB7", background: "#F3F2FE", color: "#534AB7", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Reintentar subida
              </button>
            )}
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: "#888", marginTop: 8 }}>
        Deja esta pestaña abierta en primer plano hasta que termine -- si la minimizas o cambias de pestaña, puede demorar más (no se rompe, solo se hace más lento).
      </p>
    </div>
  );
}
