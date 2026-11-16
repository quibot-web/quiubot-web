import { interpolate, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";

// Fase B v2.0 (docs/diseno/plan_contenido_organico_fase_b_v2.md,
// punto 7). La narración (voz_url de generarVoz()), siempre a volumen
// completo -- es la capa de audio principal, música y efectos se
// acomodan alrededor de ella (ver CapaMusicaConDucking.tsx), nunca al
// revés.
//
// SE MONTA UNA POR ESCENA (dentro de su propio TransitionSeries.Sequence),
// nunca una sola global para todo el reel: tiemposRender trae PAUSAS
// reales entre escenas (ej. e1 termina en 2.78s, e2 no arranca a
// hablar sino hasta 3.6s) que el VIDEO salta (cero cuadros de hueco
// entre escenas), pero que existen en el archivo de audio fuente. Una
// sola <Audio> de punta a punta se desincroniza del video después de
// la primera escena. trimBefore/trimAfter de @remotion/media son en
// CUADROS del archivo fuente (confirmado en
// node_modules/@remotion/media/dist/esm/index.mjs, dividen por fps)
// -- cada escena recorta exactamente su propio tramo
// [inicio_s, fin_s] de tiemposRender, así que lo que se oye siempre
// es lo que esa escena puntual dijo.
const SEGUNDOS_FADE = 0.1;

export function CapaVoz({
  url,
  trimBefore,
  trimAfter,
  duracionCuadros,
  fps,
}: {
  url: string;
  trimBefore: number;
  trimAfter: number;
  duracionCuadros: number;
  fps: number;
}) {
  const frame = useCurrentFrame();
  const fade = Math.min(Math.round(SEGUNDOS_FADE * fps), Math.floor(duracionCuadros / 2));
  const volumen = interpolate(frame, [0, fade, duracionCuadros - fade, duracionCuadros], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <Audio src={url} trimBefore={trimBefore} trimAfter={trimAfter} volume={volumen} />;
}
