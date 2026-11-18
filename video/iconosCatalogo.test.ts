import { describe, expect, it } from "vitest";
import { coloresIconoSobreBlanco, resolverIcono } from "./iconosCatalogo";
import { NOMBRES_ICONOS } from "./nombresIconos";
import type { TemaGuion } from "./tema";

const tema = (primario: string, secundario: string) => ({ color_primario: primario, color_secundario: secundario }) as TemaGuion;

describe("catálogo de íconos", () => {
  it("un nombre del catálogo se usa tal cual", () => {
    expect(resolverIcono("reloj_arena")).toBe("reloj_arena");
  });

  it("guiones guardados con emoji: se traducen al ícono equivalente, nunca se pinta el emoji", () => {
    expect(resolverIcono("🌑")).toBe("luna");
    expect(resolverIcono("☀️")).toBe("sol");
    expect(resolverIcono("⏳")).toBe("reloj_arena");
    expect(resolverIcono("📅")).toBe("calendario");
    expect(resolverIcono("🦄")).toBe("destellos");
  });

  it("hay suficientes íconos para variar (y ningún nombre repetido)", () => {
    expect(NOMBRES_ICONOS.length).toBeGreaterThanOrEqual(80);
    expect(new Set(NOMBRES_ICONOS).size).toBe(NOMBRES_ICONOS.length);
  });

  it("trazo: el color de marca más legible sobre blanco; paleta muy clara cae a gris oscuro", () => {
    expect(coloresIconoSobreBlanco(tema("#534AB7", "#B9B2FF"))).toEqual({ trazo: "#534AB7", acento: "#B9B2FF" });
    expect(coloresIconoSobreBlanco(tema("#FFF3C4", "#FFE08A")).trazo).toBe("#2B2B2B");
  });
});
