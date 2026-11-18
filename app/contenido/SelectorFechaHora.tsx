"use client";

import { useState } from "react";
import { hoyBogota, fechaBogota } from "@/app/lib/fechaBogota";
import { ESTADOS_NO_REPROGRAMABLES, esFechaFutura, type PublicacionOrganica } from "@/app/lib/contenido";

// Cambiar fecha y hora de un reel desde su pantalla (además del
// arrastre en el calendario). Misma convención de offset de Bogotá que
// el formulario de crear (`${fecha}T${hora}:00-05:00`) y la misma
// validación del servidor (PATCH accion "reprogramar"): nunca en el
// pasado, nunca en publicando/procesando/publicada/cancelada. Una pieza
// vencida dice "Reprogramar": el servidor la deja en "lista" si ya
// tiene video, o en "aprobada"/"borrador" según cómo estaba antes.
function horaBogota(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" });
}

export default function SelectorFechaHora({ pieza, onGuardado }: { pieza: PublicacionOrganica; onGuardado: () => void }) {
  const hoy = hoyBogota();
  const fechaActual = fechaBogota(new Date(pieza.programada_para));
  const [fecha, setFecha] = useState(fechaActual < hoy ? hoy : fechaActual);
  const [hora, setHora] = useState(horaBogota(pieza.programada_para));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ESTADOS_NO_REPROGRAMABLES.includes(pieza.estado)) return null;
  const esVencida = pieza.estado === "vencida";
  const sinCambios = !esVencida && fecha === fechaActual && hora === horaBogota(pieza.programada_para);

  async function guardar() {
    setError(null);
    const programada_para = `${fecha}T${hora}:00-05:00`;
    if (fecha < hoy || !esFechaFutura(programada_para)) {
      setError("Elige una fecha y hora que todavía no hayan pasado.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/contenido/${pieza.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "reprogramar", programada_para }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo cambiar la fecha.");
        return;
      }
      onGuardado();
    } catch {
      setError("No se pudo cambiar la fecha.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ background: esVencida ? "#FEF6E7" : "#fff", border: `1px solid ${esVencida ? "#F0C36D" : "#e5e5e5"}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: esVencida ? "#8A6416" : "#1a1a1a", margin: "0 0 10px" }}>
        {esVencida ? "Se pasó la hora de este reel. Elige una nueva para reprogramarlo." : "Fecha y hora de publicación"}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} style={campo} aria-label="Fecha" />
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={campo} aria-label="Hora" />
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || sinCambios}
          style={{ ...boton, opacity: guardando || sinCambios ? 0.5 : 1, cursor: guardando || sinCambios ? "default" : "pointer" }}
        >
          {guardando ? "Guardando…" : esVencida ? "Reprogramar" : "Cambiar fecha"}
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: "#B91C1C", margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}

const campo: React.CSSProperties = { padding: "8px 10px", borderRadius: 10, border: "1.5px solid #ddd", fontSize: 14, fontFamily: "inherit" };
const boton: React.CSSProperties = { padding: "9px 16px", borderRadius: 10, border: "none", background: "#534AB7", color: "#fff", fontSize: 13, fontWeight: 700 };
