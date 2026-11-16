import { describe, it, expect } from "vitest";
import { calcularCurvaDucking } from "./CapaMusicaConDucking";

function esEstrictamenteCreciente(arr: number[]): boolean {
  return arr.every((v, i) => i === 0 || v > arr[i - 1]);
}

describe("calcularCurvaDucking", () => {
  it("caso normal: puntos estrictamente crecientes y el patrón de volumen sube/baja/sube en el orden esperado", () => {
    const { puntos, valores } = calcularCurvaDucking({
      fps: 30,
      durationInFrames: 300, // 10s
      volumenNormal: 0.8,
      volumenConVoz: 0.2,
      inicioVoz_s: 1,
      finVoz_s: 9,
    });
    expect(esEstrictamenteCreciente(puntos)).toBe(true);
    expect(puntos).toHaveLength(valores.length);
    expect(valores).toEqual([0, 0.8, 0.8, 0.2, 0.2, 0.8, 0.8, 0]);
  });

  it("caso límite: la voz empieza casi en el cuadro 0 (reel corto) -- nunca lanza, sigue estrictamente creciente", () => {
    // En un reel tan corto los "ideales" de fade/ducking se pisan entre
    // sí -- lo único que de verdad importa para no romper interpolate()
    // es que la secuencia se mantenga estrictamente creciente, aunque
    // eso empuje el último punto un poco más allá de durationInFrames
    // (extrapolateRight:"clamp" lo cubre: no hay cuadros reales ahí).
    const { puntos } = calcularCurvaDucking({
      fps: 30,
      durationInFrames: 60, // 2s, muy corto
      volumenNormal: 0.8,
      volumenConVoz: 0.2,
      inicioVoz_s: 0.05,
      finVoz_s: 1.9,
    });
    expect(esEstrictamenteCreciente(puntos)).toBe(true);
    expect(puntos[puntos.length - 1]).toBeGreaterThanOrEqual(60);
  });

  it("caso límite: voz ocupa TODO el reel de punta a punta -- sigue estrictamente creciente", () => {
    const { puntos } = calcularCurvaDucking({
      fps: 30,
      durationInFrames: 90,
      volumenNormal: 0.8,
      volumenConVoz: 0.2,
      inicioVoz_s: 0,
      finVoz_s: 3,
    });
    expect(esEstrictamenteCreciente(puntos)).toBe(true);
  });
});
