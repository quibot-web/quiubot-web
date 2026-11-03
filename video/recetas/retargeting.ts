import type { RecetaObjetivo } from "./tipos";

// retargeting tiene destino "sitio_web" en objetivos_config (ver
// app/lib/metas.ts) -- su CTA del video siempre es "web", nunca
// "whatsapp" (corrige la ambigüedad del plan original, confirmada en
// anexo_reglas_copy_y_cta.md).
export const recetaRetargeting: RecetaObjetivo = {
  objetivoId: "retargeting",
  enfoque: "Quien ya conoce la marca: resolver dudas y empujar a decidir. Usa las reglas COPY QUE VENDE.",
  duracionMinS: 8,
  duracionMaxS: 15,
  bloques: ["gancho", "objecion", "producto", "oferta", "cta"],
  bucleTipico: "La objeción que se tacha y se resuelve -- el bucle se cierra en la escena objecion_respuesta.",
  indicadorBucle: "espera_final",
  accionCta: "web",
  textoCtaSugerido: "Míralo aquí",
  requiereUsuarioEnCta: false,
  permiteObjecionRespuesta: true,
};
