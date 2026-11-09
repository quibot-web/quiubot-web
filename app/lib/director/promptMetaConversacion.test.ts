// Pura (sin Supabase) -- confirma que el campo "producto" del prompt
// nunca ofrece nombres inventados: sin catálogo, el texto dice que no
// hay nada guardado; con catálogo, lista exactamente esos nombres
// reales y ninguno más.
import { describe, it, expect } from "vitest";
import { construirPromptMetaConversacion, type ContextoNegocioDirector } from "./promptMetaConversacion";
import type { BorradorMeta } from "./borradorMeta.schema";

const CONTEXTO_BASE: ContextoNegocioDirector = {
  nombreNegocio: "Tienda de Juan",
  adnTitular: null,
  adnFraseCorta: null,
  paisCobertura: "CO",
  ciudadesCobertura: [],
  metaAnteriorResumen: null,
  productos: [],
};

const BORRADOR_VACIO: BorradorMeta = {};

describe("construirPromptMetaConversacion", () => {
  it("sin productos guardados, dice que no tiene ninguno y nunca menciona nombres de ejemplo típicos", () => {
    const prompt = construirPromptMetaConversacion(CONTEXTO_BASE, BORRADOR_VACIO);
    expect(prompt).toContain("Todavía no tiene ningún producto o servicio guardado.");
    // Nombres de ejemplo que un prompt genérico podría inventar -- no
    // deben aparecer en ningún lado del texto armado.
    expect(prompt).not.toMatch(/producto a\b/i);
    expect(prompt).not.toMatch(/servicio x\b/i);
  });

  it("con productos guardados, los lista por su nombre real tal cual vienen del catálogo", () => {
    const contexto: ContextoNegocioDirector = {
      ...CONTEXTO_BASE,
      productos: [
        { nombre: "Camiseta Azul", tipo: "producto" },
        { nombre: "Asesoría de marca", tipo: "servicio" },
      ],
    };
    const prompt = construirPromptMetaConversacion(contexto, BORRADOR_VACIO);
    expect(prompt).toContain("Productos y servicios guardados: Camiseta Azul, Asesoría de marca.");
    expect(prompt).not.toContain("Todavía no tiene ningún producto o servicio guardado.");
  });

  it("instruye explícitamente a nunca inventar nombres de ejemplo", () => {
    const prompt = construirPromptMetaConversacion(CONTEXTO_BASE, BORRADOR_VACIO);
    expect(prompt).toContain("nunca inventes nombres de ejemplo");
  });
});
