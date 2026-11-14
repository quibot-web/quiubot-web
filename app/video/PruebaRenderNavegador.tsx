"use client";

import { useState } from "react";
import type { Guion } from "@/video/guion.schema";
import type { MediosResueltos } from "@/video/escenas/tipos";

// Spike de la Fase O1 (contenido orgánico, ver docs/diseno/
// plan_contenido_organico.md sección 5) -- confirma en el navegador real
// de quien lo usa (no solo en el de Code) que @remotion/web-renderer
// funciona con el guion actual antes de construir todo el flujo de
// /contenido. Solo admin: vive dentro de /video, que ya exige admin
// completo más arriba en esta misma página.
//
// "@remotion/web-renderer" se carga con import() DENTRO del handler, no
// arriba del archivo -- así Next lo separa en su propio chunk y nunca
// entra al bundle de /video para quien no toca este botón (pesa varios
// MB, con los codificadores de Mediabunny incluidos).
export default function PruebaRenderNavegador({
  guion,
  medios,
  pistaUrl,
  mostrarZonaSegura,
}: {
  guion: Guion;
  medios: MediosResueltos;
  pistaUrl: string | null;
  mostrarZonaSegura: boolean;
}) {
  const [estado, setEstado] = useState<"inactivo" | "cargando" | "renderizando" | "listo" | "error">("inactivo");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [urlDescarga, setUrlDescarga] = useState<string | null>(null);
  const [duracionMs, setDuracionMs] = useState<number | null>(null);

  async function probar() {
    setEstado("cargando");
    setMensaje(null);
    setUrlDescarga(null);
    const inicio = performance.now();
    try {
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer");
      const { Composicion, duracionEnCuadros } = await import("@/video/Composicion");

      const check = await canRenderMediaOnWeb({ width: 1080, height: 1920, container: "mp4", videoCodec: "h264", audioCodec: "aac" });
      if (!check.canRender) {
        setEstado("error");
        setMensaje(
          `Este navegador no puede preparar videos acá (${check.issues.map((i) => i.message).join("; ")}). Abre Quiubot desde un computador con Chrome.`
        );
        return;
      }

      setEstado("renderizando");
      const props = { guion, medios, pistaUrl, mostrarZonaSegura };
      const resultado = await renderMediaOnWeb({
        composition: {
          id: "spike-admin",
          component: Composicion,
          durationInFrames: duracionEnCuadros(guion),
          fps: guion.fps,
          width: 1080,
          height: 1920,
          defaultProps: props,
        },
        inputProps: props,
        container: "mp4",
        videoCodec: "h264",
        audioCodec: "aac",
        licenseKey: "free-license",
      });

      const blob = await resultado.getBlob();
      setUrlDescarga(URL.createObjectURL(blob));
      setDuracionMs(performance.now() - inicio);
      setEstado("listo");
    } catch (err) {
      setEstado("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div style={{ marginTop: 16, padding: 14, border: "1px dashed #CFC9EE", borderRadius: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#534AB7", marginBottom: 6 }}>
        Spike: render en el navegador (contenido orgánico, solo admin)
      </div>
      <button
        type="button"
        onClick={probar}
        disabled={estado === "cargando" || estado === "renderizando"}
        style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #534AB7", background: "#fff", color: "#534AB7", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
      >
        {estado === "cargando" ? "Cargando..." : estado === "renderizando" ? "Renderizando..." : "Probar render en el navegador"}
      </button>
      {estado === "listo" && urlDescarga && (
        <p style={{ fontSize: 12, color: "#1a1a1a", marginTop: 8 }}>
          Listo en {((duracionMs ?? 0) / 1000).toFixed(1)}s.{" "}
          <a href={urlDescarga} download="spike.mp4">
            Descargar mp4
          </a>
        </p>
      )}
      {estado === "error" && <p style={{ fontSize: 12, color: "#b91c1c", marginTop: 8 }}>{mensaje}</p>}
    </div>
  );
}
