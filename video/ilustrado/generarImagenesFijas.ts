// Genera public/ilustrado/*.png desde IMAGENES_FIJAS (ver imagenesFijas.tsx)
// y el manifiesto con la huella de cada SVG de origen.
// Uso: npx tsx video/ilustrado/generarImagenesFijas.ts
// (después, si cambió algo que usan las publicaciones: generarPostsFijos.ts)
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { huellaImagenFija, markupImagenFija } from "./markupImagenFija";
import { IMAGENES_FIJAS, type NombreImagenFija } from "./imagenesFijas";

async function main() {
  const carpeta = path.join(process.cwd(), "public", "ilustrado");
  fs.mkdirSync(carpeta, { recursive: true });
  const rutaManifiesto = path.join(carpeta, "manifiesto.json");
  const anterior = fs.existsSync(rutaManifiesto) ? (JSON.parse(fs.readFileSync(rutaManifiesto, "utf8")) as Record<string, string>) : {};
  // Se conservan las publicaciones (las genera generarPostsFijos.ts).
  const manifiesto: Record<string, string> = Object.fromEntries(Object.entries(anterior).filter(([k]) => k.startsWith("post-")));
  for (const nombre of Object.keys(IMAGENES_FIJAS) as NombreImagenFija[]) {
    const svg = markupImagenFija(nombre);
    const ancho = IMAGENES_FIJAS[nombre].ancho;
    const anchoSvg = Number(/width="([\d.]+)"/.exec(svg)?.[1] ?? ancho);
    await sharp(Buffer.from(svg), { density: Math.min(2400, Math.ceil((72 * ancho) / anchoSvg) + 1) })
      .resize({ width: ancho })
      .png({ compressionLevel: 9, palette: false })
      .toFile(path.join(carpeta, `${nombre}.png`));
    manifiesto[nombre] = huellaImagenFija(nombre);
  }
  fs.writeFileSync(rutaManifiesto, JSON.stringify(manifiesto, null, 1) + "\n");
  console.log(`${Object.keys(manifiesto).length} imágenes en ${carpeta}`);
}
main();
