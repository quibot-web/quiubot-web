import type { RecetaOrganica } from "./tipos";

// La "parte 2" de verdad no vive acá -- lo decide el calendario (/
// contenido, commit 4 del plan): esta pieza es la parte 1 de N, la
// siguiente pieza programada en un día posterior retoma el tema.
export const recetaSeriePartes: RecetaOrganica = {
  recetaId: "serie_partes",
  enfoque: '"Parte 1 de 3" de un tema -- la siguiente pieza del calendario es la parte 2.',
  duracionMinS: 15,
  duracionMaxS: 30,
  // "valor" dos veces -- 3 escenas (gancho ≤2.5s + 1 valor ≤5s + cta
  // ≤5s) nunca llegan a los 15s mínimos de esta receta. La segunda
  // escena de valor no repite la primera: es el adelanto de la parte
  // siguiente ("lo que viene"), contenido real, no relleno.
  bloques: ["gancho", "valor", "valor", "cta"],
  bucleTipico: 'El contador 1/3, 2/3, 3/3 de la lista_numerada, más "sigue para la parte 2" explícito en el cta.',
  indicadorBucle: "contador",
  accionCta: "seguir",
  textoCtaSugerido: "Sigue para la parte 2",
  requiereUsuarioEnCta: true,
};
