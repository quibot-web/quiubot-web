import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";

const SEGUNDOS_FADE = 0.5;

// @remotion/media ya no recomienda volume como función por cuadro (la
// propia doc lo marca "no longer recommended") -- se precalcula el
// número con useCurrentFrame()/interpolate() en vez del callback, mismo
// fade de entrada/salida de siempre, solo que resuelto afuera.
export function CapaMusica({ url, volumen }: { url: string; volumen: number }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fade = Math.round(SEGUNDOS_FADE * fps);
  const volumenEnEsteCuadro = interpolate(frame, [0, fade, durationInFrames - fade, durationInFrames], [0, volumen, volumen, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <Audio src={url} volume={volumenEnEsteCuadro} />;
}
