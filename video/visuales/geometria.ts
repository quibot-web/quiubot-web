// Adaptado de video/fixtures/organico/referencia/visuales/geometria.ts
// (Fase A, aprobado) -- ESTOS NÚMEROS CAMBIARON respecto al original
// (que llenaba toda la zona segura, 25%-65%, porque esos reels no
// tenían subtítulos). Acá SubtitulosSincronizados.tsx ocupa una franja
// fija al pie de la zona segura (54%-65%, ver ese archivo) -- bug real
// encontrado al revisar los cuadros del spike de ReelAutomatico: el
// "mensajes nuevos" de CelularChat (centrado en su tarjeta, que antes
// llegaba hasta 65%) se superponía con los subtítulos. La tarjeta/zona
// visual ahora termina en 51%, con un respiro de 3 puntos antes de esa
// franja, y arranca en 15% (no 25%: sin un "titular" aparte arriba --
// la narración ya cumple ese papel -- ese espacio quedaba vacío).
export const TARJETA_TOP_PORCENTAJE = 15;
export const TARJETA_ALTURA_PORCENTAJE = 36; // termina en 51%, antes de la franja de subtítulos (54%-65%)
export const TARJETA_ANCHO_PORCENTAJE = 80;
