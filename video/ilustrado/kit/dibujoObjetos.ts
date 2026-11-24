// Fondos y objetos del kit como SVG (puro). Se convierten a PNG una vez al
// precargar. Sin texto: los dibujos de la cartelera y el pizarrón son solo
// formas.
import { PAREDES, type MotivoDibujo, type Pared } from "./catalogoKit";
import { estrella, oscurecer, type ParteSvg } from "./dibujoPersonaje";

const svg = (ancho: number, alto: number, cuerpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">${cuerpo}</svg>`;

// ---------- Salón de clases (diorama 2.5D) ----------
// Sin paredes laterales de "caja" (ronda del 23 nov 2026): la pared del
// fondo y el piso ocupan todo el ancho, con colores planos, y el entorno
// (EscenaKit) los continúa más allá de la isla: la cámara nunca ve el vacío.
export const SALON = {
  ancho: 2200,
  alto: 1500,
  pared: { x0: 0, x1: 2200, y0: 0, y1: 1040 },
} as const;
export const COLOR_PISO = "#C99460";
export const COLOR_LINEA_PISO = "#AE7A45";
export const Y_LINEAS_PISO = [1110, 1210, 1340, 1500] as const;

export function svgSalon(pared: Pared): ParteSvg {
  const { ancho, alto } = SALON;
  const { x0, x1, y0, y1 } = SALON.pared;
  const color = PAREDES[pared];
  const s: string[] = [];
  // Pared (color plano: continúa sin costura en el entorno), zócalo y piso.
  s.push(`<rect x="0" y="0" width="${ancho}" height="${y1}" fill="${color}"/>`);
  s.push(`<rect x="0" y="${y1 - 120}" width="${ancho}" height="120" fill="${oscurecer(color, 0.12)}"/><rect x="0" y="${y1 - 124}" width="${ancho}" height="10" fill="${oscurecer(color, 0.22)}"/>`);
  s.push(`<rect x="0" y="${y1}" width="${ancho}" height="${alto - y1}" fill="${COLOR_PISO}"/>`);
  for (const y of Y_LINEAS_PISO) s.push(`<rect x="0" y="${y}" width="${ancho}" height="5" fill="${COLOR_LINEA_PISO}"/>`);
  // Tablas: juntas cortas, en perspectiva (más juntas arriba).
  for (let fila = 0; fila < Y_LINEAS_PISO.length - 1; fila++) {
    const ya = fila === 0 ? y1 : Y_LINEAS_PISO[fila - 1];
    const yb = Y_LINEAS_PISO[fila];
    const paso = 260 + fila * 90;
    for (let x = (fila % 2) * paso * 0.5; x < ancho; x += paso) s.push(`<rect x="${x}" y="${ya}" width="5" height="${yb - ya}" fill="${COLOR_LINEA_PISO}" opacity="0.7"/>`);
  }
  void x0;
  void y0;
  void x1;
  // Pizarrón con dibujos de tiza (sin letras ni números).
  const pz = { x: 230, y: 200, w: 520, h: 360 };
  s.push(`<rect x="${pz.x - 18}" y="${pz.y - 18}" width="${pz.w + 36}" height="${pz.h + 36}" rx="10" fill="#8A5A36"/><rect x="${pz.x}" y="${pz.y}" width="${pz.w}" height="${pz.h}" rx="4" fill="#2F4A3F"/><rect x="${pz.x + 20}" y="${pz.y + pz.h + 18}" width="${pz.w - 40}" height="14" rx="5" fill="#6E4628"/>`);
  s.push(`<circle cx="${pz.x + 110}" cy="${pz.y + 110}" r="48" fill="none" stroke="#E8EFE8" stroke-width="7" opacity="0.85"/>`);
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    s.push(`<line x1="${pz.x + 110 + Math.cos(a) * 62}" y1="${pz.y + 110 + Math.sin(a) * 62}" x2="${pz.x + 110 + Math.cos(a) * 82}" y2="${pz.y + 110 + Math.sin(a) * 82}" stroke="#E8EFE8" stroke-width="6" stroke-linecap="round" opacity="0.85"/>`);
  }
  s.push(`<path d="M${pz.x + 230} ${pz.y + 240} q40 -60 80 0 t80 0 t80 0" fill="none" stroke="#F2D57A" stroke-width="7" stroke-linecap="round" opacity="0.9"/>`);
  s.push(`<path d="M${pz.x + 260} ${pz.y + 90} l60 -40 l60 40 v70 h-120 z" fill="none" stroke="#E8EFE8" stroke-width="6" opacity="0.8"/>`);
  // Ventana con cielo.
  const v = { x: 1720, y: 190, w: 260, h: 380 };
  s.push(`<rect x="${v.x - 16}" y="${v.y - 16}" width="${v.w + 32}" height="${v.h + 32}" rx="8" fill="#FFFFFF"/><rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="#9FD3F2"/><ellipse cx="${v.x + 90}" cy="${v.y + 110}" rx="60" ry="26" fill="#FFFFFF" opacity="0.9"/><ellipse cx="${v.x + 170}" cy="${v.y + 230}" rx="50" ry="20" fill="#FFFFFF" opacity="0.85"/><rect x="${v.x + v.w / 2 - 6}" y="${v.y}" width="12" height="${v.h}" fill="#FFFFFF"/><rect x="${v.x}" y="${v.y + v.h / 2 - 6}" width="${v.w}" height="12" fill="#FFFFFF"/><rect x="${v.x - 30}" y="${v.y + v.h + 14}" width="${v.w + 60}" height="18" rx="6" fill="${oscurecer(color, 0.25)}"/>`);
  // Guirnalda de banderines.
  const colores = ["#E85D5D", "#F2C230", "#3FA66B", "#3F6FD8", "#E86A9A", "#EE8A35"];
  s.push(`<path d="M${x0 + 40} ${y0 + 40} Q${ancho / 2} ${y0 + 140} ${x1 - 40} ${y0 + 40}" fill="none" stroke="#7A5A3A" stroke-width="5"/>`);
  for (let i = 0; i < 16; i++) {
    const t = (i + 0.5) / 16;
    const x = x0 + 40 + t * (x1 - x0 - 80);
    const y = y0 + 40 + 4 * 100 * t * (1 - t) * 1.0 - 4;
    s.push(`<path d="M${x - 26} ${y} L${x + 26} ${y} L${x} ${y + 52} Z" fill="${colores[i % colores.length]}"/>`);
  }
  // Sombra donde la pared toca el piso.
  s.push(`<rect x="0" y="${y1}" width="${ancho}" height="22" fill="rgba(60,40,20,0.18)"/>`);
  return { svg: svg(ancho, alto, s.join("")), ancho, alto, ancla: { x: 0, y: 0 } };
}

// ---------- Cartelera de corcho (los dibujos van aparte, en sus casillas) ----------
export const CARTELERA = { ancho: 1000, alto: 720, margen: 64, columnas: 4, filas: 3, hueco: 6 } as const;
export function casillaCartelera(i: number): { x: number; y: number; ancho: number; alto: number } {
  const { ancho, alto, margen, columnas, filas } = CARTELERA;
  const cw = (ancho - margen * 2) / columnas;
  const ch = (alto - margen * 2) / filas;
  const c = i % columnas;
  const f = Math.floor(i / columnas);
  return { x: margen + c * cw + 14, y: margen + f * ch + 12, ancho: cw - 28, alto: ch - 24 };
}
export function svgCartelera(): ParteSvg {
  const { ancho, alto } = CARTELERA;
  const s: string[] = [];
  s.push(`<rect x="10" y="18" width="${ancho - 10}" height="${alto - 10}" rx="18" fill="rgba(40,25,10,0.25)"/>`);
  s.push(`<rect x="0" y="0" width="${ancho}" height="${alto}" rx="18" fill="#9C6A3C"/><rect x="${ancho - 40}" y="12" width="28" height="${alto - 24}" rx="10" fill="#7E522C"/>`);
  s.push(`<rect x="30" y="30" width="${ancho - 60}" height="${alto - 60}" rx="8" fill="#D9A867"/>`);
  // Textura de corcho.
  for (let i = 0; i < 140; i++) {
    const x = 40 + ((i * 97) % (ancho - 80));
    const y = 40 + ((i * 53) % (alto - 80));
    s.push(`<circle cx="${x}" cy="${y}" r="${2 + (i % 3)}" fill="#C08E52" opacity="0.6"/>`);
  }
  // Casilla vacía: borde punteado.
  const h = casillaCartelera(CARTELERA.hueco);
  s.push(`<rect x="${h.x}" y="${h.y}" width="${h.ancho}" height="${h.alto}" rx="8" fill="rgba(255,255,255,0.18)" stroke="#FFFFFF" stroke-width="7" stroke-dasharray="22 14"/>`);
  return { svg: svg(ancho, alto, s.join("")), ancho, alto, ancla: { x: 0, y: 0 } };
}

// ---------- Dibujo infantil (papel con crayón) ----------
export const DIBUJO = { ancho: 190, alto: 165 } as const;
export function svgDibujo(motivo: MotivoDibujo): ParteSvg {
  const { ancho: W, alto: H } = DIBUJO;
  const t = (d: string, color: string, w = 7) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const f = (d: string, color: string) => `<path d="${d}" fill="${color}" opacity="0.85"/>`;
  const papel = `<rect x="6" y="8" width="${W - 12}" height="${H - 12}" rx="6" fill="rgba(0,0,0,0.18)"/><rect x="2" y="2" width="${W - 12}" height="${H - 12}" rx="6" fill="#FFFDF7"/><rect x="${W / 2 - 30}" y="-6" width="60" height="18" rx="3" fill="rgba(255,240,170,0.85)"/>`;
  const cx = W / 2 - 4;
  const cy = H / 2;
  let d = "";
  switch (motivo) {
    case "sol_casa":
      d = f(`M${cx - 40} ${cy + 50} v-45 h70 v45 z`, "#E86A5A") + f(`M${cx - 52} ${cy + 6} L${cx - 5} ${cy - 34} L${cx + 42} ${cy + 6} Z`, "#7A55C7") + `<circle cx="${cx + 52}" cy="${cy - 40}" r="20" fill="#F2C230"/>` + t(`M${cx - 70} ${cy + 52} h140`, "#3FA66B", 8);
      break;
    case "flor":
      d = t(`M${cx} ${cy + 55} v-50`, "#3FA66B", 8) + [0, 72, 144, 216, 288].map((a) => `<circle cx="${cx + Math.cos((a * Math.PI) / 180) * 24}" cy="${cy - 20 + Math.sin((a * Math.PI) / 180) * 24}" r="17" fill="#E86A9A"/>`).join("") + `<circle cx="${cx}" cy="${cy - 20}" r="14" fill="#F2C230"/>`;
      break;
    case "gato":
      d = `<circle cx="${cx}" cy="${cy + 8}" r="40" fill="#EE8A35"/>` + f(`M${cx - 36} ${cy - 18} l6 -38 l24 26 z M${cx + 36} ${cy - 18} l-6 -38 l-24 26 z`, "#EE8A35") + `<circle cx="${cx - 14}" cy="${cy + 2}" r="5" fill="#2B2233"/><circle cx="${cx + 14}" cy="${cy + 2}" r="5" fill="#2B2233"/>` + t(`M${cx - 50} ${cy + 16} h26 M${cx + 24} ${cy + 16} h26`, "#2B2233", 4);
      break;
    case "arcoiris":
      d = ["#E85D5D", "#F2C230", "#3FA66B", "#3F6FD8"].map((c, i) => t(`M${cx - 66 + i * 12} ${cy + 40} A${66 - i * 12} ${66 - i * 12} 0 0 1 ${cx + 66 - i * 12} ${cy + 40}`, c, 10)).join("");
      break;
    case "arbol":
      d = f(`M${cx - 10} ${cy + 55} v-40 h20 v40 z`, "#8A5A36") + `<circle cx="${cx}" cy="${cy - 18}" r="44" fill="#3FA66B"/><circle cx="${cx - 18}" cy="${cy - 22}" r="7" fill="#E85D5D"/><circle cx="${cx + 20}" cy="${cy - 8}" r="7" fill="#E85D5D"/>`;
      break;
    case "cohete":
      d = f(`M${cx} ${cy - 60} Q${cx + 30} ${cy - 20} ${cx + 22} ${cy + 30} h-44 Q${cx - 30} ${cy - 20} ${cx} ${cy - 60} z`, "#3F6FD8") + `<circle cx="${cx}" cy="${cy - 14}" r="10" fill="#9FD3F2"/>` + f(`M${cx - 22} ${cy + 22} l-16 22 l20 -6 z M${cx + 22} ${cy + 22} l16 22 l-20 -6 z`, "#E85D5D") + f(`M${cx - 12} ${cy + 32} Q${cx} ${cy + 66} ${cx + 12} ${cy + 32} z`, "#F2C230");
      break;
    case "pez":
      d = `<ellipse cx="${cx - 6}" cy="${cy + 4}" rx="48" ry="28" fill="#2FB3B0"/>` + f(`M${cx + 38} ${cy + 4} l30 -22 v44 z`, "#2FB3B0") + `<circle cx="${cx - 28}" cy="${cy - 2}" r="6" fill="#2B2233"/>` + t(`M${cx - 70} ${cy + 48} q20 -10 40 0 t40 0 t40 0`, "#3F6FD8", 5);
      break;
    case "corazon":
      d = f(`M${cx} ${cy + 46} C${cx - 70} ${cy} ${cx - 40} ${cy - 54} ${cx} ${cy - 22} C${cx + 40} ${cy - 54} ${cx + 70} ${cy} ${cx} ${cy + 46} Z`, "#E85D5D");
      break;
    case "mariposa":
      d = `<ellipse cx="${cx - 30}" cy="${cy - 16}" rx="28" ry="34" fill="#7A55C7"/><ellipse cx="${cx + 30}" cy="${cy - 16}" rx="28" ry="34" fill="#7A55C7"/><ellipse cx="${cx - 24}" cy="${cy + 26}" rx="20" ry="22" fill="#E86A9A"/><ellipse cx="${cx + 24}" cy="${cy + 26}" rx="20" ry="22" fill="#E86A9A"/>` + t(`M${cx} ${cy - 40} v80`, "#2B2233", 8);
      break;
    case "barco":
      d = f(`M${cx - 56} ${cy + 20} h112 l-20 26 h-72 z`, "#8A5A36") + f(`M${cx} ${cy - 54} v70 h48 z`, "#F2F0EA") + t(`M${cx} ${cy - 54} v74`, "#2B2233", 5) + t(`M${cx - 72} ${cy + 56} q18 -10 36 0 t36 0 t36 0 t36 0`, "#3F6FD8", 5);
      break;
    case "estrella":
      d = `<path d="${estrella(cx, cy + 4, 56, 24)}" fill="#F2C230"/>`;
      break;
    case "perro":
      d = `<circle cx="${cx}" cy="${cy + 6}" r="38" fill="#C9955E"/><ellipse cx="${cx - 38}" cy="${cy + 10}" rx="14" ry="30" fill="#8A5A36"/><ellipse cx="${cx + 38}" cy="${cy + 10}" rx="14" ry="30" fill="#8A5A36"/><circle cx="${cx - 13}" cy="${cy}" r="5" fill="#2B2233"/><circle cx="${cx + 13}" cy="${cy}" r="5" fill="#2B2233"/><ellipse cx="${cx}" cy="${cy + 18}" rx="9" ry="7" fill="#2B2233"/>`;
      break;
  }
  return { svg: svg(W, H, papel + `<g transform="translate(0 2)">${d}</g>`), ancho: W, alto: H, ancla: { x: W / 2, y: H / 2 } };
}

// ---------- Bolsa de dulces ----------
export const DULCES = { ancho: 170, alto: 200 } as const;
export function svgDulces(): ParteSvg {
  const { ancho: W, alto: H } = DULCES;
  const s: string[] = [];
  const colores = ["#E85D5D", "#F2C230", "#3FA66B", "#3F6FD8", "#E86A9A"];
  // Dulces asomando y un chupetín.
  s.push(`<line x1="${W * 0.7}" y1="10" x2="${W * 0.62}" y2="90" stroke="#F2F0EA" stroke-width="8" stroke-linecap="round"/><circle cx="${W * 0.72}" cy="22" r="26" fill="#E86A9A"/><path d="M${W * 0.72 - 16} 22 a16 16 0 0 1 32 0" fill="none" stroke="#FFFFFF" stroke-width="6"/>`);
  for (let i = 0; i < 5; i++) s.push(`<ellipse cx="${30 + i * 26}" cy="${70 - (i % 2) * 10}" rx="18" ry="14" fill="${colores[i]}"/>`);
  // Bolsa transparente con lazo.
  s.push(`<path d="M18 76 Q${W / 2} 60 ${W - 18} 76 L${W - 8} ${H - 14} Q${W / 2} ${H + 4} 8 ${H - 14} Z" fill="rgba(255,255,255,0.55)" stroke="rgba(255,255,255,0.9)" stroke-width="5"/>`);
  for (let i = 0; i < 9; i++) s.push(`<circle cx="${30 + ((i * 37) % (W - 60))}" cy="${110 + ((i * 23) % 70)}" r="13" fill="${colores[i % colores.length]}"/>`);
  s.push(`<path d="M${W / 2 - 30} 82 q30 -24 60 0 q-30 20 -60 0 z" fill="#E85D5D"/>`);
  return { svg: svg(W, H, s.join("")), ancho: W, alto: H, ancla: { x: W / 2, y: H * 0.6 } };
}

// ---------- Pupitre (vista de frente, tapa en perspectiva) y silla ----------
export const PUPITRE = { ancho: 400, alto: 320, tapa: 56 } as const;
export function svgPupitre(): ParteSvg {
  const { ancho: W, alto: H, tapa } = PUPITRE;
  const s: string[] = [];
  s.push(`<ellipse cx="${W / 2}" cy="${H - 6}" rx="${W * 0.5}" ry="12" fill="rgba(20,16,30,0.22)"/>`);
  // Patas metálicas.
  for (const x of [34, W - 50]) s.push(`<rect x="${x}" y="${tapa + 100}" width="16" height="${H - tapa - 108}" rx="6" fill="#6C7384"/>`);
  // Panel del frente y la tapa (más clara, vista desde arriba).
  s.push(`<rect x="12" y="${tapa}" width="${W - 24}" height="130" rx="10" fill="#4F86C6"/><rect x="${W * 0.62}" y="${tapa}" width="${W * 0.38 - 12}" height="130" rx="10" fill="#4174B0"/>`);
  s.push(`<path d="M28 4 L${W - 28} 4 L${W} ${tapa} L0 ${tapa} Z" fill="#D9A867"/><rect x="0" y="${tapa - 4}" width="${W}" height="16" rx="6" fill="#B9864C"/>`);
  return { svg: svg(W, H, s.join("")), ancho: W, alto: H, ancla: { x: W / 2, y: 0 } };
}
export const SILLA = { ancho: 300, alto: 520 } as const;
export function svgSilla(): ParteSvg {
  const { ancho: W, alto: H } = SILLA;
  const s: string[] = [];
  for (const x of [40, W - 56]) s.push(`<rect x="${x}" y="60" width="16" height="${H - 60}" rx="6" fill="#6C7384"/>`);
  s.push(`<rect x="10" y="0" width="${W - 20}" height="150" rx="22" fill="#E07B4C"/><rect x="${W * 0.6}" y="0" width="${W * 0.4 - 10}" height="150" rx="22" fill="#C9673C"/>`);
  s.push(`<rect x="0" y="${H * 0.58}" width="${W}" height="30" rx="10" fill="#C9673C"/>`);
  return { svg: svg(W, H, s.join("")), ancho: W, alto: H, ancla: { x: W / 2, y: 0 } };
}
