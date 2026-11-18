// Visual de 2 estados "ícono + palabra grande" (parte 2c, 18 nov 2026 --
// catálogo de la Fase B). Una tarjeta blanca con un emoji enorme y UNA
// palabra (o 2-3) gigante: "antes" el problema en rojo (ej. 🌑 OSCURA),
// "después" el arreglo en verde (ej. ☀️ CON LUZ). El ícono y la palabra
// cambian juntos con un pequeño "pop".
//
// La palabra se ajusta al ancho real con fitText() contra el ancho REAL
// de la tarjeta (80% de 1080, no el cuadro completo -- mismo error ya
// corregido en BotonEstado.tsx), con un tope de tamaño.
import { interpolate, spring } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { COLOR_ALERTA, COLOR_EXITO, COLOR_EXITO_BLOQUE } from "./acento";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";
import { familiaDeFuenteSinCargar } from "./tamanos";
import type { TemaGuion } from "../tema";

const ANCHO_TARJETA_PX = (TARJETA_ANCHO_PORCENTAJE / 100) * 1080;
const PADDING_HORIZONTAL_PX = 48;
const MARGEN_SEGURIDAD_PX = 24;
const TAMANO_MAXIMO_PALABRA = 130;

// Se mide en MAYÚSCULAS porque así se dibuja (textTransform) -- medido
// en minúsculas, en el render real "LUZ NATURAL YA" tocaba los bordes.
function tamanoPalabraQueCabe(texto: string, familia: string): number {
  const { fontSize } = fitText({ text: texto.toLocaleUpperCase("es"), withinWidth: ANCHO_TARJETA_PX - PADDING_HORIZONTAL_PX * 2 - MARGEN_SEGURIDAD_PX, fontFamily: familia, fontWeight: 900 });
  return Math.min(TAMANO_MAXIMO_PALABRA, Math.floor(fontSize));
}

export function IconoPalabraVisual({
  frame,
  fps,
  tema,
  cuadroCambia,
  iconoAntes,
  palabraAntes,
  iconoDespues,
  palabraDespues,
}: {
  frame: number;
  fps: number;
  tema: TemaGuion;
  cuadroCambia: number;
  iconoAntes: string;
  palabraAntes: string;
  iconoDespues: string;
  palabraDespues: string;
}) {
  const despues = frame >= cuadroCambia;
  const pop = despues ? spring({ frame: frame - cuadroCambia, fps, config: { damping: 9, stiffness: 180 } }) : 1;
  const icono = despues ? iconoDespues : iconoAntes;
  const palabra = despues ? palabraDespues : palabraAntes;
  const familia = familiaDeFuenteSinCargar(tema.fuente);
  const tamano = tamanoPalabraQueCabe(palabra, familia);

  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: `${TARJETA_ALTURA_PORCENTAJE}%`,
        transform: `translateX(-50%) scale(${interpolate(pop, [0, 1], [0.9, 1])})`,
        background: "#fff",
        borderRadius: 32,
        boxShadow: despues ? `0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px ${COLOR_EXITO}55` : "0 30px 80px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: `0 ${PADDING_HORIZONTAL_PX}px`,
      }}
    >
      <span style={{ fontSize: 170, lineHeight: 1 }}>{icono}</span>
      <span style={{ fontSize: tamano, fontWeight: 900, lineHeight: 1.05, whiteSpace: "nowrap", textTransform: "uppercase", color: despues ? COLOR_EXITO_BLOQUE : COLOR_ALERTA }}>{palabra}</span>
    </div>
  );
}
