// "Tu idea para el video" (/contenido, 24 nov 2026): el usuario puede
// escribir un tema corto o su propia idea desarrollada (puntos, ejemplo,
// frase de cierre) y el reel la sigue. Puro: lo usan el formulario, las
// rutas y la validación del guion.

export const LIMITE_IDEA = 1500;
// Lo que cabe en un reel de ~30 s con voz: gancho + 3 consejos + cierre.
export const MAX_PUNTOS_POR_REEL = 3;
export const MAX_PARTES_SERIE = 3;

export type TipoIdea = "vacia" | "tema" | "idea";

// Un tema es corto, de una sola línea ("cómo elegir la talla correcta");
// todo lo demás es una idea desarrollada que el guion debe respetar.
export function clasificarIdea(texto: string | null | undefined): TipoIdea {
  const t = (texto ?? "").trim();
  if (!t) return "vacia";
  const palabras = t.split(/\s+/).length;
  if (t.length <= 140 && !/\n/.test(t) && palabras <= 22) return "tema";
  return "idea";
}

const VINETA = /^\s*(?:[-•*·]|\d{1,2}[.)-]|(?:primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo|luego|despu[eé]s|por [uú]ltimo|finalmente)\b[,:]?)\s*/i;

// Puntos que el usuario numeró o marcó (viñetas, "1.", "Primero:", ...).
// Una idea en prosa sin puntos marcados devuelve [].
export function puntosDeLaIdea(texto: string): string[] {
  return texto
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => VINETA.test(l) && l.replace(VINETA, "").trim().length >= 3)
    .map((l) => l.replace(VINETA, "").trim());
}

// Lo que va antes del primer punto (introducción) y después del último (cierre).
function marcoDeLaIdea(texto: string): { intro: string[]; cierre: string[] } {
  const lineas = texto.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const primero = lineas.findIndex((l) => VINETA.test(l));
  let ultimo = -1;
  lineas.forEach((l, i) => {
    if (VINETA.test(l)) ultimo = i;
  });
  if (primero === -1) return { intro: lineas, cierre: [] };
  return { intro: lineas.slice(0, primero), cierre: lineas.slice(ultimo + 1) };
}

export type PropuestaSerie = { motivo: string; partes: { titulo: string; idea: string }[] };

// Más de 3 puntos no caben en un reel de ~30 s: se propone una serie de
// 2-3 reels que reparte los puntos EN SU ORDEN, sin perder ninguno, con la
// introducción en todas y el cierre en la última. Más de 9 puntos: ni en
// una serie (null: hay que acortar la idea).
export function proponerSerie(texto: string): PropuestaSerie | null | "cabe" {
  const puntos = puntosDeLaIdea(texto);
  if (puntos.length <= MAX_PUNTOS_POR_REEL) return "cabe";
  const cantidad = Math.ceil(puntos.length / MAX_PUNTOS_POR_REEL);
  if (cantidad > MAX_PARTES_SERIE) return null;
  const porParte = Math.ceil(puntos.length / cantidad);
  const { intro, cierre } = marcoDeLaIdea(texto);
  const partes = Array.from({ length: cantidad }, (_, k) => {
    const suyos = puntos.slice(k * porParte, (k + 1) * porParte);
    const lineas = [...intro, ...suyos.map((p, i) => `${k * porParte + i + 1}. ${p}`), ...(k === cantidad - 1 ? cierre : [])];
    return { titulo: `Parte ${k + 1} de ${cantidad}: ${suyos[0].slice(0, 60)}`, idea: `Parte ${k + 1} de ${cantidad}.\n${lineas.join("\n")}`.slice(0, LIMITE_IDEA) };
  });
  return { motivo: `Tu idea tiene ${puntos.length} puntos y un reel de ~30 segundos alcanza para ${MAX_PUNTOS_POR_REEL}.`, partes };
}

function normalizar(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const VACIAS = new Set(["porque", "cuando", "donde", "desde", "hasta", "entre", "sobre", "tiene", "tienes", "puedes", "hacer", "siempre", "nunca", "mucho", "muchos", "mucha", "otros", "otras", "todos", "todas", "cliente", "clientes", "negocio", "tambien", "ademas", "luego", "primero", "segundo", "tercero", "despues", "ultimo", "finalmente"]);

// Raíces (6 letras) de las palabras con contenido de un punto.
function raices(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-zñ0-9]+/)
    .filter((p) => p.length >= 5 && !VACIAS.has(p))
    .map((p) => p.slice(0, 6));
}

// La idea del usuario respetada: cada punto marcado se trata en el guion
// y en el mismo orden. Tolerante con la redacción (el guion adapta las
// frases al formato reel): basta una raíz de palabra con contenido del
// punto. Devuelve problemas para el reintento de la IA.
export function verificarIdeaRespetada(idea: string, textosGuion: string[]): string[] {
  const puntos = puntosDeLaIdea(idea);
  if (puntos.length === 0) return [];
  const texto = normalizar(textosGuion.join(" \n "));
  const problemas: string[] = [];
  let posicionAnterior = -1;
  puntos.forEach((p, i) => {
    const posiciones = raices(p)
      .map((r) => texto.indexOf(r))
      .filter((x) => x >= 0);
    if (posiciones.length === 0) {
      problemas.push(`el punto ${i + 1} de la idea del usuario ("${p.slice(0, 80)}") no aparece en el guion -- trátalo con sus palabras`);
      return;
    }
    const posicion = Math.min(...posiciones.filter((x) => x > posicionAnterior), Infinity);
    if (posicion === Infinity) problemas.push(`el punto ${i + 1} de la idea del usuario ("${p.slice(0, 80)}") va antes de lo que el usuario pidió -- respeta el orden de sus puntos`);
    else posicionAnterior = posicion;
  });
  return problemas;
}

// ---------- Datos reales ----------
// Los datos concretos que el usuario escribió en su idea (precio, horario,
// envío, promoción) son datos reales de la marca y se pueden decir y
// mostrar. Uno que no esté en la idea ni en los datos de la marca es
// inventado y se rechaza.
const PATRONES_DATO: { etiqueta: string; patron: RegExp }[] = [
  { etiqueta: "precio", patron: /\$\s?\d[\d.,]*(?:\s?(?:mil|k))?/g },
  { etiqueta: "porcentaje", patron: /\b\d{1,3}\s?%/g },
  { etiqueta: "hora", patron: /\b\d{1,2}(?::\d{2})?\s?(?:a\.?\s?m\.?|p\.?\s?m\.?|am|pm)(?![a-z])/g },
  { etiqueta: "promoción", patron: /\b\d\s?x\s?\d\b/g },
];
const CLAVES_SIN_VALOR: { etiqueta: string; patron: RegExp }[] = [
  { etiqueta: "envío gratis", patron: /\benv[ií]os? gratis\b|\bdomicilios? gratis\b/ },
  { etiqueta: "garantía", patron: /\bgarant[ií]as?\b/ },
  { etiqueta: "cuotas", patron: /\bcuotas?\b|\ba plazos\b/ },
  { etiqueta: "descuento", patron: /\bdescuentos?\b/ },
];

const soloDigitos = (s: string) => s.replace(/[^\d]/g, "");
const compacto = (s: string) => s.replace(/\s+/g, "");

export function detectarDatosInventados(textosGuion: string[], fuentesReales: string): string[] {
  const guion = normalizar(textosGuion.join(" \n "));
  const fuentes = normalizar(fuentesReales);
  // Cada número que escribió el usuario o está en los datos de la marca ("$45.000" -> 45000).
  const numerosFuentes = new Set([...fuentes.matchAll(/\d[\d.,:]*/g)].map((m) => soloDigitos(m[0])));
  const problemas: string[] = [];
  for (const { etiqueta, patron } of PATRONES_DATO) {
    for (const m of guion.matchAll(patron)) {
      const valor = m[0].trim();
      const digitos = soloDigitos(valor);
      const esta = compacto(fuentes).includes(compacto(valor)) || (etiqueta !== "promoción" && digitos !== "" && numerosFuentes.has(digitos));
      if (!esta) problemas.push(`el guion dice "${valor}" (${etiqueta}) y ese dato no lo escribió el usuario ni está en los datos de la marca -- no lo inventes`);
    }
  }
  for (const { etiqueta, patron } of CLAVES_SIN_VALOR) {
    if (patron.test(guion) && !patron.test(fuentes)) problemas.push(`el guion promete "${etiqueta}" y eso no lo escribió el usuario ni está en los datos de la marca -- no lo inventes`);
  }
  return [...new Set(problemas)];
}
