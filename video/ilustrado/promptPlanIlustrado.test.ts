import { describe, expect, it } from "vitest";
import { construirPromptPlanIlustrado } from "./promptPlanIlustrado";
import { CATALOGO, ID_ESCENAS } from "./motor/catalogo";

describe("prompt del plan ilustrado", () => {
  const prompt = construirPromptPlanIlustrado([{ id: "e1", narracion: "Pagas anuncios y nadie te compra" }]);

  it("trae todo el catálogo y la narración con cada palabra numerada", () => {
    for (const e of ID_ESCENAS) for (const a of Object.keys(CATALOGO[e].acciones).filter((x) => x !== "micro")) expect(prompt).toContain(a);
    // La micro-acción la inserta el código, no la IA.
    expect(prompt).not.toMatch(/· micro:/);
    expect(prompt).toContain("e1: [0]Pagas [1]anuncios [2]y [3]nadie [4]te [5]compra");
  });

  it("prohíbe inventar datos y texto en pantalla", () => {
    expect(prompt).toMatch(/Nunca inventes datos/);
    expect(prompt).toMatch(/no muestran precios, descuentos, reseñas, horarios ni promesas/);
    expect(prompt).toMatch(/nunca texto/);
  });

  it("en el reintento incluye los problemas del intento anterior", () => {
    expect(construirPromptPlanIlustrado([{ id: "e1", narracion: "Hola" }], ["e1: palabra 9 fuera de rango"])).toMatch(/CORRÍGELOS:\n- e1: palabra 9 fuera de rango/);
  });
});
