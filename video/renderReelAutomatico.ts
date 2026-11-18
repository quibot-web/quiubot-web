// Renderiza un reel con voz completo (ReelAutomatico) a mp4 desde un
// guion guardado en JSON -- para revisar estilos con el render real
// (sistema de estilos, paso 1). No lee ni escribe la base: recibe el
// guion y las URLs de las fotos ya resueltas.
//
// Uso: npx tsx video/renderReelAutomatico.ts <guion.json> <salida.mp4> [--medios medios.json] [--estilo noche|color_pleno|foto]
// --estilo asigna el estilo como lo haría una generación nueva
// (asignarEstilo), para ver un guion viejo con el estilo nuevo.
// Import relativo a propósito, igual que render.ts.
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { GuionSchema } from "./guion.schema";
import { ESTILOS_VISUALES, asignarEstilo, idsFotosSinTexto, type EstiloVisualId } from "./estilos/estilos";

function argumento(nombre: string): string | null {
  const i = process.argv.indexOf(nombre);
  return i !== -1 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const [rutaGuion, rutaSalida] = process.argv.slice(2).filter((a, i, todos) => !a.startsWith("--") && !todos[i - 1]?.startsWith("--"));
  if (!rutaGuion || !rutaSalida) throw new Error("Uso: npx tsx video/renderReelAutomatico.ts <guion.json> <salida.mp4> [--medios medios.json] [--estilo noche|color_pleno|foto]");
  const guion = GuionSchema.parse(JSON.parse(fs.readFileSync(rutaGuion, "utf8")));
  const rutaMedios = argumento("--medios");
  const medios: Record<string, { url: string; tipo: string }> = rutaMedios ? JSON.parse(fs.readFileSync(rutaMedios, "utf8")) : {};
  const estilo = argumento("--estilo");
  if (estilo) {
    if (!(ESTILOS_VISUALES as readonly string[]).includes(estilo)) throw new Error(`Estilo desconocido: ${estilo} (${ESTILOS_VISUALES.join(", ")})`);
    const fotosSinTexto = idsFotosSinTexto(medios, guion.analisisPiezas);
    guion.estilo = asignarEstilo(guion.escenas, estilo as EstiloVisualId, { fotosSinTexto });
    if (guion.estilo.id !== estilo) console.log(`Aviso: "${estilo}" no aplica a esta pieza (sin fotos sin texto); se usa "${guion.estilo.id}".`);
  }

  const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), "video", "Root.tsx") });
  const inputProps = { guion, medios };
  const composition = await selectComposition({ serveUrl, id: "reel-automatico", inputProps });
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: rutaSalida, inputProps });
  console.log(rutaSalida, `(${(composition.durationInFrames / composition.fps).toFixed(1)} s, estilo ${guion.estilo?.id ?? "ninguno"})`);
  if (guion.estilo) console.log("layouts:", JSON.stringify(guion.estilo.layouts));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
