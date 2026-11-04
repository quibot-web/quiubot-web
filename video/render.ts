// CLI local de Fase 1a -- "npm run render -- <guion.json>".
// Toma un guion.json como el que descarga /video (botón "Descargar
// JSON"), resuelve las piezas reales del álbum y la música en Supabase
// (las mismas tablas que ya usa /api/video/guion), y renderiza el mp4
// con @remotion/bundler + @remotion/renderer -- por ahora solo en local;
// un worker server-side llega en la Fase 1b.
//
// Import relativo a propósito, no "@/..." -- igual que guion.schema.ts:
// el bundler propio de Remotion no entiende el alias de tsconfig, solo
// lo resuelve el bundler de Next. Este archivo no lo bundlea Remotion
// (solo video/Root.tsx, que SÍ usa imports relativos), pero se mantiene
// la misma regla para no tener que acordarse de dos criterios distintos.

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { GuionSchema, idsDeMediaUsados } from "./guion.schema";
import { urlPistaMusical } from "../app/lib/cloudinaryUrl";
import type { MediosResueltos } from "./escenas/tipos";

const CARPETA_SALIDA = path.join(os.homedir(), "Desktop", "videos_quiubot");

async function main() {
  const rutaArg = process.argv[2];
  if (!rutaArg) {
    console.error("Uso: npm run render -- <guion.json>");
    process.exit(1);
  }

  const rutaGuion = path.resolve(rutaArg);
  if (!fs.existsSync(rutaGuion)) {
    console.error(`No existe el archivo: ${rutaGuion}`);
    process.exit(1);
  }

  const crudo = JSON.parse(fs.readFileSync(rutaGuion, "utf-8"));
  const resultadoGuion = GuionSchema.safeParse(crudo);
  if (!resultadoGuion.success) {
    console.error("El guion no pasa el esquema:");
    for (const issue of resultadoGuion.error.issues) console.error(`- ${issue.path.join(".")}: ${issue.message}`);
    process.exit(1);
  }
  const guion = resultadoGuion.data;

  const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llaveSupabase = process.env.SUPABASE_SERVICE_ROLE;
  if (!urlSupabase || !llaveSupabase) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE en .env.local.");
    process.exit(1);
  }
  const supabase = createClient(urlSupabase, llaveSupabase);

  // Resolver las piezas reales (el guion solo trae el media_id, nunca
  // la URL -- ver idsDeMediaUsados en guion.schema.ts). Sin filtro por
  // user_id: id es un UUID único en toda la tabla, y esta es una
  // herramienta local de confianza, no una ruta expuesta.
  const idsPiezas = idsDeMediaUsados(guion.escenas);
  const medios: MediosResueltos = {};
  if (idsPiezas.length > 0) {
    const { data: piezas, error } = await supabase.from("album_creativos").select("id, url_imagen, tipo").in("id", idsPiezas);
    if (error) {
      console.error(`Error consultando el álbum: ${error.message}`);
      process.exit(1);
    }
    for (const id of idsPiezas) {
      const pieza = piezas?.find((p) => p.id === id);
      if (!pieza) {
        console.error(`La pieza "${id}" que usa el guion ya no existe en el álbum.`);
        process.exit(1);
      }
      medios[id] = { url: pieza.url_imagen, tipo: pieza.tipo === "video" ? "video" : "imagen" };
    }
  }

  let pistaUrl: string | null = null;
  if (guion.musica.pista_id) {
    const { data: pista, error } = await supabase
      .from("pistas_musicales")
      .select("id, public_id, cloudinary_name")
      .eq("id", guion.musica.pista_id)
      .maybeSingle();
    if (error) {
      console.error(`Error consultando la pista musical: ${error.message}`);
      process.exit(1);
    }
    if (pista) pistaUrl = urlPistaMusical(pista.cloudinary_name, pista.public_id);
  }

  fs.mkdirSync(CARPETA_SALIDA, { recursive: true });
  const fecha = new Date().toISOString().slice(0, 10);
  const rutaSalida = path.join(CARPETA_SALIDA, `${guion.objetivo}_${fecha}.mp4`);

  // RENDER_CONCURRENCY (opcional, ver npm run render) -- sin esto,
  // renderMedia() usa su propio default (null): round(min(8, max(1,
  // núcleos/2))). Se deja como variable de entorno (no un flag nuevo en
  // package.json) para poder comparar valores en la misma máquina sin
  // tocar código cada vez.
  const concurrencyEnv = process.env.RENDER_CONCURRENCY;
  const concurrency = concurrencyEnv ? Number(concurrencyEnv) : null;
  console.log(`Núcleos de CPU detectados: ${os.cpus().length}. Concurrency pedida: ${concurrency ?? "(default de Remotion)"}`);

  const inicio = Date.now();
  console.log("Empaquetando la composición de Remotion...");
  const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), "video", "Root.tsx") });
  const trasEmpaquetado = Date.now();
  console.log(`Empaquetado: ${((trasEmpaquetado - inicio) / 1000).toFixed(1)}s`);

  const inputProps = { guion, medios, pistaUrl };
  const composicion = await selectComposition({ serveUrl, id: "render", inputProps });
  const trasSeleccion = Date.now();
  console.log(`Selección de composición: ${((trasSeleccion - trasEmpaquetado) / 1000).toFixed(1)}s`);

  console.log(`Renderizando ${guion.escenas.length} escenas (${composicion.durationInFrames} cuadros) -> ${rutaSalida}`);
  await renderMedia({ composition: composicion, serveUrl, codec: "h264", outputLocation: rutaSalida, inputProps, concurrency });
  const trasRender = Date.now();
  console.log(`Render (renderMedia): ${((trasRender - trasSeleccion) / 1000).toFixed(1)}s`);

  const duracionS = (Date.now() - inicio) / 1000;
  console.log(`Listo: ${rutaSalida}`);
  console.log(`Render terminado en ${duracionS.toFixed(1)}s.`);
}

main().catch((err) => {
  console.error("Error al renderizar:", err);
  process.exit(1);
});
