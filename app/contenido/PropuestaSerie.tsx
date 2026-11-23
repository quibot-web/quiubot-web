"use client";
import { useState } from "react";
import { fechaBogota, hoyBogota } from "@/app/lib/fechaBogota";
import { esFechaFutura } from "@/app/lib/contenido";
import { LIMITE_IDEA, type PropuestaSerie as Propuesta } from "@/app/lib/ideaUsuario";

// "Tu idea para el video" (24 nov 2026): cuando la idea no cabe en un
// reel, se le dice al usuario y se le propone una serie de 2-3 reels. La
// idea nunca se recorta en silencio. El usuario puede ajustar el texto de
// cada parte y elige la fecha de cada una; la parte 1 queda en esta pieza.

function horaBogota(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });
}

function sumarDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00-05:00`);
  d.setUTCDate(d.getUTCDate() + dias);
  return fechaBogota(d);
}

export default function PropuestaSerie({ piezaId, programadaPara, propuesta, onCreada, onCancelar }: { piezaId: string; programadaPara: string; propuesta: Propuesta; onCreada: () => void; onCancelar: () => void }) {
  const base = fechaBogota(new Date(programadaPara)) < hoyBogota() ? hoyBogota() : fechaBogota(new Date(programadaPara));
  const hora = horaBogota(programadaPara);
  // Por defecto, un reel por día a la misma hora; cada fecha se puede cambiar.
  const [partes, setPartes] = useState(propuesta.partes.map((p, i) => ({ ...p, fecha: sumarDias(base, i), hora })));
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cambiar(i: number, cambios: Partial<(typeof partes)[number]>) {
    setPartes((prev) => prev.map((p, k) => (k === i ? { ...p, ...cambios } : p)));
  }

  async function crear() {
    const conFecha = partes.map((p) => ({ idea: p.idea.trim(), programada_para: `${p.fecha}T${p.hora}:00-05:00` }));
    if (conFecha.some((p) => !esFechaFutura(p.programada_para))) return setError("Cada parte necesita una fecha y hora futuras.");
    if (conFecha.some((p) => p.idea.length < 3)) return setError("Cada parte necesita su idea.");
    setCreando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contenido/${piezaId}/serie`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partes: conFecha }) });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "No se pudo crear la serie.");
      onCreada();
    } catch {
      setError("No se pudo crear la serie.");
    } finally {
      setCreando(false);
    }
  }

  return (
    <div style={{ background: "#FFF8E6", border: "1px solid #F2D58A", borderRadius: 14, padding: 18, textAlign: "left", margin: "0 auto 16px", maxWidth: 560 }}>
      <p style={{ fontSize: 14, fontWeight: 800, color: "#5c4200", margin: "0 0 6px" }}>Tu idea no cabe en un solo reel</p>
      <p style={{ fontSize: 13, color: "#5c4200", margin: "0 0 14px" }}>
        {propuesta.motivo} Para no recortarla, te proponemos dividirla en {partes.length} reels. Puedes ajustar el texto de cada parte y elegir su fecha.
      </p>
      {partes.map((p, i) => (
        <div key={i} style={{ background: "#fff", borderRadius: 10, border: "1px solid #eee", padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#333", marginBottom: 6 }}>{i === 0 ? `${p.titulo} (este reel)` : p.titulo}</div>
          <textarea value={p.idea} maxLength={LIMITE_IDEA} rows={4} onChange={(e) => cambiar(i, { idea: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <input type="date" min={hoyBogota()} value={p.fecha} onChange={(e) => cambiar(i, { fecha: e.target.value })} style={{ flex: 1, padding: 6, borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5 }} />
            <input type="time" value={p.hora} onChange={(e) => cambiar(i, { hora: e.target.value })} style={{ flex: 1, padding: 6, borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5 }} />
          </div>
        </div>
      ))}
      {error && <p style={{ fontSize: 12.5, color: "#b91c1c", margin: "0 0 8px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancelar} disabled={creando} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", fontWeight: 600, cursor: "pointer" }}>
          Volver a mi idea
        </button>
        <button type="button" onClick={crear} disabled={creando} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
          {creando ? "Creando…" : `Crear la serie de ${partes.length} reels`}
        </button>
      </div>
    </div>
  );
}
