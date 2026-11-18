import { describe, expect, it } from "vitest";
import { ajustarTextoGigante, indicesPalabraClave, problemasTextoGigante, textoGiganteDeRespaldo } from "./textoGigante";
import { GuionSchema } from "../guion.schema";
import { fixtureConsejosNumerados } from "../fixtures/organico/consejosNumerados";

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

describe("texto_gigante: límites", () => {
  it("cortos y válidos", () => {
    for (const t of ["¿Fotos oscuras?", "¿Sin precio?", "Nadie te escribe"]) expect(problemasTextoGigante(t)).toEqual([]);
  });

  it("más de 4 palabras, más de 16 caracteres, palabra de más de 8 o emoji: problema", () => {
    expect(problemasTextoGigante("Ocultar el precio deja tu anuncio").length).toBeGreaterThan(0);
    expect(problemasTextoGigante("¿Fotos muy oscuras?").length).toBeGreaterThan(0);
    expect(problemasTextoGigante("¿DESCUENTOS?").length).toBeGreaterThan(0);
    expect(problemasTextoGigante("¿Sin precio? 💸").length).toBeGreaterThan(0);
  });

  it("el schema lo valida en cualquier escena", () => {
    const conTexto = (t: string) => ({ ...fixtureConsejosNumerados, escenas: fixtureConsejosNumerados.escenas.map((e, i) => (i === 0 ? { ...e, texto_gigante: t } : e)) });
    expect(GuionSchema.safeParse(conTexto("¿Sin precio?")).success).toBe(true);
    expect(GuionSchema.safeParse(conTexto("Ocultar el precio deja tu anuncio incompleto")).success).toBe(false);
  });

  it("respaldo para guiones guardados: primera frase si cumple, si no la palabra clave", () => {
    expect(textoGiganteDeRespaldo("¿Fotos oscuras? Del antes al después", "Fotos oscuras")).toBe("¿Fotos oscuras?");
    expect(textoGiganteDeRespaldo("Ocultar el precio deja tu anuncio incompleto", "precio")).toBe("precio");
    expect(problemasTextoGigante(textoGiganteDeRespaldo("Texto larguísimo sin cortes posibles", "palabras clave larguísimas que sobran"))).toEqual([]);
  });
});
