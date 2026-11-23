// Plan ilustrado de un reel: por cada escena del guion (frase narrada),
// qué acciones de qué escenas del catálogo dispara cada palabra. Puro.
// En la fase 2 lo escribe la IA (con validación); en la fase 1 lo usa el
// prototipo como dato fijo.
import { CATALOGO, ID_ESCENAS, definicionAccion, type IdEscena } from "./catalogo";
import type { LineaDeTiempo } from "../tiempoIlustrado";

export type AccionPlan = { escena: IdEscena; accion: string; palabra: number };
export type FrasePlan = { escena_id: string; acciones: AccionPlan[] };
export type PlanIlustrado = { frases: FrasePlan[] };

// Una acción ya con su cuadro global.
export type Disparo = AccionPlan & { cuadro: number; frase: string; inicioFrase: number };

export function problemasDelPlan(plan: PlanIlustrado, palabrasPorFrase: Record<string, number>): string[] {
  const problemas: string[] = [];
  for (const f of plan.frases) {
    const total = palabrasPorFrase[f.escena_id];
    if (total === undefined) problemas.push(`${f.escena_id}: la frase no existe en la narración`);
    for (const a of f.acciones) {
      if (!ID_ESCENAS.includes(a.escena)) problemas.push(`${f.escena_id}: escena desconocida "${a.escena}"`);
      else if (!definicionAccion(a.escena, a.accion)) problemas.push(`${f.escena_id}: la escena "${a.escena}" no tiene la acción "${a.accion}" (tiene: ${Object.keys(CATALOGO[a.escena].acciones).join(", ")})`);
      if (total !== undefined && (!Number.isInteger(a.palabra) || a.palabra < 0 || a.palabra >= total)) problemas.push(`${f.escena_id}: palabra ${a.palabra} fuera de rango (0-${total - 1})`);
    }
  }
  return problemas;
}

export function resolverDisparos(plan: PlanIlustrado, linea: LineaDeTiempo): Disparo[] {
  const res: Disparo[] = [];
  for (const f of plan.frases) {
    const inicioFrase = linea.escenas.find((e) => e.id === f.escena_id)?.desde ?? 0;
    for (const a of f.acciones) res.push({ ...a, cuadro: linea.cuadroDePalabra(f.escena_id, a.palabra), frase: f.escena_id, inicioFrase });
  }
  return res.sort((a, b) => a.cuadro - b.cuadro);
}

// Cuadros de cada acción de una escena, en orden (para los componentes).
export type DisparosEscena = Record<string, number[]>;
export function disparosDeEscena(disparos: Disparo[], escena: IdEscena): DisparosEscena {
  const res: DisparosEscena = {};
  for (const d of disparos) if (d.escena === escena) (res[d.accion] ??= []).push(d.cuadro);
  return res;
}
