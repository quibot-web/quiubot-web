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

type ProbeCuentaInstagram = {
  conTokenUsuario: RespuestaCuentaInstagram;
  conTokenPagina: RespuestaCuentaInstagram | null;
  // El valor real del token de página (nunca expuesto fuera de este
  // archivo) -- se guarda acá para poder reusarlo en un chequeo
  // adicional (como account_type) con el MISMO token que de verdad
  // resolvió el enlace, en vez de volver a adivinar cuál token probar.
  tokenPaginaValor: string | null;
};

// UNA sola ronda de llamadas reales a Meta -- resolverCuentaInstagramDeLaPagina
// y diagnosticarCuentaInstagramDeLaPagina comparten esto en vez de cada una
// volver a pedirle a Meta lo mismo (antes diagnosticarCuentaInstagramDeLaPagina
// llamaba a resolverCuentaInstagramDeLaPagina DE NUEVO al final, duplicando
// las mismas 2-4 llamadas -- cualquier respuesta distinta entre esas 2 rondas
// volvía inconsistente lo que mostraba el diagnóstico contra lo que de verdad
// usaba publicar). Se prueba en orden hasta encontrar un id:
//   1. instagram_business_account con el token de usuario (lo único que se
//      probaba antes del 18 nov 2026).
//   2. connected_instagram_account con el mismo token -- campo más nuevo que
//      usan páginas vinculadas por una vía distinta a la clásica
//      "Configuración de la página -> Instagram".
//   3 y 4. los mismos 2 campos otra vez, con el token DE LA PÁGINA en vez
//      del de usuario -- algunas páginas solo resuelven el enlace con su
//      propio token, no con el del usuario que la administra.
async function probarCuentaInstagram(pageId: string, userAccessToken: string): Promise<ProbeCuentaInstagram> {
  const conTokenUsuario = await consultarCuentaInstagram(pageId, userAccessToken);
  if (esErrorTokenMetaVencido(conTokenUsuario.error) || elegirCampoConId(conTokenUsuario, "usuario")) {
    return { conTokenUsuario, conTokenPagina: null, tokenPaginaValor: null };
  }
  const tokenPagina = await obtenerTokenDePagina(pageId, userAccessToken);
  if (!tokenPagina) return { conTokenUsuario, conTokenPagina: null, tokenPaginaValor: null };
  const conTokenPagina = await consultarCuentaInstagram(pageId, tokenPagina);
  return { conTokenUsuario, conTokenPagina, tokenPaginaValor: tokenPagina };
}

function resolverDesdeProbe(probe: ProbeCuentaInstagram): ResolucionCuentaInstagram {
  if (esErrorTokenMetaVencido(probe.conTokenUsuario.error)) return { tokenVencido: true };
  const resueltaConUsuario = elegirCampoConId(probe.conTokenUsuario, "usuario");
  if (resueltaConUsuario) return resueltaConUsuario;
  if (probe.conTokenPagina) {
    if (esErrorTokenMetaVencido(probe.conTokenPagina.error)) return { tokenVencido: true };
    return elegirCampoConId(probe.conTokenPagina, "pagina") ?? { encontrada: false };
  }
  return { encontrada: false };
}

// Resuelve qué cuenta de Instagram está vinculada a una página de
// Facebook, en un solo lugar compartido -- obtenerSaludInstagram (meta
// seguidores_instagram), publicar-estrategia (objetivo seguidores_instagram)
// y /api/admin/publicar-instagram-prueba (publicar un reel) usaban 3
// copias de la MISMA llamada (fields=instagram_business_account{...} con
// el token de usuario), y solo esa. Caso real que lo motivó (18 nov 2026):
// una cuenta de Instagram vinculada de verdad a la página Quiubot
// (confirmada por Juan José en el panel de Meta) que instagram_business_account
// + token de usuario no encontraba.
export async function resolverCuentaInstagramDeLaPagina(
  pageId: string,
  userAccessToken: string
): Promise<ResolucionCuentaInstagram> {
  return resolverDesdeProbe(await probarCuentaInstagram(pageId, userAccessToken));
}

// Diagnóstico de la resolución de arriba, crudo -- pedido explícito
// para /admin/publicar-instagram-prueba: muestra CADA combinación de
// campo x token probada, no solo la respuesta final elegida, para poder
// comparar a mano cuál de las 2 vías es la que de verdad tiene el id.
// Nunca devuelve ningún token, solo lo que Meta respondió para cada id.
// `resolucion` se deriva del MISMO probe de abajo (nunca pide a Meta una
// segunda vez), así que lo que muestra la tabla y lo que dice "id a usar"
// nunca pueden divergir entre sí.
export type DiagnosticoCuentaInstagram = {
  pageId: string;
  conTokenUsuario: { instagram_business_account: string | null; connected_instagram_account: string | null; error: string | null };
  conTokenPagina: { instagram_business_account: string | null; connected_instagram_account: string | null; error: string | null } | null;
  resolucion: ResolucionCuentaInstagram;
  // Solo si Meta lo devuelve -- ni todas las cuentas ni todas las vías
  // de login lo exponen (ver el nodo IG User de la Graph API). Nunca se
  // inventa ni se asume un valor por defecto.
  accountType: string | null;
};

function resumenError(data: RespuestaCuentaInstagram): string | null {
  const error = data.error as { message?: string } | undefined;
  return error?.message ?? null;
}

function mapearCampos(data: RespuestaCuentaInstagram) {
  return {
    instagram_business_account: data.instagram_business_account?.id ?? null,
    connected_instagram_account: data.connected_instagram_account?.id ?? null,
    error: resumenError(data),
  };
}

export async function diagnosticarCuentaInstagramDeLaPagina(
  pageId: string,
  userAccessToken: string
): Promise<DiagnosticoCuentaInstagram> {
  const probe = await probarCuentaInstagram(pageId, userAccessToken);
  const resolucion = resolverDesdeProbe(probe);

  let accountType: string | null = null;
  if ("encontrada" in resolucion && resolucion.encontrada) {
    // El MISMO token que resolvió el enlace -- si fue con el token de la
    // página, se reusa ese, nunca el de usuario (que puede no tener
    // visibilidad sobre este nodo específico si la página solo resuelve
    // con su propio token).
    const tokenParaConsultar = resolucion.tokenUsado === "pagina" ? probe.tokenPaginaValor : userAccessToken;
    if (tokenParaConsultar) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${resolucion.igUserId}?fields=account_type&access_token=${tokenParaConsultar}`
        );
        const data = await res.json();
        accountType = typeof data?.account_type === "string" ? data.account_type : null;
      } catch (err) {
        console.error("Error consultando account_type para diagnóstico:", err);
      }
    }
  }

  return {
    pageId,
    conTokenUsuario: mapearCampos(probe.conTokenUsuario),
    conTokenPagina: probe.conTokenPagina ? mapearCampos(probe.conTokenPagina) : null,
    resolucion,
    accountType,
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
