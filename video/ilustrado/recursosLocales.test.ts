// CORS del reel ilustrado (staging 23 nov 2026: "VideoFrames can't be
// created from tainted sources"): ningún recurso remoto puede llegar al
// canvas del render sin CORS.
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aUrlLocal, esRemota } from "./recursosLocales";
import { MundoIlustrado } from "./motor/MundoIlustrado";
import { prepararReel } from "./motor/preparar";
import { MARCA_PROTOTIPO, PLAN_PROTOTIPO } from "./planPrototipo";
import tiemposReales from "./fixtures/tiemposPrototipoReales.json";
import type { TiemposIlustrado } from "./tiempoIlustrado";
import { paletaNoche } from "../estilos/estilos";

const TEMA = { color_primario: "#534AB7", color_secundario: "#B9B2FF", fuente: "moderna" as const, logo_url: null, nombre_marca: "Quiubot", instagramUsuario: "quiubot" };
const REMOTA = "https://res.cloudinary.com/demo/image/upload/foto.jpg";

describe("recursos remotos a URL local", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("esRemota: Cloudinary sí; relativas, blob:, data: y el mismo origen no", () => {
    expect(esRemota(REMOTA, "https://staging.quiubot.com")).toBe(true);
    expect(esRemota("/ilustrado/moneda.png", "https://staging.quiubot.com")).toBe(false);
    expect(esRemota("https://staging.quiubot.com/x.png", "https://staging.quiubot.com")).toBe(false);
    expect(esRemota("blob:https://staging.quiubot.com/abc", "https://staging.quiubot.com")).toBe(false);
    expect(esRemota("data:image/png;base64,AAA", null)).toBe(false);
  });

  it("una foto remota se baja UNA vez con CORS y se usa como blob: local; si falla, null (nunca la remota sin CORS)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["x"]) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:local/1" }));
    expect(await aUrlLocal(REMOTA)).toBe("blob:local/1");
    expect(await aUrlLocal(REMOTA)).toBe("blob:local/1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(REMOTA, { mode: "cors", credentials: "omit" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("CORS")));
    expect(await aUrlLocal("https://otro.cdn/sin-cors.jpg")).toBeNull();
    expect(await aUrlLocal("/demo-organico/foto.jpg")).toBe("/demo-organico/foto.jpg");
  });
});

describe("ninguna imagen del reel se dibuja sin CORS", () => {
  const reel = prepararReel(tiemposReales as TiemposIlustrado, PLAN_PROTOTIPO, 30);
  const recursos = { fotoApagada: REMOTA, fotoClara: REMOTA, brilloLuz: REMOTA };
  // Cuadros de todas las pantallas e islas: feed, foto, multitud (halos), chat, billetera, perfil.
  const cuadros = Array.from({ length: Math.floor(reel.linea.duracionCuadros / 15) }, (_, i) => i * 15);

  it("toda <img> del mundo lleva crossorigin=anonymous (aunque la foto llegue remota)", () => {
    for (const f of cuadros) {
      const h = renderToStaticMarkup(createElement(MundoIlustrado, { frame: f, fps: 30, reel, paleta: paletaNoche(TEMA), tema: TEMA, marca: MARCA_PROTOTIPO, fotoUrl: REMOTA, recursos }));
      for (const img of h.match(/<img[^>]*>/g) ?? []) expect(img, `cuadro ${f}`).toMatch(/crossorigin="anonymous"/i);
    }
  });

  it("en el código: toda <img> y todo new Image() del reel piden CORS", () => {
    const carpeta = path.join(process.cwd(), "video", "ilustrado");
    const archivos = fs.readdirSync(carpeta, { recursive: true }).map(String).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
    let etiquetas = 0;
    for (const archivo of archivos) {
      const codigo = fs.readFileSync(path.join(carpeta, archivo), "utf8");
      for (const m of codigo.matchAll(/<img\s[^<>]*?\/>/g)) {
        etiquetas++;
        expect(m[0], archivo).toMatch(/crossOrigin="anonymous"/);
      }
      for (const m of codigo.matchAll(/new Image\(\);?\s*\n([\s\S]{0,300})/g)) expect(m[1], archivo).toMatch(/crossOrigin = "anonymous"/);
    }
    // La revisión no es vacía: encuentra las <img> del reel (foto, halos, imágenes fijas, perfil).
    expect(etiquetas).toBeGreaterThanOrEqual(7);
  });
});
