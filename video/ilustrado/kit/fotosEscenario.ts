// "Fotos" ilustradas para las pantallas del celular cuando la marca no
// tiene una foto apta y el rubro se conoce por la narración (revisión del
// episodio 1, 24 nov 2026: sin foto se veía la tarjeta con la inicial).
// Puro: SVG armado con las mismas piezas del kit; ReelIlustrado las pasa a
// PNG una vez al precargar (como el resto del kit).
//   - prendas: ropa colgada en un perchero (la publicación propia de la marca).
//   - modelo: una persona del kit luciendo la ropa (la foto del anuncio).
import { COLORES_ROPA } from "./catalogoKit";
import { prenda } from "./dibujoLugares";
import { svgAntebrazo, svgBrazo, svgCabeza, svgCuerpo, svgPeloAtras, svgRasgos, type AspectoPersonaje, type ParteSvg } from "./dibujoPersonaje";
import { proporciones } from "./poses";
import type { Pieza } from "./piezas";

const svg = (ancho: number, alto: number, cuerpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">${cuerpo}</svg>`;
// Una parte (su propio <svg>) puesta en (x, y) de otra. conAncla: como los
// brazos en EscenaKit (se resta el ancla); el cuerpo, la cabeza, el pelo y
// los rasgos van en el origen del lienzo del personaje (el ancla es solo
// el centro del giro).
const poner = (p: ParteSvg, x: number, y: number, conAncla = false) => `<g transform="translate(${x} ${y})">${p.svg.replace("<svg ", `<svg x="${conAncla ? -p.ancla.x : 0}" y="${conAncla ? -p.ancla.y : 0}" `)}</g>`;

export type Rubro = "ropa";
export const ANCHO_FOTO = 900;
export const ALTO_FOTO = 800; // misma proporción que la foto de un anuncio en el feed

function fondoEstudio(c1: string, c2: string): string {
  return (
    `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
    `<rect width="${ANCHO_FOTO}" height="${ALTO_FOTO}" fill="url(#f)"/>` +
    `<circle cx="160" cy="160" r="110" fill="#FFFFFF" opacity="0.25"/><circle cx="780" cy="680" r="150" fill="#FFFFFF" opacity="0.18"/>`
  );
}

// Ropa en un perchero, con una pila de ropa doblada al lado.
export function svgFotoPrendas(): ParteSvg {
  const s: string[] = [fondoEstudio("#FCE9EF", "#F3D2DD")];
  s.push(`<rect x="110" y="140" width="16" height="560" fill="#8A8F98"/><rect x="760" y="140" width="16" height="560" fill="#8A8F98"/><rect x="96" y="136" width="694" height="18" rx="9" fill="#8A8F98"/>`);
  s.push(`<rect x="80" y="694" width="730" height="20" rx="8" fill="#5E5A66"/>`);
  const colores = [COLORES_ROPA.rosado, COLORES_ROPA.azul, COLORES_ROPA.amarillo, COLORES_ROPA.verde, COLORES_ROPA.morado, COLORES_ROPA.naranja];
  // Las prendas grandes: llenan la foto.
  for (let i = 0; i < 5; i++) s.push(`<g transform="translate(${190 + i * 128} 154) scale(1.8) translate(${-(190 + i * 128)} -154)">${prenda(190 + i * 128, 154, i, colores[i])}</g>`);
  return { svg: svg(ANCHO_FOTO, ALTO_FOTO, s.join("")), ancho: ANCHO_FOTO, alto: ALTO_FOTO, ancla: { x: 0, y: 0 } };
}

// Una persona del kit luciendo la ropa (de cuerpo entero, sonriendo, una
// mano en la cintura), como la foto de un anuncio de ropa.
export const MODELO: AspectoPersonaje = { tipo: "mama", piel: "triguena", pelo: "castano", peinado: "largo", ropa: "rosado", ropa2: "azul", accesorio: "ninguno" };
export function svgFotoModelo(a: AspectoPersonaje = MODELO): ParteSvg {
  const p = proporciones(a.tipo);
  const s: string[] = [fondoEstudio("#E8F1FB", "#CFE0F3")];
  // El personaje entra entero en la foto (lienzo del personaje: p.ancho x p.alto).
  const k = (ALTO_FOTO - 70) / p.alto;
  const x0 = ANCHO_FOTO / 2 - p.cx * k;
  const partes: string[] = [];
  const pelo = svgPeloAtras(a);
  if (pelo) partes.push(poner(pelo, 0, 0));
  partes.push(poner(svgCuerpo(a), 0, 0));
  // Brazos: el de la izquierda en la cintura, el otro suelto (ángulos "hacia afuera").
  const brazo = (lado: 1 | -1, hombro: number, codo: number) => {
    const br = svgBrazo(a);
    const ab = svgAntebrazo(a, "abierta");
    return `<g transform="translate(${p.cx - lado * p.hombroDx} ${p.hombroY}) rotate(${lado * hombro})">${poner(br, 0, 0, true)}<g transform="translate(0 ${p.brazo.largo}) rotate(${lado * codo})">${poner(ab, 0, 0, true)}</g></g>`;
  };
  partes.push(brazo(1, 10, -4));
  partes.push(brazo(-1, 32, -78));
  partes.push(poner(svgCabeza(a), 0, 0));
  partes.push(poner(svgRasgos(a, "feliz", "abiertos"), 0, 0));
  s.push(`<ellipse cx="${ANCHO_FOTO / 2}" cy="${ALTO_FOTO - 34}" rx="230" ry="20" fill="rgba(20,16,40,0.16)"/>`);
  s.push(`<g transform="translate(${x0} 20) scale(${k})">${partes.join("")}</g>`);
  return { svg: svg(ANCHO_FOTO, ALTO_FOTO, s.join("")), ancho: ANCHO_FOTO, alto: ALTO_FOTO, ancla: { x: 0, y: 0 } };
}

export const CLAVE_FOTO = { prendas: "foto:prendas", modelo: "foto:modelo" } as const;
export function piezasDeEscenario(rubro: Rubro | undefined): Pieza[] {
  if (rubro !== "ropa") return [];
  return [
    { clave: CLAVE_FOTO.prendas, parte: svgFotoPrendas() },
    { clave: CLAVE_FOTO.modelo, parte: svgFotoModelo() },
  ];
}
