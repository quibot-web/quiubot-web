import type { RecetaOrganica } from "./tipos";

export const recetaPreguntaComunidad: RecetaOrganica = {
  recetaId: "pregunta_comunidad",
  enfoque: "Conversación: elige A o B, opina en los comentarios.",
  duracionMinS: 10,
  duracionMaxS: 20,
  bloques: ["gancho", "valor", "cta"],
  bucleTipico: "El gancho abre la pregunta; dos_opciones la desarrolla, el cta pide la respuesta.",
  indicadorBucle: "espera_final",
  accionCta: "comentar",
  textoCtaSugerido: "Comenta tu opción",
  requiereUsuarioEnCta: false,
};
