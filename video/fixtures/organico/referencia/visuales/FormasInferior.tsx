// "El fondo de la zona inferior (fuera de la zona segura) puede llevar
// formas o movimiento suave de marca... pero sin texto ni información"
// (pedido explícito, v3). Puramente decorativo -- 2 formas más, en la
// banda de abajo (65%-100%, fuera de ZONA_SEGURA.abajo), con deriva
// lenta igual que las 2 que ya tiene FondoMarca. Capa aparte en vez de
// agregarlas a FondoMarca.tsx (archivo real de producción, compartido
// por todos los anuncios) para no arriesgar nada ahí -- esto vive solo
// en el reel de referencia.
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export function FormasInferior() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const deriva = interpolate(frame, [0, Math.max(durationInFrames, 1)], [0, 8], { extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: "30%",
          aspectRatio: "1",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          bottom: `${4 + deriva * 0.4}%`,
          right: `${10 - deriva}%`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "22%",
          aspectRatio: "1",
          borderRadius: "50%",
          background: "rgba(0,0,0,0.10)",
          bottom: `${-6 + deriva * 0.3}%`,
          left: `${18 + deriva}%`,
        }}
      />
    </div>
  );
}
