// Adaptado de video/fixtures/organico/referencia/visuales/geometria.ts
// (Fase A, aprobado) -- ESTOS NÚMEROS CAMBIARON respecto al original
// (que llenaba toda la zona segura, 25%-65%, porque esos reels no
// tenían subtítulos). Acá SubtitulosSincronizados.tsx ocupa una franja
// fija al pie de la zona segura (54%-65%, ver ese archivo) -- bug real
// encontrado al revisar los cuadros del spike de ReelAutomatico: el
// "mensajes nuevos" de CelularChat (centrado en su tarjeta, que antes
// llegaba hasta 65%) se superponía con los subtítulos. La tarjeta/zona
// visual arranca en 15% (no 25%: sin un "titular" aparte arriba -- la
// narración ya cumple ese papel -- ese espacio quedaba vacío).
//
// Respiro ampliado a 5 puntos (antes 3) tras el control de calidad por
// visión marcando "texto_superpuesto" en la escena "marca" (boton_estado)
// en staging -- probado a fondo con texto cerca del máximo (28 car.) y
// narraciones largas (hasta 20 palabras) sin lograr reproducir una
// superposición real (video/visuales/ReelAutomatico.tsx, spike
// descartable): lo más probable es que el modelo de visión haya sido
// demasiado estricto con 2 bloques de texto en negrita cerca uno del
// otro sin tocarse (ver el prompt ajustado en
// app/api/admin/reel-automatico-prueba/control-calidad/route.ts). Este
// respiro extra es la mitigación de margen, por si acaso.
export const TARJETA_TOP_PORCENTAJE = 15;
export const TARJETA_ALTURA_PORCENTAJE = 34; // termina en 49%, 5 puntos antes de la franja de subtítulos (54%-65%)
export const TARJETA_ANCHO_PORCENTAJE = 80;
