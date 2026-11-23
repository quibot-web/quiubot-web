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

  it("caso real (cd34eec3): Whisper estira 'y' sobre un silencio medido; quitar ese silencio no la pierde, pero quitar su parte con sonido sí", () => {
    const palabras = [{ texto: "y", inicio_s: 21.48, fin_s: 22.28 }];
    const silencios = [{ inicio_s: 21.584, fin_s: 21.871 }];
    const tramosOk = [
      { original: { inicio_s: 20, fin_s: 21.7 }, compactado: { inicio_s: 20, fin_s: 21.7 } },
      { original: { inicio_s: 21.75, fin_s: 23 }, compactado: { inicio_s: 21.7, fin_s: 22.95 } },
    ];
    expect(verificarPalabrasCompletas(palabras, [tramosOk], silencios)).toEqual([]);
    const tramosMuerden = [tramosOk[0], { original: { inicio_s: 21.95, fin_s: 23 }, compactado: { inicio_s: 21.7, fin_s: 22.75 } }];
    expect(verificarPalabrasCompletas(palabras, [tramosMuerden], silencios)).toHaveLength(1);
  });
});
