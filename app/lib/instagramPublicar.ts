import "server-only";
import { esErrorTokenMetaVencido, MENSAJE_META_TOKEN_VENCIDO, ACCION_RECONECTAR_META } from "@/app/lib/metaErrors";
import { resolverCuentaInstagramDeLaPagina } from "@/app/lib/metaInstagramSalud";

// Publicar un video del álbum como Reel en Instagram -- función real
// para cualquier usuario con Meta e Instagram conectados (no solo
// admin: Meta exige que instagram_content_publish se use en una
// función real para usuarios reales, no solo en una pantalla de
// prueba). Usada por app/api/album/[id]/publicar-instagram/route.ts.
// Deliberadamente sin tabla ni cron propios -- el "estado" del
// contenedor lo guarda el cliente entre llamadas, igual que antes.
const GRAPH_API_VERSION = "v21.0";

// tipo/detalle: solo para el publicador automático (cron
// publicar-organico), que necesita distinguir qué hacer con la pieza
// (reintentar, pedir reconexión, dar por fallida). "error" sigue siendo
// el único texto apto para mostrarle al usuario -- "detalle" es la
// respuesta cruda de Meta, solo para registrarError, nunca se devuelve
// a un cliente (la ruta del álbum la quita antes de responder).
export type TipoErrorInstagram = "cupo" | "reconexion" | "permiso" | "transitorio" | "rechazo" | "sin_instagram";
export type ErrorPublicarInstagram = { error: string; accion?: typeof ACCION_RECONECTAR_META; tipo?: TipoErrorInstagram; detalle?: string };

// Códigos de Graph API que Meta documenta como pasajeros (error
// desconocido/temporal, límite de llamadas) -- vale la pena reintentar
// en la siguiente corrida. 10 y 200-299 son permisos faltantes: ningún
// reintento los arregla, hay que reconectar.
const CODIGOS_META_TRANSITORIOS = new Set([1, 2, 4, 17, 32, 341, 613]);

export function clasificarErrorMeta(error: unknown, statusHttp?: number): TipoErrorInstagram {
  const e = (error && typeof error === "object" ? error : {}) as { code?: unknown; is_transient?: unknown };
  if (esErrorTokenMetaVencido(error)) return "reconexion";
  if (typeof e.code === "number" && (e.code === 10 || (e.code >= 200 && e.code <= 299))) return "permiso";
  if (e.is_transient === true) return "transitorio";
  if (typeof e.code === "number" && CODIGOS_META_TRANSITORIOS.has(e.code)) return "transitorio";
  if (typeof statusHttp === "number" && statusHttp >= 500) return "transitorio";
  return "rechazo";
}

function detalleCrudo(valor: unknown): string {
  try {
    return typeof valor === "string" ? valor : JSON.stringify(valor);
  } catch {
    return String(valor);
  }
}

export async function resolverCuentaInstagramParaPublicar(
  pageId: string,
  accessToken: string
): Promise<{ igUserId: string } | ErrorPublicarInstagram> {
  const resolucion = await resolverCuentaInstagramDeLaPagina(pageId, accessToken);
  if ("tokenVencido" in resolucion) {
    return { error: MENSAJE_META_TOKEN_VENCIDO, accion: ACCION_RECONECTAR_META, tipo: "reconexion" };
  }
  if (!resolucion.encontrada) {
    return {
      tipo: "sin_instagram",
      error:
        "Necesitas que tu Instagram profesional esté vinculado a tu página de Facebook (Meta Business Manager → Cuentas de Instagram → Conectar activos) antes de publicar.",
    };
  }
  return { igUserId: resolucion.igUserId };
}

// Cupo de publicaciones por API de Instagram (ventana móvil de 24h).
// null = no se pudo saber (Meta no respondió el formato esperado) -- en
// ese caso se sigue de largo, igual que antes: el propio POST /media
// fallaría si de verdad no hay cupo.
export async function consultarCupoInstagram({
  igUserId,
  accessToken,
}: {
  igUserId: string;
  accessToken: string;
}): Promise<{ usado: number; total: number; lleno: boolean } | { tokenVencido: true } | null> {
  try {
    const limiteRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/content_publishing_limit?fields=quota_usage,config&access_token=${accessToken}`
    );
    const limiteData = await limiteRes.json();
    if (esErrorTokenMetaVencido(limiteData?.error)) return { tokenVencido: true };
    const cupoUsado = limiteData?.data?.[0]?.quota_usage;
    const cupoTotal = limiteData?.data?.[0]?.config?.quota_total;
    if (typeof cupoUsado === "number" && typeof cupoTotal === "number") {
      return { usado: cupoUsado, total: cupoTotal, lleno: cupoUsado >= cupoTotal };
    }
    return null;
  } catch (err) {
    console.error("Error consultando el cupo de publicaciones de Instagram:", err);
    return null;
  }
}

export async function crearContenedorInstagram({
  igUserId,
  accessToken,
  videoUrl,
  caption,
  omitirRevisionCupo = false,
}: {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
  // El publicador automático ya revisó el cupo él mismo antes de
  // llamar acá (necesita distinguir "cupo lleno" de un error real).
  omitirRevisionCupo?: boolean;
}): Promise<{ container_id: string } | ErrorPublicarInstagram> {
  try {
    if (!omitirRevisionCupo) {
      const cupo = await consultarCupoInstagram({ igUserId, accessToken });
      if (cupo && "lleno" in cupo && cupo.lleno) {
        return { error: `Llegaste al cupo de publicaciones de Instagram por hoy (${cupo.usado}/${cupo.total}).`, tipo: "cupo" };
      }
    }

    const mediaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "REELS",
        video_url: videoUrl,
        caption,
        share_to_feed: true,
        access_token: accessToken,
      }),
    });
    const mediaData = await mediaRes.json();
    if (esErrorTokenMetaVencido(mediaData.error)) {
      return { error: MENSAJE_META_TOKEN_VENCIDO, accion: ACCION_RECONECTAR_META, tipo: "reconexion" };
    }
    if (!mediaData?.id) {
      console.error("Error creando contenedor de Instagram:", mediaData);
      return { error: "Meta no aceptó el video.", tipo: clasificarErrorMeta(mediaData?.error, mediaRes.status), detalle: detalleCrudo(mediaData) };
    }

    return { container_id: mediaData.id as string };
  } catch (err) {
    console.error("Error creando contenedor de Instagram:", err);
    return { error: "No se pudo crear el contenedor en Instagram.", tipo: "transitorio", detalle: detalleCrudo(String(err)) };
  }
}

export async function verificarEstadoContenedorInstagram({
  accessToken,
  containerId,
}: {
  accessToken: string;
  containerId: string;
}): Promise<{ status_code?: string } | ErrorPublicarInstagram> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const data = await res.json();
    if (esErrorTokenMetaVencido(data.error)) {
      return { error: MENSAJE_META_TOKEN_VENCIDO, accion: ACCION_RECONECTAR_META, tipo: "reconexion" };
    }
    if (data?.error) {
      return { error: "No se pudo verificar el estado del video en Instagram.", tipo: clasificarErrorMeta(data.error, res.status), detalle: detalleCrudo(data) };
    }
    return { status_code: data.status_code as string | undefined };
  } catch (err) {
    console.error("Error verificando contenedor de Instagram:", err);
    return { error: "No se pudo verificar el estado del video en Instagram.", tipo: "transitorio", detalle: detalleCrudo(String(err)) };
  }
}

export async function publicarContenedorInstagram({
  accessToken,
  igUserId,
  containerId,
}: {
  accessToken: string;
  igUserId: string;
  containerId: string;
}): Promise<{ media_id: string; permalink?: string } | ErrorPublicarInstagram> {
  try {
    const publishRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
    });
    const publishData = await publishRes.json();
    if (esErrorTokenMetaVencido(publishData.error)) {
      return { error: MENSAJE_META_TOKEN_VENCIDO, accion: ACCION_RECONECTAR_META, tipo: "reconexion" };
    }
    if (!publishData?.id) {
      console.error("Error publicando en Instagram:", publishData);
      return { error: "Meta no publicó el video.", tipo: clasificarErrorMeta(publishData?.error, publishRes.status), detalle: detalleCrudo(publishData) };
    }

    // Ya está publicado -- si falla solo la consulta del permalink, se
    // devuelve igual el media_id (nunca un error: eso haría creer que no
    // se publicó, y alguien podría volver a programarlo).
    let permalink: string | undefined;
    try {
      const permalinkRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${publishData.id}?fields=permalink&access_token=${accessToken}`
      );
      const permalinkData = await permalinkRes.json();
      permalink = typeof permalinkData?.permalink === "string" ? permalinkData.permalink : undefined;
    } catch (err) {
      console.error("Reel publicado, pero no se pudo leer su permalink:", err);
    }

    return { media_id: publishData.id as string, permalink };
  } catch (err) {
    console.error("Error publicando en Instagram:", err);
    return { error: "No se pudo publicar el video en Instagram.", tipo: "transitorio", detalle: detalleCrudo(String(err)) };
  }
}
