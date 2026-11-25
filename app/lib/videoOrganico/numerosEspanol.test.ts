import { describe, expect, it } from "vitest";
import { tokensNormalizados } from "./numerosEspanol";
import { palabrasFaltantes } from "./palabrasFaltantes";

const n = (t: string) => tokensNormalizados(t).map((x) => x.n).join(" ");
// Caso real (episodio 1): la narración en letras, Whisper en dígitos.
const E2 = [{ id: "e2", narracion: "Ya gastaste trescientos mil pesos y nada." }];

describe("control de voz: números en letras vs. dígitos", () => {
  it.each(["300.000", "300 mil", "300000", "300,000", "$300.000"])("'trescientos mil pesos' coincide con Whisper '%s'", (oido) => {
    const pesos = oido.startsWith("$") ? "" : " pesos";
    expect(palabrasFaltantes(E2, `Ya gastaste ${oido}${pesos} y nada.`)).toEqual([]);
  });

  it("un número distinto sí falta (los números no se comparan como 'parecidos')", () => {
    expect(palabrasFaltantes(E2, "Ya gastaste 30.000 pesos y nada.")).toEqual([{ palabra: "trescientos mil", escena_id: "e2", primeraDeFrase: false }]);
  });

  it("normaliza a dígitos en los dos lados", () => {
    expect(n("trescientos mil")).toBe("300000");
    expect(n("dos millones trescientos mil")).toBe("2300000");
    expect(n("2 millones")).toBe("2000000");
    expect(n("1.500.000")).toBe("1500000");
    expect(n("mil quinientos")).toBe("1500");
    expect(n("dos mil dos")).toBe("2002");
    expect(n("treinta y cinco clientes")).toBe("35 clientes");
    expect(n("veinte por ciento")).toBe("20 por ciento");
    expect(n("20%")).toBe("20 por ciento");
    expect(n("$50.000")).toBe("50000 pesos");
    expect(n("cinco cinco")).toBe("5 5");
    expect(n("el constructor de tiendas")).toBe("el constructor de tiendas");
  });

  it("palabras de siempre sin cambios", () => {
    expect(n("Hola, ¿cómo estás?")).toBe("hola como estas");
  });
});
