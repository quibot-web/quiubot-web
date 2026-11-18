// Cámara del estilo Noche: un acercamiento lento a lo largo de toda la
// escena (nunca quieta) y un "golpe" de zoom en el momento del cambio
// (el evento del visual o la salida de la palabra gigante) -- el cambio
// visual cada 1-2 s de los principios de retención. Solo scale/translate.
import { AbsoluteFill, interpolate, spring } from "remotion";

const ACERCAMIENTO_TOTAL = 0.05;
const GOLPE = 0.045;

// Varios golpes: el del cambio principal y los de relleno del control
// "cambio cada 2 s" (ritmo.ts). Cuenta solo el más reciente.
export function escalaCamara(frame: number, fps: number, duracionCuadros: number, cuadrosGolpe: number[]): number {
  const avance = duracionCuadros > 0 ? Math.min(1, Math.max(0, frame / duracionCuadros)) : 0;
  const pasados = cuadrosGolpe.filter((c) => frame >= c);
  let golpe = 0;
  if (pasados.length > 0) {
    const ultimo = Math.max(...pasados);
    const s = spring({ frame: frame - ultimo, fps, config: { damping: 14, stiffness: 170 } });
    golpe = GOLPE * (1 - s);
  }
  return 1 + ACERCAMIENTO_TOTAL * avance + golpe;
}

export function CamaraEscena({
  frame,
  fps,
  duracionCuadros,
  cuadrosGolpe,
  children,
}: {
  frame: number;
  fps: number;
  duracionCuadros: number;
  cuadrosGolpe: number[];
  children: React.ReactNode;
}) {
  const escala = escalaCamara(frame, fps, duracionCuadros, cuadrosGolpe);
  // Leve deriva vertical para que el acercamiento no se sienta mecánico.
  const deriva = interpolate(frame, [0, Math.max(1, duracionCuadros)], [0, -12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ transform: `translateY(${deriva}px) scale(${escala})`, transformOrigin: "50% 38%" }}>{children}</AbsoluteFill>;
}
