// Banco de pruebas visual (parte 2b, 18 nov 2026): renderiza UN visual
// del reel automático en su estado "antes" o "después", con los textos
// que se le pasen -- para revisar con un render real (no a ojo en el
// código) que los textos al máximo de largo caben, no se cortan y no
// salen como cuadros. Lo usa video/renderBancoVisuales.ts (stills PNG).
// Nunca entra a un reel real: es solo una composición de revisión.
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { familiaDeFuente } from "./fuentes";
import type { TemaGuion } from "./tema";
import { AnuncioBotonVisual } from "./visuales/AnuncioBotonVisual";
import { ConexionWhatsappVisual } from "./visuales/ConexionWhatsappVisual";
import { RespuestaLentaVisual } from "./visuales/RespuestaLentaVisual";
import { ComparacionVisual } from "./visuales/ComparacionVisual";
import { IconoPalabraVisual } from "./visuales/IconoPalabraVisual";

export type PropsBancoVisuales = {
  tipo: "anuncio_boton" | "conexion_whatsapp" | "respuesta_lenta" | "comparacion" | "icono_palabra";
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
    </AbsoluteFill>
  );
}
