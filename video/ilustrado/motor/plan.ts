// Plan ilustrado de un reel: por cada escena del guion (frase narrada),
// qué acciones de qué escenas del catálogo dispara cada palabra. Puro.
// En la fase 2 lo escribe la IA (con validación); en la fase 1 lo usa el
// prototipo como dato fijo.
import type { Variedad } from "../kit/variedad";
import type { LineaDeTiempo } from "../tiempoIlustrado";
import type { ComposicionKit } from "../kit/catalogoKit";
import type { OpcionesCartel } from "./catalogo";
import { crearRegistro, type Registro } from "./registro";

// escena: una del catálogo (feed, chat, billetera...) o el id de una
// composición del kit ("k_..."). En el kit, accion = "elemento.verbo" y
// objetivo (opcional) = otro elemento al que apunta (ej. lo que señala).
export type AccionPlan = { escena: string; accion: string; palabra: number; objetivo?: string };
export type FrasePlan = { escena_id: string; acciones: AccionPlan[]; metafora?: string };
// variedad: pared, paleta de ropa y movimiento de cámara que eligió el
// código para este reel (lo leen los reels siguientes de la cuenta).
// opciones: los textos del cartel final de una historia narrada (los pone el código).
// escenario: lo que el código sabe de la historia por la narración (rubro,
// si se habla de mensajes): cambia las fotos ilustradas, el botón del
// anuncio y los mensajes del chat. Nunca lo escribe la IA.
export type EscenarioPlan = { rubro?: "ropa"; mensajes?: boolean };
export type PlanIlustrado = { frases: FrasePlan[]; composiciones?: ComposicionKit[]; variedad?: Variedad; opciones?: OpcionesCartel; escenario?: EscenarioPlan };

// Una acción ya con su cuadro global.
export type Disparo = AccionPlan & { cuadro: number; frase: string; inicioFrase: number };

export function problemasDelPlan(plan: PlanIlustrado, palabrasPorFrase: Record<string, number>, registro: Registro = crearRegistro(plan.composiciones)): string[] {
  const problemas: string[] = [];
  for (const f of plan.frases) {
    const total = palabrasPorFrase[f.escena_id];
    if (total === undefined) problemas.push(`${f.escena_id}: la frase no existe en la narración`);
    for (const a of f.acciones) {
      const def = registro.escena(a.escena);
      if (!def) problemas.push(`${f.escena_id}: escena desconocida "${a.escena}"`);
      else if (!def.acciones[a.accion]) problemas.push(`${f.escena_id}: la escena "${a.escena}" no tiene la acción "${a.accion}" (tiene: ${Object.keys(def.acciones).filter((x) => x !== "micro").join(", ")})`);
      if (a.objetivo !== undefined) {
        const cu = registro.composicion(a.escena);
        const existe = !!cu && (cu.personajes.some((u) => u.per.id === a.objetivo) || cu.objetos.some((o) => o.obj.id === a.objetivo));
        if (!existe) problemas.push(`${f.escena_id}: el objetivo "${a.objetivo}" de "${a.escena}.${a.accion}" no es un elemento de esa composición`);
      }
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
export function disparosDeEscena(disparos: Disparo[], escena: string): DisparosEscena {
  const res: DisparosEscena = {};
  for (const d of disparos) if (d.escena === escena) (res[d.accion] ??= []).push(d.cuadro);
  return res;
}
