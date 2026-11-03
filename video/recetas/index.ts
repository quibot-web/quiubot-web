import type { ObjetivoVideo } from "../guion.schema";
import type { RecetaObjetivo } from "./tipos";
import { recetaVentaDirectaWhatsapp } from "./ventaDirectaWhatsapp";
import { recetaVentaDirectaWeb } from "./ventaDirectaWeb";
import { recetaLeads } from "./leads";
import { recetaTraficoMensajes, recetaVisitasWeb } from "./traficoYVisitasWeb";
import { recetaReconocimiento } from "./reconocimiento";
import { recetaSeguidoresFacebook, recetaSeguidoresInstagram } from "./seguidores";
import { recetaRetargeting } from "./retargeting";

export const RECETAS: Record<ObjetivoVideo, RecetaObjetivo> = {
  venta_directa_whatsapp: recetaVentaDirectaWhatsapp,
  venta_directa_web: recetaVentaDirectaWeb,
  leads: recetaLeads,
  trafico_mensajes: recetaTraficoMensajes,
  visitas_web: recetaVisitasWeb,
  reconocimiento: recetaReconocimiento,
  seguidores_facebook: recetaSeguidoresFacebook,
  seguidores_instagram: recetaSeguidoresInstagram,
  retargeting: recetaRetargeting,
};

export function recetaDe(objetivoId: ObjetivoVideo): RecetaObjetivo {
  return RECETAS[objetivoId];
}

export type { RecetaObjetivo } from "./tipos";
export { validarContraReceta, validarOrdenBloques } from "./tipos";
