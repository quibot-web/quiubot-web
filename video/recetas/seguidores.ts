import type { RecetaObjetivo } from "./tipos";

// seguidores_facebook (botón real LIKE_PAGE) y seguidores_instagram
// (VIEW_INSTAGRAM_PROFILE) comparten el mismo enfoque y estructura --
// solo cambia a qué cuenta apunta el "usuario" del cta en el guion.
function construirReceta(objetivoId: "seguidores_facebook" | "seguidores_instagram"): RecetaObjetivo {
  return {
    objetivoId,
    enfoque: "Valor en serie: \"esto y más si nos sigues\". Un consejo, truco o tendencia del rubro de la marca.",
    duracionMinS: 8,
    duracionMaxS: 15,
    bloques: ["gancho", "valor", "cta"],
    bucleTipico: "\"Parte 1 de...\" / \"sigue para la parte 2\" -- usa lista_numerada en el bloque de valor para cerrar el bucle en \"contador\".",
    indicadorBucle: "contador",
    accionCta: "seguir",
  };
}

export const recetaSeguidoresFacebook = construirReceta("seguidores_facebook");
export const recetaSeguidoresInstagram = construirReceta("seguidores_instagram");
