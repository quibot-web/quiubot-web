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
// Solo DATOS U OFERTAS CONCRETAS (24 nov 2026): una cifra, un %, un
// plazo, un horario, "envío gratis", "2x1", "garantía de 1 año", "12
// cuotas". Nombrar el concepto en un consejo ("no regales descuentos",
// "explica tu garantía", "ofrece cuotas", "publica tu horario") NO es un
// dato y pasa.
// Con número: el valor (o su número) tiene que estar en las fuentes.
const PATRONES_DATO: { etiqueta: string; patron: RegExp }[] = [
  { etiqueta: "precio", patron: /\$\s?\d[\d.,]*(?:\s?(?:mil|k))?/g },
  { etiqueta: "porcentaje", patron: /\b\d{1,3}\s?%/g },
  { etiqueta: "hora", patron: /\b\d{1,2}(?::\d{2})?\s?(?:a\.?\s?m\.?|p\.?\s?m\.?|am|pm)(?![a-z])/g },
  { etiqueta: "horario", patron: /\bde \d{1,2}(?::\d{2})? a \d{1,2}(?::\d{2})?\b|\b24\s?\/\s?7\b/g },
  { etiqueta: "promoción", patron: /\b\d\s?x\s?\d\b/g },
  { etiqueta: "garantía", patron: /\bgarant[ií]as? de \d+\s?(?:a[nñ]os?|mes(?:es)?|d[ií]as?)\b|\b\d+\s?(?:a[nñ]os?|mes(?:es)?|d[ií]as?) de garant[ií]a\b/g },
  { etiqueta: "cuotas", patron: /\b\d+\s?cuotas\b|\bhasta \d+\s?cuotas\b/g },
  { etiqueta: "plazo", patron: /\b(?:entrega|env[ií]o|despacho|llega|te llega|lo recibes)\b[^.\n]{0,20}?\b(?:en )?\d+\s?(?:h|horas?|d[ií]as?(?: h[aá]biles)?)\b/g },
];
// Ofertas concretas sin número: tienen que estar escritas en las fuentes.
const OFERTAS_SIN_NUMERO: { etiqueta: string; patron: RegExp }[] = [
  { etiqueta: "envío gratis", patron: /\benv[ií]os? gratis\b|\bdomicilios? gratis\b|\benv[ií]o sin costo\b/ },
  { etiqueta: "cuotas sin interés", patron: /\bcuotas sin inter[eé]s(?:es)?\b|\bsin intereses\b/ },
  { etiqueta: "devolución gratis", patron: /\bdevoluci[oó]n(?:es)? gratis\b/ },
];

const soloDigitos = (s: string) => s.replace(/[^\d]/g, "");
const compacto = (s: string) => s.replace(/\s+/g, "");

export function detectarDatosInventados(textosGuion: string[], fuentesReales: string): string[] {
  // Se busca en el texto en minúsculas CON tildes (los patrones aceptan
  // las dos formas) para que el motivo muestre lo que dice el guion; se
  // compara contra las fuentes sin tildes.
  const guion = textosGuion.join(" \n ").toLowerCase();
  const fuentes = normalizar(fuentesReales);
  // Cada número que escribió el usuario o está en los datos de la marca ("$45.000" -> 45000).
  const numerosFuentes = new Set([...fuentes.matchAll(/\d[\d.,:]*/g)].map((m) => soloDigitos(m[0])));
  const problemas: string[] = [];
  for (const { etiqueta, patron } of PATRONES_DATO) {
    for (const m of guion.matchAll(patron)) {
      const valor = m[0].trim();
      const digitos = soloDigitos(valor);
      const esta = compacto(fuentes).includes(compacto(normalizar(valor))) || (etiqueta !== "promoción" && digitos !== "" && numerosFuentes.has(digitos));
      if (!esta) problemas.push(`el guion dice "${valor}" (${etiqueta}) y ese dato no lo escribió el usuario ni está en los datos de la marca -- no lo inventes`);
    }
  }
  for (const { etiqueta, patron } of OFERTAS_SIN_NUMERO) {
    if (patron.test(guion) && !patron.test(fuentes)) problemas.push(`el guion promete "${etiqueta}" y eso no lo escribió el usuario ni está en los datos de la marca -- no lo inventes`);
  }
  return [...new Set(problemas)];
}

// ---------- Series (24 nov 2026): cada parte funciona sola y se siente serie ----------
export type ContextoSerie = { parte: number; total: number; ideaAnterior?: string | null; ideaSiguiente?: string | null };

// "Parte 2 de 3.\n..." -> { parte: 2, total: 3 } (el encabezado que pone
// la propuesta de serie al comienzo de la idea de cada parte).
export function serieDesdeIdea(idea: string | null | undefined): { parte: number; total: number } | null {
  const m = /^\s*parte (\d) de (\d)\b/i.exec(idea ?? "");
  if (!m) return null;
  const parte = Number(m[1]);
  const total = Number(m[2]);
  return total >= 2 && total <= MAX_PARTES_SERIE && parte >= 1 && parte <= total ? { parte, total } : null;
}

const ADELANTO = /\b(ma[nñ]ana|pr[oó]xim[oa]|siguiente|en la parte (dos|tres|2|3)|la otra parte|despu[eé]s te (muestro|cuento|ense[nñ]o))\b/i;
const LLAMADO = /\b(gu[aá]rd(a|alo|ala|en)|s[ií]gue(me|nos)?|s[ií]guenos)\b/i;
const REPASO = /\b(ayer|en la parte (uno|dos|1|2)|en el (reel|video) anterior|antes (vimos|te mostr[eé])|ya (viste|vimos)|la vez pasada|recuerda que)\b/i;

// Problemas de una parte de serie (para el reintento de la IA). Los
// textos van en orden: gancho primero, cierre al final.
export function problemasDeParteDeSerie(narraciones: string[], serie: ContextoSerie): string[] {
  const problemas: string[] = [];
  const inicio = narraciones.slice(0, 2).join(" ");
  const cierre = narraciones.slice(-2).join(" ");
  if (serie.parte < serie.total) {
    if (!ADELANTO.test(cierre)) problemas.push(`parte ${serie.parte} de ${serie.total}: el cierre tiene que adelantar en concreto lo que viene en la parte ${serie.parte + 1} (ej. "Mañana: cómo ...")`);
    if (!LLAMADO.test(cierre)) problemas.push(`parte ${serie.parte} de ${serie.total}: el cierre tiene que pedir guardar el reel o seguir la cuenta para no perderse la siguiente parte`);
  }
  if (serie.parte > 1 && !REPASO.test(inicio)) {
    problemas.push(`parte ${serie.parte} de ${serie.total}: después del gancho, repasa en UNA frase lo de la parte anterior (ej. "Ayer viste que ..."), para que quien llega nuevo entienda`);
  }
  return problemas;
}
