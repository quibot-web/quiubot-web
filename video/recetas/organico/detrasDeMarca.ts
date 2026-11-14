import type { RecetaOrganica } from "./tipos";

export const recetaDetrasDeMarca: RecetaOrganica = {
  recetaId: "detras_de_marca",
  enfoque: "Valores, cómo se hace, por qué existe la marca -- usa marcas.info_adicional.",
  duracionMinS: 15,
  duracionMaxS: 30,
  bloques: ["gancho", "valor", "marca", "cta"],
  bucleTipico: "El gancho promete conocer algo de la marca; revelacion_marca lo cumple.",
  indicadorBucle: "espera_final",
  accionCta: "suave",
  textoCtaSugerido: "Conócenos",
  requiereUsuarioEnCta: false,
  requiereRevelacionMarca: true,
};
