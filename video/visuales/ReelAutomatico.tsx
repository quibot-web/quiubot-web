import { AbsoluteFill, Sequence, spring, useCurrentFrame } from "remotion";
import { layoutDeEscena, layoutDelVisual, paletaNoche, type LayoutEscena } from "../estilos/estilos";
import { FondoNoche } from "../estilos/FondoNoche";
import { CamaraEscena } from "../estilos/CamaraEscena";
import { PalabraGigante } from "../estilos/PalabraGigante";
import { familiaDeFuenteSinCargar } from "./tamanos";
import type { BloqueGuion } from "../guion.schema";
import type { TemaGuion } from "../tema";
import type { Visual } from "./schema";
import type { PalabraConTiempoVisual } from "./index";
import type { Guion } from "../guion.schema";
import type { MediosResueltos } from "../escenas/tipos";
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
  medios,
}: {
  tema: TemaGuion;
  bloque: BloqueGuion;
  fps: number;
  visual: Visual;
  palabras: PalabraConTiempoVisual[];
  inicioEscena_s: number;
  medios?: MediosResueltos;
}) {
  const frame = useCurrentFrame();
  return <>{renderizarVisual(visual, { tema, bloque, frame, fps, palabras, inicioEscena_s, medios })}</>;
}

// Momento en que la palabra gigante del gancho da paso al visual: la
// palabra que cae en el ~45% de la narración, entre 1 y 2 s (cambio
// visual cada 1-2 s).
function cuadroSalidaPalabraGigante(palabras: PalabraConTiempoVisual[], inicioEscena_s: number, fps: number): number {
  const indice = Math.ceil(palabras.length * 0.45);
  const t = palabras[indice] ? palabras[indice].inicio_s - inicioEscena_s : 1.5;
  return Math.round(Math.min(2, Math.max(1, t)) * fps);
}

// Escena en el sistema de estilos (paso 1, estilo Noche): fondo, cámara
// y layout. Separado de ContenidoEscena para no tocar el camino de
// siempre (guiones sin estilo).
function EscenaNoche({
  escena,
  indiceEscena,
  layout,
  tema,
  fps,
  palabras,
  inicioEscena_s,
  duracionCuadros,
  medios,
}: {
  escena: Guion["escenas"][number];
  indiceEscena: number;
  layout: LayoutEscena;
  tema: TemaGuion;
  fps: number;
  palabras: PalabraConTiempoVisual[];
  inicioEscena_s: number;
  duracionCuadros: number;
  medios?: MediosResueltos;
}) {
  const frame = useCurrentFrame();
  const paleta = paletaNoche(tema);
  const visual = escena.visual;
  const esPalabraGigante = layout === "palabra_gigante" && escena.tipo === "gancho_texto";
  // El visual que entra tras la palabra gigante se dibuja con su propio
  // layout (protagonista si lo admite), nunca como tarjeta chica.
  const layoutVisual = layout === "palabra_gigante" ? layoutDelVisual(visual?.tipo) : layout;
  const ctx = { tema, bloque: escena.bloque, frame, fps, palabras, inicioEscena_s, medios, estilo: { paleta, layout: layoutVisual } };
  const cuadroSalida = esPalabraGigante ? cuadroSalidaPalabraGigante(palabras, inicioEscena_s, fps) : null;
  const primerEvento = visual && visual.eventos.length > 0 ? visual.eventos[0].palabra : null;
  const cuadroEvento = primerEvento !== null && palabras[primerEvento] ? Math.round((palabras[primerEvento].inicio_s - inicioEscena_s) * fps) : null;
  const cuadroGolpe = cuadroSalida ?? cuadroEvento;
  // En la palabra gigante, el visual entra recién en la salida del texto.
  const entradaVisual = cuadroSalida === null ? 1 : frame >= cuadroSalida ? spring({ frame: frame - cuadroSalida, fps, config: { damping: 13 } }) : 0;

  return (
    <>
      <FondoNoche paleta={paleta} indiceEscena={indiceEscena} frame={frame} fps={fps} />
      <CamaraEscena frame={frame} fps={fps} duracionCuadros={duracionCuadros} cuadroGolpe={cuadroGolpe}>
        {visual && (
          <AbsoluteFill style={{ opacity: entradaVisual, transform: `scale(${0.88 + 0.12 * entradaVisual})` }}>{renderizarVisual(visual, ctx)}</AbsoluteFill>
        )}
        {esPalabraGigante && escena.tipo === "gancho_texto" && (
          <PalabraGigante
            texto={escena.params.texto}
            palabraClave={escena.params.palabra_clave}
            sticker={escena.params.sticker}
            familia={familiaDeFuenteSinCargar(tema.fuente)}
            paleta={paleta}
            frame={frame}
            fps={fps}
            cuadroSalida={cuadroSalida ?? duracionCuadros}
          />
        )}
      </CamaraEscena>
    </>
  );
}

export type PropsReelAutomatico = {
  guion: Guion;
  // Piezas del álbum resueltas a URL (parte 2d, comparacion_foto) --
  // mismo contrato que Composicion/VistaPrevia.
  medios?: MediosResueltos;
  pistaMusicaUrl?: string | null;
  efectos?: EfectoSonido[];
  mostrarZonaSegura?: boolean;
};

export function ReelAutomatico({ guion, medios, pistaMusicaUrl, efectos = [], mostrarZonaSegura }: PropsReelAutomatico) {
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
          {guion.estilo?.id === "noche" ? (
            <EscenaNoche
              escena={escena}
              indiceEscena={i}
              layout={guion.estilo.layouts[escena.id] ?? layoutDeEscena(escena)}
              tema={tema}
              fps={fps}
              palabras={palabras}
              inicioEscena_s={inicioEscena_s}
              duracionCuadros={duracionEscenaCuadros}
              medios={medios}
            />
          ) : (
            <>
              <FondoMarca tema={tema} bloque={escena.bloque} organico />
              {escena.visual && (
                <ContenidoEscena tema={tema} bloque={escena.bloque} fps={fps} visual={escena.visual} palabras={palabras} inicioEscena_s={inicioEscena_s} medios={medios} />
              )}
            </>
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
