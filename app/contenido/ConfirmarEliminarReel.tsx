"use client";

import { useEffect, useState } from "react";

// Confirmación de "Eliminar este reel" (borrado suave: estado
// "cancelada", el video se queda en el álbum). El texto lo arma el
// servidor (PATCH accion "previa_eliminar"): sabe si la pieza ya está
// publicada, si se está publicando ahora mismo, o si es la parte 1 de
// una serie con su parte 2 fuera de la semana/mes que se está mirando.
// Lo usan el menú "⋯" de la tarjeta del calendario y la pantalla de la
// pieza -- un solo lugar para el texto y el flujo.
type Previa = { titulo: string; detalles: string[]; boton: string };

export default function ConfirmarEliminarReel({ piezaId, onCerrar, onEliminado }: { piezaId: string; onCerrar: () => void; onEliminado: () => void }) {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/contenido/${piezaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "previa_eliminar" }),
        });
        const data = await res.json();
        if (cancelado) return;
        if (!res.ok) setError(data.error || "No se puede eliminar este reel ahora.");
        else setPrevia({ titulo: data.titulo, detalles: data.detalles ?? [], boton: data.boton });
      } catch {
        if (!cancelado) setError("No se pudo revisar este reel. Intenta de nuevo.");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [piezaId]);

  async function confirmar() {
    setEliminando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contenido/${piezaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "eliminar" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo eliminar el reel.");
        setPrevia(null);
        return;
      }
      onEliminado();
    } catch {
      setError("No se pudo eliminar el reel.");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && !eliminando) onCerrar();
      }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}
    >
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 400, fontFamily: "system-ui, sans-serif" }}>
        {!previa && !error && <p style={{ fontSize: 14, color: "#666", margin: 0 }}>Revisando el reel…</p>}

        {error && (
          <>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#8A1F1F", margin: "0 0 14px" }}>{error}</p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={onCerrar} style={botonSecundario}>
                Entendido
              </button>
            </div>
          </>
        )}

        {previa && !error && (
          <>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", margin: "0 0 10px" }}>{previa.titulo}</p>
            {previa.detalles.map((d, i) => (
              <p key={i} style={{ fontSize: 13, color: "#555", margin: "0 0 8px", lineHeight: 1.45 }}>
                {d}
              </p>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
              <button type="button" onClick={onCerrar} disabled={eliminando} style={botonSecundario}>
                No, dejarlo
              </button>
              <button type="button" onClick={confirmar} disabled={eliminando} style={{ ...botonSecundario, background: "#B91C1C", borderColor: "#B91C1C", color: "#fff" }}>
                {eliminando ? "Eliminando…" : previa.boton}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const botonSecundario: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 10,
  border: "1.5px solid #ddd",
  background: "#fff",
  color: "#1a1a1a",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
