import type { RecetaOrganica } from "./tipos";

export const recetaConsejosNumerados: RecetaOrganica = {
  recetaId: "consejos_numerados",
  enfoque: "3 consejos útiles del rubro de la marca -- valor, no venta.",
  duracionMinS: 15,
  duracionMaxS: 30,
  bloques: ["gancho", "valor", "marca", "cta"],
  bucleTipico: "El contador 1/3, 2/3, 3/3 de la lista_numerada -- quien ve el 1 quiere ver el 3.",
  indicadorBucle: "contador",
  accionCta: "seguir",
  textoCtaSugerido: "Síguenos para más consejos",
  requiereUsuarioEnCta: true,
  requiereRevelacionMarca: true,
};
