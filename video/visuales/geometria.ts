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
// Tarjetas de solo texto (comparacion, checklist): crecen al máximo que
// permite la regla del molde (70-85% del ancho, validarGeometriaMinima)
// para que el texto de 40px o más quepa sin verse apretado.
export const TARJETA_ANCHO_AMPLIO_PORCENTAJE = 85;

// Layout "objeto protagonista" (sistema de estilos): sin tarjeta, el
// visual se dibuja directo sobre el fondo y ocupa más. Centrado en la zona
// segura entre el letrero de arriba (termina ~20%) y los subtítulos, que
// van justo debajo (FRANJA_SUBTITULOS_ESTILO). Revisión de Noche: antes
// el objeto quedaba en el 15-40% de la altura con mucho vacío abajo.
// Revisión del paso 3: el bloque vivía arriba y dejaba ~40% vacío abajo.
// Baja un poco: objeto 24%-59%, subtítulos 60%-68%. El 20% inferior lo
// tapa la interfaz de Instagram (caption y botones): el bloque termina en
// 68%, con margen.
export const PROTAGONISTA_TOP_PORCENTAJE = 24;
export const PROTAGONISTA_ALTURA_PORCENTAJE = 35; // termina en 59%
export const PROTAGONISTA_ANCHO_PORCENTAJE = 88;
// Subtítulos con estilo: justo debajo del objeto (antes 54%-65%, con el
// objeto terminando en 49%).
export const FRANJA_SUBTITULOS_ESTILO = { top: 60, alto: 8 };
// Límite inferior del contenido con estilo: debajo lo tapa Instagram.
export const LIMITE_INFERIOR_INSTAGRAM_PORCENTAJE = 80;
// Centro vertical del objeto (37%) vs. el de la tarjeta de siempre
// (TARJETA_TOP + ALTURA/2 = 35,5%): cuánto bajan las tarjetas flotantes.
export const CENTRO_PROTAGONISTA_PORCENTAJE = PROTAGONISTA_TOP_PORCENTAJE + PROTAGONISTA_ALTURA_PORCENTAJE / 2;
