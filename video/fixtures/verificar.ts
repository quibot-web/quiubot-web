import { RECETAS, validarContraReceta } from "../recetas";
import { RECETAS_ORGANICAS, validarContraRecetaOrganica } from "../recetas/organico";
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
import { fixtureConsejosNumerados } from "./organico/consejosNumerados";
import { fixtureMitoVerdad } from "./organico/mitoVerdad";
import { fixtureProductoEnUso } from "./organico/productoEnUso";
import { fixtureSeriePartes } from "./organico/seriePartes";
import { fixturePreguntaComunidad } from "./organico/preguntaComunidad";
import { fixtureDetrasDeMarca } from "./organico/detrasDeMarca";

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
  if (!guion.objetivo) {
    huboError = true;
    console.error(`[${nombre}] es un fixture de anuncio sin "objetivo" -- no se puede validar contra ninguna receta.`);
    continue;
  }
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

const fixturesOrganicas: { nombre: string; huboMedia: boolean; guion: Guion }[] = [
  { nombre: "consejosNumerados", huboMedia: false, guion: fixtureConsejosNumerados },
  { nombre: "mitoVerdad", huboMedia: false, guion: fixtureMitoVerdad },
  { nombre: "productoEnUso", huboMedia: true, guion: fixtureProductoEnUso },
  { nombre: "seriePartes", huboMedia: false, guion: fixtureSeriePartes },
  { nombre: "preguntaComunidad", huboMedia: false, guion: fixturePreguntaComunidad },
  { nombre: "detrasDeMarca", huboMedia: false, guion: fixtureDetrasDeMarca },
];

for (const { nombre, huboMedia, guion } of fixturesOrganicas) {
  if (!guion.receta_organica) {
    huboError = true;
    console.error(`[${nombre}] es un fixture orgánico sin "receta_organica" -- no se puede validar contra ninguna receta.`);
    continue;
  }
  const receta = RECETAS_ORGANICAS[guion.receta_organica];
  const errores = validarContraRecetaOrganica(guion, receta, huboMedia);
  if (errores.length > 0) {
    huboError = true;
    console.error(`[${nombre}] NO cumple su receta orgánica:`);
    errores.forEach((e) => console.error(`  - ${e}`));
  } else {
    console.log(`[${nombre}] OK`);
  }
}

if (huboError) {
  process.exitCode = 1;
}
