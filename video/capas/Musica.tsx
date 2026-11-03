import { Audio, interpolate, useVideoConfig } from "remotion";

const SEGUNDOS_FADE = 0.5;

export function CapaMusica({ url, volumen }: { url: string; volumen: number }) {
  const { fps, durationInFrames } = useVideoConfig();
  const fade = Math.round(SEGUNDOS_FADE * fps);

  return (
    <Audio
      src={url}
      volume={(f) =>
        interpolate(f, [0, fade, durationInFrames - fade, durationInFrames], [0, volumen, volumen, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  );
}
