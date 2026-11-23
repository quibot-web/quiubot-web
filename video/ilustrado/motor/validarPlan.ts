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
import { CATALOGO, ID_ESCENAS, MICRO, definicionAccion, type IdEscena, type IdIsla } from "./catalogo";
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
            // Hasta 4 de la IA + las micro-acciones que inserta el arreglo de ritmo.
            acciones: z.array(AccionSchema).min(1).max(8),
            metafora: z.string().max(120).optional(),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

// Ritmo: la voz va a ~2,8 palabras por segundo; 7 palabras ~ 2,5 s. Es
// la GUÍA antes de la voz; la regla final es por tiempo (MAX_SEGUNDOS_SIN_CAMBIO).
export const MAX_PALABRAS_SIN_ACCION = 7;
export const MAX_SEGUNDOS_SIN_CAMBIO = 2.5;
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
  // "e2[3] \"Meta\"": cómo se nombra una palabra en los mensajes de reintento.
  const textos = escenas.flatMap((e) => e.narracion.trim().split(/\s+/).filter(Boolean).map((t, i) => `${e.id}[${i}] "${t}"`));
  const etiquetaPalabra = (pos: number) => textos[pos] ?? `palabra ${pos}`;
  const globales = p.frases
    .flatMap((f) => f.acciones.map((a) => ({ ...a, frase: f.escena_id, pos: inicioFrase[f.escena_id] + a.palabra, posConPausa: inicioFrase[f.escena_id] + indiceFrase[f.escena_id] + a.palabra })))
    .sort((a, b) => a.pos - b.pos);

  if (globales[0].pos > 1) problemas.push(`${globales[0].frase}: la primera acción del reel debe ir en la palabra 0 o 1 (movimiento desde el inicio)`);
  for (let i = 1; i < globales.length; i++) {
    const a = globales[i - 1];
    const b = globales[i];
    if (b.pos - a.pos > MAX_PALABRAS_SIN_ACCION) {
      const candidatas = Array.from({ length: b.pos - a.pos - 1 }, (_, k) => a.pos + 1 + k)
        .filter((pos) => pos - a.pos <= MAX_PALABRAS_SIN_ACCION && b.pos - pos <= MAX_PALABRAS_SIN_ACCION)
        .map((pos) => etiquetaPalabra(pos));
      problemas.push(`${b.frase}: hay ${b.pos - a.pos} palabras sin ningún cambio antes de "${b.escena}.${b.accion}" (máximo ${MAX_PALABRAS_SIN_ACCION}); pon una acción en alguna de estas palabras: ${candidatas.join(", ")}`);
    }
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
  return ID_ESCENAS.map((e) => `- ${e} (${CATALOGO[e].isla === "celular" ? "pantalla del celular" : "objeto del mundo"}):\n${Object.keys(CATALOGO[e].acciones).filter((a) => a !== MICRO).map((a) => `    · ${a}: ${definicionAccion(e, a)!.descripcion}`).join("\n")}`).join("\n");
}

// ---------- Arreglos de ritmo (fase 2, staging 23 nov 2026) ----------
// Con frases reales de 8-12 palabras la IA dejaba huecos de 8 palabras
// sin cambio y no lo corregía al reintentar. En vez de rechazar el plan
// (o adelantar la acción siguiente, que haría aparecer la imagen antes
// de que la voz la nombre), se inserta una MICRO-ACCIÓN neutra de la
// escena que está en pantalla en la mitad del hueco. Solo si no se
// puede, la acción siguiente se adelanta 1 palabra dentro de su frase.

type AccionUbicada = { frase: string; indiceFrase: number; accion: PlanIlustrado["frases"][number]["acciones"][number] };

function copiar(plan: PlanIlustrado): PlanIlustrado {
  return { frases: plan.frases.map((f) => ({ ...f, acciones: f.acciones.map((a) => ({ ...a })) })) };
}

function insertarMicro(plan: PlanIlustrado, frase: string, escena: IdEscena, palabra: number): boolean {
  const f = plan.frases.find((x) => x.escena_id === frase);
  if (!f || f.acciones.length >= 8 || !(MICRO in CATALOGO[escena].acciones)) return false;
  if (f.acciones.some((a) => a.palabra === palabra)) return false;
  f.acciones.push({ escena, accion: MICRO, palabra });
  f.acciones.sort((x, y) => x.palabra - y.palabra);
  return true;
}

// Antes de la voz, por palabras (guía de 7 palabras).
export function repararRitmoPorPalabras(plan: PlanIlustrado, escenas: { id: string; narracion: string }[]): { plan: PlanIlustrado; ajustes: string[] } {
  const copia = copiar(plan);
  const ajustes: string[] = [];
  const largo = Object.fromEntries(escenas.map((e) => [e.id, contarPalabras(e.narracion)]));
  const inicio: Record<string, number> = {};
  let total = 0;
  for (const e of escenas) {
    inicio[e.id] = total;
    total += largo[e.id];
  }
  const ubicar = (pos: number) => {
    const e = escenas.find((x) => pos >= inicio[x.id] && pos < inicio[x.id] + largo[x.id]);
    return e ? { frase: e.id, palabra: pos - inicio[e.id] } : null;
  };
  for (let vuelta = 0; vuelta < 30; vuelta++) {
    const lista = copia.frases
      .filter((f) => inicio[f.escena_id] !== undefined)
      .flatMap((f, indiceFrase) => f.acciones.map((accion) => ({ frase: f.escena_id, indiceFrase, accion, pos: inicio[f.escena_id] + accion.palabra })))
      .sort((x, y) => x.pos - y.pos);
    if (lista.length === 0) break;
    // Huecos entre acciones y al final del reel (el final cuenta como una acción virtual).
    const fin = { pos: total, accion: null as AccionUbicada["accion"] | null, frase: "" };
    const pares = [...lista.map((x, k) => [x, lista[k + 1] ?? fin] as const)];
    const hueco = pares.find(([a, b]) => b.pos - a.pos > MAX_PALABRAS_SIN_ACCION);
    if (!hueco) break;
    const [a, b] = hueco;
    const medio = ubicar(a.pos + Math.floor((b.pos - a.pos) / 2));
    if (medio && insertarMicro(copia, medio.frase, a.accion.escena, medio.palabra)) {
      ajustes.push(`${medio.frase}: micro-acción de ${a.accion.escena} en la palabra ${medio.palabra} (hueco de ${b.pos - a.pos} palabras)`);
      continue;
    }
    // Sin micro-acción posible: la acción siguiente se adelanta 1 palabra dentro de su frase.
    if (b.accion && b.accion.palabra > 0) {
      ajustes.push(`${b.frase}: ${b.accion.escena}.${b.accion.accion} de la palabra ${b.accion.palabra} a la ${b.accion.palabra - 1}`);
      b.accion.palabra -= 1;
      continue;
    }
    break;
  }
  return { plan: copia, ajustes };
}

// Con la voz real, por tiempo: ningún tramo de más de 2,5 s sin cambio.
// La micro-acción va en la palabra más cercana a la mitad del tramo,
// a no menos de MIN_SEGUNDOS_ENTRE_ISLAS de la acción siguiente.
export function rellenarRitmoPorTiempo(
  plan: PlanIlustrado,
  palabrasPorEscena: { escena_id: string; palabras: { inicio_s: number; fin_s?: number }[] }[],
  maxSegundos = MAX_SEGUNDOS_SIN_CAMBIO
): { plan: PlanIlustrado; ajustes: string[] } {
  const copia = copiar(plan);
  const ajustes: string[] = [];
  const palabras = palabrasPorEscena.flatMap((p) => p.palabras.map((w, i) => ({ frase: p.escena_id, palabra: i, t: w.inicio_s })));
  if (palabras.length === 0) return { plan: copia, ajustes };
  const ultima = palabrasPorEscena[palabrasPorEscena.length - 1]?.palabras.at(-1);
  const finVoz = ultima?.fin_s ?? (ultima ? ultima.inicio_s + 0.4 : 0);
  const tiempo = (frase: string, i: number) => palabras.find((w) => w.frase === frase && w.palabra === i)?.t ?? Infinity;
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    const lista = copia.frases.flatMap((f) => f.acciones.map((a) => ({ a, t: tiempo(f.escena_id, a.palabra) }))).sort((x, y) => x.t - y.t);
    if (lista.length === 0) break;
    const pares = lista.map((x, k) => [x, lista[k + 1] ?? { a: null, t: finVoz }] as const);
    const hueco = pares.find(([x, y]) => y.t - x.t > maxSegundos);
    if (!hueco) break;
    const [x, y] = hueco;
    const medio = (x.t + y.t) / 2;
    const candidata = palabras
      .filter((w) => w.t > x.t + 0.3 && w.t < y.t - (y.a ? MIN_SEGUNDOS_ENTRE_ISLAS : 0))
      .sort((p, q) => Math.abs(p.t - medio) - Math.abs(q.t - medio))[0];
    if (!candidata || !insertarMicro(copia, candidata.frase, x.a.escena, candidata.palabra)) {
      ajustes.push(`sin palabra para rellenar un tramo de ${(y.t - x.t).toFixed(1)} s después de ${x.a.escena}.${x.a.accion}`);
      break;
    }
    ajustes.push(`${candidata.frase}: micro-acción de ${x.a.escena} en la palabra ${candidata.palabra} (tramo de ${(y.t - x.t).toFixed(1)} s sin cambio)`);
  }
  return { plan: copia, ajustes };
}

// Tramo más largo sin cambio (segundos), para pruebas y registro.
export function tramoMasLargoSinCambio(plan: PlanIlustrado, palabrasPorEscena: { escena_id: string; palabras: { inicio_s: number; fin_s?: number }[] }[]): number {
  const t = (frase: string, i: number) => palabrasPorEscena.find((p) => p.escena_id === frase)?.palabras[i]?.inicio_s ?? Infinity;
  const tiempos = plan.frases.flatMap((f) => f.acciones.map((a) => t(f.escena_id, a.palabra))).sort((a, b) => a - b);
  const ultima = palabrasPorEscena[palabrasPorEscena.length - 1]?.palabras.at(-1);
  tiempos.push(ultima?.fin_s ?? (ultima ? ultima.inicio_s + 0.4 : 0));
  let maximo = 0;
  for (let i = 1; i < tiempos.length; i++) maximo = Math.max(maximo, tiempos[i] - tiempos[i - 1]);
  return maximo;
}

