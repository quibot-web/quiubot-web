// productoParecido() es pura (sin Supabase) -- decide cuándo ofrecer
// "¿es el mismo que '...'?" en vez de dejar crear un posible duplicado.
import { describe, it, expect } from "vitest";
import { productoParecido } from "./productos";

const GUARDADOS = [{ nombre: "Camiseta Azul" }, { nombre: "Curso de Marketing Digital" }];

describe("productoParecido", () => {
  it("nombre idéntico (sin importar mayúsculas) no cuenta como 'parecido' -- eso lo bloquea el índice único, no esta pregunta", () => {
    expect(productoParecido("camiseta azul", GUARDADOS)).toBeNull();
  });

  it("un nombre que contiene a uno guardado sugiere ese guardado", () => {
    expect(productoParecido("Camiseta Azul Talla M", GUARDADOS)).toBe("Camiseta Azul");
  });

  it("un typo corto (distancia de edición chica) sugiere el guardado", () => {
    expect(productoParecido("Camisetaa Azul", GUARDADOS)).toBe("Camiseta Azul");
  });

  it("nombres totalmente distintos no sugieren nada", () => {
    expect(productoParecido("Zapatos Deportivos", GUARDADOS)).toBeNull();
  });

  it("nunca compara nombres muy cortos (3 letras o menos) -- falsos positivos seguros", () => {
    expect(productoParecido("Sol", [{ nombre: "Sol" }, { nombre: "Solo" }])).toBeNull();
  });

  it("catálogo vacío nunca sugiere nada", () => {
    expect(productoParecido("Lo que sea", [])).toBeNull();
  });
});
