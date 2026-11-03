import { RECETAS, validarContraReceta } from "../recetas";
import type { Guion } from "../guion.schema";
import { fixtureCompleta } from "./completa";
import { fixtureBucleContador } from "./bucleContador";
import { fixtureVentaDirectaWhatsapp } from "./ventaDirectaWhatsapp";
import { fixtureVentaDirectaWeb } from "./ventaDirectaWeb";
import { fixtureLeads } from "./leads";
import { fixtureTraficoMensajes } from "./traficoMensajes";
import { fixtureReconocimiento } from "./reconocimiento";
import { fixtureSeguidoresInstagram } from "./seguidores";
import { fixtureRetargeting } from "./retargeting";

// npm run video:verificar -- cada fixture ya se auto-valida contra
// GuionSchema al importarlo (lanza si algo no cumple la FORMA del
// guion); este script además comprueba, para los fixtures pensados
// para seguir una receta, que también cumplen la receta de su objetivo
// (video/recetas/). fixtureCompleta y fixtureBucleContador son de antes
// del paso 3 y no siguen ninguna receta a propósito -- solo se
// comprueba que cargan sin lanzar error.
const fixturesConReceta: { nombre: string; huboMedia: boolean; guion: Guion }[] = [
  { nombre: "ventaDirectaWhatsapp", huboMedia: true, guion: fixtureVentaDirectaWhatsapp },
  { nombre: "ventaDirectaWeb", huboMedia: true, guion: fixtureVentaDirectaWeb },
  { nombre: "leads", huboMedia: false, guion: fixtureLeads },
  { nombre: "traficoMensajes", huboMedia: false, guion: fixtureTraficoMensajes },
  { nombre: "reconocimiento", huboMedia: false, guion: fixtureReconocimiento },
  { nombre: "seguidores", huboMedia: false, guion: fixtureSeguidoresInstagram },
  { nombre: "retargeting", huboMedia: true, guion: fixtureRetargeting },
];

let huboError = false;
for (const { nombre, huboMedia, guion } of fixturesConReceta) {
  const receta = RECETAS[guion.objetivo];
  const errores = validarContraReceta(guion, receta, huboMedia);
  if (errores.length > 0) {
    huboError = true;
    console.error(`[${nombre}] NO cumple su receta:`);
    errores.forEach((e) => console.error(`  - ${e}`));
  } else {
    console.log(`[${nombre}] OK`);
  }
}

console.log("[completa / bucleContador] cargados sin lanzar error (demo de las 9 escenas, no siguen receta)");
void fixtureCompleta;
void fixtureBucleContador;

if (huboError) {
  process.exitCode = 1;
}
