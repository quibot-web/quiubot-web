// Parte 2b: textos parametrizables en los 3 visuales de 2 estados.
import { describe, it, expect } from "vitest";
import { VisualSchema, LIMITES_TEXTO_VISUAL, TIPOS_VISUAL_DOS_ESTADOS } from "./schema";

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

describe("parte 2c: comparacion e icono_palabra", () => {
  it("comparacion exige los dos textos; las etiquetas son opcionales", () => {
    expect(VisualSchema.safeParse({ tipo: "comparacion", texto_mal: "Fondo desordenado", texto_bien: "Fondo liso", eventos: evento }).success).toBe(true);
    expect(VisualSchema.safeParse({ tipo: "comparacion", texto_mal: "Fondo desordenado", eventos: evento }).success).toBe(false);
    expect(VisualSchema.safeParse({ tipo: "comparacion", texto_mal: "a".repeat(LIMITES_TEXTO_VISUAL.comparacion.texto + 1), texto_bien: "b", eventos: evento }).success).toBe(false);
  });

  it("icono_palabra exige los 2 íconos (nombres del catálogo) y las 2 palabras, con su límite", () => {
    const base = { tipo: "icono_palabra", icono_antes: "luna", palabra_antes: "Oscura", icono_despues: "sol", palabra_despues: "Con luz", eventos: evento };
    expect(VisualSchema.safeParse(base).success).toBe(true);
    // Un emoji solo se acepta para que los guiones guardados sigan válidos.
    expect(VisualSchema.safeParse({ ...base, icono_antes: "🌑" }).success).toBe(true);
    expect(VisualSchema.safeParse({ ...base, icono_antes: "lunita" }).success).toBe(false);
    expect(VisualSchema.safeParse({ ...base, palabra_despues: "a".repeat(LIMITES_TEXTO_VISUAL.icono_palabra.palabra + 1) }).success).toBe(false);
    expect(VisualSchema.safeParse({ ...base, palabra_antes: "Mal ✗" }).success).toBe(false);
  });

  it("los visuales nuevos de 2 estados son 1 solo evento cambia_estado", () => {
    const dos = [...evento, { palabra: 4, accion: "cambia_estado" as const }];
    expect(VisualSchema.safeParse({ tipo: "comparacion", texto_mal: "a", texto_bien: "b", eventos: dos }).success).toBe(false);
  });

  it("la lista única de visuales para un consejo incluye los nuevos y deja afuera los de 1 estado y el del gancho", () => {
    expect(TIPOS_VISUAL_DOS_ESTADOS).toEqual(expect.arrayContaining(["comparacion", "icono_palabra", "anuncio_boton", "respuesta_lenta", "conexion_whatsapp", "contador"]));
    for (const fuera of ["boton_estado", "cursor_clic", "celular_chat"]) {
      expect(TIPOS_VISUAL_DOS_ESTADOS as readonly string[]).not.toContain(fuera);
    }
  });
});

describe("parte 2d: checklist y comparacion_foto", () => {
  it("checklist: 2 o 3 ítems con su límite, título opcional", () => {
    expect(VisualSchema.safeParse({ tipo: "checklist", items: ["Luz natural", "Fondo liso"], eventos: evento }).success).toBe(true);
    expect(VisualSchema.safeParse({ tipo: "checklist", titulo: "Antes de publicar", items: ["a", "b", "c"], eventos: evento }).success).toBe(true);
    expect(VisualSchema.safeParse({ tipo: "checklist", items: ["solo uno"], eventos: evento }).success).toBe(false);
    expect(VisualSchema.safeParse({ tipo: "checklist", items: ["a", "b", "c", "d"], eventos: evento }).success).toBe(false);
    expect(VisualSchema.safeParse({ tipo: "checklist", items: ["a", "b".repeat(LIMITES_TEXTO_VISUAL.checklist.item + 1)], eventos: evento }).success).toBe(false);
  });

  it("comparacion_foto exige media_id y los dos textos", () => {
    expect(VisualSchema.safeParse({ tipo: "comparacion_foto", media_id: "foto-1", texto_mal: "Oscura", texto_bien: "Con luz", eventos: evento }).success).toBe(true);
    expect(VisualSchema.safeParse({ tipo: "comparacion_foto", texto_mal: "Oscura", texto_bien: "Con luz", eventos: evento }).success).toBe(false);
  });
});
