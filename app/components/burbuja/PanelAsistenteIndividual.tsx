"use client";
// Corrección de voz (Fase 2, Commit 2): el chat de un asistente con
// chat propio deja de ser una conversación en vivo usuario↔asistente
// -- pasa a ser de SOLO LECTURA: la transcripción real asistente→
// Director (reporta/recomienda) y Director→asistente (responde citando
// al cliente en tercera persona), armada en el servidor con plantillas
// sobre datos reales (GET /api/equipo/mensajes?asistente=X). Sin campo
// de texto -- el botón de abajo lleva al chat del Director, que es el
// único que conversa con el usuario.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { AsistenteId } from "@/app/components/esferas/esferasShared";
import { NOMBRE_CHAT, type ChatEquipoId } from "@/app/lib/director/chatsEquipo";

type ItemTranscripcion = { id: string; rol: "asistente" | "director"; texto: string; datos?: { etiqueta: string; valor: string }[]; miniaturas?: string[]; enlaceCampanaId?: string; creadoEn: string };

type AsistenteConChatPropio = "marca" | "estratega" | "creativo" | "publicador" | "analista" | "optimizador";

export default function PanelAsistenteIndividual({
  asistente,
  onPreguntarAlDirector,
}: {
  asistente: AsistenteConChatPropio;
  onPreguntarAlDirector: (pregunta: string) => void;
}) {
  const [transcripcion, setTranscripcion] = useState<ItemTranscripcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/equipo/mensajes?asistente=${asistente}`)
      .then((r) => r.json())
      .then((data) => setTranscripcion(data.transcripcion ?? []))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [asistente]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripcion]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {cargando ? (
          <div style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 20 }}>Cargando...</div>
        ) : transcripcion.length === 0 ? (
          <div style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 20 }}>Todavía no hay nada que reportar acá.</div>
        ) : (
          transcripcion.map((item) => (
            <div key={item.id} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <EsferaAsistente asistente={item.rol === "asistente" ? (asistente as AsistenteId) : "director"} estado="normal" tamano={26} />
              <div style={{ background: "#f2f2f0", color: "#1a1a1a", padding: "8px 12px", borderRadius: 12, fontSize: 13, maxWidth: 230, lineHeight: 1.4 }}>
                {item.texto}
                {item.datos && item.datos.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {item.datos.map((d, j) => (
                      <div key={j} style={{ flex: 1, background: "#fff", borderRadius: 8, padding: "5px 6px" }}>
                        <small style={{ display: "block", fontSize: 10, color: "#666" }}>{d.etiqueta}</small>
                        <b style={{ fontSize: 12.5 }}>{d.valor}</b>
                      </div>
                    ))}
                  </div>
                )}
                {item.miniaturas && item.miniaturas.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                    {item.miniaturas.map((url, j) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={j} src={url} alt="" style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 6 }} />
                    ))}
                  </div>
                )}
                {item.enlaceCampanaId && (
                  <Link href={`/campanas?highlight=${item.enlaceCampanaId}`} style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "#534AB7", fontWeight: 600, textDecoration: "underline" }}>
                    Ver campaña
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={finRef} />
      </div>

      <div style={{ borderTop: "1px solid #eee", padding: 12 }}>
        <button
          onClick={() => onPreguntarAlDirector(`Cuéntame más sobre lo que ha hecho el ${NOMBRE_CHAT[asistente as ChatEquipoId]}`)}
          style={{ width: "100%", background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Preguntarle al Director sobre esto
        </button>
      </div>
    </div>
  );
}
