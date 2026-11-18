import { caracterEnFuentes } from "../glifos";

// Texto gigante del gancho (layout "palabra gigante", 18 nov 2026): una
// idea corta en pantalla aunque la narración diga la frase completa
// ("¿Fotos oscuras?", "¿Sin precio?"). Límites medidos con fontTools sobre
// las 4 fuentes en mayúsculas a 160px: una palabra de 8 caracteres
// ("OSCURAS?") mide 879-921px y cabe en los 950px útiles; las de 9 ya
// pasan de 1000. Con estos límites cabe en 1-2 líneas a 160px o más.
export const LIMITES_TEXTO_GIGANTE = { palabras: 4, caracteres: 16, palabraMasLarga: 8 } as const;

export function problemasTextoGigante(texto: string): string[] {
  const limpio = texto.trim();
  const palabras = limpio.split(/\s+/).filter(Boolean);
  const problemas: string[] = [];
  if (palabras.length === 0) problemas.push("está vacío");
  if (palabras.length > LIMITES_TEXTO_GIGANTE.palabras) problemas.push(`tiene ${palabras.length} palabras (máximo ${LIMITES_TEXTO_GIGANTE.palabras})`);
  if (limpio.length > LIMITES_TEXTO_GIGANTE.caracteres) problemas.push(`tiene ${limpio.length} caracteres (máximo ${LIMITES_TEXTO_GIGANTE.caracteres}, con espacios)`);
  const larga = palabras.find((p) => p.length > LIMITES_TEXTO_GIGANTE.palabraMasLarga);
  if (larga) problemas.push(`"${larga}" tiene ${larga.length} caracteres (máximo ${LIMITES_TEXTO_GIGANTE.palabraMasLarga} por palabra, contando signos)`);
  if ([...limpio].some((c) => !caracterEnFuentes(c))) problemas.push("usa símbolos o emoji (solo letras, números y puntuación)");
  return problemas;
}

// Guiones guardados antes del campo texto_gigante: la primera frase del
// texto del gancho si cumple los límites ("¿Fotos oscuras?"), si no la
// palabra clave; si nada cumple, las primeras palabras de la clave que sí.
export function textoGiganteDeRespaldo(texto: string, palabraClave: string): string {
  const primeraFrase = texto.split(/(?<=[?.!])\s+/)[0] ?? "";
  for (const candidato of [primeraFrase, palabraClave]) {
    if (candidato && problemasTextoGigante(candidato).length === 0) return candidato.trim();
  }
  const palabras = palabraClave.split(/\s+/).filter((p) => p.length <= LIMITES_TEXTO_GIGANTE.palabraMasLarga);
  let resultado = "";
  for (const p of palabras.slice(0, LIMITES_TEXTO_GIGANTE.palabras)) {
    const siguiente = resultado ? `${resultado} ${p}` : p;
    if (siguiente.length > LIMITES_TEXTO_GIGANTE.caracteres) break;
    resultado = siguiente;
  }
  return resultado || palabraClave.slice(0, LIMITES_TEXTO_GIGANTE.palabraMasLarga);
}

// Reparte un texto en líneas con el tamaño de letra más grande que quepa
// en una caja (layout "palabra gigante"). Función pura: recibe cómo medir
// (en el render es measureText de @remotion/layout-utils; en los tests,
// una medida falsa), para poder probarla sin navegador.
export type MedirTexto = (texto: string, tamano: number) => number;

export type OpcionesTextoGigante = {
  ancho: number;
  alto: number;
  maxLineas: number;
  tamanoMin: number;
  tamanoMax: number;
  interlineado: number;
};

export function partirEnLineas(palabras: string[], tamano: number, ancho: number, medir: MedirTexto): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (!actual || medir(candidata, tamano) <= ancho) actual = candidata;
    else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export function ajustarTextoGigante(texto: string, medir: MedirTexto, o: OpcionesTextoGigante): { tamano: number; lineas: string[] } {
  const palabras = texto.split(/\s+/).filter(Boolean);
  for (let tamano = o.tamanoMax; tamano >= o.tamanoMin; tamano -= 4) {
    const lineas = partirEnLineas(palabras, tamano, o.ancho, medir);
    const cabeAncho = lineas.every((l) => medir(l, tamano) <= o.ancho);
    if (cabeAncho && lineas.length <= o.maxLineas && lineas.length * tamano * o.interlineado <= o.alto) return { tamano, lineas };
  }
  return { tamano: o.tamanoMin, lineas: partirEnLineas(palabras, o.tamanoMin, o.ancho, medir) };
}

// Índices de las palabras del texto que forman la palabra clave (la
// primera vez que aparece seguida), para pintarlas con la luz de la
// marca. Compara sin tildes, mayúsculas ni puntuación.
function normalizar(p: string): string {
  return p
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

export function indicesPalabraClave(palabras: string[], palabraClave: string): Set<number> {
  const clave = palabraClave.split(/\s+/).map(normalizar).filter(Boolean);
  const texto = palabras.map(normalizar);
  if (clave.length === 0) return new Set();
  for (let i = 0; i + clave.length <= texto.length; i++) {
    if (clave.every((c, k) => texto[i + k] === c)) return new Set(clave.map((_, k) => i + k));
  }
  return new Set();
}
