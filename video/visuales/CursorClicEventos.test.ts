// Bug real encontrado con una prueba real en navegador (16 nov 2026,
// arnés de renderMediaOnWeb): "aparece" y "clic" apuntando al mismo
// cuadro (palabras distintas que redondearon al mismo cuadro en el
// audio real) hacía que interpolate() tumbara el render entero con
// "inputRange must be strictly monotonically increasing".
import { describe, it, expect } from "vitest";
import { calcularLlegadaCursor } from "./CursorClicEventos";

describe("calcularLlegadaCursor", () => {
  it("con cuadroAparece distinto de cuadroClic, interpola normalmente", () => {
    expect(calcularLlegadaCursor(0, 0, 10)).toBe(0);
    expect(calcularLlegadaCursor(10, 0, 10)).toBe(1);
    expect(calcularLlegadaCursor(5, 0, 10)).toBeCloseTo(0.5);
  });

  it("con cuadroAparece === cuadroClic, salta directo a 1 sin lanzar", () => {
    expect(() => calcularLlegadaCursor(0, 0, 0)).not.toThrow();
    expect(calcularLlegadaCursor(0, 0, 0)).toBe(1);
    expect(calcularLlegadaCursor(20, 15, 15)).toBe(1);
  });

  it("con cuadroAparece === cuadroClic, antes de ese cuadro se queda en 0", () => {
    expect(calcularLlegadaCursor(2, 5, 5)).toBe(0);
  });
});
