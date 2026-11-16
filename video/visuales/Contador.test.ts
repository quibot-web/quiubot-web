// Bug real encontrado con una prueba real en navegador (16 nov 2026,
// arnés de renderMediaOnWeb): un visual "contador" con un solo evento
// (permitido por el schema, min 1) hacía cuadroInicio === cuadroFin,
// y interpolate() tumbaba el render entero con "inputRange must be
// strictly monotonically increasing but got [0,0]".
import { describe, it, expect } from "vitest";
import { valorContadorEnFrame } from "./Contador";

describe("valorContadorEnFrame", () => {
  it("con cuadroInicio distinto de cuadroFin, interpola normalmente", () => {
    expect(valorContadorEnFrame(0, 0, 10, 0, 3)).toBe(0);
    expect(valorContadorEnFrame(10, 0, 10, 0, 3)).toBe(3);
    expect(valorContadorEnFrame(5, 0, 10, 0, 3)).toBe(2);
  });

  it("con cuadroInicio === cuadroFin (un solo evento), salta directo a 'hasta' sin lanzar", () => {
    expect(() => valorContadorEnFrame(0, 0, 0, 0, 3)).not.toThrow();
    expect(valorContadorEnFrame(0, 0, 0, 0, 3)).toBe(3);
    expect(valorContadorEnFrame(5, 0, 0, 0, 3)).toBe(3);
  });

  it("con cuadroInicio === cuadroFin, antes de ese cuadro se queda en 'desde'", () => {
    expect(valorContadorEnFrame(2, 5, 5, 0, 3)).toBe(0);
    expect(valorContadorEnFrame(5, 5, 5, 0, 3)).toBe(3);
  });
});
