import { describe, it, expect } from "vitest";
import { colorTextoSobre, contrasteSuficiente } from "../tema";
import { COLOR_EXITO, COLOR_EXITO_BLOQUE } from "./acento";

// Ronda K (revisión real en staging, 19 nov 2026): BotonEstado.tsx
// usaba "#fff" fijo para el estado activo (nunca colorTextoSobre()) --
// blanco sobre COLOR_EXITO da solo 1.98:1, muy por debajo de los
// 4.5:1 de contrasteSuficiente(). colorTextoSobre(COLOR_EXITO) por sí
// solo YA elegiría texto casi negro (pasa de sobra, 8.78:1) -- pero
// eso cambiaría el estilo de "texto blanco sobre botón de marca" que
// el resto del proyecto usa. Para mantener texto BLANCO y aun así
// pasar el contraste, el fondo cambia a COLOR_EXITO_BLOQUE (la
// variante ya verificada para esto, ver acento.ts).
describe("contraste del botón activo (CTA/cursor_clic, fondo de éxito)", () => {
  it("COLOR_EXITO_BLOQUE + colorTextoSobre() da texto BLANCO y pasa contrasteSuficiente()", () => {
    const texto = colorTextoSobre(COLOR_EXITO_BLOQUE);
    expect(texto.toLowerCase()).toBe("#ffffff");
    expect(contrasteSuficiente(texto, COLOR_EXITO_BLOQUE)).toBe(true);
  });

  it("COLOR_EXITO a secas fuerza texto casi negro para pasar -- por eso no se usa si se quiere texto blanco", () => {
    const texto = colorTextoSobre(COLOR_EXITO);
    expect(texto.toLowerCase()).not.toBe("#ffffff");
    expect(contrasteSuficiente(texto, COLOR_EXITO)).toBe(true);
  });
});
