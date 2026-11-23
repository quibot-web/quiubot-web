// Cámara automática del reel ilustrado (pura). Por cada acción del plan,
// la cámara encuadra la zona que esa acción declara en el catálogo, así
// lo nombrado ocupa al menos media pantalla. Reglas para no marear:
// - acciones a menos de 1 s entre sí se encuadran juntas si todas siguen
//   ocupando >= 50% (si no, la cámara se mueve igual, después de una
//   pausa mínima);
// - cada viaje dura 0,5-1,4 s según la distancia (más lejos = más lento),
//   con arranque y frenado suaves, y llega ~0,2 s después de la palabra;
// - después de llegar, la cámara se queda al menos 0,5 s (con un
//   acercamiento lento para que nunca esté muerta), y no se va de una
//   toma hasta que su última acción se vio al menos 0,4 s.
import type { PuntoCamara } from "../tiempoIlustrado";
import { CATALOGO, definicionAccion, unionRects, type IdIsla } from "./catalogo";
import { ALTO_PANTALLA, ANCHO_PANTALLA, desplazar, encuadre, ocupacion, type Encuadre, type Rect } from "./geometria";
import type { Disparo } from "./plan";
import type { Recorrido } from "./recorrido";

export const JUNTAR_SI_MENOS_DE = 30; // cuadros (1 s)
export const PAUSA_MINIMA = 15; // cuadros (0,5 s)
export const VER_ULTIMA_ACCION = 12; // cuadros (0,4 s)
const LLEGAR_TRAS_PALABRA = 6; // cuadros

export function focoGlobal(d: Pick<Disparo, "escena" | "accion">, recorrido: Recorrido): Rect {
  const def = definicionAccion(d.escena, d.accion);
  const isla = recorrido[CATALOGO[d.escena].isla as IdIsla];
  if (!def || !isla) throw new Error(`Sin foco para ${d.escena}.${d.accion}`);
  return desplazar(def.foco, isla.x, isla.y);
}

export type Toma = { desde: number; ultimaAccion: number; focos: Rect[]; encuadre: Encuadre };

const igual = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.ancho === b.ancho && a.alto === b.alto;

export function tomasDeCamara(disparos: Disparo[], recorrido: Recorrido): Toma[] {
  const tomas: Toma[] = [];
  for (const d of disparos) {
    const f = focoGlobal(d, recorrido);
    const ultima = tomas[tomas.length - 1];
    if (ultima) {
      if (ultima.focos.some((g) => igual(g, f))) {
        ultima.ultimaAccion = d.cuadro;
        continue;
      }
      if (d.cuadro - ultima.desde < JUNTAR_SI_MENOS_DE) {
        const focos = [...ultima.focos, f];
        const enc = encuadre(unionRects(focos));
        if (focos.every((g) => ocupacion(g, enc) >= 0.5)) {
          ultima.focos = focos;
          ultima.encuadre = enc;
          ultima.ultimaAccion = d.cuadro;
          continue;
        }
      }
    }
    tomas.push({ desde: d.cuadro, ultimaAccion: d.cuadro, focos: [f], encuadre: encuadre(f) });
  }
  return tomas;
}

export function duracionViaje(a: Encuadre, b: Encuadre, fps: number): number {
  const z = Math.min(a.zoom, b.zoom);
  const pantallas = (Math.abs(a.x - b.x) * z) / ANCHO_PANTALLA + (Math.abs(a.y - b.y) * z) / ALTO_PANTALLA;
  const segundos = Math.min(1.5, Math.max(0.5, 0.5 + 0.35 * pantallas + 0.45 * Math.abs(Math.log(b.zoom / a.zoom))));
  return Math.round(segundos * fps);
}

const empuje = (cuadros: number) => 1 + Math.min(0.05, 0.0012 * cuadros);

export function puntosCamaraAutomatica(tomas: Toma[], total: number, fps: number): PuntoCamara[] {
  if (tomas.length === 0) return [{ cuadro: 0, x: 1000, y: 1000, zoom: 1 }];
  const puntos: PuntoCamara[] = [{ cuadro: 0, ...tomas[0].encuadre }];
  let llegadaAnterior = 0;
  for (let i = 1; i < tomas.length; i++) {
    const a = tomas[i - 1].encuadre;
    const b = tomas[i].encuadre;
    const dur = duracionViaje(a, b, fps);
    let llegada = tomas[i].desde + LLEGAR_TRAS_PALABRA;
    let inicio = llegada - dur;
    const salidaMinima = Math.max(llegadaAnterior + PAUSA_MINIMA, tomas[i - 1].ultimaAccion + VER_ULTIMA_ACCION);
    if (inicio < salidaMinima) {
      inicio = salidaMinima;
      llegada = inicio + dur;
    }
    puntos.push({ cuadro: inicio, ...a, zoom: a.zoom * empuje(inicio - llegadaAnterior) });
    puntos.push({ cuadro: llegada, ...b });
    llegadaAnterior = llegada;
  }
  const ultima = tomas[tomas.length - 1].encuadre;
  const fin = Math.max(total, llegadaAnterior + 1);
  puntos.push({ cuadro: fin, ...ultima, zoom: ultima.zoom * empuje(fin - llegadaAnterior) });
  return puntos;
}
