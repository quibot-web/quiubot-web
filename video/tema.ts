// ADN de marca -> tema visual del video (campo "tema" del guion, sección 4
// del plan). Se calcula aquí, en código, y NUNCA se le pide a la IA que
// invente los hex: así no depende de que el modelo haga bien la
// matemática de contraste WCAG. Reusa la misma fórmula de contraste que
// ya existe en Mi marca (app/marca/page.tsx: hexARgb/luminanciaRelativa/
// contrasteHex/elegirColorConContraste) -- esas funciones son privadas a
// esa página, así que se replican aquí tal cual, pero con un umbral más
// estricto: ahí el 1.3 es para un trazo decorativo con glow, aquí el
// color se usa para TEXTO legible, así que se exige el 4.5 que pide WCAG.

export type EstiloFuente = "impacto" | "moderna" | "elegante" | "amigable";

const COLOR_PRIMARIO_DEFECTO = "#534AB7";
const COLOR_SECUNDARIO_DEFECTO = "#7F77DD";
const COLOR_FONDO_DEFECTO = "#0D0A22";
const COLOR_TEXTO_CLARO = "#FFFFFF";
const COLOR_TEXTO_OSCURO = "#111111";

// WCAG AA para texto normal. El 1.3 de Mi marca es a propósito más laxo
// porque ahí es un trazo decorativo, no texto -- aquí sí es texto.
const UMBRAL_CONTRASTE_TEXTO = 4.5;

function esHexValido(v: unknown): v is string {
  return typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}

function hexARgb(hex: string): [number, number, number] {
  let limpio = hex.replace("#", "");
  if (limpio.length === 3) limpio = limpio.split("").map((c) => c + c).join("");
  const num = parseInt(limpio, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function luminanciaRelativa(hex: string): number {
  const [r, g, b] = hexARgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrasteHex(hex1: string, hex2: string): number {
  const l1 = luminanciaRelativa(hex1);
  const l2 = luminanciaRelativa(hex2);
  const [claro, oscuro] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (claro + 0.05) / (oscuro + 0.05);
}

function elegirColorLegible(candidatos: (string | null | undefined)[], fondo: string, respaldo: string): string {
  for (const c of candidatos) {
    if (esHexValido(c) && contrasteHex(c, fondo) >= UMBRAL_CONTRASTE_TEXTO) return c;
  }
  return respaldo;
}

// rasgos_cortos.tipografia (y tipografia.estilo como respaldo) son texto
// libre que ya genera n8n para mostrarlo en pantalla ("moderna y limpia",
// "elegante y clasica") -- no es un enum, así que se clasifica por
// palabras clave con "moderna" como respaldo si nada coincide.
function clasificarEstiloFuente(textoLibre: string): EstiloFuente {
  const t = textoLibre.toLowerCase();
  if (/impact|bold|fuerte|atrevid|urban|robust/.test(t)) return "impacto";
  if (/elegante|clasic|sofistic|lujos|refinad/.test(t)) return "elegante";
  if (/amigable|cercan|calid[oa]|juguet|redonde/.test(t)) return "amigable";
  return "moderna";
}

export interface AdnMarcaParaTema {
  paleta_color?: {
    color_primario_hex?: string | null;
    color_secundario_hex?: string | null;
    colores_acento_hex?: string[] | null;
  } | null;
  rasgos_cortos?: { tipografia?: string | null } | null;
  tipografia?: { estilo?: string | null } | null;
  logo_url?: string | null;
}

export interface TemaGuion {
  color_primario: string;
  color_secundario: string;
  color_fondo: string;
  color_texto: string;
  fuente: EstiloFuente;
  logo_url: string | null;
}

export function construirTemaDesdeAdn(adn: AdnMarcaParaTema | null | undefined): TemaGuion {
  const paleta = adn?.paleta_color || {};
  const primario = esHexValido(paleta.color_primario_hex) ? paleta.color_primario_hex : null;
  const secundario = esHexValido(paleta.color_secundario_hex) ? paleta.color_secundario_hex : null;
  const acento =
    Array.isArray(paleta.colores_acento_hex) && esHexValido(paleta.colores_acento_hex[0]) ? paleta.colores_acento_hex[0] : null;

  // Fondo oscuro fijo a propósito: con texto encima en cualquier escena
  // sin media (gancho, revelación de marca, cta), un fondo oscuro neutro
  // deja que los colores de marca se vean como acento y SIEMPRE garantiza
  // contraste alto para texto claro, sin tener que resolver qué pasa si
  // el primario de la marca es un color claro. Las escenas con foto o
  // video real del álbum lo tapan casi por completo.
  const colorFondo = COLOR_FONDO_DEFECTO;
  const colorPrimario = elegirColorLegible([primario, acento, secundario], colorFondo, COLOR_PRIMARIO_DEFECTO);
  const colorSecundario = elegirColorLegible([secundario, acento, primario], colorFondo, COLOR_SECUNDARIO_DEFECTO);
  const colorTexto = contrasteHex(COLOR_TEXTO_CLARO, colorFondo) >= UMBRAL_CONTRASTE_TEXTO ? COLOR_TEXTO_CLARO : COLOR_TEXTO_OSCURO;

  const textoTipografia = adn?.rasgos_cortos?.tipografia || adn?.tipografia?.estilo || "";

  return {
    color_primario: colorPrimario,
    color_secundario: colorSecundario,
    color_fondo: colorFondo,
    color_texto: colorTexto,
    fuente: clasificarEstiloFuente(textoTipografia),
    logo_url: adn?.logo_url ?? null,
  };
}
