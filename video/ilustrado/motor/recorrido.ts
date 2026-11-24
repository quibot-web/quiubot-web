// Dónde va cada isla del mundo: en fila sobre un mismo piso, en el orden
// que menos hace viajar a la cámara (las islas que se visitan una
// después de la otra quedan juntas). Puro.
import type { Disparo } from "./plan";
import type { Rect } from "./geometria";
import { REGISTRO_CATALOGO, type Registro } from "./registro";

export const PISO_Y = 2000;
const SEPARACION = 180;
const SEPARACION_KIT = 1600;

// Isla -> dónde queda (las del catálogo y las composiciones del kit).
export type Recorrido = Record<string, Rect>;

function permutaciones<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutaciones([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

export function construirRecorrido(disparos: Disparo[], registro: Registro = REGISTRO_CATALOGO): Recorrido {
  const visitas: string[] = [];
  for (const d of disparos) {
    const isla = registro.escena(d.escena)?.isla;
    if (!isla) continue;
    if (visitas[visitas.length - 1] !== isla) visitas.push(isla);
  }
  const islas = [...new Set(visitas)];
  if (islas.length === 0) islas.push("celular");
  const ubicar = (orden: string[]) => {
    const r: Recorrido = {};
    let x = 0;
    orden.forEach((id, i) => {
      const t = registro.tamIsla(id)!;
      r[id] = { x, y: PISO_Y - t.alto, ancho: t.ancho, alto: t.alto };
      // Junto a una composición del kit, más espacio: su lugar continúa
      // más allá de la isla (ENTORNO) y no debe verse detrás de otra isla.
      const kit = !!registro.composicion(id) || (orden[i + 1] !== undefined && !!registro.composicion(orden[i + 1]));
      x += t.ancho + (kit ? SEPARACION_KIT : SEPARACION);
    });
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
