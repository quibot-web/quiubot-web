// Pura, sin red -- solo confirma que la transformación que se le pide
// a Cloudinary antes de convertir una foto del álbum/catálogo a base64
// (ver estrategiasJobs.ts) tiene el tope de tamaño y el formato fijo
// esperados.
import { describe, it, expect } from "vitest";
import { urlReducidaParaIA } from "./cloudinaryUrl";

describe("urlReducidaParaIA", () => {
  it("inserta el tope de tamaño (1600, sin agrandar), calidad automática y formato jpg fijo", () => {
    const url = urlReducidaParaIA("https://res.cloudinary.com/demo/image/upload/v1/foto.png");
    expect(url).toBe("https://res.cloudinary.com/demo/image/upload/w_1600,h_1600,c_limit,q_auto:good,f_jpg/v1/foto.png");
  });

  it("nunca usa f_auto -- un webhook/IA necesita un formato fijo, no el mejor para el navegador que lo pida", () => {
    const url = urlReducidaParaIA("https://res.cloudinary.com/demo/image/upload/v1/foto.jpg");
    expect(url).not.toContain("f_auto");
    expect(url).toContain("f_jpg");
  });
});
