import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { esErrorTokenMetaVencido, MENSAJE_META_TOKEN_VENCIDO, ACCION_RECONECTAR_META } from "@/app/lib/metaErrors";
import { resolverCuentaInstagramDeLaPagina, diagnosticarCuentaInstagramDeLaPagina } from "@/app/lib/metaInstagramSalud";

// Flujo mínimo real de "Publicar en Instagram" -- existe SOLO para
// sostener el video de revisión de App Review de Meta del permiso
// instagram_content_publish (ver el plan de "Meta App Review" vigente).
// Deliberadamente chico: nada de tabla publicaciones_organicas, cron,
// reintentos ni estados persistidos -- eso es la Fase B de contenido
// orgánico, que sigue en pausa. Acá el "estado" (container_id, ig_user_id)
// lo guarda el propio cliente entre llamadas, nunca la base de datos.
//
// 3 acciones por POST (un solo archivo, sin [id] dinámico) porque las 3
// comparten exactamente la misma validación de admin+Meta -- separarlas
// en 3 archivos solo repetiría ese bloque 3 veces.
const GRAPH_API_VERSION = "v21.0";

type Accion = "crear_contenedor" | "verificar_estado" | "publicar";

async function resolverUsuarioAdmin(email: string) {
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, meta_page_id, meta_access_token")
    .eq("email", email.trim().toLowerCase())
    .single();
  return usuario;
}

async function resolverCuentaInstagram(pageId: string, accessToken: string) {
  const resolucion = await resolverCuentaInstagramDeLaPagina(pageId, accessToken);
  if ("tokenVencido" in resolucion) {
    return { error: MENSAJE_META_TOKEN_VENCIDO, accion: ACCION_RECONECTAR_META } as const;
  }
  if (!resolucion.encontrada) {
    return {
      error:
        "Necesitas que tu Instagram profesional esté vinculado a tu página de Facebook (Meta Business Manager → Cuentas de Instagram → Conectar activos) antes de publicar.",
    } as const;
  }
  return { igUserId: resolucion.igUserId } as const;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const usuario = await resolverUsuarioAdmin(session.user.email);
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  // Mismo criterio que las demás rutas de /api/admin -- esta función es
  // de prueba/demo, nunca de cliente.
  if (usuario.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (!usuario.meta_page_id || !usuario.meta_access_token) {
    return NextResponse.json({ error: "Conecta tu cuenta de Meta antes de probar esto." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const accion = body?.accion as Accion | undefined;

  if (accion === "crear_contenedor") {
    const albumId = body?.album_id;
    const caption = typeof body?.caption === "string" ? body.caption : "";
    if (typeof albumId !== "string") {
      return NextResponse.json({ error: "Falta el video del álbum a publicar." }, { status: 400 });
    }

    const { data: video } = await supabaseAdmin
      .from("album_creativos")
      .select("url_imagen, tipo")
      .eq("id", albumId)
      .eq("user_id", usuario.id)
      .single();

    if (!video || video.tipo !== "video") {
      return NextResponse.json({ error: "Ese video no existe en tu álbum." }, { status: 404 });
    }

    const ig = await resolverCuentaInstagram(usuario.meta_page_id, usuario.meta_access_token);
    if ("error" in ig) {
      return NextResponse.json({ error: ig.error, accion: "accion" in ig ? ig.accion : undefined }, { status: 400 });
    }

    try {
      const limiteRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${ig.igUserId}/content_publishing_limit?access_token=${usuario.meta_access_token}`
      );
      const limiteData = await limiteRes.json();
      const cupoUsado = limiteData?.data?.[0]?.quota_usage;
      const cupoTotal = limiteData?.data?.[0]?.config?.quota_total;
      if (typeof cupoUsado === "number" && typeof cupoTotal === "number" && cupoUsado >= cupoTotal) {
        return NextResponse.json(
          { error: `Llegaste al cupo de publicaciones de Instagram por hoy (${cupoUsado}/${cupoTotal}).` },
          { status: 400 }
        );
      }

      const mediaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${ig.igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "REELS",
          video_url: video.url_imagen,
          caption,
          share_to_feed: true,
          access_token: usuario.meta_access_token,
        }),
      });
      const mediaData = await mediaRes.json();
      if (esErrorTokenMetaVencido(mediaData.error)) {
        return NextResponse.json({ error: MENSAJE_META_TOKEN_VENCIDO, accion: ACCION_RECONECTAR_META }, { status: 400 });
      }
      if (!mediaData?.id) {
        console.error("Error creando contenedor de Instagram:", mediaData);
        return NextResponse.json({ error: mediaData?.error?.message || "Meta no aceptó el video." }, { status: 400 });
      }

      return NextResponse.json({ container_id: mediaData.id as string, ig_user_id: ig.igUserId });
    } catch (err) {
      console.error("Error creando contenedor de Instagram:", err);
      return NextResponse.json({ error: "No se pudo crear el contenedor en Instagram." }, { status: 500 });
    }
  }

  if (accion === "verificar_estado") {
    const containerId = body?.container_id;
    if (typeof containerId !== "string") {
      return NextResponse.json({ error: "Falta el contenedor a verificar." }, { status: 400 });
    }
    try {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${containerId}?fields=status_code&access_token=${usuario.meta_access_token}`
      );
      const data = await res.json();
      if (esErrorTokenMetaVencido(data.error)) {
        return NextResponse.json({ error: MENSAJE_META_TOKEN_VENCIDO, accion: ACCION_RECONECTAR_META }, { status: 400 });
      }
      return NextResponse.json({ status_code: data.status_code as string | undefined });
    } catch (err) {
      console.error("Error verificando contenedor de Instagram:", err);
      return NextResponse.json({ error: "No se pudo verificar el estado del video en Instagram." }, { status: 500 });
    }
  }

  if (accion === "publicar") {
    const containerId = body?.container_id;
    const igUserId = body?.ig_user_id;
    if (typeof containerId !== "string" || typeof igUserId !== "string") {
      return NextResponse.json({ error: "Falta el contenedor a publicar." }, { status: 400 });
    }
    try {
      const publishRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: containerId, access_token: usuario.meta_access_token }),
      });
      const publishData = await publishRes.json();
      if (esErrorTokenMetaVencido(publishData.error)) {
        return NextResponse.json({ error: MENSAJE_META_TOKEN_VENCIDO, accion: ACCION_RECONECTAR_META }, { status: 400 });
      }
      if (!publishData?.id) {
        console.error("Error publicando en Instagram:", publishData);
        return NextResponse.json({ error: publishData?.error?.message || "Meta no publicó el video." }, { status: 400 });
      }

      const permalinkRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${publishData.id}?fields=permalink&access_token=${usuario.meta_access_token}`
      );
      const permalinkData = await permalinkRes.json();

      return NextResponse.json({ media_id: publishData.id as string, permalink: permalinkData?.permalink as string | undefined });
    } catch (err) {
      console.error("Error publicando en Instagram:", err);
      return NextResponse.json({ error: "No se pudo publicar el video en Instagram." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}

// GET -- diagnóstico, pedido por Juan José tras el error real "(#10)
// Application does not have permission for this action" al publicar.
// Nunca devuelve el token en sí, solo METADATOS sobre la conexión:
// qué permisos tiene el token guardado (GET /me/permissions -- lo
// único que de verdad dice si Meta ya le dio Acceso avanzado/estándar
// a cada permiso, o si ni siquiera está pedido), el META_CONFIG_ID de
// este ambiente (solo el número, no es secreto -- es público en la URL
// de /api/meta/conectar) y el tipo de cuenta de Instagram vinculada.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const usuario = await resolverUsuarioAdmin(session.user.email);
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  if (usuario.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const metaConfigId = process.env.META_CONFIG_ID || null;

  if (!usuario.meta_page_id || !usuario.meta_access_token) {
    return NextResponse.json({ meta_config_id: metaConfigId, permisos: [], instagram: null, error: "Conecta tu cuenta de Meta primero." });
  }

  let permisos: { permission: string; status: string }[] = [];
  try {
    const permisosRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/permissions?access_token=${usuario.meta_access_token}`
    );
    const permisosData = await permisosRes.json();
    if (Array.isArray(permisosData?.data)) {
      permisos = permisosData.data.map((p: { permission: string; status: string }) => ({ permission: p.permission, status: p.status }));
    }
  } catch (err) {
    console.error("Error consultando /me/permissions:", err);
  }

  // Diagnóstico crudo pedido explícito tras el error "(#10)": compara
  // instagram_business_account vs. connected_instagram_account, con el
  // token de usuario y con el de la página, en vez de asumir cuál de
  // los 2 campos tiene el id -- ver app/lib/metaInstagramSalud.ts.
  let diagnosticoCuenta;
  try {
    diagnosticoCuenta = await diagnosticarCuentaInstagramDeLaPagina(usuario.meta_page_id, usuario.meta_access_token);
  } catch (err) {
    console.error("Error diagnosticando la cuenta de Instagram:", err);
    diagnosticoCuenta = null;
  }

  // instagram se deriva DIRECTO de diagnosticoCuenta.resolucion -- la
  // misma fuente de verdad que ya usa publicar (nunca una llamada
  // aparte que pudiera responder algo distinto, que era como se
  // explicaba el bug real "dice no conectada aunque publicar funciona").
  const resolucion = diagnosticoCuenta?.resolucion;
  const instagram =
    resolucion && "encontrada" in resolucion && resolucion.encontrada
      ? { conectado: true, igUserId: resolucion.igUserId, username: resolucion.username, account_type: diagnosticoCuenta?.accountType ?? null }
      : { conectado: false, igUserId: null, username: null, account_type: null };

  return NextResponse.json({
    meta_config_id: metaConfigId,
    permisos,
    instagram,
    diagnostico_cuenta: diagnosticoCuenta,
  });
}
