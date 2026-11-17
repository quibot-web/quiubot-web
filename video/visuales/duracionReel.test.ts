import { describe, it, expect } from "vitest";
import { duracionReelAutomaticoEnCuadros } from "./duracionReel";
import type { Guion } from "../guion.schema";

// Ronda K: antes sumaba +8 cuadros de "cola" de transición aunque ya
// no hay transición (TransitionSeries+fade() se reemplazó por
// Sequence a Sequence, sin solape -- ver el comentario real en
// ReelAutomatico.tsx). La duración total debe ser EXACTAMENTE la suma
// de cada escena, ni un cuadro más.
function guionConTiempos(tiempos: { escena_id: string; inicio_s: number; fin_s: number }[]): Pick<Guion, "tiemposRender" | "fps"> {
  return { tiemposRender: tiempos, fps: 30 };
}

describe("duracionReelAutomaticoEnCuadros", () => {
  it("una sola escena: la duración es exactamente la suya, sin cola de transición", () => {
    const guion = guionConTiempos([{ escena_id: "e1", inicio_s: 0, fin_s: 2 }]);
    expect(duracionReelAutomaticoEnCuadros(guion as Guion)).toBe(60);
  });

  it("varias escenas: la suma exacta de cada una, sin +8 cuadros extra (ronda K: ya no hay fundido que pida esa cola)", () => {
    const guion = guionConTiempos([
      { escena_id: "e1", inicio_s: 0, fin_s: 3.16 },
      { escena_id: "e2", inicio_s: 3.16, fin_s: 6.905 },
      { escena_id: "e3", inicio_s: 6.905, fin_s: 10.36 },
    ]);
    const esperado = Math.round((3.16 + (6.905 - 3.16) + (10.36 - 6.905)) * 30);
    expect(duracionReelAutomaticoEnCuadros(guion as Guion)).toBe(esperado);
  });

  it("sin tiemposRender, da 0", () => {
    expect(duracionReelAutomaticoEnCuadros({ fps: 30 } as Guion)).toBe(0);
  });
});
