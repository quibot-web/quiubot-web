import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";

// Fase B v2.0 (docs/diseno/plan_contenido_organico_fase_b_v2.md,
// punto 7). La narración completa (voz_url de generarVoz()), siempre
// a volumen completo -- es la capa de audio principal, música y
// efectos se acomodan alrededor de ella (ver CapaMusicaConDucking.tsx),
// nunca al revés. Mismo truco de fade de 0.1s en los bordes que
// capas/Musica.tsx (evita un "clic" audible si el audio generado no
// empieza/termina en silencio absoluto).
const SEGUNDOS_FADE = 0.1;

export function CapaVoz({ url }: { url: string }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fade = Math.round(SEGUNDOS_FADE * fps);
  const volumen = interpolate(frame, [0, fade, durationInFrames - fade, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <Audio src={url} volume={volumen} />;
}
