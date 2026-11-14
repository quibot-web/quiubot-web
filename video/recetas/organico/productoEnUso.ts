import type { RecetaOrganica } from "./tipos";

// El plan original dejaba el CTA ambiguo ("suave o seguir") -- se
// resuelve a "suave", igual criterio que recetaReconocimiento (Fase 1
// de anuncios): mostrar el producto resolviendo algo es contenido de
// marca/valor, no una invitación directa a nada puntual.
export const recetaProductoEnUso: RecetaOrganica = {
  recetaId: "producto_en_uso",
  enfoque: "El producto real resolviendo algo, sin precio salvo que venga en los datos -- valor, no venta.",
  duracionMinS: 12,
  duracionMaxS: 25,
  bloques: ["gancho", "producto", "beneficio", "cta"],
  bucleTipico: "El gancho muestra el problema; producto_hero cierra el bucle mostrando la solución real.",
  indicadorBucle: "espera_final",
  accionCta: "suave",
  textoCtaSugerido: "Conócenos",
  requiereUsuarioEnCta: false,
  ganchoUsaProductoDeFondo: true,
};
