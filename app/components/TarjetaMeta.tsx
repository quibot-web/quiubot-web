"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Target } from "lucide-react";
import type { AvanceMeta, Meta } from "@/app/lib/metas";

const TIPO_LABEL: Record<string, string> = {
  conversaciones_whatsapp: "conversaciones de WhatsApp",
  leads: "leads",
};

function formatoCop(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

// Bloque "meta" del Inicio -- se resuelve solo, sin depender del fetch
// compartido de home-resumen, porque es admin-only (la API 403-ea a
// cualquiera que no sea admin, así que para el resto esta tarjeta
// simplemente no renderiza nada, igual que un bloque desconocido).
export default function TarjetaMeta() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [visible, setVisible] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [avance, setAvance] = useState<AvanceMeta | null>(null);
  const [pausando, setPausando] = useState(false);

  useEffect(() => {
    fetch("/api/metas")
      .then((r) => {
        if (!r.ok) throw new Error();
        setVisible(true);
        return r.json();
      })
      .then((data) => {
        setMeta(data.meta);
        setAvance(data.avance);
      })
      .catch(() => setVisible(false))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return null;
  if (!visible) return null;

  if (!meta) {
    return (
      <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Target size={18} color="#534AB7" />
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#1a1a1a" }}>Mi meta</p>
        </div>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px" }}>
          Todavía no tienes una meta de Autopiloto activa.
        </p>
        <button
          onClick={() => router.push("/metas/crear")}
          style={{ padding: "10px 18px", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer" }}
        >
          Crear meta
        </button>
      </div>
    );
  }

  const tipoLabel = TIPO_LABEL[meta.tipo] || meta.tipo;
  const conversiones = avance?.conversiones ?? 0;
  const proporcion = Math.min(1, conversiones / meta.cantidad_objetivo);
  const proporcionGasto = Math.min(1, (avance?.spend ?? 0) / meta.presupuesto_maximo_cop);

  let textoDias = "";
  if (avance) {
    if (avance.diasRestantes <= 0) textoDias = "meta vencida";
    else if (avance.diasRestantes === 1) textoDias = "último día";
    else textoDias = `quedan ${avance.diasRestantes} días`;
  }

  const togglePausa = async () => {
    setPausando(true);
    try {
      const res = await fetch(`/api/metas/${meta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pausado_autopiloto: !meta.pausado_autopiloto }),
      });
      const data = await res.json();
      if (res.ok) setMeta(data.meta);
    } finally {
      setPausando(false);
    }
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Target size={18} color="#534AB7" />
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#1a1a1a" }}>Mi meta</p>
        </div>
        <button
          onClick={togglePausa}
          disabled={pausando}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #ddd", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#666", cursor: pausando ? "not-allowed" : "pointer" }}
        >
          {meta.pausado_autopiloto ? <Play size={13} /> : <Pause size={13} />}
          {meta.pausado_autopiloto ? "Reanudar Autopiloto" : "Pausar Autopiloto"}
        </button>
      </div>

      <p style={{ fontSize: 14, color: "#1a1a1a", margin: "0 0 10px" }}>
        {conversiones} de {meta.cantidad_objetivo} {tipoLabel} · {textoDias}
        {avance?.proyeccion != null && ` · a este ritmo llegas a ~${avance.proyeccion}`}
      </p>
      <div style={{ height: 8, borderRadius: 999, background: "#F3F2FE", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${proporcion * 100}%`, background: "#534AB7", borderRadius: 999 }} />
      </div>

      <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 6px" }}>
        Gastado {formatoCop(avance?.spend ?? 0)} de {formatoCop(meta.presupuesto_maximo_cop)}
      </p>
      <div style={{ height: 6, borderRadius: 999, background: "#F3F2FE", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${proporcionGasto * 100}%`, background: proporcionGasto >= 1 ? "#B3261E" : "#9B93E8", borderRadius: 999 }} />
      </div>

      {meta.pausado_autopiloto && (
        <p style={{ fontSize: 12, color: "#B3261E", margin: "14px 0 0" }}>Autopiloto en pausa -- no se generan nuevas propuestas.</p>
      )}
    </div>
  );
}
