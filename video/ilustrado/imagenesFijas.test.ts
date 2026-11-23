import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IMAGENES_FIJAS, POSTS_FIJOS, type NombreImagenFija } from "./imagenesFijas";
import { huellaImagenFija, huellaPostFijo, markupImagenFija } from "./markupImagenFija";

const CARPETA = path.join(process.cwd(), "public", "ilustrado");
const manifiesto = JSON.parse(fs.readFileSync(path.join(CARPETA, "manifiesto.json"), "utf8")) as Record<string, string>;

describe("imágenes fijas del reel ilustrado (public/ilustrado)", () => {
  for (const nombre of Object.keys(IMAGENES_FIJAS) as NombreImagenFija[]) {
    it(`${nombre}.png está generado desde su dibujo actual (si falla: npx tsx video/ilustrado/generarImagenesFijas.ts)`, () => {
      expect(fs.existsSync(path.join(CARPETA, `${nombre}.png`))).toBe(true);
      expect(manifiesto[nombre]).toBe(huellaImagenFija(nombre));
    });
  }

  for (const tipo of POSTS_FIJOS) {
    it(`post-${tipo}.png está generado desde el HTML actual de la publicación (si falla: npx tsx video/ilustrado/generarPostsFijos.ts)`, () => {
      expect(fs.existsSync(path.join(CARPETA, `post-${tipo}.png`))).toBe(true);
      expect(manifiesto[`post-${tipo}`]).toBe(huellaPostFijo(tipo));
    });
  }

  it("los SVG de origen no usan texto (al rasterizar no hay fuentes de la marca)", () => {
    for (const nombre of Object.keys(IMAGENES_FIJAS) as NombreImagenFija[]) expect(markupImagenFija(nombre), nombre).not.toMatch(/<text/);
  });

  it("no quedan archivos huérfanos en public/ilustrado", () => {
    const archivos = fs.readdirSync(CARPETA).filter((f) => f.endsWith(".png")).map((f) => f.replace(/\.png$/, ""));
    expect(archivos.sort()).toEqual([...Object.keys(IMAGENES_FIJAS), ...POSTS_FIJOS.map((t) => `post-${t}`)].sort());
  });
});
