// Una composición del kit ubicada en su isla (puro, probado): dónde queda
// cada personaje y objeto, qué recuadro declara cada uno para la cámara
// (lo nombrado ocupa >= 50 % de la pantalla), qué acciones tiene y qué se
// ve (para el control de calidad por visión).
import type { Rect } from "../motor/geometria";
import {
  ACCESORIOS,
  COLORES_ROPA,
  NOMBRE_FONDO,
  NOMBRE_OBJETO,
  NOMBRE_PERSONAJE,
  PELOS,
  PIELES,
  VERBOS_OBJETO,
  VERBOS_PERSONAJE,
  type ColorRopa,
  type ComposicionKit,
  type ObjetoKit,
  type Pared,
  type PersonajeKit,
  type Peinado,
  type Pose,
  type TipoPersonaje,
} from "./catalogoKit";
import { CARTELERA, DIBUJO, DULCES, SALON, casillaCartelera } from "./dibujoObjetos";
import type { AspectoPersonaje } from "./dibujoPersonaje";
import { estadoPose, posicionMano, proporciones, topeDePose, type Proporciones } from "./poses";

export const ISLA_KIT = { salon: { ancho: SALON.ancho, alto: SALON.alto } } as const;

const POS_X = { izquierda: 360, centro_izquierda: 740, centro: 1100, centro_derecha: 1460, derecha: 1840 } as const;
const PIES = { frente: 1445, fondo: 1205 } as const;
const ESCALA = { frente: 1, fondo: 0.8 } as const;
// Los niños, un poco más grandes en el mundo: con el zoom máximo de la
// cámara un niño solo ocupaba el 47 % de la pantalla (el mínimo es 50 %).
// Siguen siendo más chicos que la profesora.
const ESCALA_TIPO: Record<TipoPersonaje, number> = { profesora: 1, nino: 1.12, nina: 1.12 };
const PARED_X = { pared_izquierda: 620, pared_centro: 1100, pared_derecha: 1580 } as const;
const PARED_Y = 470;

// ---------- Variedad: lo que la IA no fija sale de la semilla del reel ----------
export function hashTexto(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const elegir = <T>(xs: readonly T[], h: number, salto = 0): T => xs[(h + salto) % xs.length];
const PEINADOS_POR_TIPO: Record<TipoPersonaje, Peinado[]> = { profesora: ["mono", "largo", "corto", "rizado"], nino: ["corto", "rizado"], nina: ["colitas", "largo", "rizado", "mono"] };
const ROPAS = Object.keys(COLORES_ROPA).filter((c) => c !== "blanco") as ColorRopa[];

export function aspectoDe(per: PersonajeKit, semilla: string, indice: number): AspectoPersonaje {
  const h = hashTexto(`${semilla}:${per.id}`);
  // Ropa distinta para cada personaje de la escena (índice como salto).
  const ropa = per.ropa ?? elegir(ROPAS, h, indice * 3);
  const ropa2 = per.ropa2 ?? elegir(ROPAS.filter((c) => c !== ropa), h >>> 5, indice);
  return {
    tipo: per.tipo,
    piel: per.piel ?? elegir(Object.keys(PIELES) as AspectoPersonaje["piel"][], h >>> 9),
    pelo: per.pelo ?? elegir((Object.keys(PELOS) as AspectoPersonaje["pelo"][]).filter((c) => per.tipo === "profesora" || c !== "canoso"), h >>> 13),
    peinado: per.peinado ?? elegir(PEINADOS_POR_TIPO[per.tipo], h >>> 17),
    ropa,
    ropa2,
    accesorio: per.accesorio ?? (per.tipo === "profesora" ? elegir(ACCESORIOS, h >>> 21) : "ninguno"),
  };
}

// ---------- Ubicación ----------
export type PersonajeUbicado = { per: PersonajeKit; aspecto: AspectoPersonaje; p: Proporciones; cx: number; pies: number; escala: number; espejo: boolean };
export type ObjetoUbicado = { obj: ObjetoKit; rect: Rect | null }; // null: en la mano de alguien
export type ComposicionUbicada = { c: ComposicionKit; pared: Pared; isla: { ancho: number; alto: number }; personajes: PersonajeUbicado[]; objetos: ObjetoUbicado[] };

function tamObjeto(o: ObjetoKit): { ancho: number; alto: number } {
  if (o.tipo === "cartelera") return { ancho: CARTELERA.ancho, alto: CARTELERA.alto };
  if (o.tipo === "dibujo") return { ancho: DIBUJO.ancho * 1.4, alto: DIBUJO.alto * 1.4 };
  return { ancho: DULCES.ancho * 1.2, alto: DULCES.alto * 1.2 };
}

export function ubicarComposicion(c: ComposicionKit, semilla: string): ComposicionUbicada {
  const personajes = c.personajes.map((per, i) => {
    const escala = ESCALA[per.plano] * ESCALA_TIPO[per.tipo];
    return { per, aspecto: aspectoDe(per, semilla, i), p: proporciones(per.tipo), cx: POS_X[per.posicion], pies: PIES[per.plano], escala, espejo: per.mira === "izquierda" };
  });
  const objetos = c.objetos.map((obj) => {
    if (obj.en_mano_de || !obj.lugar) return { obj, rect: null };
    const t = tamObjeto(obj);
    if (obj.lugar.startsWith("pared_")) {
      const x = PARED_X[obj.lugar as keyof typeof PARED_X];
      return { obj, rect: { x: x - t.ancho / 2, y: PARED_Y - t.alto / 2, ancho: t.ancho, alto: t.alto } };
    }
    const x = POS_X[obj.lugar.replace("piso_", "") as keyof typeof POS_X];
    return { obj, rect: { x: x - t.ancho / 2, y: PIES.frente - t.alto, ancho: t.ancho, alto: t.alto } };
  });
  const pared = c.pared ?? elegir(["crema", "menta", "celeste", "durazno"] as const, hashTexto(`${semilla}:${c.id}`));
  return { c, pared, isla: ISLA_KIT[c.fondo], personajes, objetos };
}

// Punto local del personaje (lienzo) -> coordenadas de la isla.
export function aIsla(u: PersonajeUbicado, x: number, y: number): { x: number; y: number } {
  return { x: u.cx + (x - u.p.cx) * u.escala * (u.espejo ? -1 : 1), y: u.pies + (y - u.p.pies) * u.escala };
}

// Recuadro del personaje en una pose (cuerpo + manos, a lo alto que llegue).
export function rectPersonaje(u: PersonajeUbicado, pose: Pose = u.per.pose): Rect {
  const e = estadoPose(pose, 6, 30, u.p);
  const manos = [posicionMano(u.p, e.mira, "mira"), posicionMano(u.p, e.otro, "otro")].map((m) => aIsla(u, m.x, m.y));
  const tope = aIsla(u, u.p.cx, topeDePose(u.p, e)).y;
  const medio = (u.p.cuerpoAncho / 2) * u.escala;
  const x0 = Math.min(u.cx - medio, ...manos.map((m) => m.x - 40));
  const x1 = Math.max(u.cx + medio, ...manos.map((m) => m.x + 40));
  return { x: x0, y: tope, ancho: x1 - x0, alto: u.pies + 10 - tope };
}

export function rectElemento(cu: ComposicionUbicada, id: string, pose?: Pose): Rect | null {
  const per = cu.personajes.find((x) => x.per.id === id);
  if (per) return rectPersonaje(per, pose);
  const obj = cu.objetos.find((x) => x.obj.id === id);
  if (!obj) return null;
  if (obj.rect) return obj.rect;
  const duenio = cu.personajes.find((x) => x.per.id === obj.obj.en_mano_de);
  return duenio ? rectPersonaje(duenio, pose) : null;
}

export function casillaHuecoEnIsla(cu: ComposicionUbicada): Rect | null {
  const cart = cu.objetos.find((o) => o.obj.tipo === "cartelera" && o.rect);
  if (!cart?.rect) return null;
  const h = casillaCartelera(CARTELERA.hueco);
  return { x: cart.rect.x + h.x, y: cart.rect.y + h.y, ancho: h.ancho, alto: h.alto };
}

export function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, ancho: Math.max(a.x + a.ancho, b.x + b.ancho) - x, alto: Math.max(a.y + a.alto, b.y + b.alto) - y };
}

// ---------- Acciones ("elemento.verbo") ----------
export type DefAccionKit = { descripcion: string; foco: Rect };

function nombreElemento(cu: ComposicionUbicada, id: string): string {
  const per = cu.personajes.find((x) => x.per.id === id);
  if (per) return NOMBRE_PERSONAJE[per.per.tipo].replace(/^una? /, "la ").replace(/^la niño/, "el niño");
  const obj = cu.objetos.find((x) => x.obj.id === id);
  return obj ? `el objeto ${obj.obj.tipo}` : id;
}

export function accionesDeComposicion(cu: ComposicionUbicada): Record<string, DefAccionKit> {
  const res: Record<string, DefAccionKit> = {};
  for (const u of cu.personajes) {
    for (const [verbo, def] of Object.entries(VERBOS_PERSONAJE)) {
      const pose = "pose" in def ? def.pose : undefined;
      res[`${u.per.id}.${verbo}`] = { descripcion: `${nombreElemento(cu, u.per.id)} ${def.descripcion}`, foco: rectPersonaje(u, pose) };
    }
  }
  const hueco = casillaHuecoEnIsla(cu);
  for (const o of cu.objetos) {
    for (const [verbo, descripcion] of Object.entries(VERBOS_OBJETO[o.obj.tipo])) {
      if (verbo === "va_al_hueco" && !hueco) continue;
      const r = rectElemento(cu, o.obj.id);
      if (!r) continue;
      res[`${o.obj.id}.${verbo}`] = { descripcion, foco: verbo === "va_al_hueco" && hueco ? union(r, hueco) : r };
    }
  }
  return res;
}

// Foco de una acción, con su objetivo (ej. "la profesora señala el dibujo").
export function focoDeAccionKit(cu: ComposicionUbicada, accion: string, objetivo?: string): Rect | null {
  const def = accionesDeComposicion(cu)[accion];
  if (!def) return null;
  const otro = objetivo ? rectElemento(cu, objetivo) : null;
  return otro ? union(def.foco, otro) : def.foco;
}

// ---------- Validación y descripción ----------
export function problemasComposicion(c: ComposicionKit): string[] {
  const p: string[] = [];
  const ids = [...c.personajes.map((x) => x.id), ...c.objetos.map((x) => x.id)];
  for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) p.push(`${c.id}: el id "${id}" se repite`);
  for (const o of c.objetos) {
    if (o.en_mano_de && !c.personajes.some((x) => x.id === o.en_mano_de)) p.push(`${c.id}: "${o.id}" está en la mano de "${o.en_mano_de}", que no existe en la composición`);
    if (o.tipo === "cartelera" && o.en_mano_de) p.push(`${c.id}: una cartelera no va en la mano`);
  }
  if (c.objetos.filter((o) => o.tipo === "cartelera").length > 1) p.push(`${c.id}: solo una cartelera por composición`);
  const posiciones = c.personajes.filter((x) => x.plano === "frente").map((x) => x.posicion);
  for (const pos of new Set(posiciones)) if (posiciones.filter((x) => x === pos).length > 1) p.push(`${c.id}: dos personajes en el frente en la misma posición "${pos}"`);
  return p;
}

export function descripcionVisible(cu: ComposicionUbicada): string {
  const quienes = cu.personajes.map((u) => NOMBRE_PERSONAJE[u.per.tipo]);
  const cosas = cu.objetos.map((o) => NOMBRE_OBJETO[o.obj.tipo]);
  return `${NOMBRE_FONDO[cu.c.fondo]} ilustrado con ${[...quienes, ...cosas].join(", ")}`;
}
