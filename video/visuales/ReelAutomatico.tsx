import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import type { BloqueGuion } from "../guion.schema";
import type { TemaGuion } from "../tema";
import type { Visual } from "./schema";
import type { PalabraConTiempoVisual } from "./index";
import type { Guion } from "../guion.schema";
import { familiaDeFuente } from "../fuentes";
import { FondoMarca } from "../capas/FondoMarca";
import { CapaLogo } from "../capas/Logo";
import { CapaBucleAudio } from "./CapaBucleAudio";
import { ZonaSegura } from "../capas/ZonaSegura";
import { CapaVoz } from "./CapaVoz";
import { CapaMusicaConDucking } from "./CapaMusicaConDucking";
import { CapaEfectos, type EfectoSonido } from "./CapaEfectos";
import { renderizarVisual } from "./index";
import { SubtitulosSincronizados, type PalabraEnCuadros } from "./SubtitulosSincronizados";
import { duracionReelAutomaticoEnCuadros } from "./duracionReel";

export { duracionReelAutomaticoEnCuadros };

// Fase B v2.0 (docs/diseno/plan_contenido_organico_fase_b_v2.md,
// punto 9). Composición standalone -- MISMO criterio que los 2 reels
// de referencia de la Fase A (video/fixtures/organico/referencia/):
// no pasa por Composicion.tsx/renderizarEscena(), cero riesgo sobre el
// pipeline real de anuncios/las 6 recetas orgánicas de siempre, que
// no tienen narracion/visual/tiemposRender.
//
// Requiere guion.tiemposRender + guion.palabrasPorEscena + guion.vozUrl
// ya calculados (generarVoz() + alinearPalabras(), antes de llegar
// acá) y cada escena con narracion+visual -- si falta algo de eso,
// valídalo con video/visuales/validarEdicionDesdeAudio.ts ANTES de
// montar esta composición, no acá (este componente asume un guion ya
// válido, igual que Composicion.tsx asume un GuionSchema ya parseado).
//
// Ronda K (revisión real en staging, 19 nov 2026): esto usaba
// <TransitionSeries>+fade() como Composicion.tsx (las 6 recetas de
// siempre) -- pero ahí el respiro entre escenas es una ESTIMACIÓN de
// la IA (duracion_s) con margen de sobra para un fundido. Acá, el
// respiro YA es un silencio real medido y deliberado (0.35-0.45s,
// ver compactarPausas.ts): el fundido de 8 cuadros (0.27s) se sumaba
// ENCIMA de ese respiro (cada escena se alargaba +8 cuadros propios, y
// la transición solapaba la ÚLTIMA parte de una escena con la
// PRIMERA de la siguiente) -- dos problemas reales del mismo origen,
// no dos bugs distintos: (a) la tarjeta/subtítulo de la escena que
// sale queda montada 8 cuadros de más, visible al mismo tiempo que la
// que entra (dos tarjetas/subtítulos superpuestos, caso real: "Tercero,
// responde…" sobre "del negocio."), y (b) el silencio real deliberado
// (0.4s) más esos 8 cuadros de más sumaban ~0.67s de tiempo muerto
// visual en cada unión (caso real medido: e3->e4, ~0.7s) -- muy por
// encima del respiro pedido. Corte directo (Sequence a Sequence, sin
// solape ni fundido, ver duracionReel.ts): el respiro que se escucha
// es EXACTAMENTE el que compactarPausas.ts ya calculó, ningún cuadro
// extra, y nunca hay 2 escenas montadas a la vez.

// renderizarVisual() es una función pura (no un componente): necesita
// el cuadro ACTUAL, que solo useCurrentFrame() puede dar, y solo
// dentro del Sequence correcto (cada escena resetea el cuadro a 0).
// Este wrapper es lo único que llama a ese hook por escena.
function ContenidoEscena({
  tema,
  bloque,
  fps,
  visual,
  palabras,
  inicioEscena_s,
}: {
  tema: TemaGuion;
  bloque: BloqueGuion;
  fps: number;
  visual: Visual;
  palabras: PalabraConTiempoVisual[];
  inicioEscena_s: number;
}) {
  const frame = useCurrentFrame();
  return <>{renderizarVisual(visual, { tema, bloque, frame, fps, palabras, inicioEscena_s })}</>;
}

export type PropsReelAutomatico = {
  guion: Guion;
  pistaMusicaUrl?: string | null;
  efectos?: EfectoSonido[];
  mostrarZonaSegura?: boolean;
};

export function ReelAutomatico({ guion, pistaMusicaUrl, efectos = [], mostrarZonaSegura }: PropsReelAutomatico) {
  const { escenas, tema, fps } = guion;
  const familia = familiaDeFuente(tema.fuente);
  const tiemposRender = guion.tiemposRender ?? [];
  const palabrasPorEscena = guion.palabrasPorEscena ?? [];

  const primeraInicio_s = tiemposRender[0]?.inicio_s ?? 0;
  const ultimaFin_s = tiemposRender[tiemposRender.length - 1]?.fin_s ?? 0;

  const segmentosAudio = guion.segmentosAudio ?? [];

  // Desplazamientos acumulados (dónde empieza cada escena, en cuadros)
  // calculados aparte, en un solo reduce puro -- nunca una variable
  // reasignada DENTRO del .map() que arma el JSX de cada escena:
  // react-hooks/immutability rechaza mutar una variable de closure
  // durante el render, aunque acá sea determinístico y seguro.
  const duracionesEnCuadros = escenas.map((escena) => {
    const tiempo = tiemposRender.find((t) => t.escena_id === escena.id);
    return Math.round((tiempo ? tiempo.fin_s - tiempo.inicio_s : 0) * fps);
  });
  const desdeEscenaPorIndice = duracionesEnCuadros.reduce<number[]>((acc, _duracion, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + duracionesEnCuadros[i - 1]);
    return acc;
  }, []);

  const nodosEscenas = escenas.map((escena, i) => {
    const tiempo = tiemposRender.find((t) => t.escena_id === escena.id);
    const palabras = palabrasPorEscena.find((p) => p.escena_id === escena.id)?.palabras ?? [];
    const inicioEscena_s = tiempo?.inicio_s ?? 0;
    // Ronda H: tramos reales de audio de esta escena (ver
    // app/lib/videoOrganico/compactarPausas.ts) -- casi siempre 1
    // (toda la narración de la escena es continua en la toma cruda).
    // Si el guion no trae segmentosAudio (guion viejo, de antes de
    // esta ronda), cae al tramo único de siempre: todo
    // [tiempo.inicio_s, tiempo.fin_s].
    const tramos = segmentosAudio.find((s) => s.escena_id === escena.id)?.tramos ?? (tiempo ? [{ original: tiempo, compactado: tiempo }] : []);

    // Subtítulos en cuadros RELATIVOS a esta escena -- useCurrentFrame()
    // dentro del Sequence ya arranca en 0 acá, mismo criterio que el
    // resto de video/escenas/.
    const palabrasEnCuadros: PalabraEnCuadros[] = palabras.map((p) => ({
      texto: p.texto,
      inicioCuadro: Math.round((p.inicio_s - inicioEscena_s) * fps),
      finCuadro: Math.round((p.fin_s - inicioEscena_s) * fps),
    }));

    const duracionEscenaCuadros = duracionesEnCuadros[i];
    const desdeEscena = desdeEscenaPorIndice[i];

    return (
      <Sequence key={escena.id} from={desdeEscena} durationInFrames={duracionEscenaCuadros}>
        <AbsoluteFill>
          <FondoMarca tema={tema} bloque={escena.bloque} organico />
          {escena.visual && (
            <ContenidoEscena tema={tema} bloque={escena.bloque} fps={fps} visual={escena.visual} palabras={palabras} inicioEscena_s={inicioEscena_s} />
          )}
          <SubtitulosSincronizados palabras={palabrasEnCuadros} tema={tema} />
          {guion.vozUrl &&
            tiempo &&
            tramos.map((tramo, iTramo) => {
              // Posición/duración de ESTE tramo, relativas al propio
              // Sequence de la escena (que ya arranca en cuadro 0 ahí
              // mismo) -- nunca negativas ni más allá de
              // duracionEscenaCuadros: tiempo.inicio_s/fin_s (route.ts,
              // ronda I) YA ES el borde del primer/último tramo de esta
              // escena, así que siempre coincide exacto, haya habido
              // margen real ahí (un corte de verdad) o no.
              const desdeCuadro = Math.round((tramo.compactado.inicio_s - inicioEscena_s) * fps);
              const duracionTramoCuadros = Math.round((tramo.compactado.fin_s - tramo.compactado.inicio_s) * fps);
              if (duracionTramoCuadros <= 0) return null;
              return (
                <Sequence key={`${escena.id}-voz-${iTramo}`} from={desdeCuadro} durationInFrames={duracionTramoCuadros}>
                  <CapaVoz
                    url={guion.vozUrl!}
                    trimBefore={Math.round(tramo.original.inicio_s * fps)}
                    trimAfter={Math.round(tramo.original.fin_s * fps)}
                    duracionCuadros={duracionTramoCuadros}
                    fps={fps}
                  />
                </Sequence>
              );
            })}
        </AbsoluteFill>
      </Sequence>
    );
  });

  return (
    <AbsoluteFill style={{ fontFamily: familia }}>
      {nodosEscenas}

      <CapaLogo tema={tema} />
      <CapaBucleAudio guion={guion} />
      {pistaMusicaUrl && (
        <CapaMusicaConDucking url={pistaMusicaUrl} volumenNormal={guion.musica.volumen} volumenConVoz={guion.musica.volumen * 0.3} inicioVoz_s={primeraInicio_s} finVoz_s={ultimaFin_s} />
      )}
      <CapaEfectos efectos={efectos} />
      {mostrarZonaSegura && <ZonaSegura />}
    </AbsoluteFill>
  );
}
