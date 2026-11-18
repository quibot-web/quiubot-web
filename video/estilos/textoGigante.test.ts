import { describe, expect, it } from "vitest";
import { ajustarTextoGigante, indicesPalabraClave } from "./textoGigante";

// Medida falsa: cada carácter mide 0.6 del tamaño.
const medir = (t: string, tamano: number) => t.length * tamano * 0.6;
const opciones = { ancho: 900, alto: 600, maxLineas: 4, tamanoMin: 72, tamanoMax: 170, interlineado: 1.05 };

describe("ajustarTextoGigante", () => {
  it("texto corto: tamaño máximo", () => {
    expect(ajustarTextoGigante("¿Fotos oscuras?", medir, opciones).tamano).toBe(170);
  });

  it("texto largo (60 car.): baja el tamaño hasta que cabe en 4 líneas y en el alto, nunca menos del mínimo", () => {
    const { tamano, lineas } = ajustarTextoGigante("Ocultar el precio deja tu anuncio incompleto y nadie compra", medir, opciones);
    expect(lineas.length).toBeLessThanOrEqual(4);
    expect(tamano).toBeGreaterThanOrEqual(72);
    for (const l of lineas) expect(medir(l, tamano)).toBeLessThanOrEqual(900);
  });
});

describe("indicesPalabraClave", () => {
  it("encuentra la palabra clave seguida, sin tildes ni puntuación", () => {
    expect([...indicesPalabraClave(["¿Fotos", "oscuras?", "Del", "antes"], "Fotos oscuras")]).toEqual([0, 1]);
    expect([...indicesPalabraClave(["Usa", "“desde”", "con", "el", "monto", "mínimo", "real"], "monto minimo real")]).toEqual([4, 5, 6]);
  });

  it("si no aparece, nada resaltado", () => {
    expect(indicesPalabraClave(["Hola"], "precio").size).toBe(0);
  });
});
