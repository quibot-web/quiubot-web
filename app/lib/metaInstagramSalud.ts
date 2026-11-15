// Chequeo de vinculación de Instagram -- movido de
// app/api/meta/instagram/salud/route.ts (que ahora delega acá) para
// poder reusarlo server-side desde verificarRequisitosMeta()
// (app/lib/metas.ts), igual que metaPixelSalud.ts.
import { esErrorTokenMetaVencido } from "@/app/lib/metaErrors";

const GRAPH_API_VERSION = "v21.0";

export type SaludInstagram = {
  conectado: boolean;
  username: string | null;
  followers_count: number | null;
  // Distinto de "nunca vinculado" -- antes POST /api/metas sí distinguía
  // esto (mostraba MENSAJE_META_TOKEN_VENCIDO) pero /api/meta/instagram/salud
  // nunca lo chequeó, tratando un token vencido igual que "no vinculado".
  // Se agrega acá para que verificarRequisitosMeta() pueda mostrar el
  // mensaje correcto sin perder esa distinción.
  tokenVencido: boolean;
};

export type UsuarioMetaInstagram = {
  meta_page_id: string | null;
  meta_access_token: string | null;
};

type CampoCuentaInstagram = "instagram_business_account" | "connected_instagram_account";
type TokenUsado = "usuario" | "pagina";

export type ResolucionCuentaInstagram =
  | { encontrada: true; igUserId: string; username: string | null; campo: CampoCuentaInstagram; tokenUsado: TokenUsado }
  | { encontrada: false }
  | { tokenVencido: true };

type RespuestaCuentaInstagram = {
  instagram_business_account?: { id?: string; username?: string };
  connected_instagram_account?: { id?: string; username?: string };
  error?: unknown;
};

async function consultarCuentaInstagram(pageId: string, accessToken: string): Promise<RespuestaCuentaInstagram> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}?fields=instagram_business_account{id,username},connected_instagram_account{id,username}&access_token=${accessToken}`
  );
  return res.json();
}

// El token de usuario no siempre alcanza para resolver el enlace de una
// página con Instagram (ver resolverCuentaInstagramDeLaPagina) -- esto
// saca el token PROPIO de la página desde /me/accounts (mismo edge que
// ya usan meta/callback y meta/cuentas, agregando access_token al
// listado de fields). Nunca se guarda en la base, solo vive en memoria
// durante esta resolución.
async function obtenerTokenDePagina(pageId: string, userAccessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?fields=id,access_token&access_token=${userAccessToken}`
    );
    const data = await res.json();
    const paginas: { id?: string; access_token?: string }[] = Array.isArray(data?.data) ? data.data : [];
    return paginas.find((p) => p.id === pageId)?.access_token ?? null;
  } catch (err) {
    console.error("Error obteniendo el token de la página desde /me/accounts:", err);
    return null;
  }
}

function elegirCampoConId(data: RespuestaCuentaInstagram, tokenUsado: TokenUsado): ResolucionCuentaInstagram | null {
  const ig = data.instagram_business_account;
  if (ig?.id) {
    return { encontrada: true, igUserId: ig.id, username: ig.username ?? null, campo: "instagram_business_account", tokenUsado };
  }
  const conectada = data.connected_instagram_account;
  if (conectada?.id) {
    return { encontrada: true, igUserId: conectada.id, username: conectada.username ?? null, campo: "connected_instagram_account", tokenUsado };
  }
  return null;
}

// Resuelve qué cuenta de Instagram está vinculada a una página de
// Facebook, en un solo lugar compartido -- obtenerSaludInstagram (meta
// seguidores_instagram), publicar-estrategia (objetivo seguidores_instagram)
// y /api/admin/publicar-instagram-prueba (publicar un reel) usaban 3
// copias de la MISMA llamada (fields=instagram_business_account{...} con
// el token de usuario), y solo esa.
//
// Caso real que lo motivó (18 nov 2026): una cuenta de Instagram
// vinculada de verdad a la página Quiubot (confirmada por Juan José en
// el panel de Meta) que instagram_business_account + token de usuario no
// encontraba. Se prueba en orden hasta encontrar un id:
//   1. instagram_business_account con el token de usuario (lo único que
//      se probaba antes de hoy).
//   2. connected_instagram_account con el token de usuario -- campo más
//      nuevo que usan páginas vinculadas por una vía distinta a la
//      clásica "Configuración de la página -> Instagram".
//   3 y 4. los mismos 2 campos otra vez, con el token DE LA PÁGINA en
//      vez del de usuario -- algunas páginas solo resuelven el enlace
//      con su propio token, no con el del usuario que la administra.
export async function resolverCuentaInstagramDeLaPagina(
  pageId: string,
  userAccessToken: string
): Promise<ResolucionCuentaInstagram> {
  const conTokenUsuario = await consultarCuentaInstagram(pageId, userAccessToken);
  if (esErrorTokenMetaVencido(conTokenUsuario.error)) return { tokenVencido: true };

  const resueltaConUsuario = elegirCampoConId(conTokenUsuario, "usuario");
  if (resueltaConUsuario) return resueltaConUsuario;

  const tokenPagina = await obtenerTokenDePagina(pageId, userAccessToken);
  if (!tokenPagina) return { encontrada: false };

  const conTokenPagina = await consultarCuentaInstagram(pageId, tokenPagina);
  if (esErrorTokenMetaVencido(conTokenPagina.error)) return { tokenVencido: true };

  return elegirCampoConId(conTokenPagina, "pagina") ?? { encontrada: false };
}

// Diagnóstico de la resolución de arriba, crudo -- pedido explícito
// para /admin/publicar-instagram-prueba: muestra CADA combinación de
// campo x token probada, no solo la respuesta final elegida, para poder
// comparar a mano cuál de las 2 vías es la que de verdad tiene el id.
// Nunca devuelve ningún token, solo lo que Meta respondió para cada id.
export type DiagnosticoCuentaInstagram = {
  pageId: string;
  conTokenUsuario: { instagram_business_account: string | null; connected_instagram_account: string | null; error: string | null };
  conTokenPagina: { instagram_business_account: string | null; connected_instagram_account: string | null; error: string | null } | null;
  resolucion: ResolucionCuentaInstagram;
};

function resumenError(data: RespuestaCuentaInstagram): string | null {
  const error = data.error as { message?: string } | undefined;
  return error?.message ?? null;
}

export async function diagnosticarCuentaInstagramDeLaPagina(
  pageId: string,
  userAccessToken: string
): Promise<DiagnosticoCuentaInstagram> {
  const conTokenUsuario = await consultarCuentaInstagram(pageId, userAccessToken);
  const tokenPagina = await obtenerTokenDePagina(pageId, userAccessToken);
  const conTokenPagina = tokenPagina ? await consultarCuentaInstagram(pageId, tokenPagina) : null;

  return {
    pageId,
    conTokenUsuario: {
      instagram_business_account: conTokenUsuario.instagram_business_account?.id ?? null,
      connected_instagram_account: conTokenUsuario.connected_instagram_account?.id ?? null,
      error: resumenError(conTokenUsuario),
    },
    conTokenPagina: conTokenPagina
      ? {
          instagram_business_account: conTokenPagina.instagram_business_account?.id ?? null,
          connected_instagram_account: conTokenPagina.connected_instagram_account?.id ?? null,
          error: resumenError(conTokenPagina),
        }
      : null,
    resolucion: await resolverCuentaInstagramDeLaPagina(pageId, userAccessToken),
  };
}

// ¿Tiene una cuenta de Instagram profesional vinculada a su página de
// Facebook? Lo usa /metas/crear para decidir si ofrece seguidores_instagram
// (no se puede fotografiar lo que no existe), igual que metaPixelSalud.ts
// decide si ofrece ventas_web.
export async function obtenerSaludInstagram(usuario: UsuarioMetaInstagram): Promise<SaludInstagram> {
  if (!usuario.meta_page_id || !usuario.meta_access_token) {
    return { conectado: false, username: null, followers_count: null, tokenVencido: false };
  }

  try {
    const resolucion = await resolverCuentaInstagramDeLaPagina(usuario.meta_page_id, usuario.meta_access_token);
    if ("tokenVencido" in resolucion) {
      return { conectado: false, username: null, followers_count: null, tokenVencido: true };
    }
    if (!resolucion.encontrada) {
      return { conectado: false, username: null, followers_count: null, tokenVencido: false };
    }

    // Una vez resuelto el id, los seguidores se leen directo del nodo del
    // usuario de Instagram -- da igual por cuál de los 2 campos/tokens se
    // encontró el id, este nodo es el mismo.
    const followersRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${resolucion.igUserId}?fields=followers_count&access_token=${usuario.meta_access_token}`
    );
    const followersData = await followersRes.json();

    return {
      conectado: true,
      username: resolucion.username,
      followers_count: typeof followersData.followers_count === "number" ? followersData.followers_count : null,
      tokenVencido: false,
    };
  } catch (err) {
    console.error("Error consultando salud de Instagram:", err);
    return { conectado: false, username: null, followers_count: null, tokenVencido: false };
  }
}
