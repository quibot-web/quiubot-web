// Dónde va cada isla del mundo: en fila sobre un mismo piso, en el orden
// que menos hace viajar a la cámara (las islas que se visitan una
// después de la otra quedan juntas). Puro.
import { ISLAS, CATALOGO, type IdIsla } from "./catalogo";
import type { Disparo } from "./plan";
import type { Rect } from "./geometria";

export const PISO_Y = 2000;
const SEPARACION = 180;

export type Recorrido = Partial<Record<IdIsla, Rect>>;

function permutaciones<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutaciones([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

export function construirRecorrido(disparos: Disparo[]): Recorrido {
  const visitas: IdIsla[] = [];
  for (const d of disparos) {
    const isla = CATALOGO[d.escena].isla as IdIsla;
    if (visitas[visitas.length - 1] !== isla) visitas.push(isla);
  }
  const islas = [...new Set(visitas)];
  if (islas.length === 0) islas.push("celular");
  const ubicar = (orden: IdIsla[]) => {
    const r: Recorrido = {};
    let x = 0;
    for (const id of orden) {
      const t = ISLAS[id];
      r[id] = { x, y: PISO_Y - t.alto, ancho: t.ancho, alto: t.alto };
      x += t.ancho + SEPARACION;
    }
    return r;
  };
  const centro = (r: Rect) => r.x + r.ancho / 2;
  // Hasta 7 islas: 5040 órdenes posibles, se prueban todos. Empate -> el
  // orden de primera aparición (primero en la lista).
  let mejor = islas;
  let mejorCosto = Infinity;
  for (const orden of permutaciones(islas)) {
    const r = ubicar(orden);
    let costo = 0;
    for (let i = 1; i < visitas.length; i++) costo += Math.abs(centro(r[visitas[i]]!) - centro(r[visitas[i - 1]]!));
    if (costo < mejorCosto - 1e-6) {
      mejorCosto = costo;
      mejor = orden;
    }
  }
  return ubicar(mejor);
}
