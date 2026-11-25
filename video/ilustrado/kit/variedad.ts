// Variedad entre reels de una misma cuenta (puro). Cada reel guarda en su
// plan (guion.ilustrado.variedad) lo que eligió, y el siguiente evita lo de
// los últimos VENTANA_VARIEDAD reels:
// - pared del lugar, paleta de ropa y movimiento de cámara: los elige el
//   código (regla dura: nunca repite los de los últimos 3);
// - escena de apertura: la elige la IA; el validador rechaza repetir una de
//   los últimos 3 (la IA corrige en el reintento);
// - lugares: la IA los ve en el prompt y se le pide rotar cuando la
//   narración lo permite (no se fuerza: un reel sobre una clase va en un
//   salón aunque el anterior también).
import { z } from "zod";
import { COLORES_ROPA, PAREDES, type ColorRopa, type Pared } from "./catalogoKit";

export const VENTANA_VARIEDAD = 3;

function hashTexto(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Paletas de ropa: los personajes de un reel se visten con una (lo que la IA
// no fija). Cinco, para que siempre haya una fuera de las últimas tres.
export const PALETAS_ROPA = {
  calida: ["rojo", "naranja", "amarillo", "rosado"],
  fria: ["azul", "turquesa", "verde", "morado"],
  primaria: ["rojo", "azul", "amarillo", "verde"],
  suave: ["rosado", "turquesa", "amarillo", "morado"],
  tierra: ["naranja", "verde", "gris", "rojo"],
} as const satisfies Record<string, readonly ColorRopa[]>;
export type PaletaRopa = keyof typeof PALETAS_ROPA;

// Movimiento de la cámara dentro de cada plano del kit (todos dentro de
// los márgenes de encuadreSeguro: zoom 0,985-1,035 y deriva +-10).
export const MOVIMIENTOS_CAMARA = ["acercar", "alejar", "barrer_derecha", "barrer_izquierda", "quieta"] as const;
export type MovimientoCamara = (typeof MOVIMIENTOS_CAMARA)[number];

export const VariedadSchema = z
  .object({
    pared: z.enum(Object.keys(PAREDES) as [Pared, ...Pared[]]),
    paleta: z.enum(Object.keys(PALETAS_ROPA) as [PaletaRopa, ...PaletaRopa[]]),
    camara: z.enum(MOVIMIENTOS_CAMARA),
  })
  .strict();
export type Variedad = z.infer<typeof VariedadSchema>;

// Lo que deja un reel para que los siguientes no lo repitan.
export type HuellaVisual = Partial<Variedad> & { apertura?: string; lugares?: string[] };

function elegirEvitando<T extends string>(opciones: readonly T[], usadas: (T | undefined)[], h: number): T {
  const libres = opciones.filter((o) => !usadas.includes(o));
  const pool = libres.length ? libres : opciones;
  return pool[h % pool.length];
}

export function elegirVariedad(historial: HuellaVisual[], semilla: string): Variedad {
  const recientes = historial.slice(0, VENTANA_VARIEDAD);
  const h = hashTexto(`variedad:${semilla}`);
  return {
    pared: elegirEvitando(Object.keys(PAREDES) as Pared[], recientes.map((x) => x.pared), h),
    paleta: elegirEvitando(Object.keys(PALETAS_ROPA) as PaletaRopa[], recientes.map((x) => x.paleta), h >>> 7),
    camara: elegirEvitando(MOVIMIENTOS_CAMARA, recientes.map((x) => x.camara), h >>> 13),
  };
}

// Escena -> "lugar" (las composiciones del kit cuentan por su fondo:
// dos salones distintos son el mismo lugar).
export type LugarDe = (escena: string) => string;

export function huellaDePlan(plan: { frases: { acciones: { escena: string; accion: string }[] }[]; composiciones?: { id: string; fondo: string }[]; variedad?: Partial<Variedad> }): HuellaVisual {
  const lugar: LugarDe = (e) => {
    const c = plan.composiciones?.find((x) => x.id === e);
    return c ? `kit:${c.fondo}` : e;
  };
  const acciones = plan.frases.flatMap((f) => f.acciones).filter((a) => a.accion !== "micro");
  return {
    ...(plan.variedad ?? {}),
    apertura: acciones[0] ? lugar(acciones[0].escena) : undefined,
    lugares: [...new Set(acciones.map((a) => lugar(a.escena)))],
  };
}

// Problemas de variedad para la IA (solo la apertura es regla dura).
export function problemasVariedad(plan: Parameters<typeof huellaDePlan>[0], historial: HuellaVisual[]): string[] {
  const apertura = huellaDePlan(plan).apertura;
  const recientes = historial.slice(0, VENTANA_VARIEDAD).map((x) => x.apertura).filter(Boolean);
  if (apertura && recientes.includes(apertura)) {
    return [`el reel abre con "${apertura}", igual que uno de los últimos ${VENTANA_VARIEDAD} reels de la cuenta (${recientes.join(", ")}); abre con otra escena o lugar`];
  }
  return [];
}

export function textoVariedadParaPrompt(historial: HuellaVisual[]): string {
  const recientes = historial.slice(0, VENTANA_VARIEDAD);
  if (!recientes.length) return "";
  const aperturas = [...new Set(recientes.map((x) => x.apertura).filter(Boolean))];
  const lugares = [...new Set(recientes.flatMap((x) => x.lugares ?? []))];
  return `VARIEDAD (los últimos ${recientes.length} reels de esta cuenta):
- Abrieron con: ${aperturas.join(", ") || "—"}. Este reel NO puede abrir con ninguna de esas escenas o lugares (su primera acción va en otra).
- Usaron estos lugares: ${lugares.join(", ") || "—"}. Si la narración lo permite, cuenta la historia en otros (otra escena del catálogo u otro lugar del kit); si la narración pide uno de esos, se puede repetir.`;
}

// Colores de ropa de una paleta (el kit los usa para lo que la IA no fija).
export function ropasDePaleta(paleta: PaletaRopa | undefined): ColorRopa[] {
  return paleta ? [...PALETAS_ROPA[paleta]] : (Object.keys(COLORES_ROPA).filter((c) => c !== "blanco") as ColorRopa[]);
}

// Huellas de las piezas anteriores de la cuenta (filas con el plan guardado
// en guion.ilustrado; las que no tienen plan ilustrado no cuentan).
export function huellasDePiezas(piezas: { ilustrado?: unknown }[]): HuellaVisual[] {
  const res: HuellaVisual[] = [];
  for (const p of piezas) {
    const plan = p.ilustrado as Parameters<typeof huellaDePlan>[0] | null | undefined;
    if (!plan || !Array.isArray(plan.frases)) continue;
    try {
      res.push(huellaDePlan(plan));
    } catch {
      // Un plan viejo o raro no rompe la generación.
    }
  }
  return res.slice(0, VENTANA_VARIEDAD);
}
