// Una fuente OFL por estilo (ver sección 6 del plan), cargada desde
// archivos locales en public/fonts/ -- NUNCA por red. Antes usaba
// @remotion/google-fonts, que en cada render (y cada carga del Studio o
// del Player) descarga los .woff2 reales desde fonts.gstatic.com: con
// loadFont() sin pesos/subsets explícitos, eso son decenas de requests
// por familia (ver el log real de "npm run render": 27-80 requests por
// fuente, por CADA tab de Chrome Headless que abre el renderer). Con los
// archivos ya en public/, Remotion los sirve desde su propio servidor
// local (el mismo que sirve el resto del bundle) tanto en el navegador
// como en el renderer -- cero red, cero riesgo de que el render falle o
// se demore por una fuente que no cargó a tiempo.
//
// Los .woff2 se bajaron una sola vez (no se vuelven a tocar) de las
// mismas URLs que @remotion/google-fonts ya traía en su metadata. Poppins
// trae un archivo está­tico por peso (son así en Google Fonts); Playfair
// Display y Nunito son fuentes variables -- un solo archivo cubre todo
// el rango de pesos, así que se registra una sola vez por familia con
// weight "400 900" (rango, no un peso fijo) en vez de "descargar" el
// mismo archivo 5 veces con una etiqueta de peso distinta cada vez.
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

import type { EstiloFuente } from "./tema";

const FAMILIA_IMPACTO = "Bebas Neue";
const FAMILIA_MODERNA = "Poppins";
const FAMILIA_ELEGANTE = "Playfair Display";
const FAMILIA_AMIGABLE = "Nunito";

const PESOS_ESTATICOS_POPPINS = ["400", "600", "700", "800", "900"] as const;

for (const peso of PESOS_ESTATICOS_POPPINS) {
  loadFont({ family: FAMILIA_MODERNA, url: staticFile(`fonts/Poppins-${peso}.woff2`), weight: peso, style: "normal", format: "woff2" });
}

loadFont({ family: FAMILIA_IMPACTO, url: staticFile("fonts/BebasNeue-400.woff2"), weight: "400", style: "normal", format: "woff2" });
loadFont({ family: FAMILIA_ELEGANTE, url: staticFile("fonts/PlayfairDisplay-variable.woff2"), weight: "400 900", style: "normal", format: "woff2" });
loadFont({ family: FAMILIA_AMIGABLE, url: staticFile("fonts/Nunito-variable.woff2"), weight: "400 900", style: "normal", format: "woff2" });

export const FAMILIA_POR_ESTILO: Record<EstiloFuente, string> = {
  impacto: FAMILIA_IMPACTO,
  moderna: FAMILIA_MODERNA,
  elegante: FAMILIA_ELEGANTE,
  amigable: FAMILIA_AMIGABLE,
};

export function familiaDeFuente(estilo: EstiloFuente): string {
  return FAMILIA_POR_ESTILO[estilo];
}
