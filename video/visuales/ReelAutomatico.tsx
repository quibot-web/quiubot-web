import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { BloqueGuion } from "../guion.schema";
import type { TemaGuion } from "../tema";
import type { Visual } from "./schema";
import type { PalabraConTiempoVisual } from "./index";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
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
export const CUADROS_TRANSICION = 8;

export function duracionReelAutomaticoEnCuadros(guion: Guion): number {
  const tiempos = guion.tiemposRender ?? [];
  const base = Math.round(tiempos.reduce((acc, t) => acc + (t.fin_s - t.inicio_s), 0) * guion.fps);
  return tiempos.length > 1 ? base + CUADROS_TRANSICION : base;
}

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

  const nodosEscenas = escenas.flatMap((escena, i) => {
    const tiempo = tiemposRender.find((t) => t.escena_id === escena.id);
    const palabras = palabrasPorEscena.find((p) => p.escena_id === escena.id)?.palabras ?? [];
    const duracionS = tiempo ? tiempo.fin_s - tiempo.inicio_s : 0;
    const inicioEscena_s = tiempo?.inicio_s ?? 0;

    // Subtítulos en cuadros RELATIVOS a esta escena -- useCurrentFrame()
    // dentro del Sequence ya arranca en 0 acá, mismo criterio que el
    // resto de video/escenas/.
    const palabrasEnCuadros: PalabraEnCuadros[] = palabras.map((p) => ({
      texto: p.texto,
      inicioCuadro: Math.round((p.inicio_s - inicioEscena_s) * fps),
      finCuadro: Math.round((p.fin_s - inicioEscena_s) * fps),
    }));

    const duracionEscenaCuadros = Math.round(duracionS * fps);

    const nodos: React.ReactNode[] = [
      <TransitionSeries.Sequence key={escena.id} durationInFrames={duracionEscenaCuadros + CUADROS_TRANSICION}>
        <AbsoluteFill>
          <FondoMarca tema={tema} bloque={escena.bloque} organico />
          {escena.visual && (
            <ContenidoEscena tema={tema} bloque={escena.bloque} fps={fps} visual={escena.visual} palabras={palabras} inicioEscena_s={inicioEscena_s} />
          )}
          <SubtitulosSincronizados palabras={palabrasEnCuadros} tema={tema} />
          {guion.vozUrl && tiempo && (
            <CapaVoz
              url={guion.vozUrl}
              trimBefore={Math.round(tiempo.inicio_s * fps)}
              trimAfter={Math.round(tiempo.fin_s * fps)}
              duracionCuadros={duracionEscenaCuadros}
              fps={fps}
            />
          )}
        </AbsoluteFill>
      </TransitionSeries.Sequence>,
    ];
    if (i < escenas.length - 1) {
      nodos.push(
        <TransitionSeries.Transition
          key={`${escena.id}-transicion`}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: CUADROS_TRANSICION })}
        />
      );
    }
    return nodos;
  });

  return (
    <AbsoluteFill style={{ fontFamily: familia }}>
      <TransitionSeries>{nodosEscenas}</TransitionSeries>

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
