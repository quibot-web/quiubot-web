import { describe, it, expect } from "vitest";
import { compactarPausas, construirTramosAudio, MAX_PAUSA_S, MARGEN_CORTE_S } from "./compactarPausas";

describe("compactarPausas", () => {
  it("sin huecos grandes, el tiempo compactado es igual al original", () => {
    const palabras = [
      { texto: "Hola", inicio_s: 0, fin_s: 0.3 },
      { texto: "mundo", inicio_s: 0.3, fin_s: 0.6 },
      { texto: "bien", inicio_s: 0.7, fin_s: 1.0 }, // hueco de 0.1s, bajo el tope
    ];
    const resultado = compactarPausas(palabras);
    for (const p of resultado) expect(p.compactado).toEqual(p.original);
  });

  it("un hueco interno de 0.56s se recorta a 0.25s, y el corrimiento afecta a TODO lo que viene después", () => {
    // Caso real medido: "mensajes" (fin 1.06) -> "aunque" (inicio 1.62).
    const palabras = [
      { texto: "¿Cero", inicio_s: 0, fin_s: 0.52 },
      { texto: "mensajes", inicio_s: 0.52, fin_s: 1.06 },
      { texto: "aunque", inicio_s: 1.62, fin_s: 1.7 },
      { texto: "tus", inicio_s: 1.7, fin_s: 1.96 },
    ];
    const resultado = compactarPausas(palabras, 0.25);
    expect(resultado[0].compactado).toEqual({ inicio_s: 0, fin_s: 0.52 });
    expect(resultado[1].compactado).toEqual({ inicio_s: 0.52, fin_s: 1.06 });
    // hueco original 0.56s -> compactado a 0.25s: arranca en 1.06+0.25=1.31
    expect(resultado[2].compactado.inicio_s).toBeCloseTo(1.31, 5);
    expect(resultado[2].compactado.fin_s - resultado[2].compactado.inicio_s).toBeCloseTo(0.08, 5); // duración propia intacta
    // la siguiente palabra se corre por el mismo corrimiento acumulado (0.31s)
    expect(resultado[3].compactado.inicio_s).toBeCloseTo(1.39, 5);
  });

  it("un hueco justo en el tope (0.25s) no se toca", () => {
    const palabras = [
      { texto: "a", inicio_s: 0, fin_s: 0.2 },
      { texto: "b", inicio_s: 0.45, fin_s: 0.6 }, // hueco exacto de 0.25s
    ];
    const resultado = compactarPausas(palabras, 0.25);
    expect(resultado[1].compactado).toEqual(resultado[1].original);
  });

  it("varios huecos grandes acumulan corrimiento, no se pisan entre sí", () => {
    const palabras = [
      { texto: "a", inicio_s: 0, fin_s: 0.2 },
      { texto: "b", inicio_s: 1.2, fin_s: 1.4 }, // hueco de 1.0s -> recorta 0.75s
      { texto: "c", inicio_s: 2.4, fin_s: 2.6 }, // hueco original real: 1.0s -> recorta otros 0.75s
    ];
    const resultado = compactarPausas(palabras, 0.25);
    expect(resultado[1].compactado.inicio_s).toBeCloseTo(0.45, 5);
    expect(resultado[1].compactado.fin_s).toBeCloseTo(0.65, 5);
    expect(resultado[2].compactado.inicio_s).toBeCloseTo(0.9, 5);
    expect(resultado[2].compactado.fin_s).toBeCloseTo(1.1, 5);
  });

  it("un hueco entre dos palabras de ESCENAS distintas se recorta igual que uno interno (la función no conoce escenas)", () => {
    const palabras = [
      { texto: "publicados?", inicio_s: 2.82, fin_s: 3.38 }, // última de e1
      { texto: "Primero,", inicio_s: 4.24, fin_s: 4.68 }, // primera de e2 -- hueco real de 0.86s
    ];
    const resultado = compactarPausas(palabras, MAX_PAUSA_S);
    expect(resultado[1].compactado.inicio_s).toBeCloseTo(3.38 + MAX_PAUSA_S, 5);
  });
});

describe("construirTramosAudio", () => {
  it("una escena sin huecos internos da un solo tramo, con margen a los dos lados por defecto (no es ni la 1ra ni la última del reel)", () => {
    const palabras = compactarPausas([
      { texto: "a", inicio_s: 0.5, fin_s: 0.8 },
      { texto: "b", inicio_s: 0.8, fin_s: 1.1 },
    ]);
    const tramos = construirTramosAudio(palabras);
    expect(tramos).toHaveLength(1);
    expect(tramos[0].original.inicio_s).toBeCloseTo(0.5 - MARGEN_CORTE_S, 5);
    expect(tramos[0].original.fin_s).toBeCloseTo(1.1 + MARGEN_CORTE_S, 5);
  });

  it("margenAlInicio/margenAlFinal en false (bordes reales del reel completo) no agregan margen ahí", () => {
    const palabras = compactarPausas([
      { texto: "a", inicio_s: 0, fin_s: 0.3 },
      { texto: "b", inicio_s: 0.3, fin_s: 0.6 },
    ]);
    const tramos = construirTramosAudio(palabras, { margenAlInicio: false, margenAlFinal: false });
    expect(tramos).toHaveLength(1);
    expect(tramos[0].original).toEqual({ inicio_s: 0, fin_s: 0.6 });
  });

  it("un hueco interno grande dentro de la MISMA escena parte en 2 tramos, cada corte con margen (nunca se corta justo en el límite medido de la palabra)", () => {
    const palabras = compactarPausas([
      { texto: "¿Cero", inicio_s: 0, fin_s: 0.52 },
      { texto: "mensajes", inicio_s: 0.52, fin_s: 1.06 },
      { texto: "aunque", inicio_s: 1.62, fin_s: 1.7 },
    ]);
    const tramos = construirTramosAudio(palabras, { margenAlInicio: false, margenAlFinal: false });
    expect(tramos).toHaveLength(2);
    // tramo 1: sin margen al inicio (borde real del reel), con margen al final (es un corte)
    expect(tramos[0].original.inicio_s).toBeCloseTo(0, 5);
    expect(tramos[0].original.fin_s).toBeCloseTo(1.06 + MARGEN_CORTE_S, 5);
    // tramo 2: con margen al inicio (es el otro lado del mismo corte), sin margen al final (borde real)
    expect(tramos[1].original.inicio_s).toBeCloseTo(1.62 - MARGEN_CORTE_S, 5);
    expect(tramos[1].original.fin_s).toBeCloseTo(1.7, 5);
    // el silencio digital puro entre ambos tramos compactados = el hueco objetivo (0.25s) menos los 2 márgenes ya cubiertos con audio real
    const huecoCompactadoEntreTramos = tramos[1].compactado.inicio_s - tramos[0].compactado.fin_s;
    expect(huecoCompactadoEntreTramos).toBeCloseTo(MAX_PAUSA_S - 2 * MARGEN_CORTE_S, 5);
  });

  it("2*MARGEN_CORTE_S nunca supera MAX_PAUSA_S (si no, un corte se comería audio real del otro lado)", () => {
    expect(2 * MARGEN_CORTE_S).toBeLessThanOrEqual(MAX_PAUSA_S);
  });

  it("lista vacía da 0 tramos", () => {
    expect(construirTramosAudio([])).toEqual([]);
  });
});
