import { Composition, registerRoot } from "remotion";
import { Composicion, type PropsComposicion } from "./Composicion";
import { fixtureCompleta } from "./fixtures/completa";
import { fixtureBucleContador } from "./fixtures/bucleContador";

function duracionEnCuadros(guion: { escenas: { duracion_s: number }[]; fps: number }): number {
  return Math.round(guion.escenas.reduce((acc, e) => acc + e.duracion_s, 0) * guion.fps);
}

// Entrada de Remotion Studio para probar escenas y capas en local (paso 2
// de la Fase 1a). video/recetas/ (paso 3) va a sumar más fixtures, uno
// por receta -- estos dos cubren por ahora las 9 escenas y los 3 modos
// de bucle.
function RemotionRoot() {
  return (
    <>
      <Composition<any, PropsComposicion>
        id="fixture-completa"
        component={Composicion}
        durationInFrames={duracionEnCuadros(fixtureCompleta)}
        fps={fixtureCompleta.fps}
        width={1080}
        height={1920}
        defaultProps={{ guion: fixtureCompleta, medios: {}, mostrarZonaSegura: false }}
      />
      <Composition<any, PropsComposicion>
        id="fixture-bucle-contador"
        component={Composicion}
        durationInFrames={duracionEnCuadros(fixtureBucleContador)}
        fps={fixtureBucleContador.fps}
        width={1080}
        height={1920}
        defaultProps={{ guion: fixtureBucleContador, medios: {}, mostrarZonaSegura: true }}
      />
    </>
  );
}

registerRoot(RemotionRoot);
