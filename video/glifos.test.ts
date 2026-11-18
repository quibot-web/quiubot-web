import { describe, expect, it } from "vitest";
import { caracterEnFuentes, quitarGlifosFueraDeFuentes } from "./glifos";

describe("quitarGlifosFueraDeFuentes", () => {
  it("deja intacto el español normal", () => {
    const texto = "¿Cuánto vale? ¡Envío gratis! Ñandú, 45.000 — “sí”…";
    expect(quitarGlifosFueraDeFuentes(texto)).toBe(texto);
  });

  it("quita emoji, ✓ ✗ y flechas sin dejar espacios dobles", () => {
    expect(quitarGlifosFueraDeFuentes("¡Sí, aquí tienes! 😊")).toBe("¡Sí, aquí tienes!");
    expect(quitarGlifosFueraDeFuentes("Antes ➡️ después ✓")).toBe("Antes después");
  });

  it("Latin Extendido-A no está en Bebas Neue: fuera", () => {
    expect(caracterEnFuentes("Č")).toBe(false);
    expect(caracterEnFuentes("µ")).toBe(false);
    expect(caracterEnFuentes("ñ")).toBe(true);
  });
});
