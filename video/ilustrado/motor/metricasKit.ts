// Métricas de un reel en sus lugares del kit (puro), medidas con la cámara
// exacta de cada cuadro. Sirven para comparar una composición de la IA con
// una hecha a mano (revisión de la v6) y para la regla de ritmo de planos.
import { ALTO_PANTALLA, ANCHO_PANTALLA, vistaDelMundo, type Encuadre, type Rect } from "./geometria";
import { cuerposEnMundo } from "./camara";
import { ALTO_UTIL } from "./encuadreKit";
import { camaraDelCuadro, type ReelPreparado } from "./preparar";

export type MetricasKit = {
  segundosEnKit: number;
  personajesVisibles: number; // promedio por cuadro (cabeza y torso enteros en cuadro)
  cortesPorSegundo: number;
  ocupacionUtil: number; // promedio: parte de la franja útil cubierta por lo que se muestra (personajes y objetos visibles, 0-1)
  planoMasLargo: number; // en segundos
  // Lo peor de un cuadro: parte de la pantalla debajo de los pies del
  // personaje visible más bajo (piso vacío + interfaz de Instagram).
  pisoVacioMaximo: number;
};

function esCorte(a: Encuadre, b: Encuadre): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) * b.zoom > 40 || Math.max(a.zoom / b.zoom, b.zoom / a.zoom) > 1.04;
}
const dentro = (r: Rect, v: Rect) => r.x >= v.x && r.y >= v.y && r.x + r.ancho <= v.x + v.ancho && r.y + r.alto <= v.y + v.alto;

export function metricasKit(reel: ReelPreparado, fps: number): MetricasKit {
  const total = reel.linea.duracionCuadros;
  const islasKit = Object.keys(reel.recorrido).filter((id) => reel.registro.composicion(id));
  const cuerpos = islasKit.flatMap((id) => cuerposEnMundo(id, reel.recorrido, reel.registro));
  // Objetos con lugar (cartelera, dibujos en la pared, pupitres), en el mundo.
  const objetos = islasKit.flatMap((id) => (reel.registro.composicion(id)?.objetos ?? []).flatMap((o) => (o.rect ? [{ x: o.rect.x + reel.recorrido[id]!.x, y: o.rect.y + reel.recorrido[id]!.y, ancho: o.rect.ancho, alto: o.rect.alto }] : [])));
  const islas = islasKit.map((id) => ({ x: reel.recorrido[id]!.x, y: reel.recorrido[id]!.y, ancho: reel.recorrido[id]!.ancho, alto: reel.recorrido[id]!.alto }));
  let cuadros = 0;
  let visibles = 0;
  let ocupacion = 0;
  let cortes = 0;
  let plano = 0;
  let planoMax = 0;
  let anterior: Encuadre | null = null;
  let pisoVacio = 0;
  let planos: { enc: Encuadre; largo: number }[] = [];
  for (let f = 0; f < total; f++) {
    const cam = camaraDelCuadro(reel, f);
    const v = vistaDelMundo(cam);
    const centro = { x: cam.x, y: cam.y };
    const enKit = islas.some((r) => centro.x >= r.x - 800 && centro.x <= r.x + r.ancho + 800);
    if (!enKit) {
      anterior = null;
      plano = 0;
      planos = [];
      continue;
    }
    cuadros++;
    if (anterior && esCorte(anterior, cam)) {
      cortes++;
      // Un plano corto (< 20 cuadros) entre dos iguales no cuenta como
      // cambio: se ve como un parpadeo del mismo plano (reel_1, 24 nov).
      const ultimo = planos[planos.length - 1];
      const penultimo = planos[planos.length - 2];
      if (ultimo && penultimo && ultimo.largo < 20 && !esCorte(penultimo.enc, cam)) {
        planos.pop();
        penultimo.largo += ultimo.largo;
      } else planos.push({ enc: cam, largo: 0 });
    }
    if (!planos.length) planos.push({ enc: cam, largo: 0 });
    const actual = planos[planos.length - 1];
    actual.largo++;
    plano = actual.largo;
    planoMax = Math.max(planoMax, plano);
    anterior = cam;
    let area = 0;
    let piesMasBajos = -Infinity;
    for (const c of cuerpos) {
      if (!dentro(c.rect, v)) continue;
      visibles++;
      const r = c.completo ?? c.rect;
      piesMasBajos = Math.max(piesMasBajos, ALTO_PANTALLA / 2 + (r.y + r.alto - cam.y) * cam.zoom);
      const x0 = Math.max(0, ANCHO_PANTALLA / 2 + (r.x - cam.x) * cam.zoom);
      const x1 = Math.min(ANCHO_PANTALLA, ANCHO_PANTALLA / 2 + (r.x + r.ancho - cam.x) * cam.zoom);
      const y0 = Math.max(0, ALTO_PANTALLA / 2 + (r.y - cam.y) * cam.zoom);
      const y1 = Math.min(ALTO_PANTALLA, ALTO_PANTALLA / 2 + (r.y + r.alto - cam.y) * cam.zoom);
      area += Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
    }
    for (const r of objetos) {
      const x0 = Math.max(0, ANCHO_PANTALLA / 2 + (r.x - cam.x) * cam.zoom);
      const x1 = Math.min(ANCHO_PANTALLA, ANCHO_PANTALLA / 2 + (r.x + r.ancho - cam.x) * cam.zoom);
      const y0 = Math.max(0, ALTO_PANTALLA / 2 + (r.y - cam.y) * cam.zoom);
      const y1 = Math.min(ALTO_PANTALLA, ALTO_PANTALLA / 2 + (r.y + r.alto - cam.y) * cam.zoom);
      area += Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
    }
    ocupacion += Math.min(1, area / (ANCHO_PANTALLA * ALTO_UTIL));
    if (piesMasBajos > -Infinity) pisoVacio = Math.max(pisoVacio, Math.max(0, ALTO_PANTALLA - piesMasBajos) / ALTO_PANTALLA);
  }
  const s = cuadros / fps;
  return {
    segundosEnKit: s,
    personajesVisibles: cuadros ? visibles / cuadros : 0,
    cortesPorSegundo: s ? cortes / s : 0,
    ocupacionUtil: cuadros ? ocupacion / cuadros : 0,
    planoMasLargo: planoMax / fps,
    pisoVacioMaximo: pisoVacio,
  };
}
