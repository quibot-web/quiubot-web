// Visual del gancho, v3 (reemplaza al marcador "? de 2"): 2 tarjetas
// boca abajo, una por cada mito que viene -- con movimiento propio
// (vaivén + rotación chica, desfasados entre sí) para que nada quede
// quieto mientras el titular plantea el tema.
import { TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";

export function TarjetasMitoBocaAbajo({ frame, fps, total }: { frame: number; fps: number; total: number }) {
  const t = frame / fps;

  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE + 4}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: "32%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 28,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const fase = i * 0.5;
        const bob = Math.sin(((t + fase) / 1.8) * Math.PI * 2) * 12;
        const rot = Math.sin(((t + fase) / 2.4) * Math.PI * 2) * (i % 2 === 0 ? 3 : -3);
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: "100%",
              background: "#fff",
              borderRadius: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
              transform: `translateY(${bob}px) rotate(${rot}deg)`,
            }}
          >
            <span style={{ fontSize: 110, fontWeight: 900, color: "#ccc" }}>?</span>
          </div>
        );
      })}
    </div>
  );
}
