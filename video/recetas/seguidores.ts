import type { RecetaObjetivo } from "./tipos";

// seguidores_facebook (botón real LIKE_PAGE) y seguidores_instagram
// (VIEW_INSTAGRAM_PROFILE) comparten enfoque y estructura, pero el CTA
// real es distinto en cada uno (anexo_reglas_copy_y_cta.md): Facebook no
// lleva @usuario (el botón va a la Página, no a un perfil), Instagram sí.
function construirReceta(
  objetivoId: "seguidores_facebook" | "seguidores_instagram",
  textoCtaSugerido: string,
  requiereUsuarioEnCta: boolean
): RecetaObjetivo {
  return {
    objetivoId,
    enfoque: "Valor en serie: \"esto y más si nos sigues\". Un consejo, truco o tendencia del rubro de la marca.",
    duracionMinS: 8,
    duracionMaxS: 15,
    bloques: ["gancho", "valor", "cta"],
    bucleTipico: "\"Parte 1 de...\" / \"sigue para la parte 2\" -- usa lista_numerada en el bloque de valor para cerrar el bucle en \"contador\".",
    indicadorBucle: "contador",
    accionCta: "seguir",
    textoCtaSugerido,
    requiereUsuarioEnCta,
  };
}

export const recetaSeguidoresFacebook = construirReceta("seguidores_facebook", "Síguenos en Facebook", false);
export const recetaSeguidoresInstagram = construirReceta("seguidores_instagram", "Síguenos en Instagram @usuario", true);
