"use client";
// Lista de chats al abrir la burbuja, estilo WhatsApp
// (docs/diseno/director_lista_chats.html). "Equipo" lleva a la página
// completa /equipo (no se reconstruye toda su lógica de propuestas/
// historial dentro de un panel de 360px) -- los demás abren su chat
// individual dentro de la burbuja. Los 6 asistentes reales (no solo
// los 3 con evento automático materializado) viven en una sección
// "Asistentes" desplegable, con un contador agregado en su encabezado.
import { useEffect, useState } from "react";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import { NOMBRE_CHAT, ESFERA_POR_CHAT, ASISTENTES_CON_CHAT_PROPIO, type ChatEquipoId } from "@/app/lib/director/chatsEquipo";

type ResumenChat = { previa: { texto: string; creadoEn: string } | null; noLeidos: number };

function tiempoCorto(iso: string): string {
  const diffMin = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diffMin < 60) return "ahora";
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}h`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function FilaChat({ id, resumen, onAbrir }: { id: ChatEquipoId; resumen: ResumenChat | undefined; onAbrir: () => void }) {
  const esSoporte = id === "soporte";
  const esEquipo = id === "equipo";
  return (
    <button
      onClick={onAbrir}
      style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "10px 14px", border: "none", borderBottom: "1px solid #f0f0f0", background: esEquipo ? "#F3F2FE" : "#fff", cursor: "pointer", textAlign: "left" }}
    >
      {esEquipo ? (
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
          {resumen?.previa && <span style={{ fontSize: 11, color: "#999", flexShrink: 0 }}>{tiempoCorto(resumen.previa.creadoEn)}</span>}
        </div>
        <p style={{ fontSize: 12.5, color: "#888", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {resumen?.previa?.texto ?? (esSoporte ? "¿Dudas sobre cómo usar Quiubot?" : "Sin mensajes todavía")}
        </p>
      </div>

      {!!resumen?.noLeidos && (
        <span style={{ background: "#25D366", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flexShrink: 0 }}>
          {resumen.noLeidos}
        </span>
      )}
    </button>
  );
}

export default function ListaChats({ onAbrirChat, onAbrirEquipo }: { onAbrirChat: (chat: ChatEquipoId) => void; onAbrirEquipo: () => void }) {
  const [resumen, setResumen] = useState<Record<ChatEquipoId, ResumenChat> | null>(null);
  const [asistentesAbiertos, setAsistentesAbiertos] = useState(false);

  useEffect(() => {
    fetch("/api/equipo/chats")
      .then((r) => r.json())
      .then((data) => setResumen(data.chats ?? null))
      .catch(() => setResumen(null));
  }, []);

  const noLeidosAsistentes = ASISTENTES_CON_CHAT_PROPIO.reduce((acc, id) => acc + (resumen?.[id]?.noLeidos ?? 0), 0);

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <FilaChat id="equipo" resumen={resumen?.equipo} onAbrir={onAbrirEquipo} />
      <FilaChat id="director" resumen={resumen?.director} onAbrir={() => onAbrirChat("director")} />

      <button
        onClick={() => setAsistentesAbiertos((v) => !v)}
        style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "8px 14px", border: "none", borderBottom: "1px solid #f0f0f0", background: "#F8F8F6", cursor: "pointer" }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.04em", flex: 1, textAlign: "left" }}>
          {asistentesAbiertos ? "▾" : "▸"} Asistentes
        </span>
        {!!noLeidosAsistentes && (
          <span style={{ background: "#25D366", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
            {noLeidosAsistentes}
          </span>
        )}
      </button>

      {asistentesAbiertos && ASISTENTES_CON_CHAT_PROPIO.map((id) => <FilaChat key={id} id={id} resumen={resumen?.[id]} onAbrir={() => onAbrirChat(id)} />)}

      <FilaChat id="soporte" resumen={resumen?.soporte} onAbrir={() => onAbrirChat("soporte")} />
    </div>
  );
}
