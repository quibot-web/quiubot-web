// Prueba resolverProductoAlUsar/resolverProductoDesdeTexto con
// global.fetch mockeado -- nunca contra la base real ni contra las
// rutas HTTP de verdad (que ya tienen su propia prueba mockeando
// Supabase). Cubre: guardar/actualizar el catálogo al usar un
// producto, y que el chat del Director (sin checkbox posible) reusa
// un producto parecido en vez de crear un duplicado, o crea uno nuevo
// solo cuando de verdad no hay nada guardado parecido.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolverProductoAlUsar, valorVacioSelectorProducto, resolverProductoDesdeTexto } from "./SelectorProducto";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function respuestaOk(body: unknown) {
  return { ok: true, json: async () => body };
}
function respuestaError(body: unknown) {
  return { ok: false, json: async () => body };
}

describe("resolverProductoAlUsar", () => {
  it("texto vacío no guarda nada y no llama a fetch", async () => {
    const r = await resolverProductoAlUsar(valorVacioSelectorProducto());
    expect(r).toEqual({ productoId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nuevo producto con 'Guardar en mis productos' marcado: hace POST con marcar_uso:true", async () => {
    fetchMock.mockResolvedValue(respuestaOk({ producto: { id: "p1" } }));
    const valor = { ...valorVacioSelectorProducto(), nombre: "Camiseta Azul", guardarEnCatalogo: true };

    const r = await resolverProductoAlUsar(valor);

    expect(r).toEqual({ productoId: "p1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/productos",
      expect.objectContaining({ method: "POST", body: expect.stringContaining('"marcar_uso":true') })
    );
  });

  it("nuevo producto SIN 'Guardar en mis productos': no llama a fetch, no guarda", async () => {
    const valor = { ...valorVacioSelectorProducto(), nombre: "Camiseta Azul", guardarEnCatalogo: false };
    const r = await resolverProductoAlUsar(valor);
    expect(r).toEqual({ productoId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("producto existente sin editar nada: igual hace PATCH solo con marcar_uso (para que ultimo_uso_en se actualice)", async () => {
    fetchMock.mockResolvedValue(respuestaOk({}));
    const valor = { ...valorVacioSelectorProducto(), productoId: "p1", nombre: "Camiseta Azul" };

    const r = await resolverProductoAlUsar(valor);

    expect(r).toEqual({ productoId: "p1" });
    expect(fetchMock).toHaveBeenCalledWith("/api/productos/p1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ marcar_uso: true }) }));
  });

  it("producto existente editado con 'Actualizar catálogo': manda precio/destacar junto con marcar_uso", async () => {
    fetchMock.mockResolvedValue(respuestaOk({}));
    const valor = { ...valorVacioSelectorProducto(), productoId: "p1", nombre: "Camiseta Azul", precioCop: 70000, destacar: "Nuevo", actualizarCatalogo: true };

    await resolverProductoAlUsar(valor);

    const cuerpo = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(cuerpo).toEqual({ marcar_uso: true, precio_cop: 70000, destacar: "Nuevo" });
  });

  it("si el PATCH falla, igual devuelve el productoId (se usó igual) con un error amable", async () => {
    fetchMock.mockResolvedValue(respuestaError({ error: "boom" }));
    const valor = { ...valorVacioSelectorProducto(), productoId: "p1", nombre: "Camiseta Azul", actualizarCatalogo: true };

    const r = await resolverProductoAlUsar(valor);

    expect(r.productoId).toBe("p1");
    expect(r.error).toBeTruthy();
  });
});

describe("resolverProductoDesdeTexto (chat del Director, sin checkbox posible)", () => {
  it("coincidencia exacta con un producto guardado: reusa ese id, nunca crea uno nuevo", async () => {
    fetchMock.mockResolvedValue(respuestaOk({}));
    const r = await resolverProductoDesdeTexto("camiseta azul", null, [{ id: "p1", nombre: "Camiseta Azul" }]);

    expect(r).toEqual({ productoId: "p1" });
    expect(fetchMock).toHaveBeenCalledWith("/api/productos/p1", expect.objectContaining({ method: "PATCH" }));
  });

  it("nombre parecido (no exacto) a uno guardado: reusa ese, no duplica", async () => {
    fetchMock.mockResolvedValue(respuestaOk({}));
    const r = await resolverProductoDesdeTexto("Camiseta Azul Talla M", null, [{ id: "p1", nombre: "Camiseta Azul" }]);
    expect(r).toEqual({ productoId: "p1" });
  });

  it("sin nada parecido guardado: crea uno nuevo con marcar_uso:true", async () => {
    fetchMock.mockResolvedValue(respuestaOk({ producto: { id: "p2" } }));
    const r = await resolverProductoDesdeTexto("Zapatos Deportivos", 120000, [{ id: "p1", nombre: "Camiseta Azul" }]);

    expect(r).toEqual({ productoId: "p2" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/productos",
      expect.objectContaining({ method: "POST", body: expect.stringContaining('"marcar_uso":true') })
    );
  });

  it("texto vacío no llama a fetch", async () => {
    const r = await resolverProductoDesdeTexto("   ", null, []);
    expect(r).toEqual({ productoId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("si crear falla, no revienta -- devuelve productoId:null", async () => {
    fetchMock.mockResolvedValue(respuestaError({ error: "boom" }));
    const r = await resolverProductoDesdeTexto("Zapatos Deportivos", null, []);
    expect(r).toEqual({ productoId: null });
  });
});
