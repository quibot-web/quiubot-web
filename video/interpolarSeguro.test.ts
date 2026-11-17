import { describe, it, expect } from "vitest";
import { interpolate } from "remotion";
import { interpolarSeguro } from "./interpolarSeguro";

describe("interpolarSeguro", () => {
  it("con un rango ya estrictamente creciente, da el MISMO resultado que interpolate() directo", () => {
    const casos: [number, number[], number[]][] = [
      [5, [0, 10], [0, 1]],
      [46, [0, 5, 40, 46], [0, 1, 1, 0]],
      [0, [0, 1], [16, 0]],
    ];
    for (const [input, inputRange, outputRange] of casos) {
      expect(interpolarSeguro(input, inputRange, outputRange)).toBe(interpolate(input, inputRange, outputRange));
    }
  });

  it("caso real que tumbó el render: fundido de 15ms a 30fps redondea a 0 cuadros -- [0, 0, 46, 46] no explota y da un valor sensato", () => {
    // Antes: interpolate(frame, [0, 0, 46, 46], [0, 1, 1, 0]) lanzaba
    // "inputRange must be strictly monotonically increasing".
    expect(() => interpolarSeguro(0, [0, 0, 46, 46], [0, 1, 1, 0])).not.toThrow();
    expect(() => interpolarSeguro(23, [0, 0, 46, 46], [0, 1, 1, 0])).not.toThrow();
    expect(() => interpolarSeguro(46, [0, 0, 46, 46], [0, 1, 1, 0])).not.toThrow();
    // Los puntos colisionados en 0 se separan en [0, 1, ...] -- la
    // "rampa" de entrada que antes era instantánea (fundido <1 cuadro)
    // ahora dura exactamente 1 cuadro en vez de lanzar: cuadro 1 ya
    // llega a volumen pleno (1), no se queda apagado.
    expect(interpolarSeguro(1, [0, 0, 46, 46], [0, 1, 1, 0])).toBe(1);
  });

  it("colisión en medio del rango: el punto se empuja al menos minPaso adelante del anterior", () => {
    const resultado = interpolarSeguro(10, [0, 10, 10, 20], [0, 1, 1, 0]);
    expect(Number.isFinite(resultado)).toBe(true);
    // El segundo "10" se corrige a 11 -- el rango real queda
    // estrictamente creciente [0, 10, 11, 20].
    expect(interpolarSeguro(10, [0, 10, 10, 20], [0, 1, 1, 0])).toBe(interpolate(10, [0, 10, 11, 20], [0, 1, 1, 0]));
  });

  it("DOS colisiones separadas en un rango de 4+ puntos: ambas se corrigen", () => {
    // [0, 0, 5, 5] -- colisión en el índice 1 Y en el índice 3.
    expect(() => interpolarSeguro(2, [0, 0, 5, 5], [0, 1, 1, 0])).not.toThrow();
    const esperado = interpolate(2, [0, 1, 5, 6], [0, 1, 1, 0]);
    expect(interpolarSeguro(2, [0, 0, 5, 5], [0, 1, 1, 0])).toBe(esperado);
  });

  it("rango invertido (segundo punto MENOR que el primero) también se corrige, no solo el empate exacto", () => {
    expect(() => interpolarSeguro(1, [0, -2], [0, 1])).not.toThrow();
  });

  it("acepta un minPaso distinto a 1 (ej. trabajar en segundos con 1/fps)", () => {
    const fps = 30;
    expect(() => interpolarSeguro(0, [0, 0], [0, 1], undefined, 1 / fps)).not.toThrow();
    expect(interpolarSeguro(0, [0, 0], [0, 1], undefined, 1 / fps)).toBe(0);
  });

  it("respeta las opciones de extrapolación igual que interpolate() directo", () => {
    expect(interpolarSeguro(-5, [0, 10], [0, 1], { extrapolateLeft: "clamp" })).toBe(0);
    expect(interpolarSeguro(50, [0, 10], [0, 1], { extrapolateRight: "clamp" })).toBe(1);
  });
});
