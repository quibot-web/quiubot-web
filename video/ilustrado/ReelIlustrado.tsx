// Reel ilustrado (fase 1 del plan aprobado el 18 nov 2026): el motor
// genérico -- escenas del catálogo, acciones amarradas a palabras,
// cámara automática y voz por escena. Reemplaza al componente del
// prototipo: el prototipo es ahora solo un plan (planPrototipo.ts).
import { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { familiaDeFuente } from "../fuentes";
import type { TemaGuion } from "../tema";
import { paletaNoche } from "../estilos/estilos";
import { CapaVoz } from "../visuales/CapaVoz";
import { construirLineaDeTiempo, type TiemposIlustrado } from "./tiempoIlustrado";
import { MundoIlustrado } from "./motor/MundoIlustrado";
import { Subtitulo } from "./motor/Subtitulo";
import { prepararReel } from "./motor/preparar";
import type { PlanIlustrado } from "./motor/plan";
import type { MarcaIlustrada } from "./motor/escenas/tipos";
import { precargarImagenes, urlsImagenesFijas } from "./imagenesFijas";

export type PropsReelIlustrado = {
  tiempos: TiemposIlustrado;
  plan: PlanIlustrado;
  vozUrl: string | null;
  // Por defecto la foto de cerámica de public/demo-organico.
  fotoUrl?: string;
  tema: TemaGuion;
  marca: MarcaIlustrada;
};

const FPS = 30;

export function duracionReelIlustrado(props: Pick<PropsReelIlustrado, "tiempos">): number {
  return Math.max(1, construirLineaDeTiempo(props.tiempos, FPS).duracionCuadros);
}

export function ReelIlustrado({ tiempos, plan, vozUrl, fotoUrl, tema, marca }: PropsReelIlustrado) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reel = useMemo(() => prepararReel(tiempos, plan, fps), [tiempos, plan, fps]);
  const paleta = paletaNoche(tema);
  const foto = fotoUrl ?? staticFile("demo-organico/foto-producto-ceramica.jpg");
  // Una sola espera al inicio: todas las imágenes fijas + la foto (ver imagenesFijas.tsx).
  const { delayRender, continueRender } = useDelayRender();
  const [espera] = useState(() => delayRender("Precargando imágenes del reel ilustrado"));
  useEffect(() => {
    precargarImagenes([...urlsImagenesFijas(), foto]).then(() => continueRender(espera));
  }, [foto, espera, continueRender]);
  return (
    <AbsoluteFill style={{ fontFamily: familiaDeFuente(tema.fuente), background: paleta.fondoProfundo, overflow: "hidden" }}>
      <MundoIlustrado frame={frame} fps={fps} reel={reel} paleta={paleta} tema={tema} marca={marca} fotoUrl={foto} />
      <Subtitulo linea={reel.linea} frame={frame} luz={paleta.luz} />
      {/* Voz: cada escena reproduce sus tramos ya compactados (mismo criterio que ReelAutomatico). */}
      {vozUrl &&
        reel.linea.escenas.map((e) => {
          const tramos = tiempos.segmentosAudio.find((s) => s.escena_id === e.id)?.tramos ?? [];
          return (
            <Sequence key={e.id} from={e.desde} durationInFrames={Math.max(1, e.duracion)}>
              {tramos.map((tramo, i) => {
                const desde = Math.round((tramo.compactado.inicio_s - e.inicio_s) * fps);
                const dur = Math.round((tramo.compactado.fin_s - tramo.compactado.inicio_s) * fps);
                if (dur <= 0) return null;
                return (
                  <Sequence key={i} from={desde} durationInFrames={dur}>
                    <CapaVoz url={vozUrl} trimBefore={Math.round(tramo.original.inicio_s * fps)} trimAfter={Math.round(tramo.original.fin_s * fps)} duracionCuadros={dur} fps={fps} />
                  </Sequence>
                );
              })}
            </Sequence>
          );
        })}
    </AbsoluteFill>
  );
}
