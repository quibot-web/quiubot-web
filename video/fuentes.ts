// Una fuente OFL de Google Fonts por estilo (ver sección 6 del plan),
// cargada en el momento en que este módulo se importa -- tanto el
// reproductor del navegador como el worker de render importan este mismo
// archivo, así que la fuente siempre está disponible antes de dibujar
// cualquier escena. "Fuentes instaladas localmente" en el worker (sin
// descargar nada de internet al renderizar) es responsabilidad del
// Dockerfile del worker (Fase 1b), no de este módulo.
import { loadFont as cargarImpacto, fontFamily as familiaImpacto } from "@remotion/google-fonts/BebasNeue";
import { loadFont as cargarModerna, fontFamily as familiaModerna } from "@remotion/google-fonts/Poppins";
import { loadFont as cargarElegante, fontFamily as familiaElegante } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as cargarAmigable, fontFamily as familiaAmigable } from "@remotion/google-fonts/Nunito";

import type { EstiloFuente } from "./tema";

cargarImpacto();
cargarModerna();
cargarElegante();
cargarAmigable();

export const FAMILIA_POR_ESTILO: Record<EstiloFuente, string> = {
  impacto: familiaImpacto,
  moderna: familiaModerna,
  elegante: familiaElegante,
  amigable: familiaAmigable,
};

export function familiaDeFuente(estilo: EstiloFuente): string {
  return FAMILIA_POR_ESTILO[estilo];
}
