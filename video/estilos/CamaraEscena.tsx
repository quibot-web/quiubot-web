// Cámara del estilo Noche: un acercamiento lento a lo largo de toda la
// escena (nunca quieta) y un "golpe" de zoom en el momento del cambio
// (el evento del visual o la salida de la palabra gigante) -- el cambio
// visual cada 1-2 s de los principios de retención. Solo scale/translate.
import { AbsoluteFill, interpolate, spring } from "remotion";

const ACERCAMIENTO_TOTAL = 0.05;
const GOLPE = 0.045;

export function escalaCamara(frame: number, fps: number, duracionCuadros: number, cuadroGolpe: number | null): number {
  const avance = duracionCuadros > 0 ? Math.min(1, Math.max(0, frame / duracionCuadros)) : 0;
  let golpe = 0;
  if (cuadroGolpe !== null && frame >= cuadroGolpe) {
    const s = spring({ frame: frame - cuadroGolpe, fps, config: { damping: 14, stiffness: 170 } });
    golpe = GOLPE * (1 - s);
  }
  return 1 + ACERCAMIENTO_TOTAL * avance + golpe;
}

export function CamaraEscena({
  frame,
  fps,
  duracionCuadros,
  cuadroGolpe,
  children,
}: {
  frame: number;
  fps: number;
  duracionCuadros: number;
  cuadroGolpe: number | null;
  children: React.ReactNode;
}) {
  const escala = escalaCamara(frame, fps, duracionCuadros, cuadroGolpe);
  // Leve deriva vertical para que el acercamiento no se sienta mecánico.
  const deriva = interpolate(frame, [0, Math.max(1, duracionCuadros)], [0, -12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ transform: `translateY(${deriva}px) scale(${escala})`, transformOrigin: "50% 38%" }}>{children}</AbsoluteFill>;
}
