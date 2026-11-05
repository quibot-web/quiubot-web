"use client";
// Fase 2, Commit 5 -- chat individual de un asistente con chat propio
// (Analista/Creativo/Optimizador): solo sus mensajes de mensajes_equipo
// (eventos reales + conversación), el usuario le escribe directo y
// responde el MISMO cerebro del Director (Commit 4,
// construirPromptAsistenteEquipo) con su rol. Las propuestas no se
// aprueban acá -- eso sigue siendo del grupo o del chat del Director,
// según la nota del diseño.
import { useEffect, useRef, useState } from "react";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { AsistenteId } from "@/app/components/esferas/esferasShared";
import type { MensajeEquipo } from "@/app/lib/director/mensajeEquipo.schema";

export default function PanelAsistenteIndividual({ asistente }: { asistente: "analista" | "creativo" | "optimizador" }) {
  const [mensajes, setMensajes] = useState<MensajeEquipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/equipo/mensajes?asistente=${asistente}`)
      .then((r) => r.json())
      .then((data) => setMensajes(data.mensajesEquipo ?? []))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [asistente]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function enviar() {
    const mensaje = texto.trim();
    if (!mensaje || enviando) return;
    setTexto("");
    setEnviando(true);
    setMensajes((prev) => [...prev, { id: `tmp-${Date.now()}`, user_id: "", asistente, tipo_evento: "mensaje_usuario", contenido: { texto: mensaje }, origen_id: null, creado_en: new Date().toISOString() }]);

    try {
      const res = await fetch("/api/equipo/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje, asistente }),
      });
      const data = await res.json();
      if (res.ok && data.mensaje) setMensajes((prev) => [...prev, data.mensaje as MensajeEquipo]);
    } catch {
      // el usuario puede reintentar escribiendo de nuevo
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {cargando ? (
          <div style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 20 }}>Cargando...</div>
        ) : mensajes.length === 0 ? (
          <div style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 20 }}>Todavía no hay nada acá -- escríbele cuando quieras.</div>
        ) : (
          mensajes.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", alignSelf: m.tipo_evento === "mensaje_usuario" ? "flex-end" : "flex-start" }}>
              {m.tipo_evento !== "mensaje_usuario" && <EsferaAsistente asistente={asistente as AsistenteId} estado="normal" tamano={26} />}
              <div
                style={{
                  background: m.tipo_evento === "mensaje_usuario" ? "#534AB7" : "#f2f2f0",
                  color: m.tipo_evento === "mensaje_usuario" ? "#fff" : "#1a1a1a",
                  padding: "8px 12px",
                  borderRadius: 12,
                  fontSize: 13,
                  maxWidth: 230,
                  lineHeight: 1.4,
                }}
              >
                {m.contenido.texto}
                {m.contenido.datos && m.contenido.datos.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {m.contenido.datos.map((d, j) => (
                      <div key={j} style={{ flex: 1, background: "#fff", borderRadius: 8, padding: "5px 6px" }}>
                        <small style={{ display: "block", fontSize: 10, color: "#666" }}>{d.etiqueta}</small>
                        <b style={{ fontSize: 12.5 }}>{d.valor}</b>
                      </div>
                    ))}
                  </div>
                )}
                {m.contenido.miniaturas && m.contenido.miniaturas.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                    {m.contenido.miniaturas.map((url, j) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={j} src={url} alt="" style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 6 }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={finRef} />
      </div>

      <div style={{ display: "flex", borderTop: "1px solid #eee", padding: 10, gap: 8 }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Escribe tu mensaje..."
          disabled={enviando}
          style={{ flex: 1, border: "1px solid #e0e0e0", borderRadius: 10, padding: "8px 12px", fontSize: 13, outline: "none" }}
        />
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: enviando ? "default" : "pointer", opacity: enviando || !texto.trim() ? 0.6 : 1 }}
        >
          {enviando ? "..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}
