import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BITRATE_AUDIO_REEL, BITRATE_VIDEO_REEL, DURACION_MAXIMA_REEL_S, SOBRECOSTO_MEDIDO, TAMANO_MAXIMO_VIDEO_BYTES, tamanoEstimadoBytes } from "./configRender";

// Renders reales en Chrome (@remotion/web-renderer, 1080x1920, h264 a
// 2.5 Mbps + AAC 128 kbps), 23 nov 2026. El de 61.3 s es la pieza
// ilustrada 9c3bec9f con sus escenas repetidas hasta pasar 60 s: el reel
// más largo posible, con la animación que más le cuesta al codificador.
const MEDICIONES_REALES = [
  { caso: "reel con estilo 6e5bf3d3", duracion_s: 28.3, bytes: 9_020_000 },
  { caso: "reel ilustrado 9c3bec9f", duracion_s: 26.2, bytes: 9_050_000 },
  { caso: "reel ilustrado de 61.3 s (el más largo posible)", duracion_s: 61.3, bytes: 20_407_427 },
];

describe("tamaño del video: nunca pasa del límite de subida (Next.js trunca sobre 25 MB)", () => {
  it("el reel más largo posible (~60 s) queda bajo 24 MB, incluso con 10 % más de lo que se pasa el codificador", () => {
    expect(tamanoEstimadoBytes(DURACION_MAXIMA_REEL_S, SOBRECOSTO_MEDIDO * 1.1)).toBeLessThan(TAMANO_MAXIMO_VIDEO_BYTES);
    expect(BITRATE_VIDEO_REEL).toBe(2_500_000);
  });

  it("mediciones reales: todas bajo 24 MB y dentro del sobrecosto medido sobre el bitrate objetivo", () => {
    for (const m of MEDICIONES_REALES) {
      expect(m.bytes, m.caso).toBeLessThan(TAMANO_MAXIMO_VIDEO_BYTES);
      const objetivo = ((BITRATE_VIDEO_REEL + BITRATE_AUDIO_REEL) * m.duracion_s) / 8;
      expect(m.bytes / objetivo, m.caso).toBeLessThanOrEqual(SOBRECOSTO_MEDIDO);
    }
  });

  it("todo render de reel en el navegador usa el bitrate fijo (OPCIONES_CODIFICACION_REEL)", () => {
    const raiz = path.resolve(__dirname, "..");
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name.startsWith(".") || e.name === "_debug_") continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) archivos.push(p);
      }
    };
    recorrer(path.join(raiz, "app"));
    recorrer(path.join(raiz, "video"));
    const conRender = archivos.filter((a) => fs.readFileSync(a, "utf8").includes("renderMediaOnWeb({"));
    expect(conRender.length).toBeGreaterThanOrEqual(4);
    for (const a of conRender) expect(fs.readFileSync(a, "utf8"), path.relative(raiz, a)).toContain("...OPCIONES_CODIFICACION_REEL");
  });
});
