import { useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { interpolarSeguro } from "../interpolarSeguro";

const SEGUNDOS_FADE = 0.5;

// @remotion/media ya no recomienda volume como función por cuadro (la
// propia doc lo marca "no longer recommended") -- se precalcula el
// número con useCurrentFrame()/interpolate() en vez del callback, mismo
// fade de entrada/salida de siempre, solo que resuelto afuera.
//
// Con un video muy corto (durationInFrames < 2*fade) los 4 puntos de
// abajo pueden empatarse o invertirse -- interpolarSeguro() (la misma
// protección que ya usa el fundido de voz de Fase B v2.0, CapaVoz.tsx)
// evita el "inputRange must be strictly monotonically increasing".
// Pura y exportada aparte para poder probarla con tiempos extremos sin
// el contexto de Remotion.
export function calcularVolumenDeMusica(frame: number, durationInFrames: number, fps: number, volumen: number): number {
  const fade = Math.min(Math.round(SEGUNDOS_FADE * fps), Math.floor(durationInFrames / 2));
  if (fade < 1) return volumen;
  return interpolarSeguro(frame, [0, fade, durationInFrames - fade, durationInFrames], [0, volumen, volumen, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function CapaMusica({ url, volumen }: { url: string; volumen: number }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const volumenEnEsteCuadro = calcularVolumenDeMusica(frame, durationInFrames, fps, volumen);

  return <Audio src={url} volume={volumenEnEsteCuadro} />;
}
