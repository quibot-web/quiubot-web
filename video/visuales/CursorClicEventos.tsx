// Adaptado de video/fixtures/organico/referencia/visuales/
// CursorClicGenerico.tsx (Fase A, aprobado) -- la técnica visual es
// idéntica (mismo cursor 👆, misma trayectoria/escala de "clic"), pero
// esa versión calculaba su propio cuadroClic como 60% de
// duracionCuadros (una escena de duración fija). Acá el clic cae en un
// cuadro EXPLÍCITO, resuelto por video/visuales/index.tsx desde
// visual.eventos (palabra -> tiempo real de generarVoz()), porque la
// Fase B v2.0 ya no tiene una "duración de escena" fija de la que
// adivinar un 60%.
import { interpolate, spring } from "remotion";

export function CursorClicEventos({ frame, fps, cuadroAparece, cuadroClic }: { frame: number; fps: number; cuadroAparece: number; cuadroClic: number }) {
  const llegada = interpolate(frame, [cuadroAparece, cuadroClic], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const clic = spring({ frame: frame - cuadroClic, fps, config: { damping: 6, mass: 0.4 } });
  const escalaCursor = 1 - Math.sin(Math.min(clic, 1) * Math.PI) * 0.3;
  return (
    <div
      style={{
        position: "absolute",
        fontSize: 104,
        right: `${interpolate(llegada, [0, 1], [-34, 4])}%`,
        bottom: `${interpolate(llegada, [0, 1], [-70, -22])}%`,
        transform: `scale(${escalaCursor}) rotate(-20deg)`,
        opacity: interpolate(frame, [cuadroAparece, cuadroAparece + fps * 0.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))",
      }}
    >
      👆
    </div>
  );
}
