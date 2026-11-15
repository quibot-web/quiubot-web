// "Arco de color" de problema -> arreglo (pedido explícito del usuario,
// v3): cada escena de problema/arreglo del bloque valor usa estos dos
// acentos -- naranja/rojo en el momento de problema, verde en el
// momento en que se arregla -- en bordes, íconos y un tinte sutil de
// fondo. COLOR_ALERTA es el mismo que ya usa el bloque "problema" de
// los anuncios (video/tema.ts: COLOR_ALERTA_PRIMARIO) -- mismo
// significado visual en todo el proyecto, nunca un rojo inventado
// aparte. COLOR_EXITO es el mismo verde que ya usa WhatsApp en todo
// este reel (burbujas propias, insignia de conexión).
import { COLOR_ALERTA_PRIMARIO } from "../../../../tema";

export const COLOR_ALERTA = COLOR_ALERTA_PRIMARIO;
export const COLOR_EXITO = "#25D366";

// Variantes OSCURAS, solo para texto blanco encima de un recuadro
// sólido (pedido explícito, v3: "el texto de color siempre va sobre un
// recuadro sólido... con contraste verificado, 4.5:1 o más"). Blanco
// sobre COLOR_ALERTA/COLOR_EXITO normales NO llega a 4.5:1 (se midió
// con contrasteSuficiente() de video/tema.ts: 3.95 y 1.98
// respectivamente -- el verde de WhatsApp en particular es demasiado
// claro para texto blanco encima). Estas 2 sí lo cumplen (5.38 y 5.43).
// Los usos existentes de COLOR_ALERTA/COLOR_EXITO que NO son texto
// encima (anillos, bordes punteados, barras) se quedan como están.
export const COLOR_ALERTA_BLOQUE = "#C23A09";
export const COLOR_EXITO_BLOQUE = "#0F7A3C";
