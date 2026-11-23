// Genera public/ilustrado/post-<tipo>.png (publicaciones genéricas del
// feed como una sola imagen) con renderStill -- mismas fuentes y mismo
// HTML que el video -- y anota en el manifiesto la huella de ese HTML.
// Correr DESPUÉS de generarImagenesFijas.ts (usa sus ilustraciones).
// Uso: npx tsx video/ilustrado/generarPostsFijos.ts
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { ESCALA_POST_FIJO, POSTS_FIJOS } from "./imagenesFijas";
import { huellaPostFijo } from "./markupImagenFija";

async function main() {
  const carpeta = path.join(process.cwd(), "public", "ilustrado");
  const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), "video", "Root.tsx") });
  const rutaManifiesto = path.join(carpeta, "manifiesto.json");
  const manifiesto = JSON.parse(fs.readFileSync(rutaManifiesto, "utf8")) as Record<string, string>;
  for (const tipo of POSTS_FIJOS) {
    const inputProps = { tipo };
    const composition = await selectComposition({ serveUrl, id: "post-fijo", inputProps });
    await renderStill({ composition, serveUrl, inputProps, output: path.join(carpeta, `post-${tipo}.png`), imageFormat: "png", scale: ESCALA_POST_FIJO });
    manifiesto[`post-${tipo}`] = huellaPostFijo(tipo);
  }
  fs.writeFileSync(rutaManifiesto, JSON.stringify(manifiesto, null, 1) + "\n");
  console.log(`${POSTS_FIJOS.length} publicaciones en ${carpeta}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
