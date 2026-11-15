// Geometría compartida de las "tarjetas" (celular/anuncio simulado) del
// Reel 1 -- revisión del usuario (15 nov 2026): el elemento principal
// debe ocupar 70-85% del ancho y "llenar la pantalla" dentro de la zona
// segura (14% arriba, 35% abajo libres -- video/capas/ZonaSegura.tsx),
// no quedar chico con grandes áreas vacías alrededor. En vez de simular
// un celular a proporción real (9:18.5, que a este ancho se saldría muy
// por fuera de la zona segura por arriba/abajo), la tarjeta es una
// "pantalla" más plana -- se lee igual de bien como "celular" con un
// borde superior oscuro, pero su alto real cabe en la zona segura.
export const TITULAR_TOP_PORCENTAJE = 15;
// La mayoría de los titulares reales (≤8 palabras, Poppins 64px, 84% de
// ancho) envuelven a 2 líneas -- la tarjeta arranca después de eso, no a
// un número fijo que asumiera 1 sola línea (eso la hacía chocar con el
// titular en la v1 de esta revisión).
export const TARJETA_TOP_PORCENTAJE = 25;
export const TARJETA_ALTURA_PORCENTAJE = 40; // termina justo en 65% = límite de la zona segura
export const TARJETA_ANCHO_PORCENTAJE = 80;
