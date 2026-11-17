// Fuente única de los tamaños/anchos del molde aprobado -- separado
// de los componentes (CelularChat.tsx, BotonEstado.tsx, Contador.tsx,
// SubtitulosSincronizados.tsx) a propósito: esos archivos importan
// Remotion/fuentes (video/fuentes.ts llama loadFont() en el nivel del
// módulo, un efecto secundario real) -- validarGeometriaMinima.ts
// necesitaba estos números SIN arrastrar esa cadena de imports. Bug
// real encontrado escribiendo el primer test de esta validación:
// "Failed to parse URL from /fonts/Nunito-variable.woff2" en
// vitest/Node en cuanto algo importaba uno de esos componentes solo
// para leer una constante.
export const ANCHO_BOTON_PORCENTAJE_NUM = ((1080 * 0.88 * 0.8) / 1080) * 100;
export const TAMANO_FUENTE_BOTON = 52;
export const TAMANO_FUENTE_SUBTITULOS = 44;
export const TAMANO_FUENTE_CONTADOR_GIGANTE = 280;
export const TAMANO_FUENTE_ETIQUETA_CONTADOR_GIGANTE = 44;
export const TAMANO_FUENTE_MENSAJE = 40;
export const TAMANO_FUENTE_NOTIFICACION = 40;
export const TAMANO_FUENTE_NUMERO_GIGANTE = 260;
export const TAMANO_FUENTE_ETIQUETA_NUMERO_GIGANTE = 44;

// Ronda J: gemelo SIN efecto secundario de video/fuentes.ts's
// familiaDeFuente() -- BotonEstado.tsx necesita el nombre real de la
// familia (no solo heredarlo por CSS) para medir el texto de verdad
// con @remotion/layout-utils ANTES de pintarlo, y fuentes.ts no se
// puede importar aquí por el mismo motivo de siempre (su loadFont() a
// nivel de módulo rompe Vitest/Node). Si se agrega un EstiloFuente
// nuevo en tema.ts, este mapa también se actualiza -- son 4 líneas,
// el riesgo de que se desalineen es bajo y se nota de inmediato (un
// test real lo compara contra fuentes.ts).
import type { EstiloFuente } from "../tema";
const FAMILIA_POR_ESTILO_SIN_CARGAR: Record<EstiloFuente, string> = {
  impacto: "Bebas Neue",
  moderna: "Poppins",
  elegante: "Playfair Display",
  amigable: "Nunito",
};
export function familiaDeFuenteSinCargar(estilo: EstiloFuente): string {
  return FAMILIA_POR_ESTILO_SIN_CARGAR[estilo];
}
