import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { Guion } from "./guion.schema";
import { familiaDeFuente } from "./fuentes";
import { renderizarEscena } from "./escenas";
import type { MediosResueltos } from "./escenas/tipos";
import { CapaLogo } from "./capas/Logo";
import { CapaBucle } from "./capas/Bucle";
import { CapaMusica } from "./capas/Musica";
import { ZonaSegura } from "./capas/ZonaSegura";

export type PropsComposicion = {
  guion: Guion;
  medios: MediosResueltos;
  pistaUrl?: string | null;
  mostrarZonaSegura?: boolean;
};

// "Entre escenas no puede quedar ningún cuadro vacío": en vez de <Series>
// (corte seco), TransitionSeries SOLAPA el final de una escena con el
// inicio de la siguiente durante CUADROS_TRANSICION cuadros, con un fade
// cruzado -- la salida de una y la entrada de la otra se mezclan ahí.
// Cada <TransitionSeries.Sequence> se alarga CUADROS_TRANSICION cuadros
// de más (ver más abajo) para que ese solape no le robe tiempo visible a
// ninguna escena: con n escenas hay (n-1) transiciones que se "comen"
// CUADROS_TRANSICION cada una, así que al sumar +CUADROS_TRANSICION a
// CADA escena y restar (n-1)*CUADROS_TRANSICION por las transiciones, el
// inicio real de cada escena en el timeline cae EXACTAMENTE donde ya
// caía con <Series> (la suma se cancela) -- capas/Bucle.tsx, que calcula
// sus cuadros de inicio/fin a partir de escena.duracion_s sin saber nada
// de transiciones, sigue sincronizado sin tocarlo. Lo único que cambia
// es la cola: la última escena queda CUADROS_TRANSICION cuadros más
// larga (su propio fade no tiene con qué solaparse), por eso
// duracionEnCuadros() también suma ese mismo margen.
export const CUADROS_TRANSICION = 10;

// Compartida por Root.tsx (Remotion Studio) y por el <Player> de
// /video/nuevo -- la misma cuenta en los dos lugares, para que la
// duración de la vista previa en el navegador coincida siempre.
export function duracionEnCuadros(guion: Guion): number {
  const base = Math.round(guion.escenas.reduce((acc, e) => acc + e.duracion_s, 0) * guion.fps);
  return guion.escenas.length > 1 ? base + CUADROS_TRANSICION : base;
}

// Compuesta exactamente igual en el @remotion/player del navegador y en
// el worker de render (Fase 1b) -- lo que se ve en la vista previa es lo
// que sale en el mp4. Sin color de fondo fijo aquí: cada escena pinta el
// suyo (FondoMarca, la foto/video real, o el degradado de alerta).
export function Composicion({ guion, medios, pistaUrl, mostrarZonaSegura }: PropsComposicion) {
  const { escenas, tema, fps } = guion;
  const familia = familiaDeFuente(tema.fuente);

  const nodosEscenas = escenas.flatMap((escena, i) => {
    const nodos: React.ReactNode[] = [
      <TransitionSeries.Sequence key={escena.id} durationInFrames={Math.round(escena.duracion_s * fps) + CUADROS_TRANSICION}>
        {renderizarEscena(escena, tema, medios, guion.analisisPiezas)}
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
      <CapaBucle guion={guion} />
      {pistaUrl && <CapaMusica url={pistaUrl} volumen={guion.musica.volumen} />}
      {mostrarZonaSegura && <ZonaSegura />}
    </AbsoluteFill>
  );
}
