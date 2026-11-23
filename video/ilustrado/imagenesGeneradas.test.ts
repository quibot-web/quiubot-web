import { describe, expect, it } from "vitest";
import { pixelApagado, pixelClaro } from "./imagenesGeneradas";

const luminancia = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const saturacion = ([r, g, b]: number[]) => Math.max(r, g, b) - Math.min(r, g, b);
// Colores típicos de una foto de producto: cerámica gris clara, fondo
// neutro, sombra, madera.
const MUESTRAS = [
  [200, 198, 192],
  [150, 148, 145],
  [90, 88, 85],
  [180, 140, 100],
  [230, 225, 215],
];

describe("foto apagada vs. clara (horneadas, sin filter)", () => {
  it("la apagada es oscura y casi sin color", () => {
    for (const m of MUESTRAS) {
      const a = pixelApagado(m[0], m[1], m[2]);
      expect(luminancia(a)).toBeLessThan(luminancia(m) * 0.45);
      expect(saturacion(a)).toBeLessThan(Math.max(12, saturacion(m) * 0.2)); // con un tinte frío leve
    }
  });

  it("la clara es más luminosa y más cálida que la original", () => {
    for (const m of MUESTRAS) {
      const c = pixelClaro(m[0], m[1], m[2]);
      expect(luminancia(c)).toBeGreaterThanOrEqual(Math.min(250, luminancia(m)));
      expect(c[0] - c[2]).toBeGreaterThan(m[0] - m[2]); // más rojo que azul: cálida
    }
  });

  it("entre apagada y clara hay al menos 2,5 veces de diferencia de luminosidad", () => {
    for (const m of MUESTRAS) expect(luminancia(pixelClaro(m[0], m[1], m[2])) / Math.max(1, luminancia(pixelApagado(m[0], m[1], m[2])))).toBeGreaterThanOrEqual(2.5);
  });
});
