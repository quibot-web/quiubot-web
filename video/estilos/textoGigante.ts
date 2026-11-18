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
