// Reel ilustrado, fase 2: la IA escribe el plan (escena + acción +
// palabra por frase) sobre una narración ya validada. Hasta 3 intentos,
// cada reintento con los problemas del anterior. Si no sale válido, el
// reel sigue con su estilo de siempre (nunca se bloquea la pieza).
import type { PlanIlustrado } from "@/video/ilustrado/motor/plan";
import { ajustarPlanConTiempos, validarPlanIlustrado } from "@/video/ilustrado/motor/validarPlan";
import { construirPromptPlanIlustrado } from "@/video/ilustrado/promptPlanIlustrado";

export type ResultadoPlanIlustrado = { ok: true; plan: PlanIlustrado; intentos: number } | { ok: false; errores: string[]; intentos: number };

export async function generarPlanIlustrado(
  escenas: { id: string; narracion: string }[],
  llamarIA: (prompt: string) => Promise<string>,
  maxIntentos = 3
): Promise<ResultadoPlanIlustrado> {
  let errores: string[] | undefined;
  for (let intento = 1; intento <= maxIntentos; intento++) {
    const respuesta = await llamarIA(construirPromptPlanIlustrado(escenas, errores));
    let crudo: unknown;
    try {
      crudo = JSON.parse(respuesta);
    } catch {
      errores = ["La respuesta no fue un JSON válido."];
      continue;
    }
    const problemas = validarPlanIlustrado(crudo, escenas);
    if (problemas.length === 0) return { ok: true, plan: crudo as PlanIlustrado, intentos: intento };
    errores = problemas;
  }
  return { ok: false, errores: errores ?? [], intentos: maxIntentos };
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
  const ajustar = (plan: PlanIlustrado) => (guion.palabrasPorEscena ? ajustarPlanConTiempos(plan, guion.palabrasPorEscena).plan : plan);
  if (guion.ilustrado && validarPlanIlustrado(guion.ilustrado, narraciones).length === 0) return { guion: { ...guion, ilustrado: ajustar(guion.ilustrado) }, estado: "se_mantiene" };
  if (opciones.activo) {
    const r = await generarPlanIlustrado(narraciones, opciones.llamarIA);
    if (r.ok) return { guion: { ...guion, ilustrado: ajustar(r.plan) }, estado: "replanificado" };
  }
  const sinPlan = { ...guion };
  delete sinPlan.ilustrado;
  return { guion: sinPlan, estado: "respaldo" };
}
