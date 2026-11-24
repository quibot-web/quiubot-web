// Partes de los personajes del kit como SVG (puro). Cada parte se convierte
// a PNG UNA vez al precargar (rasterizar.ts) y el video solo mueve imágenes:
// así los brazos articulados no hacen que el renderizador serialice un SVG
// distinto en cada cuadro. Estilo del reel ilustrado: formas planas, un lado
// más oscuro (volumen 2.5D) y sin contornos. Sin texto.
import { COLORES_ROPA, PELOS, PIELES, ROPA_DE_TIPO, esAdulto, esMayor, type Accesorio, type ColorPelo, type ColorRopa, type Expresion, type Peinado, type Piel, type TipoPersonaje } from "./catalogoKit";
import { proporciones, type FormaMano, type Proporciones } from "./poses";

export type AspectoPersonaje = { tipo: TipoPersonaje; piel: Piel; pelo: ColorPelo; peinado: Peinado; ropa: ColorRopa; ropa2: ColorRopa; accesorio: Accesorio };
export type ParteSvg = { svg: string; ancho: number; alto: number; ancla: { x: number; y: number } };

export function oscurecer(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 - k))));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`;
}
export function aclarar(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * k);
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`;
}
const svg = (ancho: number, alto: number, cuerpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">${cuerpo}</svg>`;

// Una pierna con su zapato (la punta hacia la derecha), desde la cadera
// (x = borde izquierdo de la pierna, y0 = cadera). oscura: la de atrás.
function pierna(a: AspectoPersonaje, p: Proporciones, x: number, y0: number, oscura: boolean): string {
  const pi = p.piernas;
  const adulto = esAdulto(a.tipo);
  const zapato = adulto ? (esMayor(a.tipo) ? "#5A4636" : "#3A2B2B") : "#F4F2EE";
  const suela = adulto ? "#241A1A" : oscurecer(COLORES_ROPA[a.ropa2], 0.15);
  // Con pantalón, las piernas son del color del pantalón.
  const base = ROPA_DE_TIPO[a.tipo] === "pantalon" ? COLORES_ROPA[a.ropa2] : PIELES[a.piel];
  const color = oscura ? oscurecer(base, 0.1) : base;
  const y1 = y0 + (pi.y1 - pi.y0);
  return (
    `<rect x="${x}" y="${y0}" width="${pi.ancho}" height="${pi.y1 - pi.y0}" rx="${pi.ancho / 2}" fill="${color}"/>` +
    `<path d="M${x - 8} ${y1 - 6} q0 -22 ${pi.ancho / 2 + 8} -22 q${pi.ancho / 2 + 18} 0 ${pi.ancho / 2 + 26} 26 v10 h-${pi.ancho + 26} z" fill="${zapato}"/>` +
    `<rect x="${x - 8}" y="${y1 + 2}" width="${pi.ancho + 26}" height="9" rx="4" fill="${suela}"/>`
  );
}

// La pierna de quien camina, como pieza aparte que gira en la cadera
// (ancla: el centro de la cadera). Misma forma que en svgCuerpo.
export function svgPierna(a: AspectoPersonaje, oscura: boolean): ParteSvg {
  const p = proporciones(a.tipo);
  const pi = p.piernas;
  const ancho = pi.ancho + 40;
  const alto = pi.y1 - pi.y0 + 16;
  return { svg: svg(ancho, alto, pierna(a, p, 10, 0, oscura)), ancho, alto, ancla: { x: 10 + pi.ancho / 2, y: 0 } };
}

// ---------- Cuerpo (piernas, torso, cuello, sombra) ----------
// conPiernas = false: el cuerpo de quien camina (sin sombra ni piernas, que
// van aparte en svgPierna y se mueven en cada paso).
export function svgCuerpo(a: AspectoPersonaje, conPiernas = true): ParteSvg {
  const p = proporciones(a.tipo);
  const piel = PIELES[a.piel];
  const ropa = COLORES_ROPA[a.ropa];
  const ropa2 = COLORES_ROPA[a.ropa2];
  const { cx } = p;
  const t = p.torso;
  const pi = p.piernas;
  const partes: string[] = [];
  const estilo = ROPA_DE_TIPO[a.tipo];
  if (conPiernas) {
    // Sombra en el piso.
    partes.push(`<ellipse cx="${cx}" cy="${p.pies}" rx="${p.cuerpoAncho * 0.62}" ry="${p.alto * 0.016}" fill="rgba(20,16,30,0.28)"/>`);
    // Piernas y zapatos.
    for (const lado of [-1, 1] as const) partes.push(pierna(a, p, cx + lado * (pi.separacion / 2) - pi.ancho / 2, pi.y0, lado > 0));
  }
  // Cuello.
  partes.push(`<rect x="${cx - p.cuello.ancho / 2}" y="${p.cuello.y0}" width="${p.cuello.ancho}" height="${p.cuello.y1 - p.cuello.y0 + 10}" rx="12" fill="${oscurecer(piel, 0.12)}"/>`);
  const h = t.hombros / 2;
  const c = t.cintura / 2;
  if (estilo === "pantalon") {
    // Pantalón (ropa2) hasta los zapatos, cinturón, y arriba según quién es.
    partes.push(`<path d="M${cx - c - 4} ${t.y1 - 30} L${cx - c - 8} ${pi.y0 + 40} L${cx + c + 8} ${pi.y0 + 40} L${cx + c + 4} ${t.y1 - 30} Z" fill="${ropa2}"/>`);
    partes.push(`<rect x="${cx - c - 4}" y="${t.y1 - 34}" width="${t.cintura + 8}" height="16" fill="${oscurecer(ropa2, 0.35)}"/>`);
    const conChaqueta = a.tipo === "cliente" || a.tipo === "emprendedor" || a.tipo === "emprendedora" || esMayor(a.tipo);
    const camisa = conChaqueta ? "#F2F0EA" : ropa;
    partes.push(`<path d="M${cx - h} ${t.y0 + 40} Q${cx - h} ${t.y0} ${cx - h + 40} ${t.y0} L${cx + h - 40} ${t.y0} Q${cx + h} ${t.y0} ${cx + h} ${t.y0 + 40} L${cx + c + 4} ${t.y1 - 26} L${cx - c - 4} ${t.y1 - 26} Z" fill="${camisa}"/>`);
    partes.push(`<path d="M${cx + 30} ${t.y0} L${cx + h - 40} ${t.y0} Q${cx + h} ${t.y0} ${cx + h} ${t.y0 + 40} L${cx + c + 4} ${t.y1 - 26} L${cx + 40} ${t.y1 - 26} Z" fill="${oscurecer(camisa, 0.1)}"/>`);
    // Cuello de camisa.
    partes.push(`<path d="M${cx - 40} ${t.y0 - 2} L${cx} ${t.y0 + 34} L${cx + 40} ${t.y0 - 2} L${cx + 22} ${t.y0 + 40} L${cx} ${t.y0 + 26} L${cx - 22} ${t.y0 + 40} Z" fill="${oscurecer(camisa, 0.18)}"/>`);
    if (a.tipo === "vendedor") {
      // Delantal (claro) con tirantes y bolsillo.
      const del = "#F4EFE4";
      partes.push(`<path d="M${cx - c + 6} ${t.y0 + 70} L${cx + c - 6} ${t.y0 + 70} L${cx + c + 16} ${pi.y0 + 120} Q${cx} ${pi.y0 + 132} ${cx - c - 16} ${pi.y0 + 120} Z" fill="${del}"/>`);
      partes.push(`<path d="M${cx - c + 10} ${t.y0 + 72} L${cx - h + 30} ${t.y0 + 4} M${cx + c - 10} ${t.y0 + 72} L${cx + h - 30} ${t.y0 + 4}" stroke="${del}" stroke-width="12" fill="none"/>`);
      partes.push(`<rect x="${cx - 46}" y="${t.y1 + 10}" width="92" height="60" rx="10" fill="${oscurecer(del, 0.08)}"/>`);
      partes.push(`<rect x="${cx - c + 6}" y="${t.y0 + 66}" width="${t.cintura - 12}" height="8" fill="${ropa}"/>`);
    } else if (conChaqueta) {
      // Chaqueta (cliente) o saco tejido (mayores), abiertos sobre la camisa clara.
      for (const l of [-1, 1]) {
        partes.push(`<path d="M${cx + l * 26} ${t.y0} L${cx + l * (h - 40)} ${t.y0} Q${cx + l * h} ${t.y0} ${cx + l * h} ${t.y0 + 40} L${cx + l * (c + 10)} ${t.y1 - 10} L${cx + l * 30} ${t.y1 - 10} Z" fill="${l > 0 ? oscurecer(ropa, 0.12) : ropa}"/>`);
      }
      if (esMayor(a.tipo)) for (let i = 0; i < 3; i++) partes.push(`<circle cx="${cx - 38}" cy="${t.y0 + 60 + i * 50}" r="7" fill="${oscurecer(ropa, 0.35)}"/>`);
      // Emprendedor/a: saco de solapas, con un bolsillo y un botón.
      if (a.tipo === "emprendedor" || a.tipo === "emprendedora") {
        for (const l of [-1, 1]) partes.push(`<path d="M${cx + l * 26} ${t.y0} L${cx + l * 50} ${t.y0 + 70} L${cx + l * 30} ${t.y0 + 110}" stroke="${oscurecer(ropa, 0.3)}" stroke-width="7" fill="none"/>`);
        partes.push(`<rect x="${cx + 50}" y="${t.y0 + 130}" width="44" height="8" rx="3" fill="${oscurecer(ropa, 0.3)}"/><circle cx="${cx + 34}" cy="${t.y1 - 40}" r="7" fill="${oscurecer(ropa, 0.4)}"/>`);
      }
    } else {
      // Camisa con botones (papá).
      for (let i = 0; i < 3; i++) partes.push(`<circle cx="${cx}" cy="${t.y0 + 60 + i * 50}" r="6" fill="${oscurecer(ropa, 0.3)}"/>`);
    }
  } else if (estilo === "falda") {
    // Falda acampanada (ropa2) y blusa (ropa) con cuello en V.
    partes.push(`<path d="M${cx - c} ${t.y1 - 30} L${cx - c - 70} ${pi.y0 + 170} Q${cx} ${pi.y0 + 200} ${cx + c + 70} ${pi.y0 + 170} L${cx + c} ${t.y1 - 30} Z" fill="${ropa2}"/>`);
    partes.push(`<path d="M${cx + 20} ${t.y1 - 30} L${cx + c + 70} ${pi.y0 + 170} Q${cx + c + 30} ${pi.y0 + 188} ${cx + 30} ${pi.y0 + 196} Z" fill="${oscurecer(ropa2, 0.14)}"/>`);
    partes.push(`<path d="M${cx - h} ${t.y0 + 40} Q${cx - h} ${t.y0} ${cx - h + 40} ${t.y0} L${cx + h - 40} ${t.y0} Q${cx + h} ${t.y0} ${cx + h} ${t.y0 + 40} L${cx + c} ${t.y1} L${cx - c} ${t.y1} Z" fill="${ropa}"/>`);
    partes.push(`<path d="M${cx + 30} ${t.y0} L${cx + h - 40} ${t.y0} Q${cx + h} ${t.y0} ${cx + h} ${t.y0 + 40} L${cx + c} ${t.y1} L${cx + 40} ${t.y1} Z" fill="${oscurecer(ropa, 0.12)}"/>`);
    if (a.tipo === "mama") partes.push(`<path d="M${cx - 38} ${t.y0} Q${cx} ${t.y0 + 46} ${cx + 38} ${t.y0} Z" fill="${piel}"/><path d="M${cx - 30} ${t.y0 + 6} Q${cx} ${t.y0 + 50} ${cx + 30} ${t.y0 + 6}" fill="none" stroke="#F2E6B8" stroke-width="5"/>`);
    else partes.push(`<path d="M${cx - 34} ${t.y0} L${cx} ${t.y0 + 70} L${cx + 34} ${t.y0} Z" fill="${piel}"/>`);
    partes.push(`<rect x="${cx - c}" y="${t.y1 - 34}" width="${t.cintura}" height="20" fill="${oscurecer(ropa2, 0.3)}"/>`);
    // Vendedora: delantal claro sobre la blusa y la falda.
    if (a.tipo === "vendedora") {
      const del = "#F4EFE4";
      partes.push(`<path d="M${cx - c + 6} ${t.y0 + 70} L${cx + c - 6} ${t.y0 + 70} L${cx + c + 30} ${pi.y0 + 150} Q${cx} ${pi.y0 + 166} ${cx - c - 30} ${pi.y0 + 150} Z" fill="${del}"/>`);
      partes.push(`<path d="M${cx - c + 10} ${t.y0 + 72} L${cx - h + 30} ${t.y0 + 4} M${cx + c - 10} ${t.y0 + 72} L${cx + h - 30} ${t.y0 + 4}" stroke="${del}" stroke-width="12" fill="none"/>`);
      partes.push(`<rect x="${cx - 46}" y="${t.y1 + 10}" width="92" height="60" rx="10" fill="${oscurecer(del, 0.08)}"/>`);
    }
    // Abuela: saco tejido abierto sobre la blusa.
    if (a.tipo === "abuela") for (const l of [-1, 1]) partes.push(`<path d="M${cx + l * 30} ${t.y0} L${cx + l * (h - 40)} ${t.y0} Q${cx + l * h} ${t.y0} ${cx + l * h} ${t.y0 + 40} L${cx + l * (c + 6)} ${t.y1 - 20} L${cx + l * 36} ${t.y1 - 20} Z" fill="${l > 0 ? oscurecer("#B9A88F", 0.12) : "#B9A88F"}"/>`);
  } else if (estilo === "vestido") {
    // Vestido (ropa) con cuello blanco.
    partes.push(`<path d="M${cx - h} ${t.y0 + 34} Q${cx - h} ${t.y0} ${cx - h + 34} ${t.y0} L${cx + h - 34} ${t.y0} Q${cx + h} ${t.y0} ${cx + h} ${t.y0 + 34} L${cx + c + 56} ${pi.y0 + 96} Q${cx} ${pi.y0 + 120} ${cx - c - 56} ${pi.y0 + 96} Z" fill="${ropa}"/>`);
    partes.push(`<path d="M${cx + 24} ${t.y0} L${cx + h - 34} ${t.y0} Q${cx + h} ${t.y0} ${cx + h} ${t.y0 + 34} L${cx + c + 56} ${pi.y0 + 96} Q${cx + c + 20} ${pi.y0 + 110} ${cx + 30} ${pi.y0 + 116} Z" fill="${oscurecer(ropa, 0.13)}"/>`);
    partes.push(`<path d="M${cx - 44} ${t.y0 - 2} Q${cx - 22} ${t.y0 + 34} ${cx} ${t.y0 + 10} Q${cx + 22} ${t.y0 + 34} ${cx + 44} ${t.y0 - 2} Z" fill="#FFFFFF"/>`);
    partes.push(`<circle cx="${cx}" cy="${t.y0 + 60}" r="7" fill="${ropa2}"/><circle cx="${cx}" cy="${t.y0 + 100}" r="7" fill="${ropa2}"/>`);
  } else {
    // Niño: camiseta (ropa) y pantaloneta (ropa2).
    partes.push(`<rect x="${cx - c - 6}" y="${t.y1 - 24}" width="${t.cintura + 12}" height="${pi.y0 - t.y1 + 92}" rx="16" fill="${ropa2}"/>`);
    partes.push(`<rect x="${cx + 6}" y="${t.y1 - 24}" width="${c}" height="${pi.y0 - t.y1 + 92}" rx="14" fill="${oscurecer(ropa2, 0.14)}"/>`);
    partes.push(`<line x1="${cx}" y1="${t.y1 + 10}" x2="${cx}" y2="${pi.y0 + 60}" stroke="${oscurecer(ropa2, 0.3)}" stroke-width="5"/>`);
    partes.push(`<path d="M${cx - h} ${t.y0 + 34} Q${cx - h} ${t.y0} ${cx - h + 34} ${t.y0} L${cx + h - 34} ${t.y0} Q${cx + h} ${t.y0} ${cx + h} ${t.y0 + 34} L${cx + c + 4} ${t.y1} L${cx - c - 4} ${t.y1} Z" fill="${ropa}"/>`);
    partes.push(`<path d="M${cx + 24} ${t.y0} L${cx + h - 34} ${t.y0} Q${cx + h} ${t.y0} ${cx + h} ${t.y0 + 34} L${cx + c + 4} ${t.y1} L${cx + 30} ${t.y1} Z" fill="${oscurecer(ropa, 0.13)}"/>`);
    partes.push(`<path d="M${cx - 30} ${t.y0 - 1} Q${cx} ${t.y0 + 30} ${cx + 30} ${t.y0 - 1}" fill="none" stroke="${oscurecer(ropa, 0.28)}" stroke-width="7"/>`);
    // Estrella en el pecho (sin texto).
    partes.push(`<path d="${estrella(cx - 30, t.y0 + 90, 22, 10)}" fill="${aclarar(ropa, 0.55)}"/>`);
  }
  return { svg: svg(p.ancho, p.alto, partes.join("")), ancho: p.ancho, alto: p.alto, ancla: { x: 0, y: 0 } };
}

export function estrella(cx: number, cy: number, R: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

// ---------- Cabeza (pelo, cara y expresión) ----------
// Cabeza SIN rasgos (pelo, orejas, cara). Los ojos, cejas y boca van en su
// propia capa (svgRasgos) para que parpadeen y miren hacia los lados sin
// redibujar la cabeza.
export function svgCabeza(a: AspectoPersonaje): ParteSvg {
  const p = proporciones(a.tipo);
  const { cx, cy, rx, ry } = p.cabeza;
  const piel = PIELES[a.piel];
  const pelo = PELOS[a.pelo];
  const peloOscuro = oscurecer(pelo, 0.2);
  const detras: string[] = [];
  const delante: string[] = [];
  // (El pelo largo va en su propia capa, DETRÁS del cuerpo: svgPeloAtras.)
  if (a.peinado === "rizado") for (let i = 0; i < 11; i++) {
    const ang = Math.PI * (0.95 + (i / 10) * 1.1);
    detras.push(`<circle cx="${cx + Math.cos(ang) * (rx + 18)}" cy="${cy - 10 + Math.sin(ang) * (ry + 14)}" r="${rx * 0.42}" fill="${i % 2 ? pelo : peloOscuro}"/>`);
  }
  if (a.peinado === "colitas") for (const lado of [-1, 1]) {
    detras.push(`<ellipse cx="${cx + lado * (rx + 34)}" cy="${cy + 30}" rx="${rx * 0.34}" ry="${ry * 0.55}" fill="${lado > 0 ? peloOscuro : pelo}"/>`);
    delante.push(`<circle cx="${cx + lado * (rx + 8)}" cy="${cy - 10}" r="13" fill="${COLORES_ROPA[a.ropa2]}"/>`);
  }
  if (a.peinado === "mono") detras.push(`<circle cx="${cx}" cy="${cy - ry - 22}" r="${rx * 0.5}" fill="${pelo}"/><circle cx="${cx + 10}" cy="${cy - ry - 18}" r="${rx * 0.36}" fill="${peloOscuro}"/>`);
  // Orejas y cara (con el lado derecho un poco más oscuro).
  const orejas = [-1, 1].map((l) => `<ellipse cx="${cx + l * rx}" cy="${cy + 14}" rx="18" ry="24" fill="${l > 0 ? oscurecer(piel, 0.1) : piel}"/>`).join("");
  const cara = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${piel}"/><path d="M${cx + rx * 0.35} ${cy - ry * 0.94} A${rx} ${ry} 0 0 1 ${cx + rx * 0.35} ${cy + ry * 0.94} Q${cx + rx * 0.75} ${cy} ${cx + rx * 0.35} ${cy - ry * 0.94} Z" fill="${oscurecer(piel, 0.08)}"/>`;
  // Flequillo / tapa de pelo por delante.
  const tapa =
    a.peinado === "rizado"
      ? Array.from({ length: 7 }, (_, i) => `<circle cx="${cx - rx * 0.8 + i * rx * 0.27}" cy="${cy - ry * 0.78 + Math.abs(i - 3) * 6}" r="${rx * 0.26}" fill="${i % 2 ? pelo : peloOscuro}"/>`).join("")
      : `<path d="M${cx - rx - 6} ${cy - 6} Q${cx - rx - 6} ${cy - ry - 12} ${cx} ${cy - ry - 14} Q${cx + rx + 6} ${cy - ry - 12} ${cx + rx + 6} ${cy - 6} Q${cx + rx * 0.55} ${cy - ry * 0.5} ${cx + rx * 0.1} ${cy - ry * 0.62} Q${cx - rx * 0.5} ${cy - ry * 0.45} ${cx - rx - 6} ${cy - 6} Z" fill="${pelo}"/><path d="M${cx + rx * 0.2} ${cy - ry - 12} Q${cx + rx + 6} ${cy - ry - 10} ${cx + rx + 6} ${cy - 6} Q${cx + rx * 0.6} ${cy - ry * 0.5} ${cx + rx * 0.2} ${cy - ry * 0.6} Z" fill="${peloOscuro}"/>`;
  delante.push(tapa);
  const cuerpo = [...detras, orejas, cara, delante.join("")].join("");
  return { svg: svg(p.ancho, p.alturaCabeza, cuerpo), ancho: p.ancho, alto: p.alturaCabeza, ancla: { x: cx, y: p.cuello.y0 + 10 } };
}

// Pelo largo: capa propia detrás del cuerpo (si iba en la cabeza, tapaba
// el vestido como una capa). Mismo lienzo y ancla que la cabeza.
export function svgPeloAtras(a: AspectoPersonaje): ParteSvg | null {
  if (a.peinado !== "largo") return null;
  const p = proporciones(a.tipo);
  const { cx, cy, rx } = p.cabeza;
  const pelo = oscurecer(PELOS[a.pelo], 0.2);
  const largo = p.torso.y0 + (p.torso.y1 - p.torso.y0) * 0.45 - cy;
  const c = `<path d="M${cx - rx - 22} ${cy - 20} Q${cx - rx - 34} ${cy + largo * 0.8} ${cx - rx + 4} ${cy + largo} L${cx + rx - 4} ${cy + largo} Q${cx + rx + 34} ${cy + largo * 0.8} ${cx + rx + 22} ${cy - 20} Z" fill="${pelo}"/>`;
  return { svg: svg(p.ancho, p.alturaCabeza, c), ancho: p.ancho, alto: p.alturaCabeza, ancla: { x: cx, y: p.cuello.y0 + 10 } };
}

// Rasgos (ojos, cejas, boca, mejillas, gafas): misma tela y ancla que la
// cabeza. Exagerados para que se lean en un celular (23 nov 2026).
// ojos "cerrados": parpadeo.
export type Ojos = "abiertos" | "cerrados";
// "bostezo": cara interna (no la elige la IA): el aburrido bosteza cada tanto.
export type Cara = Expresion | "bostezo";
export function svgRasgos(a: AspectoPersonaje, e: Cara, ojos: Ojos): ParteSvg {
  const p = proporciones(a.tipo);
  return { svg: svg(p.ancho, p.alturaCabeza, rasgos(a, p, e, ojos)), ancho: p.ancho, alto: p.alturaCabeza, ancla: { x: p.cabeza.cx, y: p.cuello.y0 + 10 } };
}

function rasgos(a: AspectoPersonaje, p: Proporciones, e: Cara, ojos: Ojos): string {
  const { cx, cy, rx } = p.cabeza;
  const nino = !esAdulto(a.tipo);
  const ojo = nino ? 14 : 12;
  const sep = rx * 0.4;
  const oy = cy + 6;
  const tinta = "#2B2233";
  const linea = (d: string, w = 8) => `<path d="${d}" fill="none" stroke="${tinta}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const s: string[] = [];
  // Mejillas.
  const rubor = e === "feliz" || e === "atento" ? 0.7 : e === "triste" || e === "aburrido" || e === "bostezo" ? 0.15 : 0.35;
  s.push(...[-1, 1].map((l) => `<ellipse cx="${cx + l * rx * 0.62}" cy="${oy + 36}" rx="${rx * 0.19}" ry="${rx * 0.11}" fill="#F07C7C" opacity="${rubor}"/>`));
  const cerrados = () => [-1, 1].forEach((l) => s.push(linea(`M${cx + l * sep - ojo} ${oy + 2} Q${cx + l * sep} ${oy + 8} ${cx + l * sep + ojo} ${oy + 2}`, 7)));
  if (e === "feliz") {
    // Ojos felices (arcos) y boca MUY abierta.
    for (const l of [-1, 1]) s.push(linea(`M${cx + l * sep - ojo * 1.1} ${oy + 6} Q${cx + l * sep} ${oy - ojo * 1.6} ${cx + l * sep + ojo * 1.1} ${oy + 6}`, 9));
    for (const l of [-1, 1]) s.push(linea(`M${cx + l * sep - 20} ${oy - 40} Q${cx + l * sep} ${oy - 56} ${cx + l * sep + 20} ${oy - 40}`, 7));
    const w = rx * 0.5;
    const h = rx * 0.52;
    s.push(`<path d="M${cx - w} ${oy + 32} Q${cx} ${oy + 38} ${cx + w} ${oy + 32} Q${cx + w * 0.9} ${oy + 32 + h} ${cx} ${oy + 34 + h} Q${cx - w * 0.9} ${oy + 32 + h} ${cx - w} ${oy + 32} Z" fill="#6E2330"/>`);
    s.push(`<path d="M${cx - w * 0.55} ${oy + 30 + h * 0.8} Q${cx} ${oy + 16 + h * 0.6} ${cx + w * 0.55} ${oy + 30 + h * 0.8} Q${cx} ${oy + 36 + h} ${cx - w * 0.55} ${oy + 30 + h * 0.8} Z" fill="#E8737E"/>`);
    s.push(`<path d="M${cx - w * 0.86} ${oy + 34} Q${cx} ${oy + 40} ${cx + w * 0.86} ${oy + 34} L${cx + w * 0.8} ${oy + 46} Q${cx} ${oy + 52} ${cx - w * 0.8} ${oy + 46} Z" fill="#FFFFFF"/>`);
  } else if (e === "triste") {
    if (ojos === "cerrados") cerrados();
    else for (const l of [-1, 1]) s.push(`<ellipse cx="${cx + l * sep}" cy="${oy + 6}" rx="${ojo * 0.9}" ry="${ojo * 1.05}" fill="${tinta}"/><circle cx="${cx + l * sep + 3}" cy="${oy + 1}" r="${ojo * 0.32}" fill="#FFFFFF"/>`);
    // Cejas MUY inclinadas (la punta de adentro bien arriba).
    for (const l of [-1, 1]) s.push(linea(`M${cx + l * (sep + 26)} ${oy - 18} L${cx + l * (sep - 18)} ${oy - 46}`, 9));
    // Boca hacia abajo, bien marcada.
    s.push(linea(`M${cx - 32} ${oy + 70} Q${cx - 14} ${oy + 44} ${cx} ${oy + 50} Q${cx + 14} ${oy + 44} ${cx + 32} ${oy + 70}`, 8));
    s.push(`<path d="M${cx + sep + 12} ${oy + 22} q-11 22 0 30 q11 -8 0 -30 z" fill="#6FBDEF"/>`);
  } else if (e === "bostezo") {
    // Bostezo: ojos cerrados apretados, cejas arriba y boca grande y ovalada.
    for (const l of [-1, 1]) {
      s.push(linea(`M${cx + l * sep - ojo} ${oy + 2} Q${cx + l * sep} ${oy - 6} ${cx + l * sep + ojo} ${oy + 2}`, 7));
      s.push(linea(`M${cx + l * sep - 18} ${oy - 44} Q${cx + l * sep} ${oy - 54} ${cx + l * sep + 18} ${oy - 44}`, 7));
    }
    s.push(`<ellipse cx="${cx}" cy="${oy + 66}" rx="${rx * 0.24}" ry="${rx * 0.36}" fill="#6E2330"/>`);
    s.push(`<ellipse cx="${cx}" cy="${oy + 84}" rx="${rx * 0.15}" ry="${rx * 0.12}" fill="#E8737E"/>`);
  } else if (e === "atento") {
    // Atento: ojos MUY abiertos con brillo grande, cejas arriba, sonrisa leve.
    for (const l of [-1, 1]) {
      if (ojos === "cerrados") s.push(linea(`M${cx + l * sep - ojo} ${oy + 2} Q${cx + l * sep} ${oy + 8} ${cx + l * sep + ojo} ${oy + 2}`, 7));
      else s.push(`<ellipse cx="${cx + l * sep}" cy="${oy - 2}" rx="${ojo * 1.15}" ry="${ojo * 1.4}" fill="${tinta}"/><circle cx="${cx + l * sep + 4}" cy="${oy - 9}" r="${ojo * 0.5}" fill="#FFFFFF"/><circle cx="${cx + l * sep - 4}" cy="${oy + 6}" r="${ojo * 0.2}" fill="#FFFFFF"/>`);
      s.push(linea(`M${cx + l * sep - 20} ${oy - 52} Q${cx + l * sep} ${oy - 70} ${cx + l * sep + 20} ${oy - 54}`, 8));
    }
    s.push(`<path d="M${cx - 28} ${oy + 44} Q${cx} ${oy + 80} ${cx + 28} ${oy + 44} Q${cx} ${oy + 54} ${cx - 28} ${oy + 44} Z" fill="#6E2330"/>`);
  } else if (e === "aburrido") {
    // Párpados a media asta (mirada caída), cejas planas y boca torcida de lado.
    for (const l of [-1, 1]) {
      if (ojos === "cerrados") s.push(linea(`M${cx + l * sep - ojo} ${oy + 4} L${cx + l * sep + ojo} ${oy + 4}`, 7));
      else {
        s.push(`<ellipse cx="${cx + l * sep}" cy="${oy + 6}" rx="${ojo * 0.85}" ry="${ojo * 0.7}" fill="${tinta}"/>`);
        s.push(linea(`M${cx + l * sep - ojo * 1.25} ${oy + 1} L${cx + l * sep + ojo * 1.25} ${oy + 1}`, 8));
      }
      s.push(linea(`M${cx + l * sep - 18} ${oy - 26} L${cx + l * sep + 18} ${oy - 28}`, 7));
    }
    s.push(linea(`M${cx - 24} ${oy + 56} Q${cx + 2} ${oy + 52} ${cx + 26} ${oy + 46}`, 8));
  } else if (e === "sorprendido") {
    if (ojos === "cerrados") cerrados();
    else for (const l of [-1, 1]) s.push(`<circle cx="${cx + l * sep}" cy="${oy}" r="${ojo * 1.55}" fill="#FFFFFF" stroke="${tinta}" stroke-width="4"/><circle cx="${cx + l * sep}" cy="${oy + 2}" r="${ojo * 0.7}" fill="${tinta}"/>`);
    for (const l of [-1, 1]) s.push(linea(`M${cx + l * sep - 20} ${oy - 52} Q${cx + l * sep} ${oy - 70} ${cx + l * sep + 20} ${oy - 52}`, 7));
    s.push(`<ellipse cx="${cx}" cy="${oy + 58}" rx="${rx * 0.16}" ry="${rx * 0.22}" fill="#6E2330"/>`);
  } else {
    if (ojos === "cerrados") cerrados();
    else for (const l of [-1, 1]) s.push(`<ellipse cx="${cx + l * sep}" cy="${oy}" rx="${ojo * 0.85}" ry="${ojo}" fill="${tinta}"/><circle cx="${cx + l * sep + 3}" cy="${oy - 4}" r="${ojo * 0.32}" fill="#FFFFFF"/>`);
    for (const l of [-1, 1]) s.push(linea(`M${cx + l * sep - 17} ${oy - 34} Q${cx + l * sep} ${oy - 41} ${cx + l * sep + 17} ${oy - 34}`, 7));
    s.push(linea(`M${cx - 26} ${oy + 44} Q${cx} ${oy + 64} ${cx + 26} ${oy + 44}`, 8));
  }
  if (a.accesorio === "bigote") {
    // Bigote del color del pelo, sobre la boca (no la tapa: la boca va más abajo).
    const pelo = oscurecer(PELOS[a.pelo], 0.1);
    s.push(`<path d="M${cx - 44} ${oy + 40} Q${cx - 22} ${oy + 18} ${cx} ${oy + 30} Q${cx + 22} ${oy + 18} ${cx + 44} ${oy + 40} Q${cx + 22} ${oy + 34} ${cx} ${oy + 38} Q${cx - 22} ${oy + 34} ${cx - 44} ${oy + 40} Z" fill="${pelo}"/>`);
  }
  if (esMayor(a.tipo)) {
    // Arrugas suaves junto a los ojos.
    for (const l of [-1, 1]) s.push(`<path d="M${cx + l * (sep + ojo + 12)} ${oy - 4} l${l * 12} -6 M${cx + l * (sep + ojo + 12)} ${oy + 6} l${l * 12} 4" stroke="${oscurecer(PIELES[a.piel], 0.3)}" stroke-width="4" stroke-linecap="round"/>`);
  }
  if (a.accesorio === "gafas") {
    for (const l of [-1, 1]) s.push(`<circle cx="${cx + l * sep}" cy="${oy + 2}" r="${ojo + 18}" fill="rgba(255,255,255,0.12)" stroke="#2F2A3A" stroke-width="6"/>`);
    s.push(`<path d="M${cx - sep + ojo + 18} ${oy} Q${cx} ${oy - 10} ${cx + sep - ojo - 18} ${oy}" fill="none" stroke="#2F2A3A" stroke-width="6"/>`);
  }
  return s.join("");
}

// ---------- Brazos ----------
// Brazo (hombro a codo): la manga es del color de la ropa. Ancla = hombro.
export function svgBrazo(a: AspectoPersonaje): ParteSvg {
  const p = proporciones(a.tipo);
  const { largo, ancho } = p.brazo;
  const W = ancho + 8;
  const H = largo + ancho;
  const ropa = a.tipo === "nina" ? COLORES_ROPA[a.ropa] : COLORES_ROPA[a.ropa];
  const piel = PIELES[a.piel];
  // Adultos: manga larga (vendedor y papá, manga corta); niños: manga corta.
  const manga = esAdulto(a.tipo) && a.tipo !== "vendedor" && a.tipo !== "vendedora" && a.tipo !== "papa" ? largo + ancho / 2 : largo * 0.5;
  const c = `<rect x="4" y="0" width="${ancho}" height="${H}" rx="${ancho / 2}" fill="${piel}"/><rect x="4" y="0" width="${ancho}" height="${manga}" rx="${ancho / 2}" fill="${ropa}"/><rect x="${4 + ancho * 0.62}" y="${ancho * 0.3}" width="${ancho * 0.38}" height="${manga - ancho * 0.3}" rx="${ancho * 0.19}" fill="${oscurecer(ropa, 0.14)}"/>`;
  return { svg: svg(W, H, c), ancho: W, alto: H, ancla: { x: W / 2, y: ancho / 2 } };
}

// Antebrazo con la mano (abierta o señalando). Ancla = codo.
export function svgAntebrazo(a: AspectoPersonaje, mano: FormaMano): ParteSvg {
  const p = proporciones(a.tipo);
  const { largo, ancho, mano: rm } = p.antebrazo;
  const W = Math.max(ancho, rm * 2) + 30;
  const H = largo + rm * 3;
  const cx = W / 2;
  const piel = PIELES[a.piel];
  const sombra = oscurecer(piel, 0.12);
  const partes = [`<rect x="${cx - ancho / 2}" y="0" width="${ancho}" height="${largo}" rx="${ancho / 2}" fill="${piel}"/>`, `<rect x="${cx + ancho * 0.1}" y="${ancho * 0.3}" width="${ancho * 0.36}" height="${largo - ancho * 0.6}" rx="${ancho * 0.18}" fill="${sombra}"/>`];
  if (mano === "senala") {
    partes.push(`<circle cx="${cx}" cy="${largo + rm * 0.2}" r="${rm * 0.85}" fill="${piel}"/>`);
    partes.push(`<rect x="${cx - rm * 0.22}" y="${largo}" width="${rm * 0.44}" height="${rm * 1.9}" rx="${rm * 0.22}" fill="${piel}"/>`);
  } else {
    partes.push(`<ellipse cx="${cx}" cy="${largo + rm * 0.35}" rx="${rm}" ry="${rm * 1.12}" fill="${piel}"/>`);
    partes.push(`<ellipse cx="${cx - rm * 0.92}" cy="${largo + rm * 0.05}" rx="${rm * 0.34}" ry="${rm * 0.5}" fill="${sombra}"/>`);
  }
  return { svg: svg(W, H, partes.join("")), ancho: W, alto: H, ancla: { x: cx, y: ancho / 2 } };
}
