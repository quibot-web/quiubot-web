"use client";
// Fase 2, Commit 5 -- lista de chats al abrir la burbuja, estilo
// WhatsApp (docs/diseno/director_lista_chats.html). "Equipo" lleva a la
// página completa /equipo (no se reconstruye toda su lógica de
// propuestas/historial dentro de un panel de 360px) -- los demás abren
// su chat individual dentro de la burbuja.
import { useEffect, useState } from "react";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import { CHATS_EQUIPO, NOMBRE_CHAT, ESFERA_POR_CHAT, type ChatEquipoId } from "@/app/lib/director/chatsEquipo";

type ResumenChat = { previa: { texto: string; creadoEn: string } | null; noLeidos: number };

function tiempoCorto(iso: string): string {
  const diffMin = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diffMin < 60) return "ahora";
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}h`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

export default function ListaChats({ onAbrirChat, onAbrirEquipo }: { onAbrirChat: (chat: ChatEquipoId) => void; onAbrirEquipo: () => void }) {
  const [resumen, setResumen] = useState<Record<ChatEquipoId, ResumenChat> | null>(null);

  useEffect(() => {
    fetch("/api/equipo/chats")
      .then((r) => r.json())
      .then((data) => setResumen(data.chats ?? null))
      .catch(() => setResumen(null));
  }, []);

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      {CHATS_EQUIPO.map((id, i) => {
        const r = resumen?.[id];
        const esSoporte = id === "soporte";
        return (
          <div key={id}>
            {i === 2 && <div style={{ padding: "6px 14px", fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.04em", background: "#F8F8F6" }}>Asistentes</div>}
            <button
              onClick={() => (id === "equipo" ? onAbrirEquipo() : onAbrirChat(id))}
              style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "10px 14px", border: "none", borderBottom: "1px solid #f0f0f0", background: id === "equipo" ? "#F3F2FE" : "#fff", cursor: "pointer", textAlign: "left" }}
            >
              {id === "equipo" ? (
                <div style={{ display: "flex", flexShrink: 0 }}>
                  <div style={{ marginRight: -10 }}>
                    <EsferaAsistente asistente="director" estado="normal" tamano={32} />
                  </div>
                  <div style={{ marginRight: -10 }}>
                    <EsferaAsistente asistente="analista" estado="normal" tamano={32} />
                  </div>
                  <EsferaAsistente asistente="creativo" estado="normal" tamano={32} />
                </div>
              ) : esSoporte ? (
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#B7BDC9", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>?</div>
              ) : (
                <EsferaAsistente asistente={ESFERA_POR_CHAT[id]!} estado="normal" tamano={40} />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <b style={{ fontSize: 14, color: "#1a1a1a" }}>{NOMBRE_CHAT[id]}</b>
                  {r?.previa && <span style={{ fontSize: 11, color: "#999", flexShrink: 0 }}>{tiempoCorto(r.previa.creadoEn)}</span>}
                </div>
                <p style={{ fontSize: 12.5, color: "#888", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r?.previa?.texto ?? (esSoporte ? "¿Dudas sobre cómo usar Quiubot?" : "Sin mensajes todavía")}
                </p>
              </div>

              {!!r?.noLeidos && (
                <span style={{ background: "#25D366", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flexShrink: 0 }}>
                  {r.noLeidos}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
