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

describe("prompt del plan ilustrado con el kit de escenas (visuales-v2)", () => {
  const escenas = [{ id: "e1", narracion: "La profesora elige el dibujo que todos miran" }];
  const conKit = construirPromptPlanIlustrado(escenas, undefined, { conKit: true });
  const sinKit = construirPromptPlanIlustrado(escenas);

  it("solo con conKit trae las listas cerradas del kit, las acciones de grupo y el formato con composiciones", () => {
    expect(sinKit).not.toMatch(/KIT DE LUGARES/);
    expect(conKit).toMatch(/KIT DE LUGARES/);
    for (const t of ["profesora", "nino", "nina", "cartelera", "dulces", "pupitre", "sentado_en", "mira_a", "todos.aplaude", "<id>.senala", "objetivo"]) expect(conKit).toContain(t);
    expect(conKit).toMatch(/"composiciones":\[/);
  });

  it("le dice a la IA cuándo NO usar el kit, que lo visto no contradice la frase y que la cámara es automática", () => {
    expect(conKit).toMatch(/Si no, usa solo el catálogo: no fuerces el kit/);
    expect(conKit).toMatch(/no contradice la frase/);
    expect(conKit).toMatch(/La cámara es automática/);
    expect(conKit).toMatch(/Pon solo a los protagonistas/);
    expect(conKit).toMatch(/Nunca en fila/);
    expect(conKit).toContain("se_distrae");
    expect(conKit).toContain("pasa_de_largo");
    expect(conKit).toMatch(/no se vende solo/);
  });
});
