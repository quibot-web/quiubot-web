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
import { CARTELERA, DIBUJO, DULCES, PUPITRE, SALON, SILLA, casillaCartelera } from "./dibujoObjetos";
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
// sentado: detrás de un pupitre (la silla atrás, el pupitre adelante tapa las piernas).
export type PersonajeUbicado = { per: PersonajeKit; aspecto: AspectoPersonaje; p: Proporciones; cx: number; pies: number; escala: number; espejo: boolean; sentado?: { pupitre: Rect; silla: Rect } };
export type ObjetoUbicado = { obj: ObjetoKit; rect: Rect | null }; // null: en la mano de alguien
export type ComposicionUbicada = { c: ComposicionKit; pared: Pared; isla: { ancho: number; alto: number }; personajes: PersonajeUbicado[]; objetos: ObjetoUbicado[] };

function tamObjeto(o: ObjetoKit): { ancho: number; alto: number } {
  if (o.tipo === "cartelera") return { ancho: CARTELERA.ancho, alto: CARTELERA.alto };
  if (o.tipo === "pupitre") return { ancho: PUPITRE.ancho * ESCALA[o.plano], alto: PUPITRE.alto * ESCALA[o.plano] };
  if (o.tipo === "dibujo") return { ancho: DIBUJO.ancho * 1.4, alto: DIBUJO.alto * 1.4 };
  return { ancho: DULCES.ancho * 1.2, alto: DULCES.alto * 1.2 };
}

export function ubicarComposicion(c: ComposicionKit, semilla: string): ComposicionUbicada {
  const objetos = ubicarObjetos(c);
  const personajes = c.personajes.map((per, i): PersonajeUbicado => {
    const p = proporciones(per.tipo);
    const pupitre = per.sentado_en ? objetos.find((o) => o.obj.id === per.sentado_en && o.obj.tipo === "pupitre")?.rect : null;
    if (pupitre) {
      // Sentado: la cintura queda un poco debajo de la tapa del pupitre.
      const plano = c.objetos.find((o) => o.id === per.sentado_en)!.plano;
      const escala = ESCALA[plano] * ESCALA_TIPO[per.tipo];
      const pies = pupitre.y + 36 * ESCALA[plano] + (p.pies - p.torso.y1) * escala;
      const cx = pupitre.x + pupitre.ancho / 2;
      const ws = SILLA.ancho * ESCALA[plano];
      const hs = SILLA.alto * ESCALA[plano];
      const silla = { x: cx - ws / 2, y: pupitre.y + pupitre.alto - hs - 20 * ESCALA[plano], ancho: ws, alto: hs };
      return { per, aspecto: aspectoDe(per, semilla, i), p, cx, pies, escala, espejo: per.mira === "izquierda", sentado: { pupitre, silla } };
    }
    const escala = ESCALA[per.plano] * ESCALA_TIPO[per.tipo];
    return { per, aspecto: aspectoDe(per, semilla, i), p, cx: POS_X[per.posicion], pies: PIES[per.plano], escala, espejo: per.mira === "izquierda" };
  });
  const pared = c.pared ?? elegir(["crema", "menta", "celeste", "durazno"] as const, hashTexto(`${semilla}:${c.id}`));
  return { c, pared, isla: ISLA_KIT[c.fondo], personajes, objetos };
}

function ubicarObjetos(c: ComposicionKit): ObjetoUbicado[] {
  return c.objetos.map((obj) => {
    if (obj.en_mano_de || !obj.lugar) return { obj, rect: null };
    const t = tamObjeto(obj);
    if (obj.lugar.startsWith("pared_")) {
      const x = PARED_X[obj.lugar as keyof typeof PARED_X];
      return { obj, rect: { x: x - t.ancho / 2, y: PARED_Y - t.alto / 2, ancho: t.ancho, alto: t.alto } };
    }
    const x = POS_X[obj.lugar.replace("piso_", "") as keyof typeof POS_X];
    return { obj, rect: { x: x - t.ancho / 2, y: PIES[obj.plano] - t.alto, ancho: t.ancho, alto: t.alto } };
  });
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
  const piso = u.sentado ? u.sentado.pupitre.y + u.sentado.pupitre.alto : u.pies + 10;
  return { x: x0, y: tope, ancho: x1 - x0, alto: piso - tope };
}

// Cabeza (con pelo) y torso: lo que nunca puede quedar cortado en el borde
// del cuadro (regla de cámara del kit: entero o fuera).
export function rectCabezaTorso(u: PersonajeUbicado): Rect {
  // El torso con la parte de arriba de los brazos (un hombro cortado en el
  // borde también se ve como un recorte).
  const medio = Math.max(u.p.cabeza.rx * 1.35, u.p.torso.hombros / 2 + u.p.brazo.ancho * 0.5);
  const a = aIsla(u, u.p.cx - medio, u.p.cabeza.cy - u.p.cabeza.ry * 1.3);
  const b = aIsla(u, u.p.cx + medio, u.p.torso.y1);
  return { x: Math.min(a.x, b.x), y: a.y, ancho: Math.abs(b.x - a.x), alto: b.y - a.y };
}

// Acción de grupo: "todos.<verbo>" dispara el verbo en todos los personajes
// de la composición en la misma palabra ("todos aplauden").
export const ID_TODOS = "todos";
export const VERBOS_TODOS = {
  aplaude: "todos aplauden",
  celebra: "todos celebran con los brazos arriba",
  feliz: "todos sonríen felices",
  triste: "todos se ponen tristes",
  sorprendido: "todos se sorprenden",
  levanta_la_mano: "todos levantan la mano",
  se_distrae: "todos se aburren y se distraen",
} as const satisfies Partial<Record<keyof typeof VERBOS_PERSONAJE, string>>;

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
  if (cu.personajes.length >= 2) {
    for (const [verbo, descripcion] of Object.entries(VERBOS_TODOS)) {
      const def = VERBOS_PERSONAJE[verbo as keyof typeof VERBOS_TODOS];
      const pose = "pose" in def ? def.pose : undefined;
      res[`${ID_TODOS}.${verbo}`] = { descripcion, foco: cu.personajes.map((u) => rectPersonaje(u, pose)).reduce(union) };
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

// Foco más chico para cuando el de la acción no cabe con zoom >= mínimo sin
// cortar a nadie (revisión de la v6: "le trae dulces" se abría muchísimo):
// - con objetivo: solo quien hace la acción (al otro lo muestra después
//   un plano de reacción, ver coberturas en camara.ts);
// - el dibujo que vuela al hueco o el hueco que late: la zona del hueco;
// - la cartelera: su parte central (primer plano de los dibujos).
// Devuelve las alternativas en orden de preferencia.
export function focoReducidoKit(cu: ComposicionUbicada, accion: string, objetivo?: string): Rect[] {
  const [id, verbo] = accion.split(".");
  const cart = cu.objetos.find((o) => o.obj.tipo === "cartelera" && o.rect)?.rect ?? null;
  const hueco = casillaHuecoEnIsla(cu);
  const centro = cart ? zonaAlrededor({ x: cart.x + cart.ancho * 0.2, y: cart.y + cart.alto * 0.1, ancho: cart.ancho * 0.6, alto: cart.alto * 0.8 }, cart, 1, 1) : null;
  if ((verbo === "va_al_hueco" || verbo === "destaca_hueco") && hueco && cart) return [zonaAlrededor(hueco, cart, 2.4, 1.9), centro!];
  if (centro && cu.objetos.some((o) => o.obj.id === id && o.obj.tipo === "cartelera")) return [centro];
  if (objetivo) {
    const propio = accionesDeComposicion(cu)[accion]?.foco;
    return propio ? [propio] : [];
  }
  return [];
}
function zonaAlrededor(r: Rect, limite: Rect, fx: number, fy: number): Rect {
  const ancho = Math.min(limite.ancho, r.ancho * fx);
  const alto = Math.min(limite.alto, r.alto * fy);
  const x = Math.max(limite.x, Math.min(limite.x + limite.ancho - ancho, r.x + r.ancho / 2 - ancho / 2));
  const y = Math.max(limite.y, Math.min(limite.y + limite.alto - alto, r.y + r.alto / 2 - alto / 2));
  return { x, y, ancho, alto };
}

// ---------- Validación y descripción ----------
// Cuánto de la cartelera puede quedar detrás de la cabeza y el torso de
// alguien (un poco es natural en un salón; la mitad del centro, no).
export const TAPA_MAXIMO_CARTELERA = 0.12;

export function problemasComposicion(c: ComposicionKit): string[] {
  const p: string[] = [];
  const ids = [...c.personajes.map((x) => x.id), ...c.objetos.map((x) => x.id)];
  for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) p.push(`${c.id}: el id "${id}" se repite`);
  if (ids.includes(ID_TODOS)) p.push(`${c.id}: "${ID_TODOS}" está reservado para las acciones de grupo ("todos.aplaude"); usa otro id`);
  for (const o of c.objetos) {
    if (o.en_mano_de && !c.personajes.some((x) => x.id === o.en_mano_de)) p.push(`${c.id}: "${o.id}" está en la mano de "${o.en_mano_de}", que no existe en la composición`);
    if (o.tipo === "cartelera" && o.en_mano_de) p.push(`${c.id}: una cartelera no va en la mano`);
  }
  if (c.objetos.filter((o) => o.tipo === "cartelera").length > 1) p.push(`${c.id}: solo una cartelera por composición`);
  for (const o of c.objetos) if (o.tipo === "pupitre" && (o.en_mano_de || !o.lugar?.startsWith("piso_"))) p.push(`${c.id}: el pupitre "${o.id}" va en el piso`);
  // Un dibujo en el piso no se entiende (primera corrida real de la IA, 24 nov 2026).
  for (const o of c.objetos) if (o.tipo === "dibujo" && o.lugar?.startsWith("piso_")) p.push(`${c.id}: el dibujo "${o.id}" va en la pared o en la mano de alguien, no en el piso`);
  // Cada personaje sostiene una sola cosa.
  const manos = c.objetos.flatMap((o) => (o.en_mano_de ? [o.en_mano_de] : []));
  for (const id of new Set(manos)) if (manos.filter((x) => x === id).length > 1) p.push(`${c.id}: "${id}" sostiene más de una cosa; cada personaje sostiene una sola`);
  for (const x of c.personajes) {
    if (x.sentado_en && !c.objetos.some((o) => o.id === x.sentado_en && o.tipo === "pupitre")) p.push(`${c.id}: "${x.id}" está sentado en "${x.sentado_en}", que no es un pupitre de la composición`);
    if (x.mira_a && !ids.includes(x.mira_a)) p.push(`${c.id}: "${x.id}" mira a "${x.mira_a}", que no existe en la composición`);
  }
  const sentados = c.personajes.flatMap((x) => (x.sentado_en ? [x.sentado_en] : []));
  for (const id of new Set(sentados)) if (sentados.filter((x) => x === id).length > 1) p.push(`${c.id}: dos personajes sentados en el mismo pupitre "${id}"`);
  const posiciones = c.personajes.filter((x) => x.plano === "frente" && !x.sentado_en).map((x) => x.posicion);
  for (const pos of new Set(posiciones)) if (posiciones.filter((x) => x === pos).length > 1) p.push(`${c.id}: dos personajes en el frente en la misma posición "${pos}"`);
  // Nunca en fila (revisión de la v6): con 3 o más personajes, al menos dos
  // profundidades distintas (de pie adelante, de pie atrás, sentado).
  const profundidades = new Set(c.personajes.map((x) => (x.sentado_en ? `sentado-${c.objetos.find((o) => o.id === x.sentado_en)?.plano}` : x.plano)));
  if (c.personajes.length >= 3 && profundidades.size < 2) p.push(`${c.id}: todos los personajes están en la misma línea (en fila); pon a alguno "plano": "fondo" o sentado en un pupitre, para que haya profundidad`);
  // Nadie tapa lo que está en la pared (primera corrida real de la IA, 24 nov
  // 2026: la profesora de pie delante de la cartelera tapaba los dibujos y
  // el espacio libre). Se mide con las piezas ya ubicadas.
  if (p.length === 0) {
    const cu = ubicarComposicion(c, "");
    for (const o of cu.objetos) {
      if (!o.rect || !o.obj.lugar?.startsWith("pared_")) continue;
      const w = o.rect;
      for (const u of cu.personajes) {
        const r = rectCabezaTorso(u);
        const ix = Math.max(0, Math.min(r.x + r.ancho, w.x + w.ancho) - Math.max(r.x, w.x));
        const iy = Math.max(0, Math.min(r.y + r.alto, w.y + w.alto) - Math.max(r.y, w.y));
        const limite = o.obj.tipo === "cartelera" ? TAPA_MAXIMO_CARTELERA : 0.25;
        if ((ix * iy) / (w.ancho * w.alto) > limite) p.push(`${c.id}: "${u.per.id}" tapa ${o.obj.tipo === "cartelera" ? "la cartelera" : `"${o.obj.id}"`} (${o.obj.lugar}); ponlo en otra posición, a un lado de lo que está en la pared`);
      }
    }
  }
  return p;
}

export function descripcionVisible(cu: ComposicionUbicada): string {
  const quienes = cu.personajes.map((u) => NOMBRE_PERSONAJE[u.per.tipo]);
  const cosas = cu.objetos.map((o) => NOMBRE_OBJETO[o.obj.tipo]);
  return `${NOMBRE_FONDO[cu.c.fondo]} ilustrado con ${[...quienes, ...cosas].join(", ")}`;
}
