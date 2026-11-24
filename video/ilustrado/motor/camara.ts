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
import { MICRO, unionRects } from "./catalogo";
import { REGISTRO_CATALOGO, type Registro } from "./registro";
import { ALTO_PANTALLA, ANCHO_PANTALLA, acercar, desplazar, encuadre, ocupacion, type Encuadre, type Rect } from "./geometria";
import type { Disparo } from "./plan";
import type { Recorrido } from "./recorrido";

export const JUNTAR_SI_MENOS_DE = 30; // cuadros (1 s)
export const PAUSA_MINIMA = 15; // cuadros (0,5 s)
export const VER_ULTIMA_ACCION = 12; // cuadros (0,4 s)
const LLEGAR_TRAS_PALABRA = 6; // cuadros

export function focoGlobal(d: Pick<Disparo, "escena" | "accion" | "objetivo">, recorrido: Recorrido, registro: Registro = REGISTRO_CATALOGO): Rect {
  const foco = registro.foco(d.escena, d.accion, d.objetivo);
  const idIsla = registro.escena(d.escena)?.isla;
  const isla = idIsla ? recorrido[idIsla] : undefined;
  if (!foco || !isla) throw new Error(`Sin foco para ${d.escena}.${d.accion}`);
  return desplazar(foco, isla.x, isla.y);
}

export type Toma = { desde: number; ultimaAccion: number; focos: Rect[]; encuadre: Encuadre; celular: boolean; escena?: string };

// Pantallas del celular: ancladas debajo del subtítulo.
const encuadrar = (focos: Rect[], celular: boolean) => encuadre(unionRects(focos), undefined, celular ? "arriba" : "centro");

const igual = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.ancho === b.ancho && a.alto === b.alto;

export function tomasDeCamara(disparos: Disparo[], recorrido: Recorrido, registro: Registro = REGISTRO_CATALOGO): Toma[] {
  const tomas: Toma[] = [];
  for (const d of disparos) {
    // La micro-acción no cambia de toma (ver pulsoDeCamara).
    if (d.accion === MICRO) continue;
    const f = focoGlobal(d, recorrido, registro);
    const esCelular = registro.escena(d.escena)?.celular === true;
    const ultima = tomas[tomas.length - 1];
    if (ultima) {
      if (ultima.focos.some((g) => igual(g, f))) {
        ultima.ultimaAccion = d.cuadro;
        continue;
      }
      if (d.cuadro - ultima.desde < JUNTAR_SI_MENOS_DE && ultima.celular === esCelular) {
        const focos = [...ultima.focos, f];
        const enc = encuadrar(focos, esCelular);
        // Composición del kit (visuales-v2): acciones seguidas en el mismo
        // lugar se ven como grupo ("todos aplauden"): basta con que el grupo
        // ocupe >= 50 %. Saltar de un niño a otro cada 10 cuadros marea.
        const mismaComposicion = !!registro.composicion(d.escena) && ultima.escena === d.escena;
        const cabe = mismaComposicion ? ocupacion(unionRects(focos), enc) >= 0.5 : focos.every((g) => ocupacion(g, enc) >= 0.5);
        if (cabe) {
          ultima.focos = focos;
          ultima.encuadre = enc;
          ultima.ultimaAccion = d.cuadro;
          continue;
        }
      }
    }
    tomas.push({ desde: d.cuadro, ultimaAccion: d.cuadro, focos: [f], encuadre: encuadrar([f], esCelular), celular: esCelular, escena: d.escena });
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
    puntos.push({ cuadro: inicio, ...acercar(a, empuje(inicio - llegadaAnterior), tomas[i - 1].celular ? "arriba" : "centro") });
    puntos.push({ cuadro: llegada, ...b });
    llegadaAnterior = llegada;
  }
  const ultima = tomas[tomas.length - 1].encuadre;
  const fin = Math.max(total, llegadaAnterior + 1);
  puntos.push({ cuadro: fin, ...acercar(ultima, empuje(fin - llegadaAnterior), tomas[tomas.length - 1].celular ? "arriba" : "centro") });
  return puntos;
}

// Micro-acción: acercamiento corto (+5% en ~0,4 s) que se suelta en ~1,3 s.
// Multiplica el zoom de la toma en curso; no la cambia.
export function pulsoDeCamara(frame: number, pulsos: number[]): number {
  let extra = 0;
  for (const p of pulsos) {
    const t = frame - p;
    if (t < 0 || t > 52) continue;
    extra = Math.max(extra, t < 12 ? 0.05 * Math.sin((t / 12) * (Math.PI / 2)) : 0.05 * (1 - (t - 12) / 40));
  }
  return 1 + extra;
}

