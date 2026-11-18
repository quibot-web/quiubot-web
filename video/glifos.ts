// Caracteres que TODAS nuestras fuentes (video/fuentes.ts: Poppins, Bebas
// Neue, Playfair Display, Nunito) dibujan de verdad -- verificado con
// fontTools contra el cmap real de los .woff2 (18 nov 2026): ASCII
// imprimible completo, Latin-1 (U+00A0-U+00FF) menos "µ", y la
// tipografía de abajo. Bebas Neue NO trae Latin Extendido-A (Ā, Č...),
// por eso no basta con "cualquier letra latina".
//
// El render corre en el navegador de cada cliente: un carácter fuera de
// esta lista depende de una fuente de respaldo de ese computador y puede
// salir como cuadro blanco. Congelado a propósito (no se recalcula en
// cada build); si se agrega una fuente, volver a verificar.
const PATRON_CARACTER_EN_FUENTES = /[ -~ -´¶-ÿ–—‘’“”…€]/u;

export function caracterEnFuentes(c: string): boolean {
  return PATRON_CARACTER_EN_FUENTES.test(c);
}

// Quita del texto todo lo que nuestras fuentes no dibujan (emoji,
// flechas, ✓...). Red de seguridad al PINTAR textos ya guardados; lo
// nuevo que genera la IA ya viene limpio (validarEdicionDesdeAudio).
export function quitarGlifosFueraDeFuentes(texto: string): string {
  return [...texto].filter(caracterEnFuentes).join("").replace(/\s{2,}/g, " ").trim();
}
