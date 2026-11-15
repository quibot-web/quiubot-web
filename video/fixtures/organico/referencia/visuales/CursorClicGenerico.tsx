// Visual "cursor que hace clic" (Fase A). Copia fiel de CursorClic en
// video/escenas/Cta.tsx (ya en producción, técnica probada) -- no se
// importa directo de ahí para no acoplar este reel de referencia (que
// no pasa por el sistema Escena, ver el plan) a un archivo que sí
// depende de PropsEscena/tipos de escena.
//
// Se ancla al botón mismo vía position:relative en el contenedor que lo
// envuelve (quien lo use debe envolver su botón en un div con
// position:"relative"), nunca a un punto adivinado de la pantalla.
import { interpolate, spring } from "remotion";

export function CursorClicGenerico({ frame, fps, duracionCuadros }: { frame: number; fps: number; duracionCuadros: number }) {
  const cuadroClic = Math.round(duracionCuadros * 0.6);
  const llegada = interpolate(frame, [fps * 0.3, cuadroClic], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
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
        opacity: interpolate(frame, [0, fps * 0.2], [0, 1], { extrapolateRight: "clamp" }),
        filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))",
      }}
    >
      👆
    </div>
  );
}
