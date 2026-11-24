// Tanda 2 del kit (24 nov 2026): lugares y objetos de negocio como SVG
// (puro). Mismo estilo que el salón: colores planos, sombras suaves, nada de
// texto (los letreros y empaques son solo formas y colores). Todos los
// lugares miden lo mismo que el salón y su pared llega a la misma altura, así
// las casillas, las profundidades y la cámara valen igual en todos.
import { PAREDES, type Fondo, type Pared } from "./catalogoKit";
import { aclarar, oscurecer, type ParteSvg } from "./dibujoPersonaje";
import { COLOR_LINEA_PISO, COLOR_PISO, SALON } from "./dibujoObjetos";

const svg = (ancho: number, alto: number, cuerpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">${cuerpo}</svg>`;
const { ancho: W, alto: H } = SALON;
const Y_PARED = SALON.pared.y1;

// Por dónde entra y sale la gente (x en la isla). El que entra aparece ahí
// y camina a su lugar; el que se va camina hasta ahí y desaparece.
export const PUERTA_X: Record<Fondo, number> = { salon: 2120, tienda: 330, cocina: 2060, calle: 1100 };

// La hoja de cada puerta (lo que se abre, en coordenadas de la isla) y el
// color del vano al abrirla: quien entra o se va cruza la puerta abierta
// (revisión de la tanda 2: salir caminando de costado no se leía como
// "se va"). El salón no tiene puerta dibujada: ahí se sale por el costado.
export type Puerta = { x: number; y: number; ancho: number; alto: number; afuera: string };
export const PUERTAS: Partial<Record<Fondo, Puerta>> = {
  tienda: { x: PUERTA_X.tienda - 130, y: 300, ancho: 260, alto: Y_PARED - 300, afuera: "#FFF1CF" },
  cocina: { x: PUERTA_X.cocina - 90, y: 340, ancho: 180, alto: Y_PARED - 340, afuera: "#FFF1CF" },
  calle: { x: PUERTA_X.calle - 130, y: 620, ancho: 260, alto: Y_PARED - 620, afuera: "#4A3B45" },
};

// La hoja sola (igual a como está pintada en el fondo), para abrirla.
export function svgHojaPuerta(fondo: Fondo): ParteSvg | null {
  const p = PUERTAS[fondo];
  if (!p) return null;
  const { ancho: w, alto: h } = p;
  const s: string[] = [];
  if (fondo === "cocina") {
    s.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="#C98E5A"/><circle cx="${PUERTA_X.cocina + 60 - p.x}" cy="${680 - p.y}" r="12" fill="#E8C34A"/>`);
  } else if (fondo === "tienda") {
    s.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="#BFE3F2"/>`);
    s.push(`<path d="M30 40 l60 -40 M30 120 l120 -100" stroke="#FFFFFF" stroke-width="16" opacity="0.6"/>`);
    s.push(`<rect x="${w / 2 - 7}" y="0" width="14" height="${h}" fill="#6E4628"/><rect x="${w / 2 + 22}" y="360" width="14" height="70" rx="6" fill="#E8C34A"/>`);
  } else {
    s.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="#BFE3F2"/><rect x="${w / 2 - 6}" y="0" width="12" height="${h}" fill="#6E4628"/>`);
  }
  return { svg: svg(w, h, s.join("")), ancho: w, alto: h, ancla: { x: 0, y: 0 } };
}

// Ventana de la cocina (a donde mira el que se distrae).
export const VENTANA_COCINA_X = 1740;

// Colores con que el entorno continúa el lugar más allá de la isla.
export type ColoresEntorno = { arriba: string; pared: string; zocalo: string | null; piso: string; lineaPiso: string; techo: boolean; abajo: string };
export function coloresEntorno(fondo: Fondo, pared: Pared): ColoresEntorno {
  const c = PAREDES[pared];
  if (fondo === "calle") return { arriba: "#BFE3F7", pared: aclarar(c, 0.1), zocalo: null, piso: "#C9C6C0", lineaPiso: "#ADA9A2", techo: false, abajo: "#55565C" };
  if (fondo === "tienda") return { arriba: aclarar(c, 0.35), pared: c, zocalo: oscurecer(c, 0.12), piso: "#E6DED2", lineaPiso: "#CFC5B5", techo: true, abajo: "#E6DED2" };
  if (fondo === "cocina") return { arriba: aclarar(c, 0.35), pared: c, zocalo: null, piso: "#D9CBB4", lineaPiso: "#BFAF95", techo: true, abajo: "#D9CBB4" };
  return { arriba: aclarar(c, 0.35), pared: c, zocalo: oscurecer(c, 0.12), piso: COLOR_PISO, lineaPiso: COLOR_LINEA_PISO, techo: true, abajo: COLOR_PISO };
}

// Piso de baldosas en perspectiva (más juntas arriba).
function baldosas(s: string[], y0: number, color: string, linea: string) {
  s.push(`<rect x="0" y="${y0}" width="${W}" height="${H - y0}" fill="${color}"/>`);
  const filas = [y0, 1100, 1180, 1280, 1400, H];
  for (const y of filas.slice(1, -1)) s.push(`<rect x="0" y="${y}" width="${W}" height="5" fill="${linea}"/>`);
  for (let f = 0; f < filas.length - 1; f++) {
    const paso = 160 + f * 70;
    for (let x = (f % 2) * paso * 0.5; x < W; x += paso) s.push(`<rect x="${x}" y="${filas[f]}" width="5" height="${filas[f + 1] - filas[f]}" fill="${linea}"/>`);
  }
}

// Productos de estante (cajas, frascos, botellas) de colores, sin letras.
function productos(s: string[], x0: number, x1: number, yBase: number, semilla: number) {
  const colores = ["#E85D5D", "#F2C230", "#3FA66B", "#3F6FD8", "#E86A9A", "#EE8A35", "#7A55C7", "#2FB3B0"];
  let x = x0 + 10;
  let i = semilla;
  while (x < x1 - 50) {
    const tipo = i % 3;
    const col = colores[(i * 5) % colores.length];
    if (tipo === 0) {
      const w = 56, h = 86;
      s.push(`<rect x="${x}" y="${yBase - h}" width="${w}" height="${h}" rx="6" fill="${col}"/><rect x="${x + 8}" y="${yBase - h + 22}" width="${w - 16}" height="26" rx="4" fill="${aclarar(col, 0.55)}"/>`);
      x += w + 10;
    } else if (tipo === 1) {
      const w = 48, h = 70;
      s.push(`<rect x="${x}" y="${yBase - h}" width="${w}" height="${h}" rx="12" fill="${col}"/><rect x="${x + 6}" y="${yBase - h - 12}" width="${w - 12}" height="16" rx="4" fill="${oscurecer(col, 0.3)}"/>`);
      x += w + 12;
    } else {
      const w = 34, h = 110;
      s.push(`<path d="M${x + 10} ${yBase - h} h14 v24 q10 10 10 24 v${h - 48} h-34 v${-(h - 48)} q0 -14 10 -24 z" fill="${col}"/><rect x="${x + 4}" y="${yBase - 52}" width="26" height="22" rx="3" fill="${aclarar(col, 0.6)}"/>`);
      x += w + 14;
    }
    i++;
  }
}

function estante(s: string[], x: number, y: number, w: number, h: number, semilla: number) {
  const madera = "#9C6A3C";
  s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${oscurecer(madera, 0.15)}"/><rect x="${x + 16}" y="${y + 16}" width="${w - 32}" height="${h - 32}" fill="${aclarar(madera, 0.45)}"/>`);
  const repisas = 4;
  for (let r = 1; r <= repisas; r++) {
    const yr = y + 16 + ((h - 32) * r) / repisas;
    productos(s, x + 16, x + w - 16, yr - 6, semilla + r * 3);
    s.push(`<rect x="${x + 10}" y="${yr - 8}" width="${w - 20}" height="16" rx="4" fill="${madera}"/>`);
  }
}

function puertaVidrio(s: string[], x: number, ancho: number, colorMarco: string) {
  const y = 300;
  s.push(`<rect x="${x - 18}" y="${y - 18}" width="${ancho + 36}" height="${Y_PARED - y + 18}" rx="8" fill="${colorMarco}"/>`);
  s.push(`<rect x="${x}" y="${y}" width="${ancho}" height="${Y_PARED - y}" fill="#BFE3F2"/>`);
  s.push(`<path d="M${x + 30} ${y + 40} l60 -40 M${x + 30} ${y + 120} l120 -100" stroke="#FFFFFF" stroke-width="16" opacity="0.6"/>`);
  s.push(`<rect x="${x + ancho / 2 - 7}" y="${y}" width="14" height="${Y_PARED - y}" fill="${colorMarco}"/><rect x="${x + ancho / 2 + 22}" y="${y + 360}" width="14" height="70" rx="6" fill="#E8C34A"/>`);
  // Campanita de la puerta.
  s.push(`<path d="M${x + ancho / 2 - 26} ${y - 26} q26 -40 52 0 z" fill="#E8C34A"/>`);
}

// ---------- Tienda de barrio (por dentro) ----------
export function svgTienda(pared: Pared): ParteSvg {
  const c = PAREDES[pared];
  const s: string[] = [];
  s.push(`<rect x="0" y="0" width="${W}" height="${Y_PARED}" fill="${c}"/>`);
  s.push(`<rect x="0" y="${Y_PARED - 120}" width="${W}" height="120" fill="${oscurecer(c, 0.12)}"/>`);
  baldosas(s, Y_PARED, "#E6DED2", "#CFC5B5");
  puertaVidrio(s, PUERTA_X.tienda - 130, 260, "#6E4628");
  estante(s, 620, 160, 700, 860, 1);
  estante(s, 1420, 160, 680, 860, 4);
  // Banderines de colores en lo alto.
  const colores = ["#E85D5D", "#F2C230", "#3FA66B", "#3F6FD8"];
  for (let i = 0; i < 14; i++) s.push(`<path d="M${600 + i * 110} 70 l44 0 l-22 46 z" fill="${colores[i % 4]}"/>`);
  s.push(`<path d="M590 70 L2150 70" stroke="#7A5A3A" stroke-width="5"/>`);
  s.push(`<rect x="0" y="${Y_PARED}" width="${W}" height="22" fill="rgba(60,40,20,0.15)"/>`);
  return { svg: svg(W, H, s.join("")), ancho: W, alto: H, ancla: { x: 0, y: 0 } };
}

// ---------- Cocina de casa ----------
export function svgCocina(pared: Pared): ParteSvg {
  const c = PAREDES[pared];
  const s: string[] = [];
  s.push(`<rect x="0" y="0" width="${W}" height="${Y_PARED}" fill="${c}"/>`);
  baldosas(s, Y_PARED, "#D9CBB4", "#BFAF95");
  // Enchape blanco detrás del mesón.
  s.push(`<rect x="0" y="560" width="1180" height="${Y_PARED - 560}" fill="#F4F1EA"/>`);
  for (let y = 560; y < 720; y += 40) s.push(`<rect x="0" y="${y}" width="1180" height="3" fill="#DDD6C8"/>`);
  for (let x = 0; x < 1180; x += 60) s.push(`<rect x="${x}" y="560" width="3" height="160" fill="#DDD6C8"/>`);
  // Gabinetes de arriba.
  const mad = "#C98E5A";
  for (let i = 0; i < 4; i++) s.push(`<rect x="${40 + i * 270}" y="150" width="250" height="300" rx="10" fill="${mad}"/><rect x="${60 + i * 270}" y="170" width="210" height="260" rx="8" fill="${aclarar(mad, 0.15)}"/><rect x="${150 + i * 270}" y="380" width="30" height="12" rx="6" fill="${oscurecer(mad, 0.4)}"/>`);
  // Mesón con estufa y horno.
  s.push(`<rect x="0" y="700" width="1180" height="34" fill="#8A8F99"/><rect x="0" y="734" width="1180" height="${Y_PARED - 734}" fill="${mad}"/>`);
  for (let i = 0; i < 4; i++) s.push(`<rect x="${30 + i * 290}" y="760" width="260" height="${Y_PARED - 790}" rx="8" fill="${aclarar(mad, 0.12)}"/>`);
  s.push(`<rect x="330" y="730" width="420" height="${Y_PARED - 730}" fill="#E7E7E7"/><rect x="370" y="800" width="340" height="180" rx="12" fill="#3B3F48"/><rect x="390" y="820" width="300" height="140" rx="10" fill="#555B66"/>`);
  for (const x of [400, 520, 640]) s.push(`<ellipse cx="${x}" cy="700" rx="46" ry="12" fill="#2F333A"/>`);
  // Olla sobre la estufa.
  s.push(`<rect x="470" y="610" width="130" height="90" rx="14" fill="#C9533F"/><rect x="455" y="600" width="160" height="22" rx="10" fill="#A9432F"/>`);
  // Nevera.
  s.push(`<rect x="1220" y="300" width="250" height="${Y_PARED - 300}" rx="22" fill="#EDEFF2"/><rect x="1220" y="560" width="250" height="8" fill="#C9CDD3"/><rect x="1430" y="360" width="12" height="140" rx="6" fill="#B5BAC1"/><rect x="1430" y="620" width="12" height="200" rx="6" fill="#B5BAC1"/>`);
  // Ventana con cortina.
  const v = { x: 1560, y: 240, w: 360, h: 340 };
  s.push(`<rect x="${v.x - 16}" y="${v.y - 16}" width="${v.w + 32}" height="${v.h + 32}" rx="8" fill="#FFFFFF"/><rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="#9FD3F2"/><ellipse cx="${v.x + 120}" cy="${v.y + 100}" rx="60" ry="24" fill="#FFFFFF" opacity="0.9"/>`);
  s.push(`<path d="M${v.x - 30} ${v.y - 30} h${v.w + 60} v40 q-${(v.w + 60) / 2} 50 -${v.w + 60} 0 z" fill="#E86A9A"/>`);
  // Puerta (salida).
  s.push(`<rect x="${PUERTA_X.cocina - 110}" y="320" width="220" height="${Y_PARED - 320}" rx="8" fill="${oscurecer(mad, 0.15)}"/><rect x="${PUERTA_X.cocina - 90}" y="340" width="180" height="${Y_PARED - 340}" fill="${mad}"/><circle cx="${PUERTA_X.cocina + 60}" cy="${680}" r="12" fill="#E8C34A"/>`);
  s.push(`<rect x="0" y="${Y_PARED}" width="${W}" height="22" fill="rgba(60,40,20,0.15)"/>`);
  return { svg: svg(W, H, s.join("")), ancho: W, alto: H, ancla: { x: 0, y: 0 } };
}

// ---------- Calle con locales ----------
export function svgCalle(pared: Pared): ParteSvg {
  const c = PAREDES[pared];
  const s: string[] = [];
  // Cielo y nubes.
  s.push(`<rect x="0" y="0" width="${W}" height="${Y_PARED}" fill="#BFE3F7"/>`);
  for (const [x, y] of [[300, 90], [1200, 60], [1900, 110]]) s.push(`<ellipse cx="${x}" cy="${y}" rx="110" ry="34" fill="#FFFFFF" opacity="0.9"/>`);
  // Tres fachadas (la del centro es la tienda, con la puerta).
  const fachadas = [
    { x: 0, w: 760, col: oscurecer(c, 0.05), toldo: "#E85D5D" },
    { x: 760, w: 680, col: aclarar(c, 0.1), toldo: "#3FA66B" },
    { x: 1440, w: 760, col: oscurecer(c, 0.1), toldo: "#3F6FD8" },
  ];
  for (const [i, f] of fachadas.entries()) {
    const top = 120 + (i % 2) * 60;
    s.push(`<rect x="${f.x}" y="${top}" width="${f.w}" height="${Y_PARED - top}" fill="${f.col}"/><rect x="${f.x}" y="${top}" width="${f.w}" height="24" fill="${oscurecer(f.col, 0.2)}"/>`);
    // Ventanas del segundo piso.
    for (let k = 0; k < 2; k++) s.push(`<rect x="${f.x + 120 + k * (f.w - 360)}" y="${top + 70}" width="120" height="150" rx="6" fill="#FFFFFF"/><rect x="${f.x + 132 + k * (f.w - 360)}" y="${top + 82}" width="96" height="126" fill="#9FD3F2"/>`);
    // Toldo a rayas.
    const ty = 470;
    s.push(`<path d="M${f.x + 40} ${ty} h${f.w - 80} l40 110 h-${f.w} z" fill="${f.toldo}"/>`);
    for (let x = f.x + 40; x < f.x + f.w - 40; x += 80) s.push(`<path d="M${x} ${ty} h40 l20 110 h-40 z" fill="#FFFFFF" opacity="0.85"/>`);
    // Vitrina del local (o la puerta, en el del centro).
    if (i === 1) {
      s.push(`<rect x="${PUERTA_X.calle - 150}" y="600" width="300" height="${Y_PARED - 600}" fill="#6E4628"/><rect x="${PUERTA_X.calle - 130}" y="620" width="260" height="${Y_PARED - 620}" fill="#BFE3F2"/><rect x="${PUERTA_X.calle - 6}" y="620" width="12" height="${Y_PARED - 620}" fill="#6E4628"/>`);
      productos(s, f.x + 40, PUERTA_X.calle - 170, 900, 2);
      productos(s, PUERTA_X.calle + 170, f.x + f.w - 30, 900, 5);
    } else {
      s.push(`<rect x="${f.x + 80}" y="620" width="${f.w - 160}" height="300" rx="6" fill="#BFE3F2"/>`);
      productos(s, f.x + 100, f.x + f.w - 100, 900, i * 7);
    }
  }
  // Andén (todo el piso) y el borde con la calle abajo.
  s.push(`<rect x="0" y="${Y_PARED}" width="${W}" height="${H - Y_PARED}" fill="#C9C6C0"/>`);
  for (const y of [1120, 1220, 1340]) s.push(`<rect x="0" y="${y}" width="${W}" height="4" fill="#ADA9A2"/>`);
  for (let x = 0; x < W; x += 220) s.push(`<rect x="${x}" y="${Y_PARED}" width="4" height="${H - Y_PARED}" fill="#ADA9A2"/>`);
  s.push(`<rect x="0" y="${H - 40}" width="${W}" height="40" fill="#8E8A84"/>`);
  // Poste y matera.
  s.push(`<rect x="1990" y="380" width="22" height="${Y_PARED - 380}" fill="#4A4F57"/><circle cx="2001" cy="370" r="30" fill="#F2E6B8"/>`);
  s.push(`<rect x="60" y="930" width="120" height="110" rx="10" fill="#B5532A"/><circle cx="120" cy="900" r="70" fill="#3FA66B"/>`);
  s.push(`<rect x="0" y="${Y_PARED}" width="${W}" height="18" fill="rgba(40,40,40,0.12)"/>`);
  return { svg: svg(W, H, s.join("")), ancho: W, alto: H, ancla: { x: 0, y: 0 } };
}

// ---------- Objetos ----------
export const TORTA = { ancho: 240, alto: 210 } as const;
export function svgTorta(): ParteSvg {
  const { ancho: w, alto: h } = TORTA;
  const s = [
    `<ellipse cx="${w / 2}" cy="${h - 16}" rx="${w / 2 - 4}" ry="16" fill="#FFFFFF"/>`,
    `<rect x="30" y="${h - 110}" width="${w - 60}" height="90" rx="14" fill="#C77B4A"/>`,
    `<rect x="30" y="${h - 76}" width="${w - 60}" height="14" fill="#F4E3C9"/>`,
    `<path d="M30 ${h - 104} q${(w - 60) / 8} 28 ${(w - 60) / 4} 0 t${(w - 60) / 4} 0 t${(w - 60) / 4} 0 t${(w - 60) / 4} 0 v-20 h-${w - 60} z" fill="#F7D7E3"/>`,
    `<ellipse cx="${w / 2}" cy="${h - 124}" rx="${(w - 60) / 2}" ry="22" fill="#FBE6EE"/>`,
    `<circle cx="${w / 2}" cy="${h - 150}" r="18" fill="#D9473F"/><path d="M${w / 2} ${h - 166} q10 -26 26 -30" stroke="#3FA66B" stroke-width="5" fill="none"/>`,
    ...[0.25, 0.5, 0.75].map((k) => `<circle cx="${30 + (w - 60) * k}" cy="${h - 128}" r="7" fill="#FFFFFF"/>`),
  ];
  return { svg: svg(w, h, s.join("")), ancho: w, alto: h, ancla: { x: w / 2, y: h * 0.6 } };
}
export const HELADO = { ancho: 100, alto: 210 } as const;
export function svgHelado(): ParteSvg {
  const { ancho: w, alto: h } = HELADO;
  const s = [
    `<path d="M18 92 L${w / 2} ${h - 6} L${w - 18} 92 Z" fill="#E2AA5E"/>`,
    `<path d="M26 104 L${w - 30} 150 M${w - 26} 104 L32 150 M40 128 L${w - 44} 178" stroke="#C48A3E" stroke-width="4"/>`,
    `<circle cx="${w / 2 - 16}" cy="80" r="30" fill="#F7B6CE"/><circle cx="${w / 2 + 16}" cy="80" r="30" fill="#FBE7B0"/><circle cx="${w / 2}" cy="48" r="30" fill="#8A5A36"/>`,
    `<circle cx="${w / 2 + 6}" cy="24" r="8" fill="#D9473F"/>`,
  ];
  return { svg: svg(w, h, s.join("")), ancho: w, alto: h, ancla: { x: w / 2, y: h * 0.72 } };
}
export const CAJA = { ancho: 200, alto: 160 } as const;
export function svgCaja(): ParteSvg {
  const { ancho: w, alto: h } = CAJA;
  const s = [
    `<rect x="6" y="28" width="${w - 12}" height="${h - 34}" rx="6" fill="#C9935A"/>`,
    `<path d="M6 28 L30 4 H${w - 30} L${w - 6} 28 Z" fill="#DDAA6E"/>`,
    `<rect x="${w / 2 - 14}" y="4" width="28" height="${h - 10}" fill="#E9D7A8" opacity="0.9"/>`,
    `<rect x="${w - 70}" y="${h - 60}" width="44" height="30" rx="4" fill="#F4EFE4"/>`,
  ];
  return { svg: svg(w, h, s.join("")), ancho: w, alto: h, ancla: { x: w / 2, y: h * 0.5 } };
}
export const BOLSA = { ancho: 180, alto: 230 } as const;
export function svgBolsa(): ParteSvg {
  const { ancho: w, alto: h } = BOLSA;
  const col = "#3FA66B";
  const s = [
    `<path d="M50 70 q0 -60 40 -60 q40 0 40 60" stroke="${oscurecer(col, 0.3)}" stroke-width="10" fill="none"/>`,
    `<path d="M14 64 H${w - 14} L${w - 4} ${h - 6} H4 Z" fill="${col}"/>`,
    `<path d="M${w - 50} 64 H${w - 14} L${w - 4} ${h - 6} H${w - 44} Z" fill="${oscurecer(col, 0.15)}"/>`,
    `<circle cx="${w / 2 - 10}" cy="${h / 2 + 30}" r="30" fill="${aclarar(col, 0.6)}"/>`,
    `<rect x="40" y="30" width="34" height="44" rx="6" fill="#F2C230"/><rect x="84" y="20" width="40" height="54" rx="8" fill="#E85D5D"/>`,
  ];
  return { svg: svg(w, h, s.join("")), ancho: w, alto: h, ancla: { x: w / 2, y: 40 } };
}
export const CELULAR = { ancho: 80, alto: 140 } as const;
export function svgCelular(): ParteSvg {
  const { ancho: w, alto: h } = CELULAR;
  const s = [
    `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="14" fill="#22252B"/>`,
    `<rect x="9" y="14" width="${w - 18}" height="${h - 30}" rx="6" fill="#7FC4F0"/>`,
    `<rect x="16" y="24" width="${w - 32}" height="34" rx="4" fill="#FFFFFF" opacity="0.8"/><rect x="16" y="64" width="${w - 32}" height="12" rx="4" fill="#FFFFFF" opacity="0.6"/><rect x="16" y="82" width="${w - 44}" height="12" rx="4" fill="#FFFFFF" opacity="0.6"/>`,
  ];
  return { svg: svg(w, h, s.join("")), ancho: w, alto: h, ancla: { x: w / 2, y: h * 0.5 } };
}
export const MOTO = { ancho: 560, alto: 360 } as const;
export function svgMoto(): ParteSvg {
  const { ancho: w, alto: h } = MOTO;
  const col = "#D9473F";
  const yR = h - 80;
  const rueda = (x: number) => `<circle cx="${x}" cy="${yR}" r="72" fill="#2A2C31"/><circle cx="${x}" cy="${yR}" r="40" fill="#9AA0A8"/><circle cx="${x}" cy="${yR}" r="12" fill="#2A2C31"/>`;
  const s = [
    `<ellipse cx="${w / 2}" cy="${h - 8}" rx="${w / 2 - 20}" ry="10" fill="rgba(20,16,30,0.25)"/>`,
    rueda(110),
    rueda(w - 110),
    // Chasis y motor.
    `<path d="M110 ${yR} L230 ${yR - 60} L340 ${yR - 60} L${w - 110} ${yR}" stroke="#4A4F57" stroke-width="16" fill="none" stroke-linecap="round"/>`,
    `<rect x="220" y="${yR - 90}" width="120" height="70" rx="16" fill="#5A5F68"/>`,
    // Exhosto.
    `<rect x="90" y="${yR - 40}" width="170" height="22" rx="11" fill="#B5BAC1"/>`,
    // Tanque y sillín.
    `<path d="M250 ${yR - 110} q40 -70 140 -60 l30 60 z" fill="${col}"/>`,
    `<path d="M120 ${yR - 112} h150 q10 0 10 14 v10 h-170 q-6 -24 10 -24 z" fill="#2A2C31"/>`,
    // Guardabarros, horquilla, manubrio y farola.
    `<path d="M${w - 180} ${yR - 60} q70 -30 140 0" stroke="${col}" stroke-width="18" fill="none" stroke-linecap="round"/>`,
    `<path d="M${w - 110} ${yR} L${w - 160} ${yR - 190}" stroke="#4A4F57" stroke-width="16" stroke-linecap="round"/>`,
    `<path d="M${w - 190} ${yR - 200} h70" stroke="#2A2C31" stroke-width="14" stroke-linecap="round"/>`,
    `<circle cx="${w - 135}" cy="${yR - 160}" r="24" fill="#F2E6B8"/><circle cx="${w - 135}" cy="${yR - 160}" r="24" fill="none" stroke="#4A4F57" stroke-width="6"/>`,
  ];
  return { svg: svg(w, h, s.join("")), ancho: w, alto: h, ancla: { x: 0, y: 0 } };
}
export const CARRO = { ancho: 900, alto: 420 } as const;
export function svgCarro(): ParteSvg {
  const { ancho: w, alto: h } = CARRO;
  const col = "#3F6FD8";
  const rueda = (x: number) => `<circle cx="${x}" cy="${h - 70}" r="68" fill="#2A2C31"/><circle cx="${x}" cy="${h - 70}" r="32" fill="#B5BAC1"/>`;
  const s = [
    `<ellipse cx="${w / 2}" cy="${h - 6}" rx="${w / 2 - 20}" ry="12" fill="rgba(20,16,30,0.25)"/>`,
    `<path d="M40 ${h - 80} q-10 -110 60 -130 l120 -10 q60 -110 180 -120 h170 q90 0 150 120 l100 20 q60 14 60 120 z" fill="${col}"/>`,
    `<path d="M250 ${h - 222} q50 -80 150 -86 h140 v86 z" fill="#BFE3F2"/><path d="M570 ${h - 308} h40 q60 0 100 86 h-140 z" fill="#BFE3F2"/>`,
    `<rect x="80" y="${h - 160}" width="${w - 160}" height="14" rx="6" fill="${oscurecer(col, 0.25)}"/>`,
    `<rect x="${w - 70}" y="${h - 190}" width="36" height="24" rx="6" fill="#F2E6B8"/><rect x="40" y="${h - 190}" width="30" height="24" rx="6" fill="#E85D5D"/>`,
    rueda(210),
    rueda(w - 200),
  ];
  return { svg: svg(w, h, s.join("")), ancho: w, alto: h, ancla: { x: 0, y: 0 } };
}
export const MOSTRADOR = { ancho: 760, alto: 400, tapa: 40 } as const;
export function svgMostrador(): ParteSvg {
  const { ancho: w, alto: h, tapa } = MOSTRADOR;
  const mad = "#B37A45";
  const s = [
    `<ellipse cx="${w / 2}" cy="${h - 6}" rx="${w / 2 - 10}" ry="10" fill="rgba(20,16,30,0.22)"/>`,
    `<rect x="20" y="${tapa}" width="${w - 40}" height="${h - tapa - 10}" fill="${mad}"/>`,
    ...[0, 1, 2].map((i) => `<rect x="${50 + i * ((w - 100) / 3)}" y="${tapa + 30}" width="${(w - 100) / 3 - 20}" height="${h - tapa - 80}" rx="8" fill="${aclarar(mad, 0.12)}"/>`),
    `<rect x="0" y="0" width="${w}" height="${tapa}" rx="10" fill="${oscurecer(mad, 0.25)}"/>`,
  ];
  return { svg: svg(w, h, s.join("")), ancho: w, alto: h, ancla: { x: 0, y: 0 } };
}
export const VITRINA = { ancho: 600, alto: 560, repisa: 0.42 } as const;
export function svgVitrina(): ParteSvg {
  const { ancho: w, alto: h } = VITRINA;
  const mad = "#8A5A36";
  const s = [
    `<ellipse cx="${w / 2}" cy="${h - 6}" rx="${w / 2 - 10}" ry="10" fill="rgba(20,16,30,0.22)"/>`,
    `<rect x="20" y="${h * 0.66}" width="${w - 40}" height="${h * 0.34 - 10}" fill="${mad}"/><rect x="40" y="${h * 0.7}" width="${w - 80}" height="${h * 0.26 - 20}" rx="8" fill="${aclarar(mad, 0.15)}"/>`,
    `<rect x="20" y="10" width="${w - 40}" height="${h * 0.66 - 10}" fill="#DFF2FA" opacity="0.55"/>`,
    `<rect x="20" y="${h * VITRINA.repisa}" width="${w - 40}" height="10" fill="#FFFFFF" opacity="0.9"/>`,
    `<rect x="14" y="4" width="${w - 28}" height="16" rx="6" fill="${oscurecer(mad, 0.2)}"/>`,
    `<path d="M60 40 l70 -30 M60 110 l150 -70" stroke="#FFFFFF" stroke-width="12" opacity="0.6"/>`,
  ];
  return { svg: svg(w, h, s.join("")), ancho: w, alto: h, ancla: { x: 0, y: 0 } };
}
export const MESA = { ancho: 460, alto: 300, tapa: 36 } as const;
export function svgMesa(): ParteSvg {
  const { ancho: w, alto: h, tapa } = MESA;
  const mad = "#C98E5A";
  const s = [
    `<ellipse cx="${w / 2}" cy="${h - 6}" rx="${w / 2 - 20}" ry="10" fill="rgba(20,16,30,0.22)"/>`,
    `<rect x="50" y="${tapa}" width="24" height="${h - tapa - 6}" fill="${oscurecer(mad, 0.25)}"/><rect x="${w - 74}" y="${tapa}" width="24" height="${h - tapa - 6}" fill="${oscurecer(mad, 0.25)}"/>`,
    `<rect x="0" y="0" width="${w}" height="${tapa}" rx="12" fill="${mad}"/><rect x="0" y="${tapa - 10}" width="${w}" height="10" fill="${oscurecer(mad, 0.15)}"/>`,
    `<path d="M20 ${tapa} h${w - 40} l-14 40 h-${w - 68} z" fill="#F4EFE4"/>`,
  ];
  return { svg: svg(w, h, s.join("")), ancho: w, alto: h, ancla: { x: 0, y: 0 } };
}

export function svgFondo(fondo: Fondo, pared: Pared): ParteSvg | null {
  if (fondo === "tienda") return svgTienda(pared);
  if (fondo === "cocina") return svgCocina(pared);
  if (fondo === "calle") return svgCalle(pared);
  return null;
}
