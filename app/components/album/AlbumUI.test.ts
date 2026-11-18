import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/imagenes", () => ({
  validarImagenPropia: async () => ({ ok: true }),
  validarVideoPropio: async () => ({ ok: true }),
}));

import { estadoAnalisisPieza, subirArchivoValidado } from "./AlbumUI";

describe("estado de análisis de una pieza del álbum", () => {
  it("imagen sin texto: apta para fondo; con texto: tiene texto; null: sin analizar", () => {
    expect(estadoAnalisisPieza({ tipo: "imagen", analisis: { tiene_texto: false } })).toBe("apta");
    expect(estadoAnalisisPieza({ tipo: "imagen", analisis: { tiene_texto: true } })).toBe("texto");
    expect(estadoAnalisisPieza({ tipo: "imagen", analisis: null })).toBe("sin_analizar");
  });

  it("videos y piezas que no trajeron su análisis (ej. fotos de un producto): sin etiqueta", () => {
    expect(estadoAnalisisPieza({ tipo: "video", analisis: null })).toBeNull();
    expect(estadoAnalisisPieza({ tipo: "imagen" })).toBeNull();
  });
});

describe("subirArchivoValidado", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("devuelve la pieza creada (con su id) para dejarla seleccionada, todavía sin analizar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, id: "p1", url: "https://res.cloudinary.com/x/image/upload/a.jpg", public_id: "a", tipo: "imagen" }) })
    );
    const r = await subirArchivoValidado(new File(["x"], "a.jpg", { type: "image/jpeg" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.item).toMatchObject({ id: "p1", url_imagen: "https://res.cloudinary.com/x/image/upload/a.jpg", tipo: "imagen", analisis: null });
  });

  it("si el servidor rechaza, devuelve su error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Configura tus credenciales de Cloudinary en Integraciones" }) }));
    const r = await subirArchivoValidado(new File(["x"], "a.jpg", { type: "image/jpeg" }));
    expect(r).toEqual({ ok: false, error: "Configura tus credenciales de Cloudinary en Integraciones" });
  });
});
