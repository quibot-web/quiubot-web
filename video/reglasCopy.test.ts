// Prueba solo las funciones nuevas (detectarFrasesVacias, detectarVerdadTibia)
// -- el resto de reglasCopy.ts ya se cubre indirectamente en las pruebas
// de las rutas de guion.
import { describe, it, expect } from "vitest";
import { detectarFrasesVacias, detectarVerdadTibia } from "./reglasCopy";

describe("detectarFrasesVacias", () => {
  it("atrapa frases de relleno conocidas (caso real: producto_en_uso con 'una forma más clara')", () => {
    expect(detectarFrasesVacias(["Mira una forma más clara de resolverlo"]).length).toBeGreaterThan(0);
    expect(detectarFrasesVacias(["Te mostramos una ruta clara"]).length).toBeGreaterThan(0);
    expect(detectarFrasesVacias(["Descubre más en el enlace"]).length).toBeGreaterThan(0);
  });

  it("no dice nada sobre un texto concreto", () => {
    expect(detectarFrasesVacias(["Activa la plantilla, elige el producto y publica en 2 minutos"])).toEqual([]);
  });

  it("ignora mayúsculas y tildes", () => {
    expect(detectarFrasesVacias(["UNA FORMA MÁS CLARA"]).length).toBeGreaterThan(0);
  });
});

describe("detectarVerdadTibia", () => {
  it("atrapa dudas en la respuesta de un mito (caso real: 'No necesariamente: puede apoyar')", () => {
    expect(detectarVerdadTibia(["No necesariamente: puede apoyar"]).length).toBeGreaterThan(0);
    expect(detectarVerdadTibia(["Depende de cómo se configure"]).length).toBeGreaterThan(0);
    expect(detectarVerdadTibia(["Puede que funcione así"]).length).toBeGreaterThan(0);
  });

  it("no dice nada sobre una afirmación firme", () => {
    expect(detectarVerdadTibia(["Nunca reemplaza a una persona: siempre apoya"])).toEqual([]);
  });
});
