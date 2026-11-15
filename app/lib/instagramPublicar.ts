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

export type ErrorPublicarInstagram = { error: string; accion?: typeof ACCION_RECONECTAR_META };

export async function resolverCuentaInstagramParaPublicar(
  pageId: string,
  accessToken: string
): Promise<{ igUserId: string } | ErrorPublicarInstagram> {
  const resolucion = await resolverCuentaInstagramDeLaPagina(pageId, accessToken);
  if ("tokenVencido" in resolucion) {
    return { error: MENSAJE_META_TOKEN_VENCIDO, accion: ACCION_RECONECTAR_META };
  }
  if (!resolucion.encontrada) {
    return {
      error:
        "Necesitas que tu Instagram profesional esté vinculado a tu página de Facebook (Meta Business Manager → Cuentas de Instagram → Conectar activos) antes de publicar.",
    };
  }
  return { igUserId: resolucion.igUserId };
}

export async function crearContenedorInstagram({
  igUserId,
  accessToken,
  videoUrl,
  caption,
}: {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
}): Promise<{ container_id: string } | ErrorPublicarInstagram> {
  try {
    const limiteRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/content_publishing_limit?access_token=${accessToken}`
    );
    const limiteData = await limiteRes.json();
    const cupoUsado = limiteData?.data?.[0]?.quota_usage;
    const cupoTotal = limiteData?.data?.[0]?.config?.quota_total;
    if (typeof cupoUsado === "number" && typeof cupoTotal === "number" && cupoUsado >= cupoTotal) {
      return { error: `Llegaste al cupo de publicaciones de Instagram por hoy (${cupoUsado}/${cupoTotal}).` };
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
      return { error: MENSAJE_META_TOKEN_VENCIDO, accion: ACCION_RECONECTAR_META };
    }
    if (!mediaData?.id) {
      console.error("Error creando contenedor de Instagram:", mediaData);
      return { error: "Meta no aceptó el video." };
    }

    return { container_id: mediaData.id as string };
  } catch (err) {
    console.error("Error creando contenedor de Instagram:", err);
    return { error: "No se pudo crear el contenedor en Instagram." };
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
      return { error: MENSAJE_META_TOKEN_VENCIDO, accion: ACCION_RECONECTAR_META };
    }
    return { status_code: data.status_code as string | undefined };
  } catch (err) {
    console.error("Error verificando contenedor de Instagram:", err);
    return { error: "No se pudo verificar el estado del video en Instagram." };
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
      return { error: MENSAJE_META_TOKEN_VENCIDO, accion: ACCION_RECONECTAR_META };
    }
    if (!publishData?.id) {
      console.error("Error publicando en Instagram:", publishData);
      return { error: "Meta no publicó el video." };
    }

    const permalinkRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${publishData.id}?fields=permalink&access_token=${accessToken}`
    );
    const permalinkData = await permalinkRes.json();

    return { media_id: publishData.id as string, permalink: permalinkData?.permalink as string | undefined };
  } catch (err) {
    console.error("Error publicando en Instagram:", err);
    return { error: "No se pudo publicar el video en Instagram." };
  }
}
