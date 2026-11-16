import type { Guion } from "../guion.schema";
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
