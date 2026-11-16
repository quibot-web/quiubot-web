import type { BloqueGuion, Guion } from "../guion.schema";
import { contarPalabras } from "../guion.schema";
import { eventosDeVisual } from "./schema";

// Validación ESTRICTA de la Fase B v2.0 (edición desde el audio), a
// propósito separada de GuionSchema -- GuionSchema es la base
// compartida por las 6 recetas orgánicas ya en producción, que NO
// traen "narracion"/"visual" todavía (son campos opcionales ahí). Esta
// función es la que exige ambos, y solo la llama el pipeline nuevo
// (docs/diseno/plan_contenido_organico_fase_b_v2.md) -- nunca se mete
// en el superRefine de GuionSchema, para no romper retroactivamente
// los guiones/fixtures/tests de las recetas que todavía no la usan.
export type HallazgoEdicionAudio = { escenaId: string; mensaje: string };

export function validarEdicionDesdeAudio(escenas: Guion["escenas"]): HallazgoEdicionAudio[] {
  const hallazgos: HallazgoEdicionAudio[] = [];

  for (const escena of escenas) {
    if (!escena.narracion) {
      hallazgos.push({ escenaId: escena.id, mensaje: "Falta narracion -- la Fase B v2.0 exige voz en cada escena." });
      continue;
    }
    if (!escena.visual) {
      hallazgos.push({ escenaId: escena.id, mensaje: "Falta visual -- la Fase B v2.0 exige un visual con eventos en cada escena." });
      continue;
    }

    const totalPalabras = contarPalabras(escena.narracion);
    eventosDeVisual(escena.visual).forEach((evento, indiceEvento) => {
      if (evento.palabra < 0 || evento.palabra >= totalPalabras) {
        hallazgos.push({
          escenaId: escena.id,
          mensaje: `El evento ${indiceEvento} apunta a la palabra ${evento.palabra}, pero la narracion solo tiene ${totalPalabras} palabra(s).`,
        });
      }
    });
  }

  return hallazgos;
}

// Estructura específica de consejos_numerados CON AUDIO -- pedido
// explícito de Juan José (16 nov 2026) tras revisar el primer intento
// en staging: la IA metió los 3 consejos en UNA sola escena con un
// "contador" ("Uno: elige mensajes. Dos: usa fotos reales. Tres: pide
// escribirte por WhatsApp.") -- eso es DECIR, no MOSTRAR. Exige la
// misma estructura que el reel de referencia aprobado
// (video/fixtures/organico/referencia/ReelConsejosNumerados.tsx):
// gancho (celular_chat en 0) -> 3 escenas "valor", una por consejo,
// cada una concreta con su propio problema->arreglo -> "marca" cierra
// el bucle reusando el MISMO celular_chat del gancho (contador ya
// arriba) -> cta. Separada de validarEdicionDesdeAudio() (que es
// genérica, sin saber de recetas) porque esta sí es específica de UNA
// receta -- se llama aparte, solo para consejos_numerados.
const ESTRUCTURA_CONSEJOS_NUMERADOS: BloqueGuion[] = ["gancho", "valor", "valor", "valor", "marca", "cta"];
const PALABRAS_ENUMERACION = /\b(uno|dos|tres|cuatro|primero|segundo|tercero|cuarto)\b/gi;
const MIN_PALABRAS_CONSEJO_CONCRETO = 5;

export function validarEstructuraConsejosNumeradosAudio(escenas: Guion["escenas"]): HallazgoEdicionAudio[] {
  const hallazgos: HallazgoEdicionAudio[] = [];
  const bloques = escenas.map((e) => e.bloque);
  const estructuraCorrecta = escenas.length === ESTRUCTURA_CONSEJOS_NUMERADOS.length && bloques.every((b, i) => b === ESTRUCTURA_CONSEJOS_NUMERADOS[i]);

  if (!estructuraCorrecta) {
    hallazgos.push({
      escenaId: escenas[0]?.id ?? "?",
      mensaje: `consejos_numerados con audio exige exactamente ${ESTRUCTURA_CONSEJOS_NUMERADOS.length} escenas en este orden: ${ESTRUCTURA_CONSEJOS_NUMERADOS.join(" -> ")} (una escena por cada consejo -- NUNCA los 3 consejos juntos en una sola escena). Llegaron ${escenas.length}: ${bloques.join(" -> ") || "(ninguna)"}.`,
    });
    // Sin la forma correcta no tiene sentido validar contenido por
    // índice (gancho/marca podrían no existir en las posiciones 0/4).
    return hallazgos;
  }

  const [gancho, , , , marca] = escenas;
  if (gancho.visual?.tipo !== "celular_chat") {
    hallazgos.push({ escenaId: gancho.id, mensaje: `El gancho debe usar visual "celular_chat" (arranca en 0 mensajes) -- llegó "${gancho.visual?.tipo ?? "sin visual"}".` });
  }
  if (marca.visual?.tipo !== "celular_chat") {
    hallazgos.push({
      escenaId: marca.id,
      mensaje: `La escena "marca" cierra el bucle del gancho y debe reusar visual "celular_chat" (el MISMO celular del gancho, ahora con el contador ya arriba) -- llegó "${marca.visual?.tipo ?? "sin visual"}".`,
    });
  }

  for (const escena of escenas.slice(1, 4)) {
    const narracion = escena.narracion ?? "";
    const coincidencias = narracion.match(PALABRAS_ENUMERACION) ?? [];
    if (new Set(coincidencias.map((p) => p.toLowerCase())).size >= 2) {
      hallazgos.push({
        escenaId: escena.id,
        mensaje: `La narracion "${narracion}" parece enumerar varios consejos en una sola escena -- cada escena "valor" es UN solo consejo, nunca una lista.`,
      });
    }
    if (contarPalabras(narracion) < MIN_PALABRAS_CONSEJO_CONCRETO) {
      hallazgos.push({
        escenaId: escena.id,
        mensaje: `La narracion "${narracion}" es muy corta para ser un consejo concreto y entendible por sí solo (mínimo ${MIN_PALABRAS_CONSEJO_CONCRETO} palabras) -- escribe la acción completa, no un fragmento.`,
      });
    }
  }

  return hallazgos;
}
