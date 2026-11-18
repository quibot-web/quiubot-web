import { describe, expect, it } from "vitest";
import { golpesDeRelleno, tramoMasLargoSinCambio } from "./ritmo";

const FPS = 30;
const MAX = 2 * FPS;

describe("cambio visual cada 2 s", () => {
  it("escena de 4,3 s con un solo evento a los 3 s: el tramo inicial de 3 s se parte con un golpe en una palabra", () => {
    const duracion = Math.round(4.3 * FPS);
    const cambios = [3 * FPS];
    expect(tramoMasLargoSinCambio(cambios, duracion)).toBe(90);
    const palabras = [0, 12, 30, 41, 55, 70, 88, 104, 120];
    const extra = golpesDeRelleno(cambios, duracion, palabras, MAX);
    expect(extra.length).toBeGreaterThan(0);
    for (const g of extra) expect(palabras).toContain(g);
    expect(tramoMasLargoSinCambio([...cambios, ...extra], duracion)).toBeLessThanOrEqual(MAX);
  });

  it("escena larga sin ningún evento ni palabras: golpes cada 2 s", () => {
    const duracion = 7 * FPS;
    const extra = golpesDeRelleno([], duracion, [], MAX);
    expect(tramoMasLargoSinCambio(extra, duracion)).toBeLessThanOrEqual(MAX);
  });

  it("si ya cambia cada <= 2 s, no agrega nada", () => {
    expect(golpesDeRelleno([40, 80], 110, [10, 50, 90], MAX)).toEqual([]);
  });
});
