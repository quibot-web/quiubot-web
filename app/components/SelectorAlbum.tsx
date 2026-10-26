"use client";

// Extraído tal cual del modal que ya vivía inline en app/estrategia/
// page.tsx (paso "album-selector") -- mismo markup, mismo comportamiento,
// solo parametrizado para poder usarse también desde ElegirEstrategia.tsx
// (elegir álbum dentro de la propia tarjeta del anuncio, en vez de en un
// paso aparte). yaUsadaPorId es opcional: si no se pasa, se comporta
// exactamente igual que antes (ningún aviso sobre las miniaturas).
export type ItemAlbum = { url_imagen: string; tipo: string; public_id: string };

type Props = {
  titulo: string;
  items: ItemAlbum[];
  onElegir: (item: ItemAlbum) => void;
  onCerrar: () => void;
  yaUsadaPorId?: Record<string, string>;
};

export default function SelectorAlbum({ titulo, items, onElegir, onCerrar, yaUsadaPorId }: Props) {
  return (
    <div
      onClick={onCerrar}
      style={{ position: "fixed", inset: 0, background: "rgba(23,21,43,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "80vh", overflowY: "auto", padding: "1.5rem" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>{titulo}</p>
          <button onClick={onCerrar} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
          {items.map((item, i) => {
            const itemId = item.public_id || item.url_imagen;
            const yaUsada = yaUsadaPorId?.[itemId];
            return (
              <div
                key={itemId || i}
                onClick={() => onElegir(item)}
                style={{ position: "relative", borderRadius: 8, overflow: "hidden", cursor: "pointer", border: "1px solid #e8e8e6" }}
              >
                {item.tipo === "video" ? (
                  <video src={item.url_imagen} style={{ width: "100%", height: 90, objectFit: "cover", background: "#000", display: "block" }} muted />
                ) : (
                  <img src={item.url_imagen} alt="" style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
                )}
                {yaUsada && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,.65)", color: "#fff", fontSize: 10, padding: "3px 6px", textAlign: "center", lineHeight: 1.3 }}>
                    Ya usada en {yaUsada}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
