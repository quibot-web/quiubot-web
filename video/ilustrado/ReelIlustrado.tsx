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
import { CapaMusicaConDucking } from "../visuales/CapaMusicaConDucking";
import { textoSerie } from "../capas/ChipSerie";
import { construirLineaDeTiempo, type TiemposIlustrado } from "./tiempoIlustrado";
import { MundoIlustrado } from "./motor/MundoIlustrado";
import { Subtitulo } from "./motor/Subtitulo";
import { prepararReel } from "./motor/preparar";
import type { PlanIlustrado } from "./motor/plan";
import type { MarcaIlustrada } from "./motor/escenas/tipos";
import { precargarImagenes, urlsImagenesFijas } from "./imagenesFijas";
import { generarRecursos, tarjetaDeMarca, type RecursosGenerados } from "./imagenesGeneradas";
import { aUrlLocal } from "./recursosLocales";

export type PropsReelIlustrado = {
  tiempos: TiemposIlustrado;
  plan: PlanIlustrado;
  vozUrl: string | null;
  // Por defecto la foto de cerámica de public/demo-organico.
  fotoUrl?: string;
  tema: TemaGuion;
  marca: MarcaIlustrada;
  // Música de fondo con ducking bajo la voz (como ReelAutomatico).
  pistaMusicaUrl?: string | null;
  volumenMusica?: number;
  // Parte de una serie: "Parte k de N" al inicio.
  serie?: { parte: number; total: number };
};

const FPS = 30;
// Último respaldo (sin canvas disponible). El prototipo la pasa explícita.
const FOTO_POR_DEFECTO = () => staticFile("demo-organico/foto-producto-ceramica.jpg");

export function duracionReelIlustrado(props: Pick<PropsReelIlustrado, "tiempos">): number {
  return Math.max(1, construirLineaDeTiempo(props.tiempos, FPS).duracionCuadros);
}

export function ReelIlustrado({ tiempos, plan, vozUrl, fotoUrl, tema, marca, pistaMusicaUrl, volumenMusica = 0.35, serie }: PropsReelIlustrado) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reel = useMemo(() => prepararReel(tiempos, plan, fps), [tiempos, plan, fps]);
  const paleta = paletaNoche(tema);
  const foto = fotoUrl ?? null;
  // Una sola espera al inicio: imágenes fijas, foto y recursos horneados
  // (foto apagada/clara, halo de luz). El mundo se monta recién cuando
  // todo está listo: así cada <img> nace con su imagen ya disponible y el
  // cuadro 0 sale completo (nunca el celular en blanco).
  const { delayRender, continueRender } = useDelayRender();
  const [espera] = useState(() => delayRender("Precargando imágenes del reel ilustrado"));
  const [listo, setListo] = useState<{ recursos: RecursosGenerados; foto: string } | null>(null);
  useEffect(() => {
    let vigente = true;
    (async () => {
      // La foto remota (álbum en Cloudinary) se baja con CORS y se usa
      // como blob: local; si no se puede, la foto por defecto -- nunca
      // una imagen remota sin CORS (contamina el canvas y el render falla).
      // Sin foto apta (o si no se pudo bajar): la tarjeta de marca, nunca una captura con texto.
      const tarjeta = () => tarjetaDeMarca(marca.colorMarca, marca.colorSecundario, marca.inicial);
      const fotoLocal = (foto ? await aUrlLocal(foto) : null) || (await tarjeta()) || FOTO_POR_DEFECTO();
      const generados = await generarRecursos(fotoLocal, paleta.luz);
      await precargarImagenes([...urlsImagenesFijas(), fotoLocal, generados.fotoApagada, generados.fotoClara, generados.brilloLuz].filter(Boolean));
      if (vigente) setListo({ recursos: generados, foto: fotoLocal });
    })();
    return () => {
      vigente = false;
    };
  }, [foto, paleta.luz, marca.colorMarca, marca.colorSecundario, marca.inicial]);
  useEffect(() => {
    if (listo) continueRender(espera);
  }, [listo, espera, continueRender]);
  return (
    <AbsoluteFill style={{ fontFamily: familiaDeFuente(tema.fuente), background: paleta.fondoProfundo, overflow: "hidden" }}>
      {listo && <MundoIlustrado frame={frame} fps={fps} reel={reel} paleta={paleta} tema={tema} marca={marca} fotoUrl={listo.foto} recursos={listo.recursos} />}
      <Subtitulo linea={reel.linea} frame={frame} luz={paleta.luz} etiqueta={serie ? textoSerie(serie) : null} />
      {pistaMusicaUrl && reel.linea.palabras.length > 0 && (
        <CapaMusicaConDucking
          url={pistaMusicaUrl}
          volumenNormal={volumenMusica}
          volumenConVoz={volumenMusica * 0.3}
          inicioVoz_s={reel.linea.palabras[0].desde / fps}
          finVoz_s={reel.linea.palabras[reel.linea.palabras.length - 1].hasta / fps}
        />
      )}
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
