import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { corregirRangoCreciente } from "../interpolarSeguro";

// Fase B v2.0 (docs/diseno/plan_contenido_organico_fase_b_v2.md,
// punto 7). Variante de capas/Musica.tsx SOLO para el reel automático
// -- deliberadamente NO se modifica el componente compartido (lo usan
// anuncios y las 6 recetas orgánicas de siempre, ninguna tiene voz):
// agregarle "ducking" ahí sumaría una rama de código a producción para
// un caso que hoy solo existe acá. Mismo truco de fade que
// capas/Musica.tsx (interpolate() precalculado, @remotion/media ya no
// recomienda volume como callback por cuadro).
//
// Las escenas de este reel narran de corrido (sin pausas de silencio
// real entre ellas, misma pista de audio generada de punta a punta
// por generarVoz()) -- "ducking" acá es UNA sola ventana continua
// (desde que empieza a hablar hasta que termina), no N ventanas con
// huecos. Si una futura receta sí tiene pausas reales entre bloques
// de narración, esto necesita generalizarse a varias ventanas.
const SEGUNDOS_FADE_BORDE = 0.5;
const SEGUNDOS_FADE_DUCKING = 0.3;

export function calcularCurvaDucking(params: {
  fps: number;
  durationInFrames: number;
  volumenNormal: number;
  volumenConVoz: number;
  inicioVoz_s: number;
  finVoz_s: number;
}): { puntos: number[]; valores: number[] } {
  const { fps, durationInFrames, volumenNormal, volumenConVoz, inicioVoz_s, finVoz_s } = params;
  const cuadroFadeBorde = Math.round(SEGUNDOS_FADE_BORDE * fps);
  const cuadroFadeDucking = Math.round(SEGUNDOS_FADE_DUCKING * fps);
  const cuadroInicioVoz = Math.round(inicioVoz_s * fps);
  const cuadroFinVoz = Math.round(finVoz_s * fps);

  // interpolate() exige el eje de entrada ESTRICTAMENTE creciente --
  // si inicioVoz/finVoz caen muy cerca de los bordes del reel (o el
  // reel es muy corto), los puntos "ideales" de abajo pueden
  // empatarse o invertirse. corregirRangoCreciente() (video/interpolarSeguro.ts)
  // es la MISMA corrección que antes vivía acá a mano -- ahora un solo
  // lugar, compartido con cualquier otro interpolate() de tiempos
  // calculados.
  const idealesSinOrdenar = [
    0,
    cuadroFadeBorde,
    cuadroInicioVoz - cuadroFadeDucking,
    cuadroInicioVoz,
    cuadroFinVoz,
    cuadroFinVoz + cuadroFadeDucking,
    durationInFrames - cuadroFadeBorde,
    durationInFrames,
  ];
  const puntos = corregirRangoCreciente(idealesSinOrdenar);
  const valores = [0, volumenNormal, volumenNormal, volumenConVoz, volumenConVoz, volumenNormal, volumenNormal, 0];
  return { puntos, valores };
}

export function CapaMusicaConDucking({
  url,
  volumenNormal,
  volumenConVoz,
  inicioVoz_s,
  finVoz_s,
}: {
  url: string;
  volumenNormal: number;
  volumenConVoz: number;
  inicioVoz_s: number;
  finVoz_s: number;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { puntos, valores } = calcularCurvaDucking({ fps, durationInFrames, volumenNormal, volumenConVoz, inicioVoz_s, finVoz_s });
  const volumenEnEsteCuadro = interpolate(frame, puntos, valores, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return <Audio src={url} volume={volumenEnEsteCuadro} />;
}
