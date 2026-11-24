// Encuadre automático en los lugares del kit (puro). Reglas (revisión de
// la v4, 24 nov 2026), pensadas para que valgan cuando la IA componga sola:
// 1. El encuadre se calcula sobre lo nombrado (personajes y objetos de la
//    acción), centrado en la franja útil entre el subtítulo y la interfaz
//    de Instagram, con zoom >= ZOOM_MINIMO_KIT (sin planos lejanos con
//    medio cuadro de piso vacío).
// 2. Nunca se corta una cara: la cabeza y el torso de cada personaje quedan
//    enteros dentro del cuadro o del todo fuera. Se verifica con el
//    acercamiento lento de la toma y la deriva de la cámara incluidos.
// 3. En un primer plano, el resto de los personajes queda entero al fondo
//    o fuera, nunca recortado alrededor (consecuencia de 2: entre los
//    encuadres válidos se elige el más cercano al ideal).
// 4. Acción de grupo ("todos.aplaude"): el encuadre que deja entera a la
//    mayor cantidad de personajes.
import { unionRects } from "./catalogo";
import { ALTO_PANTALLA, ANCHO_PANTALLA, FONDO_SUBTITULO, FRANJA_SEGURA, seTocan, vistaDelMundo, type Encuadre, type Rect } from "./geometria";

export const ZOOM_MAXIMO_KIT = 1.6;
export const ZOOM_MINIMO_KIT = 0.75;
// Solo si con 0,8 no hay ningún encuadre sin caras cortadas (por ejemplo,
// alguien sentado justo detrás del borde): se abre un poco más.
export const ZOOM_MINIMO_KIT_EXCEPCIONAL = 0.65;
// Variación de zoom de la cámara durante una toma del kit: acercamiento
// lento (hasta +2 %, EMPUJE_MAXIMO_KIT) y respiración (+-1 %). Y la deriva
// (+-8 unidades).
export const ZOOM_TOMA_MAX = 1.035;
export const ZOOM_TOMA_MIN = 0.985;
const DERIVA = 10;

// rect: cabeza y torso (lo que nunca se corta); cabezaY: centro de la cara;
// completo: el personaje entero (hasta los pies, o el pupitre si está sentado).
export type Cuerpo = { id: string; rect: Rect; cabezaY?: number; completo?: Rect };

// Reglas de primer plano limpio (revisión de la v6):
// - el protagonista ocupa como máximo ALTO_MAXIMO_PROTAGONISTA de la altura
//   útil (y al menos OCUPACION_MINIMA_UTIL de la franja útil o del ancho);
// - nadie recortado con la cara en la mitad inferior (una cabeza grande
//   asomando abajo, cuadro 270 de la v6); de cuerpo entero sí puede estar abajo;
// - todo personaje visible a MARGEN_BORDE_PX o más de los bordes.
export const ALTO_MAXIMO_PROTAGONISTA = 0.7;
export const OCUPACION_MINIMA_UTIL = 0.5;
export const MARGEN_BORDE_PX = 40;
export const CARA_MAXIMA_Y = ALTO_PANTALLA / 2;

function dentro(r: Rect, v: Rect, m: number, my = m): boolean {
  return r.x >= v.x + m && r.y >= v.y + my && r.x + r.ancho <= v.x + v.ancho - m && r.y + r.alto <= v.y + v.alto - my;
}
const conZoom = (c: Encuadre, f: number): Encuadre => ({ ...c, zoom: c.zoom * f });

// Personajes con la cabeza o el torso cortados por el borde (para pruebas
// y control de calidad: con la cámara exacta de un cuadro).
export function carasCortadas(cam: Encuadre, cuerpos: Cuerpo[]): string[] {
  const v = vistaDelMundo(cam);
  return cuerpos.filter((c) => seTocan(c.rect, v) && !dentro(c.rect, v, 0)).map((c) => c.id);
}

// Seguro durante toda la toma: cada cuerpo entero (aun con el acercamiento
// máximo) o fuera (aun con la cámara más abierta).
export function encuadreSeguro(cam: Encuadre, cuerpos: Cuerpo[]): boolean {
  const zCerca = cam.zoom * ZOOM_TOMA_MAX;
  const cerca = vistaDelMundo(conZoom(cam, ZOOM_TOMA_MAX));
  const lejos = vistaDelMundo(conZoom(cam, ZOOM_TOMA_MIN));
  // Cara en la mitad de arriba, con el zoom de la toma en sus dos extremos.
  const caraArriba = (y: number) => [cam.zoom * ZOOM_TOMA_MIN, zCerca].every((z) => ALTO_PANTALLA / 2 + (y - cam.y) * z <= CARA_MAXIMA_Y + DERIVA * z);
  const bienUbicado = (c: Cuerpo) => c.cabezaY === undefined || caraArriba(c.cabezaY) || (c.completo !== undefined && dentro(c.completo, cerca, DERIVA, 0));
  return cuerpos.every((c) => (dentro(c.rect, cerca, DERIVA + MARGEN_BORDE_PX / zCerca, DERIVA + 16 / zCerca) && bienUbicado(c)) || !seTocan(c.rect, lejos, DERIVA));
}

// Cuánto ocupa lo nombrado de la parte útil de la pantalla (el ancho o la
// franja entre el subtítulo y la interfaz de Instagram).
export function ocupacionUtil(r: Rect, cam: Encuadre): number {
  return Math.max((r.ancho * cam.zoom) / ANCHO_PANTALLA, (r.alto * cam.zoom) / ALTO_UTIL);
}

// Lo nombrado se ve entero: de ancho, en pantalla aun con el acercamiento;
// de alto, dentro de la franja útil (la cabeza nunca bajo el subtítulo).
export function cabeEnFranja(r: Rect, cam: Encuadre): boolean {
  const z = cam.zoom * ZOOM_TOMA_MAX;
  const sx = (x: number) => ANCHO_PANTALLA / 2 + (x - cam.x) * z;
  const sy = (y: number, zz: number) => ALTO_PANTALLA / 2 + (y - cam.y) * zz;
  if (sx(r.x) < 8 || sx(r.x + r.ancho) > ANCHO_PANTALLA - 8) return false;
  if (sy(r.y, z) < FONDO_SUBTITULO) return false;
  return sy(r.y, cam.zoom) >= FRANJA_SEGURA.arriba - 30 && sy(r.y + r.alto, cam.zoom) <= FRANJA_SEGURA.abajo + 60;
}

export const ALTO_UTIL = FRANJA_SEGURA.abajo - FRANJA_SEGURA.arriba - 30;
const CENTRO_FRANJA = (FRANJA_SEGURA.arriba + FRANJA_SEGURA.abajo) / 2;
// Centro de cámara que pone el rectángulo en el centro de la franja.
const centrado = (r: Rect, zoom: number) => ({ x: r.x + r.ancho / 2, y: r.y + r.alto / 2 - (CENTRO_FRANJA - ALTO_PANTALLA / 2) / zoom });

export type ResultadoEncuadre = { encuadre: Encuadre; incluidos: Rect[] };

// soloNormal: sin abrir más allá de ZOOM_MINIMO_KIT (para decidir si dos
// acciones seguidas caben en una toma; si no, mejor dos tomas).
// Memoria: la validación del plan, la cámara y las pruebas repiten las
// mismas búsquedas (es puro: mismas entradas, mismo resultado).
const memoria = new Map<string, ResultadoEncuadre | null>();
export function encuadrarKit(o: OpcionesEncuadre & { soloNormal?: boolean }): ResultadoEncuadre | null {
  const clave = JSON.stringify(o);
  if (memoria.has(clave)) return memoria.get(clave)!;
  const r = encuadrarSinMemoria(o);
  if (memoria.size > 4000) memoria.clear();
  memoria.set(clave, r);
  return r;
}
function encuadrarSinMemoria(o: OpcionesEncuadre & { soloNormal?: boolean }): ResultadoEncuadre | null {
  if (!o.obligatorios.length || o.soloNormal) return buscar(o, ZOOM_MINIMO_KIT);
  // Antes que cortar una cara, abrir más (último recurso: 0,5).
  return buscar(o, ZOOM_MINIMO_KIT) ?? buscar(o, ZOOM_MINIMO_KIT_EXCEPCIONAL, false) ?? buscar(o, 0.5, false);
}

// ---------- Posiciones horizontales seguras (exacto, por intervalos) ----------
// Con el zoom z y la cámara a la altura y, las x del centro de cámara donde
// el cuerpo c cumple encuadreSeguro: entero adentro (con margen, y con la
// cara arriba o de cuerpo entero) o del todo afuera, a la izquierda o a la
// derecha. Misma cuenta que encuadreSeguro, despejada para x.
type Intervalo = [number, number];
function xPermitidas(c: Cuerpo, z: number, y: number): Intervalo[] {
  const zc = z * ZOOM_TOMA_MAX;
  const zl = z * ZOOM_TOMA_MIN;
  const [mx, my] = [DERIVA + MARGEN_BORDE_PX / zc, DERIVA + 16 / zc];
  const [aC, hC, aL, hL] = [ANCHO_PANTALLA / 2 / zc, ALTO_PANTALLA / 2 / zc, ANCHO_PANTALLA / 2 / zl, ALTO_PANTALLA / 2 / zl];
  const r = c.rect;
  const res: Intervalo[] = [];
  // Del todo afuera: separado en vertical (cualquier x) o en horizontal.
  const separadoY = !(r.y - DERIVA < y + hL && y - hL - DERIVA < r.y + r.alto);
  if (separadoY) return [[-Infinity, Infinity]];
  res.push([-Infinity, r.x - DERIVA - aL], [r.x + r.ancho + aL + DERIVA, Infinity]);
  // Entero adentro.
  const dentroY = r.y >= y - hC + my && r.y + r.alto <= y + hC - my;
  if (dentroY) {
    let adentro: Intervalo[] = [[r.x + r.ancho - aC + mx, r.x + aC - mx]];
    const caraArriba = c.cabezaY === undefined || c.cabezaY <= y + DERIVA;
    if (!caraArriba) {
      const k = c.completo;
      const enteroY = !!k && k.y >= y - hC + DERIVA && k.y + k.alto <= y + hC;
      adentro = enteroY && k ? intersecar(adentro, [[k.x + k.ancho - aC + DERIVA, k.x + aC - DERIVA]]) : [];
    }
    res.push(...adentro.filter(([a, b]) => a <= b));
  }
  return unir(res);
}
function unir(xs: Intervalo[]): Intervalo[] {
  const o = xs.filter(([a, b]) => a <= b).sort((p, q) => p[0] - q[0]);
  const res: Intervalo[] = [];
  for (const [a, b] of o) {
    const u = res[res.length - 1];
    if (u && a <= u[1]) u[1] = Math.max(u[1], b);
    else res.push([a, b]);
  }
  return res;
}
function intersecar(as: Intervalo[], bs: Intervalo[]): Intervalo[] {
  const res: Intervalo[] = [];
  for (const [a0, a1] of as) for (const [b0, b1] of bs) {
    const lo = Math.max(a0, b0);
    const hi = Math.min(a1, b1);
    if (lo <= hi) res.push([lo, hi]);
  }
  return unir(res);
}

// sinOcupacionMinima: lo obligatorio se ve entero pero puede ocupar menos del 50 %.
// anclarAbajo: lo encuadrado es gente (con sus pies): si no llena la altura
// útil, se apoya abajo (los pies sobre la interfaz de Instagram) y lo que
// sobra queda arriba, no como piso vacío (revisión de la v7).
type OpcionesEncuadre = { obligatorios: Rect[]; deseables?: Rect[]; cuerpos: Cuerpo[]; zoomMaximo?: number; sinOcupacionMinima?: boolean; anclarAbajo?: boolean };

function buscar(o: OpcionesEncuadre, zMin: number, exigirMinimo = true): ResultadoEncuadre | null {
  const zMax = o.zoomMaximo ?? ZOOM_MAXIMO_KIT;
  const deseables = o.deseables ?? [];
  const u = o.obligatorios.length ? unionRects(o.obligatorios) : null;
  const referencia = u ?? (deseables.length ? unionRects(deseables) : null);
  if (!referencia) return null;
  const zIdeal = u ? Math.min(1000 / u.ancho, (ALTO_UTIL * ALTO_MAXIMO_PROTAGONISTA) / u.alto, zMax) : Math.min(1.1, zMax);
  if (exigirMinimo && zIdeal < zMin - 1e-9) return null;

  let mejor: (ResultadoEncuadre & { puntaje: number }) | null = null;
  for (let z = Math.max(zIdeal, zMin); z >= zMin - 1e-9; z -= 0.02) {
    // Cota: con menos zoom el puntaje solo baja (si no hay deseables).
    if (mejor && !deseables.length && z * 4 <= mejor.puntaje) break;
    const pref = o.anclarAbajo && referencia.alto * z < ALTO_UTIL ? { x: referencia.x + referencia.ancho / 2, y: referencia.y + referencia.alto - (FRANJA_SEGURA.abajo - 10 - ALTO_PANTALLA / 2) / z } : centrado(referencia, z);
    // Sin deseables, basta lo más cercano a lo ideal; con deseables, se
    // recorre todo el lugar buscando el grupo más grande.
    const rangoX = deseables.length ? referencia.ancho / 2 + 200 : 600 / z;
    const rangoY = 420 / z;
    // Solo donde lo obligatorio cabe (cabeEnFranja son restricciones
    // lineales: se calculan los intervalos en vez de probar y descartar).
    let [x0, x1, y0, y1] = [pref.x - rangoX, pref.x + rangoX, pref.y - rangoY, pref.y + rangoY];
    if (u) {
      const zc = z * ZOOM_TOMA_MAX;
      x0 = Math.max(x0, u.x + u.ancho - (ANCHO_PANTALLA / 2 - 8) / zc);
      x1 = Math.min(x1, u.x + (ANCHO_PANTALLA / 2 - 8) / zc);
      y0 = Math.max(y0, u.y + u.alto - (FRANJA_SEGURA.abajo + 60 - ALTO_PANTALLA / 2) / z);
      y1 = Math.min(y1, u.y + (ALTO_PANTALLA / 2 - FONDO_SUBTITULO) / zc, u.y + (ALTO_PANTALLA / 2 - FRANJA_SEGURA.arriba + 30) / z);
      if (x0 > x1 || y0 > y1) continue;
    }
    if (u && exigirMinimo && !o.sinOcupacionMinima && ocupacionUtil(u, { x: 0, y: 0, zoom: z }) < OCUPACION_MINIMA_UTIL - 1e-9) continue;
    // Para cada altura de cámara, las posiciones horizontales seguras son
    // la intersección de lo que permite cada personaje (ver xPermitidas):
    // exacto y sin probar posición por posición.
    for (let y = y0; y <= y1 + 1e-6; y += 20) {
      let permitidas: Intervalo[] = [[x0, x1]];
      for (const c of o.cuerpos) {
        permitidas = intersecar(permitidas, xPermitidas(c, z, y));
        if (!permitidas.length) break;
      }
      if (!permitidas.length) continue;
      const dy = (y - pref.y) * 1.5;
      // Candidatos: lo más cerca posible del centro preferido; con
      // deseables, también los bordes donde entra o sale alguien.
      const xs = new Set<number>(permitidas.map(([a, b]) => Math.max(a, Math.min(b, pref.x))));
      if (deseables.length) {
        const zc = z * ZOOM_TOMA_MAX;
        const bordes = deseables.flatMap((r) => [r.x + r.ancho - (ANCHO_PANTALLA / 2 - 8) / zc, r.x + (ANCHO_PANTALLA / 2 - 8) / zc]);
        for (const [a, b] of permitidas) {
          xs.add(a);
          xs.add(b);
          for (const x of bordes) if (x >= a && x <= b) xs.add(x);
        }
      }
      for (const x of xs) {
        const cam = { x, y, zoom: z };
        if (u && !cabeEnFranja(u, cam)) continue;
        if (!encuadreSeguro(cam, o.cuerpos)) continue; // verificación (bordes numéricos)
        const incluidos = deseables.filter((r) => cabeEnFranja(r, cam));
        if (!u && incluidos.length === 0) continue;
        const puntaje = incluidos.length * 10 + z * 4 - Math.hypot(x - pref.x, dy) / 600;
        if (!mejor || puntaje > mejor.puntaje) mejor = { encuadre: cam, incluidos: u ? o.obligatorios : incluidos, puntaje };
      }
    }
  }
  return mejor ? { encuadre: mejor.encuadre, incluidos: mejor.incluidos } : null;
}
