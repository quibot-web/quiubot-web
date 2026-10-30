"use client";
import { useState } from "react";
import { Pause, Play, X } from "lucide-react";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { AvanceMeta, Meta } from "@/app/lib/metas";

export const TIPO_LABEL: Record<string, string> = {
  conversaciones_whatsapp: "conversaciones de WhatsApp",
  leads: "leads",
  ventas_web: "ventas en tu sitio web",
  visitas_web: "visitas a tu sitio web",
  seguidores_facebook: "seguidores de Facebook",
  seguidores_instagram: "seguidores de Instagram",
};

// Solo seguidores_instagram se mide por foto de perfil, no por campaña
// propia (ver calcularAvanceSeguidoresInstagram en app/lib/metas.ts) --
// esto es lo que distingue esta meta de todas las demás: cuenta
// cualquier seguidor nuevo, no solo los que llegaron por un anuncio.
const TIPOS_POR_FOTO = new Set(["seguidores_instagram"]);

function formatoCop(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

// Una meta, con su avance -- usado tanto en "Mis metas" del Inicio
// (compacta) como en /metas (completa, con el botón de cancelar). Antes
// esto vivía repetido una sola vez en TarjetaMeta.tsx, cuando solo podía
// existir una meta activa; ahora se repite una fila por cada una (hasta
// una por tipo).
export default function FilaMeta({
  meta,
  avance,
  compacta = false,
  onCambio,
}: {
  meta: Meta;
  avance: AvanceMeta | null;
  compacta?: boolean;
  onCambio: (meta: Meta) => void;
}) {
  const [procesando, setProcesando] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const tipoLabel = TIPO_LABEL[meta.tipo] || meta.tipo;
  const porFoto = TIPOS_POR_FOTO.has(meta.tipo);
  const conversiones = avance?.conversiones ?? 0;
  // porFoto puede dar conversiones negativas (el perfil perdió más
  // seguidores de los que ganó) -- una barra no puede tener ancho
  // negativo.
  const proporcion = Math.max(0, Math.min(1, conversiones / meta.cantidad_objetivo));
  const proporcionGasto = Math.min(1, (avance?.spend ?? 0) / meta.presupuesto_maximo_cop);

  let textoDias = "";
  if (avance) {
    if (avance.diasRestantes <= 0) textoDias = "meta vencida";
    else if (avance.diasRestantes === 1) textoDias = "último día";
    else textoDias = `quedan ${avance.diasRestantes} días`;
  }

  const togglePausa = async () => {
    setProcesando(true);
    try {
      const res = await fetch(`/api/metas/${meta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pausado_autopiloto: !meta.pausado_autopiloto }),
      });
      const data = await res.json();
      if (res.ok) onCambio(data.meta);
    } finally {
      setProcesando(false);
    }
  };

  const cancelar = async () => {
    setProcesando(true);
    try {
      const res = await fetch(`/api/metas/${meta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "cancelada" }),
      });
      const data = await res.json();
      if (res.ok) onCambio(data.meta);
    } finally {
      setProcesando(false);
      setConfirmandoCancelar(false);
    }
  };

  return (
    <div style={{ background: compacta ? "transparent" : "#fff", border: compacta ? "none" : "1px solid #ece9f9", borderRadius: compacta ? 0 : 16, padding: compacta ? 0 : "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <EsferaAsistente asistente="director" estado={meta.pausado_autopiloto ? "pausa" : "normal"} tamano={compacta ? 48 : 64} />
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#1a1a1a", textTransform: "capitalize" }}>{tipoLabel}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={togglePausa}
            disabled={procesando}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #ddd", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#666", cursor: procesando ? "not-allowed" : "pointer" }}
          >
            {meta.pausado_autopiloto ? <Play size={13} /> : <Pause size={13} />}
            {meta.pausado_autopiloto ? "Reanudar" : "Pausar"}
          </button>
          {!compacta &&
            (confirmandoCancelar ? (
              <button
                onClick={cancelar}
                disabled={procesando}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#FEF0EF", border: "1px solid #F3B4AE", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#B3261E", cursor: procesando ? "not-allowed" : "pointer" }}
              >
                ¿Seguro? Cancelar
              </button>
            ) : (
              <button
                onClick={() => setConfirmandoCancelar(true)}
                disabled={procesando}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #ddd", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#888", cursor: procesando ? "not-allowed" : "pointer" }}
              >
                <X size={13} />
                Cancelar
              </button>
            ))}
        </div>
      </div>

      <p style={{ fontSize: 14, color: "#1a1a1a", margin: "0 0 10px" }}>
        {conversiones} de {meta.cantidad_objetivo} {tipoLabel} · {textoDias}
        {avance?.proyeccion != null && ` · a este ritmo llegas a ~${avance.proyeccion}`}
      </p>
      {porFoto && (
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>
          Crecimiento total de tu perfil (incluye seguidores que llegan sin anuncios).
        </p>
      )}
      <div style={{ height: 8, borderRadius: 999, background: "#F3F2FE", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${proporcion * 100}%`, background: "#534AB7", borderRadius: 999 }} />
      </div>

      {!porFoto && (
        <>
          <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 6px" }}>
            Gastado {formatoCop(avance?.spend ?? 0)} de {formatoCop(meta.presupuesto_maximo_cop)}
          </p>
          <div style={{ height: 6, borderRadius: 999, background: "#F3F2FE", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${proporcionGasto * 100}%`, background: proporcionGasto >= 1 ? "#B3261E" : "#9B93E8", borderRadius: 999 }} />
          </div>
        </>
      )}

      {meta.pausado_autopiloto && (
        <p style={{ fontSize: 12, color: "#B3261E", margin: "14px 0 0" }}>Autopiloto en pausa -- no se generan nuevas propuestas para esta meta.</p>
      )}
    </div>
  );
}
