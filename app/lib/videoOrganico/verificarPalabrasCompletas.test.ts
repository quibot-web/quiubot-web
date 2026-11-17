import { describe, it, expect } from "vitest";
import { verificarPalabrasCompletas } from "./verificarPalabrasCompletas";

describe("verificarPalabrasCompletas", () => {
  it("todas las palabras dentro de sus tramos: sin hallazgos", () => {
    const palabras = [
      { texto: "Hola", inicio_s: 0, fin_s: 0.3 },
      { texto: "mundo", inicio_s: 0.3, fin_s: 0.6 },
    ];
    const tramos = [[{ original: { inicio_s: 0, fin_s: 0.6 }, compactado: { inicio_s: 0, fin_s: 0.6 } }]];
    expect(verificarPalabrasCompletas(palabras, tramos)).toEqual([]);
  });

  it("una palabra fuera de todo tramo conservado (caso real: se compactó justo encima de ella) se reporta", () => {
    const palabras = [
      { texto: "conecta", inicio_s: 9.0, fin_s: 9.4 },
      { texto: "el", inicio_s: 9.4, fin_s: 9.5 },
    ];
    // Tramo cortado DEMASIADO adentro -- a propósito, para probar que el detector dispara: "conecta" queda a medias.
    const tramos = [[{ original: { inicio_s: 9.2, fin_s: 9.5 }, compactado: { inicio_s: 9.2, fin_s: 9.5 } }]];
    const hallazgos = verificarPalabrasCompletas(palabras, tramos);
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].palabra).toBe("conecta");
  });

  it("palabra repartida entre 2 tramos (ninguno la cubre completa) también se reporta", () => {
    const palabras = [{ texto: "responde", inicio_s: 5.0, fin_s: 5.5 }];
    const tramos = [
      [{ original: { inicio_s: 4.0, fin_s: 5.2 }, compactado: { inicio_s: 4.0, fin_s: 5.2 } }],
      [{ original: { inicio_s: 5.3, fin_s: 6.0 }, compactado: { inicio_s: 5.3, fin_s: 6.0 } }],
    ];
    expect(verificarPalabrasCompletas(palabras, tramos)).toHaveLength(1);
  });

  it("lista vacía de palabras no genera hallazgos", () => {
    expect(verificarPalabrasCompletas([], [])).toEqual([]);
  });
});
