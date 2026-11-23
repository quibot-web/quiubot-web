// Segundo control después del render (23 nov 2026): Whisper transcribe el
// audio FINAL y se compara con la narración del guion. Solo sirve para
// palabras que faltan del todo: una palabra mordida puede transcribirse
// completa ("cribe" -> "Escribe"), por eso el control principal es la
// energía (controlArranquesVoz.ts). Tolerante a errores normales de
// Whisper (una letra distinta, "Quiubot" -> "Kiubot"); estricto con la
// primera palabra de cada frase.

export function normalizarPalabra(p: string): string {
  return p
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]/g, "");
}

function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function parecidas(a: string, b: string): boolean {
  if (a === b) return true;
  return distancia(a, b) <= Math.max(1, Math.floor(Math.min(a.length, b.length) / 3));
}

export type PalabraFaltante = { palabra: string; escena_id: string; primeraDeFrase: boolean };

export function palabrasFaltantes(narraciones: { id: string; narracion: string }[], transcripcion: string): PalabraFaltante[] {
  const esperadas: { n: string; original: string; escena_id: string; primeraDeFrase: boolean }[] = [];
  for (const e of narraciones) {
    let inicioDeFrase = true;
    for (const w of e.narracion.split(/\s+/)) {
      const n = normalizarPalabra(w);
      if (!n) continue;
      esperadas.push({ n, original: w.replace(/[.,;:!?¿¡"]/g, ""), escena_id: e.id, primeraDeFrase: inicioDeFrase });
      inicioDeFrase = /[.?!;:]$/.test(w);
    }
  }
  const oidas = transcripcion.split(/\s+/).map(normalizarPalabra).filter(Boolean);

  // Alineación (subsecuencia común más larga, con palabras "parecidas").
  const A = esperadas.length;
  const B = oidas.length;
  const L = Array.from({ length: A + 1 }, () => new Array<number>(B + 1).fill(0));
  for (let i = A - 1; i >= 0; i--)
    for (let j = B - 1; j >= 0; j--) L[i][j] = parecidas(esperadas[i].n, oidas[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const faltantes: PalabraFaltante[] = [];
  let i = 0;
  let j = 0;
  while (i < A) {
    if (j < B && parecidas(esperadas[i].n, oidas[j])) {
      i++;
      j++;
    } else if (j < B && L[i][j + 1] >= L[i + 1][j]) {
      j++;
    } else {
      const e = esperadas[i];
      // Palabras de 1-2 letras ("a", "y", "de") Whisper a veces las omite
      // sin que falten; cuentan solo si abren la frase.
      if (e.n.length >= 3 || e.primeraDeFrase) faltantes.push({ palabra: e.original, escena_id: e.escena_id, primeraDeFrase: e.primeraDeFrase });
      i++;
    }
  }
  return faltantes;
}

export function hallazgosPalabrasFaltantes(faltantes: PalabraFaltante[]): string[] {
  return faltantes.map((f) => `Falta ${f.primeraDeFrase ? "la primera palabra de una frase" : "una palabra"} en el audio del video: "${f.palabra}" (escena ${f.escena_id}).`);
}
