// Números en el control de voz (25 nov 2026): la narración los escribe en
// letras ("trescientos mil pesos") y Whisper los transcribe en dígitos
// ("$300.000", "300 mil", "300000"). Antes de comparar, los dos lados pasan
// por aquí y cada número queda como un solo token en dígitos ("300000"),
// con "%" -> "por ciento" y "$" -> "pesos".

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};
const DECENAS = new Set([30, 40, 50, 60, 70, 80, 90]);
const MILLON = new Set(["millon", "millones"]);
const esNumeroEnLetras = (n: string | undefined) => n !== undefined && Object.prototype.hasOwnProperty.call(UNIDADES, n);

export function normalizarPalabra(p: string): string {
  return p
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]/g, "");
}

export type Token = { n: string; original: string; primeraDeFrase: boolean };

type Pieza = { n: string; original: string; inicioDeFrase: boolean; esDigito: boolean };

// "$300.000," -> ["300000", "pesos"]; "20%" -> ["20", "por", "ciento"];
// "300,000" / "300.000" / "300000" -> "300000". Decimales ("2,5") quedan
// como "25" en los dos lados, igual que antes.
function piezasDe(palabra: string, inicioDeFrase: boolean): Pieza[] {
  const limpia = palabra.replace(/^[¿¡"'“”‘’(«]+/, "").replace(/[.,;:!?"'“”‘’)»]+$/, "");
  const m = limpia.match(/^(\$)?(\d{1,3}(?:[.,]\d{3})+|\d+)(%)?$/);
  if (m) {
    const piezas: Pieza[] = [{ n: m[2].replace(/[.,]/g, ""), original: palabra, inicioDeFrase, esDigito: true }];
    if (m[3]) piezas.push({ n: "por", original: palabra, inicioDeFrase: false, esDigito: false }, { n: "ciento", original: palabra, inicioDeFrase: false, esDigito: false });
    if (m[1]) piezas.push({ n: "pesos", original: palabra, inicioDeFrase: false, esDigito: false });
    return piezas;
  }
  const n = normalizarPalabra(palabra);
  return n ? [{ n, original: palabra, inicioDeFrase, esDigito: false }] : [];
}

export function tokensNormalizados(texto: string, primeraEsInicio = true): Token[] {
  const piezas: Pieza[] = [];
  let inicio = primeraEsInicio;
  for (const w of texto.split(/\s+/)) {
    if (!w) continue;
    piezas.push(...piezasDe(w, inicio));
    inicio = /[.?!;:]$/.test(w);
  }

  const tokens: Token[] = [];
  let i = 0;
  while (i < piezas.length) {
    const p = piezas[i];
    // "por ciento": "ciento" no es número aquí.
    const esPalabraNumero = (p.n === "mil" || esNumeroEnLetras(p.n)) && !(p.n === "ciento" && piezas[i - 1]?.n === "por");
    if (!p.esDigito && !esPalabraNumero) {
      tokens.push({ n: p.n, original: p.original, primeraDeFrase: p.inicioDeFrase });
      i++;
      continue;
    }
    // Número: dígitos (solo los puede seguir mil/millones) o palabras.
    let total = 0;
    let actual = 0;
    let anterior = -1;
    const inicioNumero = i;
    if (p.esDigito) {
      actual = Number(p.n);
      i++;
    }
    while (i < piezas.length) {
      const q = piezas[i];
      if (q.n === "mil") {
        actual = (actual || 1) * 1000;
        total += actual;
        actual = 0;
        anterior = -1;
      } else if (MILLON.has(q.n)) {
        total = (total + (actual || 1)) * 1_000_000;
        actual = 0;
        anterior = -1;
      } else if (!p.esDigito && esNumeroEnLetras(q.n) && !(q.n === "ciento" && piezas[i - 1]?.n === "por") && !q.esDigito) {
        const v = UNIDADES[q.n];
        // "trescientos cinco" suma; "cinco cinco" no es un número.
        if (anterior >= 0 && anterior < 100 && !(DECENAS.has(anterior) && v < 10)) break;
        actual += v;
        anterior = v;
      } else if (!p.esDigito && q.n === "y" && DECENAS.has(anterior) && esNumeroEnLetras(piezas[i + 1]?.n) && UNIDADES[piezas[i + 1].n] < 10) {
        // "treinta y cinco"
      } else break;
      i++;
    }
    const original = piezas
      .slice(inicioNumero, i)
      .map((x) => x.original)
      .filter((o, k, arr) => arr.indexOf(o) === k)
      .join(" ");
    tokens.push({ n: String(total + actual), original, primeraDeFrase: p.inicioDeFrase });
  }
  return tokens;
}
