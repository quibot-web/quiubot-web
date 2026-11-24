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
import { ALTO_PANTALLA, ANCHO_PANTALLA, acercar, desplazar, encuadre, ocupacion, vistaDelMundo, type Encuadre, type Rect } from "./geometria";
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

// Pantallas del celular: ancladas debajo del subtítulo. En el kit, zoom
// hasta 1,6 (sus piezas se convierten a PNG a 1,6x: siguen nítidas).
export const ZOOM_MAXIMO_KIT = 1.6;
// Una toma de grupo en el kit no se abre más que esto (cada cosa se ve).
export const ZOOM_MINIMO_GRUPO_KIT = 0.8;
export const CALMA_KIT = 18;
export const CORTE_MINIMO_KIT = 12;
// Plano abierto para dos acciones seguidas (p. ej. la profesora señala y el
// niño de los dulces se pone triste): no más lejos que esto.
export const ZOOM_MINIMO_UNION_KIT = 0.55;
const encuadrar = (focos: Rect[], celular: boolean, kit = false) => encuadre(unionRects(focos), kit ? ZOOM_MAXIMO_KIT : undefined, celular ? "arriba" : "centro");

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
      // Calma en el kit: si la acción llega muy pronto (< 0,6 s de la toma
      // anterior) y lo nombrado ya se ve en el encuadre, la cámara se queda
      // (cuatro cortes en un segundo marean).
      if (registro.composicion(d.escena) && ultima.escena === d.escena && d.cuadro - ultima.desde < CALMA_KIT) {
        const v = vistaDelMundo(ultima.encuadre);
        const cx = f.x + f.ancho / 2;
        const cy = f.y + f.alto / 2;
        if (cx > v.x && cx < v.x + v.ancho && cy > v.y && cy < v.y + v.alto) {
          ultima.ultimaAccion = d.cuadro;
          continue;
        }
        // Menos de 12 cuadros: mejor una toma más abierta que otro corte.
        if (d.cuadro - ultima.desde < CORTE_MINIMO_KIT) {
          const focos = [...ultima.focos, f];
          const enc = encuadrar(focos, false, true);
          if (enc.zoom >= ZOOM_MINIMO_UNION_KIT) {
            ultima.focos = focos;
            ultima.encuadre = enc;
            ultima.ultimaAccion = d.cuadro;
            continue;
          }
        }
      }
      if (d.cuadro - ultima.desde < JUNTAR_SI_MENOS_DE && ultima.celular === esCelular) {
        const focos = [...ultima.focos, f];
        const enc = encuadrar(focos, esCelular, !!registro.composicion(d.escena));
        // Composición del kit (visuales-v2): acciones seguidas en el mismo
        // lugar se ven como grupo ("todos aplauden"): basta con que el grupo
        // ocupe >= 50 %. Saltar de un niño a otro cada 10 cuadros marea.
        const mismaComposicion = !!registro.composicion(d.escena) && ultima.escena === d.escena;
        const cabe = mismaComposicion ? ocupacion(unionRects(focos), enc) >= 0.5 && enc.zoom >= ZOOM_MINIMO_GRUPO_KIT : focos.every((g) => ocupacion(g, enc) >= 0.5);
        if (cabe) {
          ultima.focos = focos;
          ultima.encuadre = enc;
          ultima.ultimaAccion = d.cuadro;
          continue;
        }
      }
    }
    tomas.push({ desde: d.cuadro, ultimaAccion: d.cuadro, focos: [f], encuadre: encuadrar([f], esCelular, !!registro.composicion(d.escena)), celular: esCelular, escena: d.escena });
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

// Puerta celular <-> lugar del kit (visuales-v2, 23 nov 2026): en vez de
// viajar por el mundo oscuro entre islas, la cámara entra a la pantalla del
// celular hasta llenarla, corta al lugar encuadrado en lo mismo que la
// pantalla mostraba (la cartelera) y se abre. Al volver, al revés.
export type Puerta = { cuadro: number; desde: "celular" | "kit"; kit: string };
export type OpcionesPuerta = {
  esKit: (escena: string | undefined) => boolean;
  // Pantalla del celular (mundo) y lo que se encuadra del lugar al cortar.
  pantalla: Rect | null;
  cubrirKit: (escena: string) => Rect | null;
};
export const CUADROS_PUERTA = 14;
export const ZOOM_PUERTA_MAXIMO = 1.6;

export function cubrir(r: Rect, llenarAlto = false): Encuadre {
  const zoom = Math.min(ZOOM_PUERTA_MAXIMO, llenarAlto ? Math.max(ANCHO_PANTALLA / r.ancho, ALTO_PANTALLA / r.alto) : ANCHO_PANTALLA / r.ancho);
  return { x: r.x + r.ancho / 2, y: r.y + r.alto / 2, zoom };
}

export function puntosCamaraAutomatica(tomas: Toma[], total: number, fps: number, puertas?: OpcionesPuerta): PuntoCamara[] {
  return planDeCamara(tomas, total, fps, puertas).puntos;
}

export function planDeCamara(tomas: Toma[], total: number, fps: number, opciones?: OpcionesPuerta): { puntos: PuntoCamara[]; puertas: Puerta[] } {
  if (tomas.length === 0) return { puntos: [{ cuadro: 0, x: 1000, y: 1000, zoom: 1 }], puertas: [] };
  const puntos: PuntoCamara[] = [{ cuadro: 0, ...tomas[0].encuadre }];
  const puertas: Puerta[] = [];
  let llegadaAnterior = 0;
  for (let i = 1; i < tomas.length; i++) {
    const a = tomas[i - 1].encuadre;
    const b = tomas[i].encuadre;
    const ta = tomas[i - 1];
    const tb = tomas[i];
    const haciaKit = ta.celular && opciones?.esKit(tb.escena);
    const desdeKit = tb.celular && opciones?.esKit(ta.escena);
    if (opciones?.pantalla && (haciaKit || desdeKit)) {
      const kit = (haciaKit ? tb.escena : ta.escena)!;
      const lugar = opciones.cubrirKit(kit);
      if (lugar) {
        // Entra (CUADROS_PUERTA), corta en T, se abre (CUADROS_PUERTA).
        let T = tb.desde + LLEGAR_TRAS_PALABRA - CUADROS_PUERTA;
        const salidaMinima = Math.max(llegadaAnterior + PAUSA_MINIMA, ta.ultimaAccion + VER_ULTIMA_ACCION) + CUADROS_PUERTA;
        if (T < salidaMinima) T = salidaMinima;
        const pantalla = cubrir(opciones.pantalla, true);
        const enLugar = cubrir(lugar);
        puntos.push({ cuadro: T - CUADROS_PUERTA, ...acercar(a, empuje(T - CUADROS_PUERTA - llegadaAnterior), ta.celular ? "arriba" : "centro") });
        // Saliendo del lugar: corte a la cartelera un poco más abierta y se
        // cierra hasta llenarla (viajar desde un primer plano cruza el salón
        // con encuadres sin sentido).
        if (desdeKit) puntos.push({ cuadro: T - CUADROS_PUERTA + 1, ...enLugar, zoom: enLugar.zoom * 0.82 });
        puntos.push({ cuadro: T - 1, ...(haciaKit ? pantalla : enLugar) });
        puntos.push({ cuadro: T, ...(haciaKit ? enLugar : pantalla) });
        puntos.push({ cuadro: T + CUADROS_PUERTA, ...b });
        puertas.push({ cuadro: T, desde: haciaKit ? "celular" : "kit", kit });
        llegadaAnterior = T + CUADROS_PUERTA;
        continue;
      }
    }
    // Dentro de un mismo lugar del kit: corte (como en el cine), no viaje.
    // Un viaje de 0,5-1,5 s por toma, con tomas cada ~1 s, atrasa la cámara
    // respecto a la voz y el atraso se acumula (v4: ~3 s al final).
    if (opciones?.esKit(ta.escena) && ta.escena === tb.escena) {
      const T = Math.max(tb.desde, llegadaAnterior + CORTE_MINIMO_KIT);
      puntos.push({ cuadro: T - 1, ...acercar(a, empuje(T - 1 - llegadaAnterior), "centro") });
      puntos.push({ cuadro: T, ...b });
      llegadaAnterior = T;
      continue;
    }
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
  return { puntos, puertas };
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

