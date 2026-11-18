// Parte 2b: textos parametrizables en los 3 visuales de 2 estados.
import { describe, it, expect } from "vitest";
import { VisualSchema, LIMITES_TEXTO_VISUAL } from "./schema";

const evento = [{ palabra: 2, accion: "cambia_estado" as const }];

describe("visuales de 2 estados con textos propios", () => {
  it("sin textos sigue siendo válido (guiones ya guardados se ven igual que antes)", () => {
    for (const tipo of ["anuncio_boton", "conexion_whatsapp", "respuesta_lenta"] as const) {
      expect(VisualSchema.safeParse({ tipo, eventos: evento }).success).toBe(true);
    }
  });

  it("acepta textos según el tema (ej. fotos de producto, envíos)", () => {
    expect(
      VisualSchema.safeParse({ tipo: "anuncio_boton", icono: "📷", etiqueta: "Publicación", texto_problema: "Foto oscura y borrosa", texto_arreglo: "Foto con luz natural", eventos: evento }).success
    ).toBe(true);
    expect(
      VisualSchema.safeParse({ tipo: "respuesta_lenta", pregunta_cliente: "¿Hacen envíos a Cali?", respuesta: "¡Sí! Llega en 2 días 😊", confirmacion: "Perfecto, te pago ya", eventos: evento }).success
    ).toBe(true);
    expect(VisualSchema.safeParse({ tipo: "conexion_whatsapp", icono: "🛍️", etiqueta: "Catálogo", texto_problema: "Nadie pregunta", mensaje: "¿Cuánto vale la taza azul?", eventos: evento }).success).toBe(true);
  });

  it("rechaza textos más largos que su límite (no caben en el visual)", () => {
    const largo = "a".repeat(LIMITES_TEXTO_VISUAL.anuncio_boton.texto_arreglo + 1);
    expect(VisualSchema.safeParse({ tipo: "anuncio_boton", texto_arreglo: largo, eventos: evento }).success).toBe(false);
    const pregunta = "a".repeat(LIMITES_TEXTO_VISUAL.respuesta_lenta.pregunta_cliente + 1);
    expect(VisualSchema.safeParse({ tipo: "respuesta_lenta", pregunta_cliente: pregunta, eventos: evento }).success).toBe(false);
  });

  it("rechaza flechas y marcas de texto que las fuentes no dibujan (→ ✓ ✗ ↓), acepta su emoji", () => {
    for (const malo of ["Antes → después", "Listo ✓", "✗ Sin precio", "Baja ↓", "价格"]) {
      expect(VisualSchema.safeParse({ tipo: "anuncio_boton", texto_problema: malo, eventos: evento }).success).toBe(false);
    }
    for (const bueno of ["Listo ✔️", "❌ Sin precio", "Desde $45.000", "Ñapa 100% gratis"]) {
      expect(VisualSchema.safeParse({ tipo: "anuncio_boton", texto_problema: bueno, eventos: evento }).success).toBe(true);
    }
  });

  it("icono: un solo emoji, nunca texto ni varios emoji", () => {
    expect(VisualSchema.safeParse({ tipo: "anuncio_boton", icono: "👩‍🍳", eventos: evento }).success).toBe(true);
    for (const malo of ["Foto", "📷📷", "", "📷 foto"]) {
      expect(VisualSchema.safeParse({ tipo: "anuncio_boton", icono: malo, eventos: evento }).success).toBe(false);
    }
  });

  it("texto vacío o solo espacios: rechazado (mejor omitirlo y usar el de siempre)", () => {
    expect(VisualSchema.safeParse({ tipo: "respuesta_lenta", respuesta: "   ", eventos: evento }).success).toBe(false);
  });
});
