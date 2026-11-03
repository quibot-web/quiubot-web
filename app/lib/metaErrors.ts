import "server-only";

// Codigo base de Meta para OAuthException -- token vencido, revocado, o la
// contrasena del usuario de Facebook cambio. Es el unico que de verdad
// significa "hay que reconectar", a diferencia de otros errores de Graph
// API que son casos puntuales (ver MENSAJES_AMIGABLES en
// publicarEstrategiaJobs.ts para esos).
export const CODIGO_META_TOKEN_VENCIDO = 190;

export const MENSAJE_META_TOKEN_VENCIDO = "Tu conexión con Meta venció. Reconéctala para seguir publicando.";
export const ACCION_RECONECTAR_META = { texto: "Reconectar Meta", url: "/api/meta/conectar" };

export function esErrorTokenMetaVencido(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { code?: unknown }).code === CODIGO_META_TOKEN_VENCIDO;
}

// Nombre de la cookie del nonce anti-CSRF del OAuth de Meta -- vive aquí
// (no en app/api/meta/conectar/route.ts) porque un route.ts de Next solo
// puede exportar handlers HTTP y config de segmento; cualquier otro
// export ahí rompe la validación de tipos de rutas en el build.
export const COOKIE_STATE_META = "meta_oauth_state";
