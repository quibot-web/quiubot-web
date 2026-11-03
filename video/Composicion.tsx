import { AbsoluteFill, Series } from "remotion";
import type { Guion } from "./guion.schema";
import { familiaDeFuente } from "./fuentes";
import { renderizarEscena } from "./escenas";
import type { MediosResueltos } from "./escenas/tipos";
import { CapaLogo } from "./capas/Logo";
import { CapaSubtitulos } from "./capas/Subtitulos";
import { CapaBucle } from "./capas/Bucle";
import { CapaMusica } from "./capas/Musica";
import { ZonaSegura } from "./capas/ZonaSegura";

export type PropsComposicion = {
  guion: Guion;
  medios: MediosResueltos;
  pistaUrl?: string | null;
  mostrarZonaSegura?: boolean;
};

// Compuesta exactamente igual en el @remotion/player del navegador y en
// el worker de render (Fase 1b) -- lo que se ve en la vista previa es lo
// que sale en el mp4.
export function Composicion({ guion, medios, pistaUrl, mostrarZonaSegura }: PropsComposicion) {
  const { escenas, tema, fps } = guion;
  const familia = familiaDeFuente(tema.fuente);

  return (
    <AbsoluteFill style={{ backgroundColor: tema.color_fondo, fontFamily: familia, color: tema.color_texto }}>
      <Series>
        {escenas.map((escena) => (
          <Series.Sequence key={escena.id} durationInFrames={Math.round(escena.duracion_s * fps)}>
            {renderizarEscena(escena, tema, medios)}
          </Series.Sequence>
        ))}
      </Series>

      <CapaLogo tema={tema} />
      <CapaSubtitulos escenas={escenas} fps={fps} tema={tema} />
      <CapaBucle guion={guion} />
      {pistaUrl && <CapaMusica url={pistaUrl} volumen={guion.musica.volumen} />}
      {mostrarZonaSegura && <ZonaSegura />}
    </AbsoluteFill>
  );
}
