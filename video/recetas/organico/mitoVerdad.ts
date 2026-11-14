import type { RecetaOrganica } from "./tipos";

// El plan original dejaba el CTA ambiguo ("seguir o comentar") -- se
// resuelve a "comentar", igual que recetaRetargeting ya resolvió su
// propia ambigüedad de CTA: desmentir un mito es contenido hecho para
// que la persona reaccione ahí mismo ("Comenta 'MITO' si tú también lo
// creías"), no para pedir que siga a la cuenta.
export const recetaMitoVerdad: RecetaOrganica = {
  recetaId: "mito_verdad",
  enfoque: "Desmentir 1-2 mitos del rubro -- valor, no venta.",
  duracionMinS: 15,
  duracionMaxS: 25,
  // "objecion" dos veces -- la propia receta permite desmentir 1 o 2
  // mitos (validarOrdenBloques exige una subsecuencia exacta, así que
  // un guion con un solo mito usa la primera y listo, uno con dos usa
  // ambas).
  bloques: ["gancho", "objecion", "objecion", "cta"],
  bucleTipico: "La pregunta del mito, que se tacha y se reemplaza por la verdad en objecion_respuesta.",
  indicadorBucle: "espera_final",
  accionCta: "comentar",
  textoCtaSugerido: "Comenta si tú también lo creías",
  requiereUsuarioEnCta: false,
  permiteObjecionRespuesta: true,
};
