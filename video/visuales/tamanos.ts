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
