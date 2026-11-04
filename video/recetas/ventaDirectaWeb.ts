import type { RecetaObjetivo } from "./tipos";

// Botón real de publicar_estrategia v10 para venta_directa_web: SHOP_NOW
// por defecto (anexo_reglas_copy_y_cta.md).
export const recetaVentaDirectaWeb: RecetaObjetivo = {
  objetivoId: "venta_directa_web",
  enfoque: "Venta con urgencia u oferta real. Usa las reglas COPY QUE VENDE.",
  duracionMinS: 10,
  duracionMaxS: 20,
  bloques: ["gancho", "producto", "beneficio", "oferta", "cta"],
  bucleTipico: "\"Hasta agotar...\" u oferta que se revela al final -- el bucle se cierra en la escena de oferta_precio.",
  indicadorBucle: "espera_final",
  accionCta: "web",
  textoCtaSugerido: "Compra aquí",
  requiereUsuarioEnCta: false,
  ganchoUsaProductoDeFondo: true,
};
