"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { EstadoEsfera } from "@/app/components/esferas/esferasShared";
import type { ContextoCuentaDirector } from "@/app/lib/director/contextoCuenta";
import ConversacionDirector, { type DatosInicialesConversacion } from "@/app/metas/crear/ConversacionDirector";

type AccionDirector = {
  label: string;
  tipo: "link" | "crear_meta" | "ir_a_soporte";
  href?: string;
};

type MensajeDirector = {
  rol: "user" | "assistant";
  mensaje: string;
  acciones?: AccionDirector[];
};

const ETIQUETA_CONEXION: { clave: keyof ContextoCuentaDirector["conexiones"]; etiqueta: string }[] = [
  { clave: "meta", etiqueta: "Meta Ads" },
  { clave: "pixel", etiqueta: "Píxel" },
  { clave: "instagram", etiqueta: "Instagram" },
  { clave: "openai", etiqueta: "OpenAI" },
  { clave: "cloudinary", etiqueta: "Cloudinary" },
];

function TarjetaContexto({ contexto }: { contexto: ContextoCuentaDirector }) {
  return (
    <div style={{ background: "#F8F8FD", border: "1px solid #E3E1F7", borderRadius: 12, padding: "10px 12px", fontSize: 11.5 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: contexto.propuestasPendientes > 0 ? 8 : 0 }}>
        {ETIQUETA_CONEXION.map(({ clave, etiqueta }) => {
          const conectado = contexto.conexiones[clave].conectado;
          return (
            <span key={clave} style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #E9E7EE", borderRadius: 999, padding: "3px 8px", color: "#1a1a1a" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: conectado ? "#1E9E6B" : "#E5AE3A" }} />
              {etiqueta}
            </span>
          );
        })}
      </div>
      {contexto.propuestasPendientes > 0 && (
        <Link href="/equipo" style={{ color: "#534AB7", fontWeight: 700, textDecoration: "none" }}>
          {contexto.propuestasPendientes} propuesta{contexto.propuestasPendientes === 1 ? "" : "s"} pendiente{contexto.propuestasPendientes === 1 ? "" : "s"} →
        </Link>
      )}
    </div>
  );
}

export default function PanelDirectorGeneral({
  activo,
  historialInicial,
  contexto,
  autoenviar,
  onConsumidoAutoenviar,
  onIrASoporte,
  onCambiarEstado,
}: {
  activo: boolean;
  historialInicial: MensajeDirector[];
  contexto: ContextoCuentaDirector | null;
  autoenviar: string | null;
  onConsumidoAutoenviar: () => void;
  onIrASoporte: (pregunta: string) => void;
  onCambiarEstado?: (estado: "listo" | "pensando") => void;
}) {
  const [mensajes, setMensajes] = useState<MensajeDirector[]>(historialInicial);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"listo" | "pensando">("listo");
  const [modo, setModo] = useState<"chat" | "crear_meta">("chat");
  const [datosMeta, setDatosMeta] = useState<DatosInicialesConversacion | null>(null);
  const [cargandoMeta, setCargandoMeta] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, modo]);

  async function entrarACrearMeta() {
    setModo("crear_meta");
    if (datosMeta) return;
    setCargandoMeta(true);
    try {
      const res = await fetch("/api/metas/conversacion");
      const data = await res.json();
      if (data.requiereApiKey) {
        setModo("chat");
        return;
      }
      setDatosMeta({
        conversacionId: data.conversacion_id,
        mensajes: data.mensajes || [],
        borrador: data.borrador || {},
        resumen: data.resumen ?? null,
        errorInicial: data.errorOpenAI ? data.errorMensaje : undefined,
      });
    } catch {
      setModo("chat");
    } finally {
      setCargandoMeta(false);
    }
  }

  async function enviar(contenido: string) {
    const mensaje = contenido.trim();
    if (!mensaje || estado === "pensando") return;

    setMensajes((prev) => [...prev, { rol: "user", mensaje }]);
    setTexto("");
    setEstado("pensando");
    onCambiarEstado?.("pensando");

    try {
      const res = await fetch("/api/director/conversacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMensajes((prev) => [...prev, { rol: "assistant", mensaje: data.error || "Algo salió mal, intenta de nuevo." }]);
      } else {
        setMensajes((prev) => [...prev, data.mensajeDirector]);
      }
    } catch {
      setMensajes((prev) => [...prev, { rol: "assistant", mensaje: "No se pudo conectar con el Director. Intenta de nuevo." }]);
    } finally {
      setEstado("listo");
      onCambiarEstado?.("listo");
    }
  }

  // Handoff desde Soporte (redirigirADirector) -- llega con la pregunta
  // ya escrita y se manda sola, una sola vez.
  useEffect(() => {
    if (!autoenviar) return;
    // setTimeout(0) en vez de llamar enviar()/setModo() directo acá --
    // el enviar() real queda en un callback, no en el cuerpo síncrono
    // del efecto (react-hooks/set-state-in-effect).
    const id = setTimeout(() => {
      setModo("chat");
      enviar(autoenviar);
      onConsumidoAutoenviar();
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoenviar]);

  if (modo === "crear_meta") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "8px 14px 0" }}>
          <button onClick={() => setModo("chat")} style={{ background: "none", border: "none", color: "#6B6880", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>
            ← Volver
          </button>
        </div>
        {cargandoMeta || !datosMeta ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 13 }}>Cargando...</div>
        ) : (
          <ConversacionDirector
            datosIniciales={datosMeta}
            variante="embebida"
            onPreferirFormulario={() => {
              window.location.href = "/metas/crear";
            }}
          />
        )}
      </div>
    );
  }

  const ultimoMensaje = mensajes[mensajes.length - 1];
  const accionesActivas = ultimoMensaje?.rol === "assistant" ? ultimoMensaje.acciones : undefined;
  const estadoEsfera: EstadoEsfera = estado === "pensando" ? "trabajando" : "normal";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {!activo ? (
          <div style={{ background: "#f5f4fb", border: "1px solid #e3e1f7", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#444", textAlign: "center" }}>
            Para que el Director te guíe, conecta tu cuenta de OpenAI en{" "}
            <Link href="/?tab=integraciones" style={{ color: "#534AB7", fontWeight: 600 }}>
              Integraciones
            </Link>
            .
          </div>
        ) : (
          <>
            {contexto && <TarjetaContexto contexto={contexto} />}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button onClick={entrarACrearMeta} style={estiloChip}>
                Crear una meta
              </button>
              <Link href="/equipo" style={estiloChipLink}>
                Ver propuestas
              </Link>
              <Link href="/?tab=integraciones" style={estiloChipLink}>
                Conectar integraciones
              </Link>
              <button onClick={() => onIrASoporte("")} style={estiloChip}>
                Hablar con Soporte
              </button>
            </div>

            {mensajes.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: m.rol === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  {m.rol === "assistant" && <EsferaAsistente asistente="director" estado="normal" tamano={26} />}
                  <div
                    style={{
                      background: m.rol === "user" ? "#534AB7" : "#f2f2f0",
                      color: m.rol === "user" ? "#fff" : "#1a1a1a",
                      padding: "8px 12px",
                      borderRadius: 12,
                      fontSize: 13,
                      maxWidth: 230,
                      lineHeight: 1.4,
                    }}
                  >
                    {m.mensaje}
                  </div>
                </div>
                {i === mensajes.length - 1 && accionesActivas && accionesActivas.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginLeft: 34 }}>
                    {accionesActivas.map((a, j) =>
                      a.tipo === "link" && a.href ? (
                        <Link key={j} href={a.href} style={estiloChipLink}>
                          {a.label}
                        </Link>
                      ) : (
                        <button
                          key={j}
                          onClick={() => (a.tipo === "crear_meta" ? entrarACrearMeta() : onIrASoporte(ultimoMensajeUsuarioAnterior(mensajes)))}
                          style={estiloChip}
                        >
                          {a.label}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}

            {estado === "pensando" && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <EsferaAsistente asistente="director" estado={estadoEsfera} tamano={26} />
                <div style={{ padding: "8px 12px", borderRadius: 12, background: "#f2f2f0", color: "#999", fontSize: 13 }}>Pensando...</div>
              </div>
            )}
          </>
        )}
        <div ref={finRef} />
      </div>

      {activo && (
        <div style={{ display: "flex", borderTop: "1px solid #eee", padding: 10, gap: 8 }}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviar(texto)}
            placeholder="Escríbele al Director..."
            disabled={estado === "pensando"}
            style={{ flex: 1, border: "1px solid #e0e0e0", borderRadius: 10, padding: "8px 12px", fontSize: 13, outline: "none" }}
          />
          <button
            onClick={() => enviar(texto)}
            disabled={estado === "pensando" || !texto.trim()}
            style={{
              background: "#534AB7",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: estado === "pensando" ? "default" : "pointer",
              opacity: estado === "pensando" || !texto.trim() ? 0.6 : 1,
            }}
          >
            {estado === "pensando" ? "..." : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}

function ultimoMensajeUsuarioAnterior(mensajes: MensajeDirector[]): string {
  for (let i = mensajes.length - 1; i >= 0; i--) {
    if (mensajes[i].rol === "user") return mensajes[i].mensaje;
  }
  return "";
}

const estiloChip: CSSProperties = {
  border: "1.5px solid #E9E7EE",
  background: "#fff",
  borderRadius: 999,
  padding: "6px 11px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  color: "#1B1A22",
};

const estiloChipLink: CSSProperties = {
  border: "1.5px solid #534AB7",
  background: "#EFEDFB",
  borderRadius: 999,
  padding: "6px 11px",
  fontSize: 12,
  fontWeight: 700,
  color: "#534AB7",
  textDecoration: "none",
  display: "inline-block",
};
