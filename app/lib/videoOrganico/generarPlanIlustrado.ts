import { frasesDelCartel } from "@/app/lib/historiaNarrada";
// Reel ilustrado, fase 2: la IA escribe el plan (escena + acción +
// palabra por frase) sobre una narración ya validada. Hasta 3 intentos,
// cada reintento con los problemas del anterior. Si no sale válido, el
// reel sigue con su estilo de siempre (nunca se bloquea la pieza).
import type { PlanIlustrado } from "@/video/ilustrado/motor/plan";
import { ajustarPlanConTiempos, rellenarRitmoPorTiempo, repararRitmoPorPalabras, validarPlanIlustrado } from "@/video/ilustrado/motor/validarPlan";
import { construirPromptPlanIlustrado } from "@/video/ilustrado/promptPlanIlustrado";
import { elegirVariedad, type HuellaVisual } from "@/video/ilustrado/kit/variedad";

// "historial": los problemas de CADA intento (se registran todos, no solo el último).
export type ResultadoPlanIlustrado =
  | { ok: true; plan: PlanIlustrado; intentos: number; ajustes: string[]; historial: string[][] }
  | { ok: false; errores: string[]; intentos: number; historial: string[][] };

export async function generarPlanIlustrado(
  escenas: { id: string; narracion: string }[],
  llamarIA: (prompt: string) => Promise<string>,
  maxIntentos = 3,
  opciones: { conKit?: boolean; historial?: HuellaVisual[] } = {}
): Promise<ResultadoPlanIlustrado> {
  const historialVisual = opciones.historial ?? [];
  let errores: string[] | undefined;
  const historial: string[][] = [];
  for (let intento = 1; intento <= maxIntentos; intento++) {
    const respuesta = await llamarIA(construirPromptPlanIlustrado(escenas, errores, { conKit: opciones.conKit, historial: historialVisual }));
    let crudo: unknown;
    try {
      crudo = JSON.parse(respuesta);
    } catch {
      errores = ["La respuesta no fue un JSON válido."];
      historial.push(errores);
      continue;
    }
    // Si la forma es válida, primero se arreglan solos los huecos de
    // ritmo (micro-acciones) y recién después se valida todo.
    let candidato = crudo;
    let ajustes: string[] = [];
    // Problemas de ritmo (huecos entre acciones o al final del reel): se arreglan solos.
    if (validarPlanIlustrado(crudo, escenas, { historial: historialVisual }).every((p) => /ningún cambio/.test(p))) {
      const reparado = repararRitmoPorPalabras(crudo as PlanIlustrado, escenas);
      candidato = reparado.plan;
      ajustes = reparado.ajustes;
    }
    const problemas = validarPlanIlustrado(candidato, escenas, { historial: historialVisual });
    if (problemas.length === 0) {
      // Variedad entre reels: pared, paleta de ropa y movimiento de cámara
      // que no repiten los de los últimos reels de la cuenta.
      const plan = { ...(candidato as PlanIlustrado), variedad: elegirVariedad(historialVisual, escenas.map((e) => e.narracion).join(" ")) };
      return { ok: true, plan, intentos: intento, ajustes, historial };
    }
    errores = problemas;
    historial.push(problemas);
  }
  return { ok: false, errores: errores ?? [], intentos: maxIntentos, historial };
}

// Tras editar una narración y regenerar la voz: el plan apunta a
// palabras por número, así que se revalida contra el texto nuevo. Si
// sigue válido se reajusta con los tiempos nuevos; si no, se pide uno
// nuevo (solo cuentas activas); si tampoco sale, la pieza vuelve a su
// estilo de siempre (sin "ilustrado").
export async function planTrasRegenerarVoz<G extends { escenas: { id: string; narracion?: string }[]; ilustrado?: PlanIlustrado; palabrasPorEscena?: { escena_id: string; palabras: { inicio_s: number }[] }[] }>(
  guion: G,
  opciones: { activo: boolean; llamarIA: (prompt: string) => Promise<string> }
): Promise<{ guion: G; estado: "sin_plan" | "se_mantiene" | "replanificado" | "respaldo" }> {
  if (!guion.ilustrado && !opciones.activo) return { guion, estado: "sin_plan" };
  const narraciones = guion.escenas.map((e) => ({ id: e.id, narracion: e.narracion ?? "" }));
  // Historia narrada con cartel de opciones: el cartel lo arma el código;
  // solo la historia (antes de la pregunta) se revalida o se replanifica.
  const cartel = guion.ilustrado?.opciones;
  const preguntaEn = cartel ? guion.ilustrado!.frases.findIndex((f) => f.acciones.some((a) => a.escena === "opciones")) : -1;
  const historia = preguntaEn > 0 ? narraciones.slice(0, preguntaEn) : narraciones;
  const conCartel = (plan: PlanIlustrado): PlanIlustrado => (preguntaEn > 0 && cartel ? { ...plan, frases: [...plan.frases.slice(0, preguntaEn), ...frasesDelCartel(narraciones, preguntaEn)], opciones: cartel } : plan);
  const soloHistoria = (plan: PlanIlustrado): PlanIlustrado => (preguntaEn > 0 ? { ...plan, frases: plan.frases.slice(0, preguntaEn), opciones: undefined } : plan);
  const ajustar = (plan: PlanIlustrado) => (guion.palabrasPorEscena ? ajustarConVozReal(conCartel(plan), guion.palabrasPorEscena).plan : conCartel(plan));
  if (guion.ilustrado && validarPlanIlustrado(soloHistoria(guion.ilustrado), historia).length === 0) return { guion: { ...guion, ilustrado: ajustar(guion.ilustrado) }, estado: "se_mantiene" };
  if (opciones.activo) {
    const r = await generarPlanIlustrado(historia, opciones.llamarIA, 3, { conKit: true });
    // Se conserva la variedad que ya tenía la pieza (pared, paleta, cámara).
    if (r.ok) return { guion: { ...guion, ilustrado: ajustar({ ...r.plan, ...(guion.ilustrado?.variedad ? { variedad: guion.ilustrado.variedad } : {}) }) }, estado: "replanificado" };
  }
  const sinPlan = { ...guion };
  delete sinPlan.ilustrado;
  return { guion: sinPlan, estado: "respaldo" };
}

// Con la voz real: separa acciones de lugares distintos muy juntas y
// rellena con micro-acciones cualquier tramo de más de 2,5 s sin cambio.
export function ajustarConVozReal(plan: PlanIlustrado, palabrasPorEscena: { escena_id: string; palabras: { inicio_s: number; fin_s?: number }[] }[]): { plan: PlanIlustrado; ajustes: string[] } {
  const separado = ajustarPlanConTiempos(plan, palabrasPorEscena);
  const rellenado = rellenarRitmoPorTiempo(separado.plan, palabrasPorEscena);
  return { plan: rellenado.plan, ajustes: [...separado.ajustes, ...rellenado.ajustes] };
}

