import { describe, it, expect } from "vitest";
import { ajustarDuracionesProporcional, limpiarHashtags } from "./arreglosAutomaticosGuion";

describe("ajustarDuracionesProporcional", () => {
  it("no toca nada si la suma ya está dentro de los 2s de margen", () => {
    const escenas = [{ duracion_s: 2.3 }, { duracion_s: 5 }, { duracion_s: 4.5 }, { duracion_s: 4 }];
    const resultado = ajustarDuracionesProporcional(escenas, 16) as { duracion_s: number }[];
    expect(resultado.map((e) => e.duracion_s)).toEqual([2.3, 5, 4.5, 4]);
  });

  it("reescala proporcionalmente cuando la suma se aleja del objetivo, respetando los topes (gancho <=2.5, resto <=5)", () => {
    // Suma real: 10 (2+3+3+2), objetivo: 16 -- se aleja más de 2s.
    const escenas = [{ duracion_s: 2 }, { duracion_s: 3 }, { duracion_s: 3 }, { duracion_s: 2 }];
    const resultado = ajustarDuracionesProporcional(escenas, 16) as { duracion_s: number }[];
    // factor = 1.6 -> [3.2(tope 2.5), 4.8, 4.8, 3.2]
    expect(resultado[0].duracion_s).toBe(2.5); // gancho, tope distinto
    expect(resultado[1].duracion_s).toBe(4.8);
    expect(resultado[2].duracion_s).toBe(4.8);
    expect(resultado[3].duracion_s).toBe(3.2);
  });

  it("nunca baja del tope mínimo de 1.5s", () => {
    const escenas = [{ duracion_s: 5 }, { duracion_s: 5 }, { duracion_s: 5 }, { duracion_s: 5 }];
    // Objetivo muy chico -- el factor empujaría por debajo de 1.5, se queda en 1.5.
    const resultado = ajustarDuracionesProporcional(escenas, 4) as { duracion_s: number }[];
    for (const e of resultado) expect(e.duracion_s).toBeGreaterThanOrEqual(1.5);
  });

  it("no inventa ni borra escenas, ni toca otros campos", () => {
    const escenas = [{ id: "e1", bloque: "gancho", duracion_s: 2 }, { id: "e2", bloque: "cta", duracion_s: 2 }];
    const resultado = ajustarDuracionesProporcional(escenas, 16) as Record<string, unknown>[];
    expect(resultado.length).toBe(2);
    expect(resultado[0].id).toBe("e1");
    expect(resultado[1].bloque).toBe("cta");
  });

  it("si falta duracion_s en alguna escena, no toca nada -- deja que zod reporte el campo real", () => {
    const escenas = [{ duracion_s: 2 }, { otraCosa: true }];
    const resultado = ajustarDuracionesProporcional(escenas, 16);
    expect(resultado).toEqual(escenas);
  });

  it("si no es un array, lo devuelve tal cual", () => {
    expect(ajustarDuracionesProporcional(null, 16)).toBe(null);
    expect(ajustarDuracionesProporcional("no un array", 16)).toBe("no un array");
  });
});

describe("limpiarHashtags", () => {
  it("quita duplicados sin importar mayúsculas ni el símbolo #", () => {
    const resultado = limpiarHashtags(["#Marketing", "marketing", "#MARKETING", "#ventas"]);
    expect(resultado).toEqual(["#Marketing", "#ventas"]);
  });

  it("recorta a 8 si sobran, sin tocar el orden", () => {
    const hashtags = Array.from({ length: 10 }, (_, i) => `#tag${i}`);
    const resultado = limpiarHashtags(hashtags);
    expect(resultado).toHaveLength(8);
    expect(resultado).toEqual(hashtags.slice(0, 8));
  });

  it("nunca agrega hashtags aunque falten -- eso necesita contenido real de la IA", () => {
    const resultado = limpiarHashtags(["#uno"]);
    expect(resultado).toEqual(["#uno"]);
  });

  it("si no es un array, devuelve null para que zod reporte el error real", () => {
    expect(limpiarHashtags("no un array")).toBe(null);
    expect(limpiarHashtags(null)).toBe(null);
  });

  it("agrega # a un hashtag que llegó sin él", () => {
    expect(limpiarHashtags(["marketing"])).toEqual(["#marketing"]);
  });
});
