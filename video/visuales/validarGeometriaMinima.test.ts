// Regla de escala pedida explícita (revisión de staging, 16 nov
// 2026): "contador" standalone quedaba como una insignia de 130px
// perdida en fondo vacío, y los subtítulos a 38px -- esto comprueba
// que los números reales del molde (no los del guion, que cambian
// cada vez) siguen cumpliendo 70-85% de ancho y >=40px de fuente.
import { describe, it, expect } from "vitest";
import { validarGeometriaMinima, compararGeometria } from "./validarGeometriaMinima";

describe("validarGeometriaMinima", () => {
  it("con la geometría real del molde (tal cual quedó en el código), no hay hallazgos", () => {
    expect(validarGeometriaMinima()).toHaveLength(0);
  });
});

describe("compararGeometria", () => {
  it("con un ancho de tarjeta y tamaños de fuente dentro de lo exigido, no hay hallazgos", () => {
    expect(compararGeometria(80, [{ nombre: "x", valor: 44 }])).toHaveLength(0);
    expect(compararGeometria(70, [{ nombre: "x", valor: 40 }])).toHaveLength(0); // límites inclusive
    expect(compararGeometria(85, [{ nombre: "x", valor: 40 }])).toHaveLength(0);
  });

  it("caso real: una tarjeta de 130px en un lienzo de 1080 -- ancho muy por debajo del mínimo", () => {
    const hallazgos = compararGeometria(12, []); // 130/1080*100 ~= 12%
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].elemento).toBe("TARJETA_ANCHO_PORCENTAJE");
  });

  it("ancho por encima del máximo también es un hallazgo (no solo 'muy chico')", () => {
    expect(compararGeometria(95, [])).toHaveLength(1);
  });

  it("caso real: subtítulos a 38px -- por debajo del mínimo de 40px", () => {
    const hallazgos = compararGeometria(80, [{ nombre: "SubtitulosSincronizados.TAMANO_FUENTE_SUBTITULOS", valor: 38 }]);
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].mensaje).toContain("38px");
  });

  it("reporta varios hallazgos a la vez si hay más de uno", () => {
    const hallazgos = compararGeometria(50, [{ nombre: "a", valor: 30 }, { nombre: "b", valor: 44 }]);
    expect(hallazgos).toHaveLength(2);
  });
});
