// Visual de 2 estados "comparación ✗/✓" (parte 2c, 18 nov 2026 --
// catálogo de la Fase B, adelantado para que los consejos no dependan
// de 3 visuales con el consejo escrito en el dibujo). Dos tarjetas de
// texto: "antes" solo se ve la del error (centrada), "después" sube y
// se apaga, y entra la tarjeta de lo correcto debajo. Sirve para
// cualquier consejo del tipo "así no / así sí".
//
// Marcas dibujadas (IconoMarca, video/iconos.tsx), nunca texto ni emoji:
// ✗ ✓ ❌ ✔️ no están en las fuentes cargadas y dependen de una fuente de
// respaldo que el computador del cliente puede no tener.
// Las dos tarjetas son position:absolute dentro del cajón de siempre
// (TARJETA_TOP/ALTURA) -- nunca un flex que pueda encoger una a 0.
import { interpolate, spring } from "remotion";
import { COLOR_ALERTA, COLOR_EXITO, COLOR_EXITO_BLOQUE } from "./acento";
import { IconoMarca } from "../iconos";
import { fitText } from "@remotion/layout-utils";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_AMPLIO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";
import { TAMANO_FUENTE_ETIQUETA_COMPARACION, TAMANO_FUENTE_MINIMO_VISUAL, TAMANO_FUENTE_TEXTO_COMPARACION_MAX, familiaDeFuenteSinCargar } from "./tamanos";
import type { TemaGuion } from "../tema";

const ALTO_TARJETA_PORCENTAJE = 48;
const PADDING_HORIZONTAL_PX = 28;
const BORDE_PX = 5;
const ANCHO_TEXTO_PX = (TARJETA_ANCHO_AMPLIO_PORCENTAJE / 100) * 1080 - PADDING_HORIZONTAL_PX * 2 - BORDE_PX * 2;

// El texto (máx. 44 caracteres) tiene que caber en 2 líneas: se mide como
// si fuera una sola línea del doble de ancho (con margen por los cortes
// de palabra) y se deja entre el mínimo del molde y el máximo.
function tamanoTexto(texto: string, familia: string): number {
  const { fontSize } = fitText({ text: texto, withinWidth: ANCHO_TEXTO_PX * 1.8, fontFamily: familia, fontWeight: 800 });
  return Math.max(TAMANO_FUENTE_MINIMO_VISUAL, Math.min(TAMANO_FUENTE_TEXTO_COMPARACION_MAX, Math.floor(fontSize)));
}

function Tarjeta({ marca, etiqueta, texto, tamanoTexto, color, colorEtiqueta, estilo, estable }: { marca: "mal" | "bien"; etiqueta: string; texto: string; tamanoTexto: number; color: string; colorEtiqueta: string; estilo: React.CSSProperties; estable?: string }) {
  return (
    <div
      data-estable={estable}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: `${ALTO_TARJETA_PORCENTAJE}%`,
        background: "#fff",
        borderRadius: 28,
        border: `${BORDE_PX}px solid ${color}`,
        boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        padding: `12px ${PADDING_HORIZONTAL_PX}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 8,
        ...estilo,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <IconoMarca tipo={marca} tamano={TAMANO_FUENTE_ETIQUETA_COMPARACION} />
        <span style={{ fontSize: TAMANO_FUENTE_ETIQUETA_COMPARACION, lineHeight: 1.1, fontWeight: 800, color: colorEtiqueta, textTransform: "uppercase", letterSpacing: "0.03em" }}>{etiqueta}</span>
      </div>
      <div style={{ fontSize: tamanoTexto, fontWeight: 800, color: "#141414", lineHeight: 1.12 }}>{texto}</div>
    </div>
  );
}

export function ComparacionVisual({
  frame,
  fps,
  cuadroCambia,
  textoMal,
  textoBien,
  etiquetaMal = "Así no",
  etiquetaBien = "Así sí",
  tema,
}: {
  tema: TemaGuion;
  frame: number;
  fps: number;
  cuadroCambia: number;
  textoMal: string;
  textoBien: string;
  etiquetaMal?: string;
  etiquetaBien?: string;
}) {
  const progreso = frame >= cuadroCambia ? spring({ frame: frame - cuadroCambia, fps, config: { damping: 15 } }) : 0;
  // El mismo tamaño en las dos tarjetas (el del texto más largo).
  const familia = familiaDeFuenteSinCargar(tema.fuente);
  const tamano = Math.min(tamanoTexto(textoMal, familia), tamanoTexto(textoBien, familia));

  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_AMPLIO_PORCENTAJE}%`,
        height: `${TARJETA_ALTURA_PORCENTAJE}%`,
        transform: "translateX(-50%)",
      }}
    >
      <Tarjeta
        marca="mal"
        etiqueta={etiquetaMal}
        texto={textoMal}
        tamanoTexto={tamano}
        color={COLOR_ALERTA}
        colorEtiqueta={COLOR_ALERTA}
        // En su lugar final desde el cuadro 0 (antes arrancaba centrada y
        // saltaba arriba al entrar la otra tarjeta): solo se apaga.
        estable="comparacion-clasica-mal"
        estilo={{
          top: 0,
          opacity: interpolate(progreso, [0, 1], [1, 0.55]),
        }}
      />
      <Tarjeta
        marca="bien"
        etiqueta={etiquetaBien}
        texto={textoBien}
        tamanoTexto={tamano}
        color={COLOR_EXITO}
        colorEtiqueta={COLOR_EXITO_BLOQUE}
        estilo={{
          bottom: 0,
          opacity: progreso,
          transform: `scale(${interpolate(progreso, [0, 1], [0.96, 1])})`,
        }}
      />
    </div>
  );
}
