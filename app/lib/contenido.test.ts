// Pura, sin red -- confirma lunesDeLaSemana() (el agrupador real del
// calendario de /contenido) contra fechas reales conocidas, y que
// CrearPiezaManualSchema exige los campos reales de "Agregar reel".
import { describe, it, expect } from "vitest";
import { lunesDeLaSemana, labelReceta, CrearPiezaManualSchema } from "./contenido";

describe("lunesDeLaSemana", () => {
  it("un miércoles cae en el lunes de esa misma semana", () => {
    expect(lunesDeLaSemana("2026-11-11")).toBe("2026-11-09");
  });

  it("el propio lunes se devuelve a sí mismo", () => {
    expect(lunesDeLaSemana("2026-11-09")).toBe("2026-11-09");
  });

  it("un domingo cae en el lunes de la semana que está terminando, no en el que sigue", () => {
    expect(lunesDeLaSemana("2026-11-15")).toBe("2026-11-09");
  });

  it("el lunes siguiente ya es otra semana", () => {
    expect(lunesDeLaSemana("2026-11-16")).toBe("2026-11-16");
  });
});

describe("labelReceta", () => {
  it("devuelve la etiqueta real de una receta conocida", () => {
    expect(labelReceta("mito_verdad")).toBe("Mito o verdad");
  });
});

describe("CrearPiezaManualSchema", () => {
  it("acepta una pieza manual válida", () => {
    const r = CrearPiezaManualSchema.safeParse({ receta_organica: "consejos_numerados", programada_para: "2026-11-20T15:00:00-05:00" });
    expect(r.success).toBe(true);
  });

  it("rechaza una receta que no existe", () => {
    const r = CrearPiezaManualSchema.safeParse({ receta_organica: "inventada", programada_para: "2026-11-20T15:00:00-05:00" });
    expect(r.success).toBe(false);
  });

  it("rechaza una fecha sin offset de zona horaria", () => {
    const r = CrearPiezaManualSchema.safeParse({ receta_organica: "consejos_numerados", programada_para: "no es una fecha" });
    expect(r.success).toBe(false);
  });
});
