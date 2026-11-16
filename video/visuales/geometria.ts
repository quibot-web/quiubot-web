// Adaptado de video/fixtures/organico/referencia/visuales/geometria.ts
// (Fase A, aprobado) -- ESTOS NÚMEROS CAMBIARON respecto al original
// (que llenaba toda la zona segura, 25%-65%, porque esos reels no
// tenían subtítulos). Acá SubtitulosSincronizados.tsx ocupa una franja
// fija al pie de la zona segura (54%-65%, ver ese archivo) -- bug real
// encontrado al revisar los cuadros del spike de ReelAutomatico: el
// "mensajes nuevos" de CelularChat (centrado en su tarjeta, que antes
// llegaba hasta 65%) se superponía con los subtítulos.
//
// Respiro de 5 puntos antes de esa franja (antes 3) tras el control de
// calidad por visión marcando "texto_superpuesto" en staging --
// probado a fondo con texto cerca del máximo (28 car.) y narraciones
// largas (hasta 20 palabras) sin lograr reproducir una superposición
// real: lo más probable es que el modelo de visión haya sido
// demasiado estricto con 2 bloques de texto en negrita cerca uno del
// otro sin tocarse (ver el prompt ajustado en
// app/api/admin/reel-automatico-prueba/control-calidad/route.ts).
//
// TARJETA_TOP_PORCENTAJE NO puede arrancar en 15% -- bug real
// encontrado generando un reel completo de punta a punta (16 nov
// 2026): video/capas/Bucle.tsx y video/capas/Logo.tsx viven los dos en
// top:16% (la esquina superior, un chip de bucle + el logo de marca),
// pensados para un reel SIN voz donde el visual empezaba en 25% --
// moverlo a 15% para "aprovechar el espacio vacío de un titular que ya
// no existe" ignoró que esa esquina NO está vacía, esos 2 elementos
// siguen ahí. Arranca en 22% (después de esa esquina) con un poco
// menos de alto para seguir terminando antes de la franja de
// subtítulos.
export const TARJETA_TOP_PORCENTAJE = 22;
export const TARJETA_ALTURA_PORCENTAJE = 27; // termina en 49%, 5 puntos antes de la franja de subtítulos (54%-65%)
export const TARJETA_ANCHO_PORCENTAJE = 80;
