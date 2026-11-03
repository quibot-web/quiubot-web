import type { RecetaObjetivo } from "./tipos";

// Fuente: sección 3B del plan + anexo_reglas_copy_y_cta.md (botón real de
// publicar_estrategia v10 para venta_directa_whatsapp: WHATSAPP_MESSAGE).
export const recetaVentaDirectaWhatsapp: RecetaObjetivo = {
  objetivoId: "venta_directa_whatsapp",
  enfoque: "Venta directa: deseo o dolor real -> producto real -> WhatsApp. Usa las reglas COPY QUE VENDE.",
  duracionMinS: 10,
  duracionMaxS: 20,
  bloques: ["gancho", "problema", "producto", "beneficio", "oferta", "cta"],
  bucleTipico: "\"Mira cómo quedó...\" -- el bucle se cierra en la escena del producto (el resultado que resuelve el problema del gancho).",
  indicadorBucle: "espera_final",
  accionCta: "whatsapp",
};
