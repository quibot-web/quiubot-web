import { useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { interpolarSeguro } from "../interpolarSeguro";

// Fase B v2.0 (docs/diseno/plan_contenido_organico_fase_b_v2.md,
// punto 7). La narración (voz_url de generarVoz()), siempre a volumen
// completo -- es la capa de audio principal, música y efectos se
// acomodan alrededor de ella (ver CapaMusicaConDucking.tsx), nunca al
// revés.
//
// SE MONTA UNA (O VARIAS, ver construirTramosAudio en
// compactarPausas.ts) POR ESCENA, dentro de su propio
// TransitionSeries.Sequence, nunca una sola global para todo el
// reel: tiemposRender trae PAUSAS reales entre escenas (ej. e1
// termina en 2.78s, e2 no arranca a hablar sino hasta 3.6s) que el
// VIDEO salta (cero cuadros de hueco entre escenas), pero que existen
// en el archivo de audio fuente. Una sola <Audio> de punta a punta se
// desincroniza del video después de la primera escena. trimBefore/
// trimAfter de @remotion/media son en CUADROS del archivo fuente
// (confirmado en node_modules/@remotion/media/dist/esm/index.mjs,
// dividen por fps) -- cada tramo recorta exactamente su propio rango
// de la toma cruda, así que lo que se oye siempre es lo que se dijo
// ahí, nunca otra cosa.
//
// Ronda H: ahora puede haber varios tramos cortos por escena (cuando
// se compactó una pausa interna larga) -- un corte seco en el límite
// exacto de un tramo se oye como un "clic". 15ms de fade alcanza para
// evitarlo sin notarse, y con duracionCuadros corto (un tramo de una
// sola palabra) se recorta a la mitad de esa duración para no dejar
// toda la palabra como un fundido en vez de sonido pleno.
const SEGUNDOS_FADE = 0.015;

// Pura y exportada aparte (mismo criterio que calcularCurvaDucking en
// CapaMusicaConDucking.tsx) para poder probarla con tiempos extremos
// sin necesitar el contexto de Remotion (useCurrentFrame/<Audio>
// exigen un Player/composición real).
//
// Bug real que tumbó un render en staging: a 30fps, 15ms redondea a 0
// cuadros -- el rango de abajo quedaba [0, 0, duracionCuadros,
// duracionCuadros], que interpolate() rechaza por no ser
// estrictamente creciente. Si el fundido no llega a durar ni 1 cuadro,
// no tiene sentido fingir uno: se deja el tramo a volumen pleno
// completo (nunca hubo "clic" que evitar si no hay fundido).
// interpolarSeguro() queda como red de seguridad para el caso
// restante (fade>=1 pero duracionCuadros muy chico, ej.
// duracionCuadros=2*fade, que también puede colisionar en el punto
// medio).
export function calcularVolumenConFade(frame: number, duracionCuadros: number, fps: number): number {
  const fade = Math.min(Math.round(SEGUNDOS_FADE * fps), Math.floor(duracionCuadros / 2));
  if (fade < 1) return 1;
  return interpolarSeguro(frame, [0, fade, duracionCuadros - fade, duracionCuadros], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

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
  const volumen = calcularVolumenConFade(frame, duracionCuadros, fps);

  return <Audio src={url} trimBefore={trimBefore} trimAfter={trimAfter} volume={volumen} />;
}
