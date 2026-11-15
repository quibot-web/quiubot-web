// CLI de Fase A del pivote visual (ver el plan) -- renderiza los reels
// de referencia hechos a mano (video/fixtures/organico/referencia/) a
// mp4 real, sin pasar por GuionSchema/Supabase: a diferencia de
// render.ts, estas composiciones son autocontenidas (sin props), así
// que esto solo necesita bundle + selectComposition + renderMedia por
// id de composición.
//
// Uso: npm run render:referencia -- <id-de-composicion>
// Ejemplo: npm run render:referencia -- organico-referencia-consejos-numerados
//
// Import relativo a propósito, igual que render.ts: el bundler de
// Remotion no entiende el alias "@/" de tsconfig.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const CARPETA_SALIDA = path.join(os.homedir(), "Desktop", "videos_quiubot");

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Uso: npm run render:referencia -- <id-de-composicion>");
    process.exit(1);
  }

  fs.mkdirSync(CARPETA_SALIDA, { recursive: true });
  const rutaSalida = path.join(CARPETA_SALIDA, `${id}.mp4`);

  const inicio = Date.now();
  console.log("Empaquetando la composición de Remotion...");
  const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), "video", "Root.tsx") });
  console.log(`Empaquetado: ${((Date.now() - inicio) / 1000).toFixed(1)}s`);

  const composicion = await selectComposition({ serveUrl, id });
  console.log(`Renderizando "${id}" (${composicion.durationInFrames} cuadros) -> ${rutaSalida}`);

  await renderMedia({ composition: composicion, serveUrl, codec: "h264", outputLocation: rutaSalida });

  console.log(`Listo: ${rutaSalida}`);
  console.log(`Render terminado en ${((Date.now() - inicio) / 1000).toFixed(1)}s.`);
}

main().catch((err) => {
  console.error("Error al renderizar:", err);
  process.exit(1);
});
