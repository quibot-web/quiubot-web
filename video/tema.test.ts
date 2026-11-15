// Prueba solo mezclarColoresHex (nueva, para el "arco de color" de
// contenido orgánico) -- el resto de tema.ts ya se cubre indirectamente
// en las pruebas de las rutas de guion.
import { describe, it, expect } from "vitest";
import { mezclarColoresHex } from "./tema";

describe("mezclarColoresHex", () => {
  it("t=0 devuelve el primer color tal cual", () => {
    expect(mezclarColoresHex("#000000", "#ffffff", 0)).toBe("#000000");
  });

  it("t=1 devuelve el segundo color tal cual", () => {
    expect(mezclarColoresHex("#000000", "#ffffff", 1)).toBe("#ffffff");
  });

  it("t=0.5 es el punto medio real", () => {
    expect(mezclarColoresHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("recorta t fuera de [0,1] en vez de extrapolar", () => {
    expect(mezclarColoresHex("#000000", "#ffffff", 2)).toBe("#ffffff");
    expect(mezclarColoresHex("#000000", "#ffffff", -1)).toBe("#000000");
  });
});
