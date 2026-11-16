// Promovido tal cual desde video/fixtures/organico/referencia/visuales/
// acento.ts (Fase A, aprobado). COLOR_ALERTA es el mismo que ya usa el
// bloque "problema" de los anuncios (video/tema.ts: COLOR_ALERTA_PRIMARIO)
// -- mismo significado visual en todo el proyecto. COLOR_ALERTA_BLOQUE/
// COLOR_EXITO_BLOQUE son las variantes verificadas con contrasteSuficiente()
// (5.38:1 y 5.43:1 con texto blanco) para cuando el color va detrás de
// texto blanco sólido -- los normales (3.95:1 y 1.98:1) no alcanzan.
import { COLOR_ALERTA_PRIMARIO } from "../tema";

export const COLOR_ALERTA = COLOR_ALERTA_PRIMARIO;
export const COLOR_EXITO = "#25D366";
export const COLOR_ALERTA_BLOQUE = "#C23A09";
export const COLOR_EXITO_BLOQUE = "#0F7A3C";
