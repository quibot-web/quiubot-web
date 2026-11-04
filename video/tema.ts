// ADN de marca -> tema visual del video (campo "tema" del guion, sección 4
// del plan). Se calcula aquí, en código, y NUNCA se le pide a la IA que
// invente los hex. Reusa la misma fórmula de contraste WCAG que ya existe
// en Mi marca (app/marca/page.tsx), pero el contraste ya NO se decide una
// vez al armar el tema: cada escena tiene su propio fondo (colores de
// marca, degradados, o la foto/video real del producto), así que
// colorTextoSobre() se llama en cada escena contra lo que esa escena
// pinta de fondo -- así cualquier color de marca, por claro u oscuro que
// sea, siempre queda con texto legible encima.

export type EstiloFuente = "impacto" | "moderna" | "elegante" | "amigable";

const COLOR_PRIMARIO_DEFECTO = "#534AB7";
const COLOR_SECUNDARIO_DEFECTO = "#7F77DD";
const BLANCO = "#FFFFFF";
const OSCURO = "#15120A";

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

// Dado cualquier color de fondo, devuelve blanco o un oscuro casi negro
// -- el que de mejor contraste contra ESE fondo. Se llama por escena,
// nunca una sola vez para todo el video.
export function colorTextoSobre(fondoHex: string): string {
  return contrasteHex(BLANCO, fondoHex) >= contrasteHex(OSCURO, fondoHex) ? BLANCO : OSCURO;
}

// Para acentos que SÍ tienen que distinguirse del fondo (el recuadro de
// palabra_clave, el círculo numerado) -- no basta con "legible", tiene
// que notarse. Prueba cada candidato (normalmente color_secundario,
// a veces color_primario) y se queda con el de mejor contraste contra
// el fondo real de la escena; si ninguno gana al respaldo blanco/negro,
// usa ese respaldo. Así una paleta beige-sobre-beige nunca queda invisible.
export function colorMasContraste(candidatos: string[], fondoHex: string, respaldo: string): string {
  let mejor = respaldo;
  let mejorRatio = contrasteHex(respaldo, fondoHex);
  for (const c of candidatos) {
    const ratio = contrasteHex(c, fondoHex);
    if (ratio > mejorRatio) {
      mejor = c;
      mejorRatio = ratio;
    }
  }
  return mejor;
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
  } | null;
  rasgos_cortos?: { tipografia?: string | null } | null;
  tipografia?: { estilo?: string | null } | null;
  logo_url?: string | null;
  nombre_marca?: string | null;
}

export interface TemaGuion {
  color_primario: string;
  color_secundario: string;
  fuente: EstiloFuente;
  logo_url: string | null;
  // Respaldo para el cta "suave" cuando no hay logo -- sin esto no
  // queda nada que mostrar en esa escena.
  nombre_marca: string | null;
}

export function construirTemaDesdeAdn(adn: AdnMarcaParaTema | null | undefined): TemaGuion {
  const paleta = adn?.paleta_color || {};
  const primario = esHexValido(paleta.color_primario_hex) ? paleta.color_primario_hex : COLOR_PRIMARIO_DEFECTO;
  const secundario = esHexValido(paleta.color_secundario_hex) ? paleta.color_secundario_hex : COLOR_SECUNDARIO_DEFECTO;
  const textoTipografia = adn?.rasgos_cortos?.tipografia || adn?.tipografia?.estilo || "";

  return {
    color_primario: primario,
    color_secundario: secundario,
    fuente: clasificarEstiloFuente(textoTipografia),
    logo_url: adn?.logo_url ?? null,
    nombre_marca: adn?.nombre_marca ?? null,
  };
}

// Tono fijo para el bloque "problema" (sección 3 del plan) -- el único
// que NO usa los colores de marca a propósito, para que el contraste
// visual entre "problema" (alerta) y "solución" (marca) se sienta.
export const COLOR_ALERTA_PRIMARIO = "#E8460B";
export const COLOR_ALERTA_SECUNDARIO = "#6E1600";
