import { AbsoluteFill, Series } from "remotion";
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

// Compartida por Root.tsx (Remotion Studio) y por el <Player> de
// /video/nuevo -- la misma cuenta en los dos lugares, para que la
// duración de la vista previa en el navegador coincida siempre.
export function duracionEnCuadros(guion: Guion): number {
  return Math.round(guion.escenas.reduce((acc, e) => acc + e.duracion_s, 0) * guion.fps);
}

// Compuesta exactamente igual en el @remotion/player del navegador y en
// el worker de render (Fase 1b) -- lo que se ve en la vista previa es lo
// que sale en el mp4. Sin color de fondo fijo aquí: cada escena pinta el
// suyo (FondoMarca, la foto/video real, o el degradado de alerta).
export function Composicion({ guion, medios, pistaUrl, mostrarZonaSegura }: PropsComposicion) {
  const { escenas, tema, fps } = guion;
  const familia = familiaDeFuente(tema.fuente);

  return (
    <AbsoluteFill style={{ fontFamily: familia }}>
      <Series>
        {escenas.map((escena) => (
          <Series.Sequence key={escena.id} durationInFrames={Math.round(escena.duracion_s * fps)}>
            {renderizarEscena(escena, tema, medios, guion.analisisPiezas)}
          </Series.Sequence>
        ))}
      </Series>

      <CapaLogo tema={tema} />
      <CapaBucle guion={guion} />
      {pistaUrl && <CapaMusica url={pistaUrl} volumen={guion.musica.volumen} />}
      {mostrarZonaSegura && <ZonaSegura />}
    </AbsoluteFill>
  );
}
