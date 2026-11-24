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
export const ZOOM_MINIMO_KIT = 0.8;
// Solo si con 0,8 no hay ningún encuadre sin caras cortadas (por ejemplo,
// alguien sentado justo detrás del borde): se abre un poco más.
export const ZOOM_MINIMO_KIT_EXCEPCIONAL = 0.65;
// Variación de zoom de la cámara durante una toma del kit: acercamiento
// lento (hasta +2 %, EMPUJE_MAXIMO_KIT) y respiración (+-1 %). Y la deriva
// (+-8 unidades).
export const ZOOM_TOMA_MAX = 1.035;
export const ZOOM_TOMA_MIN = 0.985;
const DERIVA = 10;

export type Cuerpo = { id: string; rect: Rect };

function dentro(r: Rect, v: Rect, m: number): boolean {
  return r.x >= v.x + m && r.y >= v.y + m && r.x + r.ancho <= v.x + v.ancho - m && r.y + r.alto <= v.y + v.alto - m;
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
  const cerca = vistaDelMundo(conZoom(cam, ZOOM_TOMA_MAX));
  const lejos = vistaDelMundo(conZoom(cam, ZOOM_TOMA_MIN));
  return cuerpos.every((c) => dentro(c.rect, cerca, DERIVA) || !seTocan(c.rect, lejos, DERIVA));
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

const ALTO_UTIL = FRANJA_SEGURA.abajo - FRANJA_SEGURA.arriba - 30;
const CENTRO_FRANJA = (FRANJA_SEGURA.arriba + FRANJA_SEGURA.abajo) / 2;
// Centro de cámara que pone el rectángulo en el centro de la franja.
const centrado = (r: Rect, zoom: number) => ({ x: r.x + r.ancho / 2, y: r.y + r.alto / 2 - (CENTRO_FRANJA - ALTO_PANTALLA / 2) / zoom });

export type ResultadoEncuadre = { encuadre: Encuadre; incluidos: Rect[] };

// soloNormal: sin abrir más allá de ZOOM_MINIMO_KIT (para decidir si dos
// acciones seguidas caben en una toma; si no, mejor dos tomas).
export function encuadrarKit(o: { obligatorios: Rect[]; deseables?: Rect[]; cuerpos: Cuerpo[]; zoomMaximo?: number; soloNormal?: boolean }): ResultadoEncuadre | null {
  if (!o.obligatorios.length || o.soloNormal) return buscar(o, ZOOM_MINIMO_KIT);
  // Antes que cortar una cara, abrir más (último recurso: 0,5).
  return buscar(o, ZOOM_MINIMO_KIT) ?? buscar(o, ZOOM_MINIMO_KIT_EXCEPCIONAL, false) ?? buscar(o, 0.5, false);
}

function buscar(o: { obligatorios: Rect[]; deseables?: Rect[]; cuerpos: Cuerpo[]; zoomMaximo?: number }, zMin: number, exigirMinimo = true): ResultadoEncuadre | null {
  const zMax = o.zoomMaximo ?? ZOOM_MAXIMO_KIT;
  const deseables = o.deseables ?? [];
  const u = o.obligatorios.length ? unionRects(o.obligatorios) : null;
  const referencia = u ?? (deseables.length ? unionRects(deseables) : null);
  if (!referencia) return null;
  const zIdeal = u ? Math.min(1000 / u.ancho, ALTO_UTIL / u.alto, zMax) : Math.min(1.1, zMax);
  if (exigirMinimo && zIdeal < zMin - 1e-9) return null;

  let mejor: (ResultadoEncuadre & { puntaje: number }) | null = null;
  for (let z = Math.max(zIdeal, zMin); z >= zMin - 1e-9; z -= 0.02) {
    // Cota: con menos zoom el puntaje solo baja (si no hay deseables).
    if (mejor && !deseables.length && z * 4 <= mejor.puntaje) break;
    const pref = centrado(referencia, z);
    // Sin deseables, basta lo más cercano a lo ideal; con deseables, se
    // recorre todo el lugar buscando el grupo más grande.
    const rangoX = deseables.length ? referencia.ancho / 2 + 200 : 600 / z;
    const rangoY = 240 / z;
    const candidatos: { x: number; y: number; dist: number }[] = [];
    for (let dx = -rangoX; dx <= rangoX; dx += 12) for (let dy = -rangoY; dy <= rangoY; dy += 16) candidatos.push({ x: pref.x + dx, y: pref.y + dy, dist: Math.hypot(dx, dy * 1.5) });
    candidatos.sort((a, b) => a.dist - b.dist);
    for (const c of candidatos) {
      const cam = { x: c.x, y: c.y, zoom: z };
      if (u && !cabeEnFranja(u, cam)) continue;
      if (!encuadreSeguro(cam, o.cuerpos)) continue;
      const incluidos = deseables.filter((r) => cabeEnFranja(r, cam));
      if (!u && incluidos.length === 0) continue;
      const puntaje = incluidos.length * 10 + z * 4 - c.dist / 600;
      if (!mejor || puntaje > mejor.puntaje) mejor = { encuadre: cam, incluidos: u ? o.obligatorios : incluidos, puntaje };
      if (!deseables.length) break; // el más cercano de este zoom
    }
  }
  return mejor ? { encuadre: mejor.encuadre, incluidos: mejor.incluidos } : null;
}
