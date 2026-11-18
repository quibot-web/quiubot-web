// Banco de pruebas visual (parte 2b, 18 nov 2026): renderiza UN visual
// del reel automático en su estado "antes" o "después", con los textos
// que se le pasen -- para revisar con un render real (no a ojo en el
// código) que los textos al máximo de largo caben, no se cortan y no
// salen como cuadros. Lo usa video/renderBancoVisuales.ts (stills PNG).
// Nunca entra a un reel real: es solo una composición de revisión.
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { familiaDeFuente } from "./fuentes";
import type { TemaGuion } from "./tema";
import { AnuncioBotonVisual } from "./visuales/AnuncioBotonVisual";
import { ConexionWhatsappVisual } from "./visuales/ConexionWhatsappVisual";
import { RespuestaLentaVisual } from "./visuales/RespuestaLentaVisual";
import { ComparacionVisual } from "./visuales/ComparacionVisual";
import { IconoPalabraVisual } from "./visuales/IconoPalabraVisual";
import { ChecklistVisual } from "./visuales/ChecklistVisual";
import { ComparacionFotoVisual } from "./visuales/ComparacionFotoVisual";
import { renderizarVisual, type PalabraConTiempoVisual } from "./visuales/index";
import type { Visual } from "./visuales/schema";
import type { BloqueGuion, Guion } from "./guion.schema";
import { CapaBucleAudio } from "./visuales/CapaBucleAudio";

export type PropsBancoVisuales = {
  tipo: "anuncio_boton" | "conexion_whatsapp" | "respuesta_lenta" | "comparacion" | "icono_palabra" | "checklist" | "comparacion_foto";
  estado: "antes" | "despues";
  textos: Record<string, string>;
  tema?: TemaGuion;
};

const TEMA_BANCO: TemaGuion = {
  color_primario: "#534AB7",
  color_secundario: "#B9B2FF",
  fuente: "moderna",
  logo_url: null,
  nombre_marca: "Marca de prueba",
  instagramUsuario: null,
};

export function BancoVisuales({ tipo, estado, textos, tema = TEMA_BANCO }: PropsBancoVisuales) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // "antes": el cambio nunca llega. "después": el cambio pasó hace rato
  // (las animaciones de entrada ya terminaron en el cuadro que se mira).
  const cuadroCambia = estado === "antes" ? Number.MAX_SAFE_INTEGER : 0;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${tema.color_primario}, #1a1530)`, fontFamily: familiaDeFuente(tema.fuente) }}>
      {tipo === "anuncio_boton" && <AnuncioBotonVisual frame={frame} fps={fps} tema={tema} cuadroCambia={cuadroCambia} textos={textos} />}
      {tipo === "conexion_whatsapp" && <ConexionWhatsappVisual frame={frame} fps={fps} tema={tema} cuadroCambia={cuadroCambia} textos={textos} />}
      {tipo === "respuesta_lenta" && <RespuestaLentaVisual frame={frame} fps={fps} cuadroCambia={cuadroCambia} textos={textos} />}
      {tipo === "comparacion" && (
        <ComparacionVisual frame={frame} fps={fps} cuadroCambia={cuadroCambia} textoMal={textos.texto_mal} textoBien={textos.texto_bien} etiquetaMal={textos.etiqueta_mal} etiquetaBien={textos.etiqueta_bien} />
      )}
      {tipo === "icono_palabra" && (
        <IconoPalabraVisual
          frame={frame}
          fps={fps}
          tema={tema}
          cuadroCambia={cuadroCambia}
          iconoAntes={textos.icono_antes}
          palabraAntes={textos.palabra_antes}
          iconoDespues={textos.icono_despues}
          palabraDespues={textos.palabra_despues}
        />
      )}
      {tipo === "checklist" && (
        <ChecklistVisual frame={frame} fps={fps} cuadroCambia={cuadroCambia} titulo={textos.titulo || undefined} items={[textos.item1, textos.item2, textos.item3].filter(Boolean)} />
      )}
      {tipo === "comparacion_foto" && (
        // Foto de stock SOLO para el banco de pruebas (sin logos, ver la
        // referencia aprobada) -- en un reel real sale del álbum.
        <ComparacionFotoVisual
          frame={frame}
          fps={fps}
          cuadroCambia={cuadroCambia}
          urlFoto={textos.sin_foto ? null : staticFile("demo-organico/foto-producto-ceramica.jpg")}
          textoMal={textos.texto_mal}
          textoBien={textos.texto_bien}
        />
      )}
    </AbsoluteFill>
  );
}

// Parte 2e: el mismo visual pasado por renderizarVisual() (el camino
// real del reel), en el bloque que se pida -- para revisar el gancho
// (estado "problema", sin eventos, con su movimiento de entrada) y el
// cierre (mismo visual, cambio en la palabra 0) con el render real.
// Narración simulada: 10 palabras de 0.4s desde el segundo 0.
export type PropsBancoGanchoCierre = { visual: Visual; bloque: BloqueGuion; tema?: TemaGuion; chipBucle?: { indicador: "espera_final" | "contador"; texto: string } };

const PALABRAS_SIMULADAS: PalabraConTiempoVisual[] = Array.from({ length: 10 }, (_, i) => ({ texto: `palabra${i}`, inicio_s: i * 0.4, fin_s: i * 0.4 + 0.35 }));

export function BancoGanchoCierre({ visual, bloque, tema = TEMA_BANCO, chipBucle }: PropsBancoGanchoCierre) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const medios = { "foto-demo": { tipo: "imagen" as const, url: staticFile("demo-organico/foto-producto-ceramica.jpg") } };
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${tema.color_primario}, #1a1530)`, fontFamily: familiaDeFuente(tema.fuente) }}>
      {renderizarVisual(visual, { tema, bloque, frame, fps, palabras: PALABRAS_SIMULADAS, inicioEscena_s: 0, medios })}
      {chipBucle && <CapaBucleAudio guion={guionSoloChip(chipBucle, bloque, tema, fps)} />}
    </AbsoluteFill>
  );
}

// Lo mínimo que CapaBucleAudio lee de un guion: una sola escena del
// bloque pedido, de 10 s, con el bucle dado.
function guionSoloChip(chip: NonNullable<PropsBancoGanchoCierre["chipBucle"]>, bloque: BloqueGuion, tema: TemaGuion, fps: number): Guion {
  return {
    fps,
    tema,
    bucle: { texto: chip.texto, abre_en: "e1", cierra_en: "e1", indicador: chip.indicador },
    escenas: [{ id: "e1", bloque }],
    tiemposRender: [{ escena_id: "e1", inicio_s: 0, fin_s: 10 }],
  } as unknown as Guion;
}
