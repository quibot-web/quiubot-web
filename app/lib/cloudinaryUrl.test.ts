// Pura, sin red -- solo confirma que la transformación que se le pide
// a Cloudinary antes de convertir una foto del álbum/catálogo a base64
// (ver estrategiasJobs.ts) tiene el tope de tamaño y el formato fijo
// esperados.
import { describe, it, expect } from "vitest";
import { urlReducidaParaIA, urlVideoCompatible, urlFondoDifuminadoVideo, urlMiniaturaReel } from "./cloudinaryUrl";

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

// Probado contra un video real de Cloudinary (ver plan_contenido_organico.md,
// sección 5): con f_auto, Cloudinary le puede entregar VP9 a un cliente
// tipo Chrome aunque la URL termine en ".mp4", y @remotion/media (que
// decodifica con WebCodecs/Mediabunny) lo rechaza -- nunca f_auto para
// video que un consumidor automático va a decodificar él mismo.
describe("urlVideoCompatible", () => {
  it("fuerza el contenedor mp4 y el códec h264, nunca f_auto", () => {
    const url = urlVideoCompatible("https://res.cloudinary.com/demo/video/upload/v1/pieza.mp4", 1080);
    expect(url).toBe("https://res.cloudinary.com/demo/video/upload/f_mp4,vc_h264,q_auto,w_1080/v1/pieza.mp4");
    expect(url).not.toContain("f_auto");
  });
});

describe("urlFondoDifuminadoVideo", () => {
  it("mismo fondo difuminado que urlFondoDifuminado, pero con códec fijo para video", () => {
    const url = urlFondoDifuminadoVideo("https://res.cloudinary.com/demo/video/upload/v1/pieza.mp4");
    expect(url).toBe("https://res.cloudinary.com/demo/video/upload/f_mp4,vc_h264,q_auto,e_blur:1500,w_480/v1/pieza.mp4");
    expect(url).not.toContain("f_auto");
  });
});

// Miniatura de las tarjetas del calendario de /contenido (rediseño,
// sección 2 del plan) -- un frame fijo (so_1) recortado a 9:16, con un
// ancho chico porque es solo para la lista, no el video final.
describe("urlMiniaturaReel", () => {
  it("frame fijo, recorte 9:16 y extensión .jpg, con el ancho pedido", () => {
    const url = urlMiniaturaReel("https://res.cloudinary.com/demo/video/upload/v1/reel.mp4", 180);
    expect(url).toBe("https://res.cloudinary.com/demo/video/upload/so_1,c_fill,g_auto,ar_9:16,w_180,q_auto/v1/reel.jpg");
  });

  it("ancho por defecto 240 cuando no se pasa", () => {
    const url = urlMiniaturaReel("https://res.cloudinary.com/demo/video/upload/v1/reel.mp4");
    expect(url).toContain("w_240");
  });
});
