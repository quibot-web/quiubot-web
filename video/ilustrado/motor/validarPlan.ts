// Plan ilustrado que escribe la IA (fase 2): esquema estricto, reglas y
// ajuste con los tiempos reales de la voz. Puro.
//
// Datos reales, nunca inventados (regla del 18 nov 2026): la IA solo
// elige escena + acción + palabra. No hay ningún campo de texto que se
// muestre en pantalla (ni precio, ni descuento, ni reseñas, ni
// respuestas del chat): el esquema es estricto y rechaza cualquier campo
// extra. La única cadena libre es "metafora", que NUNCA se dibuja: es la
// explicación de la IA cuando el concepto no está en el catálogo.
import { z } from "zod";
import { CATALOGO, ID_ESCENAS, definicionAccion, type IdEscena, type IdIsla } from "./catalogo";
import { problemasDelPlan, type PlanIlustrado } from "./plan";

const AccionSchema = z
  .object({
    escena: z.enum(ID_ESCENAS as [IdEscena, ...IdEscena[]]),
    accion: z.string().min(1).max(40),
    palabra: z.number().int().min(0),
  })
  .strict();

export const PlanIlustradoSchema = z
  .object({
    frases: z
      .array(
        z
          .object({
            escena_id: z.string().min(1),
            acciones: z.array(AccionSchema).min(1).max(5),
            metafora: z.string().max(120).optional(),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

// Ritmo: la voz va a ~2,8 palabras por segundo; 7 palabras ~ 2,5 s.
export const MAX_PALABRAS_SIN_ACCION = 7;
// Acciones seguidas en islas distintas: la cámara necesita viajar.
export const MIN_PALABRAS_ENTRE_ISLAS = 2;
// Con los tiempos reales: separación mínima entre islas distintas.
export const MIN_SEGUNDOS_ENTRE_ISLAS = 0.6;

export const contarPalabras = (narracion: string) => narracion.trim().split(/\s+/).filter(Boolean).length;
const islaDe = (escena: IdEscena) => CATALOGO[escena].isla as IdIsla;

// Escenas del guion (id + narración) -> problemas del plan, en español,
// listos para devolverle a la IA en el reintento.
export function validarPlanIlustrado(plan: unknown, escenas: { id: string; narracion: string }[]): string[] {
  const parseado = PlanIlustradoSchema.safeParse(plan);
  if (!parseado.success) return parseado.error.issues.map((i) => `${i.path.join(".") || "plan"}: ${i.message}`);
  const p = parseado.data as PlanIlustrado;
  const palabras = Object.fromEntries(escenas.map((e) => [e.id, contarPalabras(e.narracion)]));
  const problemas = problemasDelPlan(p, palabras);

  const ids = p.frases.map((f) => f.escena_id);
  const esperados = escenas.map((e) => e.id);
  if (ids.join("|") !== esperados.join("|")) problemas.push(`el plan debe tener una entrada por frase, en orden: ${esperados.join(", ")} (llegó: ${ids.join(", ")})`);
  if (problemas.length > 0) return problemas;

  // Posición global de cada acción en palabras habladas desde el inicio
  // del reel ("pos", para el ritmo). Para separar lugares distintos, la
  // pausa entre frases (~0,25-0,4 s) cuenta como una palabra más
  // ("posConPausa"): la cámara viaja durante ella.
  const inicioFrase: Record<string, number> = {};
  const indiceFrase: Record<string, number> = {};
  let acumulado = 0;
  escenas.forEach((e, i) => {
    inicioFrase[e.id] = acumulado;
    indiceFrase[e.id] = i;
    acumulado += palabras[e.id];
  });
  const globales = p.frases
    .flatMap((f) => f.acciones.map((a) => ({ ...a, frase: f.escena_id, pos: inicioFrase[f.escena_id] + a.palabra, posConPausa: inicioFrase[f.escena_id] + indiceFrase[f.escena_id] + a.palabra })))
    .sort((a, b) => a.pos - b.pos);

  if (globales[0].pos > 1) problemas.push(`${globales[0].frase}: la primera acción del reel debe ir en la palabra 0 o 1 (movimiento desde el inicio)`);
  for (let i = 1; i < globales.length; i++) {
    const a = globales[i - 1];
    const b = globales[i];
    if (b.pos - a.pos > MAX_PALABRAS_SIN_ACCION) problemas.push(`${b.frase}: hay ${b.pos - a.pos} palabras sin ningún cambio antes de "${b.escena}.${b.accion}" (máximo ${MAX_PALABRAS_SIN_ACCION}); agrega una acción en medio`);
    if (islaDe(a.escena) !== islaDe(b.escena) && b.posConPausa - a.posConPausa < MIN_PALABRAS_ENTRE_ISLAS) {
      problemas.push(`${b.frase}: "${a.escena}.${a.accion}" y "${b.escena}.${b.accion}" son de lugares distintos y están a ${b.pos - a.pos} palabra(s); sepáralas al menos ${MIN_PALABRAS_ENTRE_ISLAS} palabras`);
    }
  }
  const fin = acumulado - 1;
  const ultima = globales[globales.length - 1];
  if (fin - ultima.pos > MAX_PALABRAS_SIN_ACCION) problemas.push(`${ultima.frase}: las últimas ${fin - ultima.pos} palabras del reel no tienen ningún cambio (máximo ${MAX_PALABRAS_SIN_ACCION})`);
  return problemas;
}

// Con los tiempos reales de la voz: si dos acciones seguidas de islas
// distintas quedaron a menos de MIN_SEGUNDOS_ENTRE_ISLAS, la segunda se
// corre a la palabra siguiente de su frase (si existe y no choca). La
// cámara igual lo resuelve (llega hasta 0,8 s tarde); esto lo evita.
export function ajustarPlanConTiempos(plan: PlanIlustrado, palabrasPorEscena: { escena_id: string; palabras: { inicio_s: number }[] }[]): { plan: PlanIlustrado; ajustes: string[] } {
  const ajustes: string[] = [];
  const copia: PlanIlustrado = { frases: plan.frases.map((f) => ({ ...f, acciones: f.acciones.map((a) => ({ ...a })) })) };
  const tiempo = (frase: string, i: number) => palabrasPorEscena.find((p) => p.escena_id === frase)?.palabras[i]?.inicio_s;
  const todas = () =>
    copia.frases
      .flatMap((f) => f.acciones.map((a) => ({ a, frase: f.escena_id, t: tiempo(f.escena_id, a.palabra) ?? Infinity })))
      .sort((x, y) => x.t - y.t);
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    const lista = todas();
    const i = lista.findIndex((x, k) => k > 0 && islaDe(lista[k - 1].a.escena) !== islaDe(x.a.escena) && x.t - lista[k - 1].t < MIN_SEGUNDOS_ENTRE_ISLAS);
    if (i === -1) break;
    const { a, frase } = lista[i];
    const total = palabrasPorEscena.find((p) => p.escena_id === frase)?.palabras.length ?? 0;
    let siguiente = a.palabra + 1;
    while (siguiente < total && (tiempo(frase, siguiente) ?? Infinity) - lista[i - 1].t < MIN_SEGUNDOS_ENTRE_ISLAS) siguiente++;
    if (siguiente >= total) break; // no hay a dónde correrla: la cámara lo resuelve
    ajustes.push(`${frase}: ${a.escena}.${a.accion} de la palabra ${a.palabra} a la ${siguiente}`);
    a.palabra = siguiente;
  }
  return { plan: copia, ajustes };
}

export function accionesDisponiblesTexto(): string {
  return ID_ESCENAS.map((e) => `- ${e} (${CATALOGO[e].isla === "celular" ? "pantalla del celular" : "objeto del mundo"}):\n${Object.keys(CATALOGO[e].acciones).map((a) => `    · ${a}: ${definicionAccion(e, a)!.descripcion}`).join("\n")}`).join("\n");
}
