import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  resolverCuentaInstagramParaPublicar,
  crearContenedorInstagram,
  verificarEstadoContenedorInstagram,
  publicarContenedorInstagram,
} from "@/app/lib/instagramPublicar";

// Publicar un video del álbum como Reel en Instagram -- función real
// para cualquier usuario con Meta e Instagram conectados, no solo
// admin (Meta exige que instagram_content_publish se use en una
// función para usuarios reales al revisar la app). La lógica contra
// Meta vive en app/lib/instagramPublicar.ts; esta ruta solo valida la
// sesión y que el video sea del propio usuario.
type Accion = "crear_contenedor" | "verificar_estado" | "publicar";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, meta_page_id, meta_access_token")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  if (!usuario.meta_page_id || !usuario.meta_access_token) {
    return NextResponse.json({ error: "Conecta tu cuenta de Meta en Integraciones antes de publicar en Instagram." }, { status: 400 });
  }

  const { id: albumId } = await params;
  const body = await req.json().catch(() => null);
  const accion = body?.accion as Accion | undefined;

  if (accion === "crear_contenedor") {
    const caption = typeof body?.caption === "string" ? body.caption : "";

    const { data: video } = await supabaseAdmin
      .from("album_creativos")
      .select("url_imagen, tipo")
      .eq("id", albumId)
      .eq("user_id", usuario.id)
      .single();

    if (!video || video.tipo !== "video") {
      return NextResponse.json({ error: "Ese video no existe en tu álbum." }, { status: 404 });
    }

    const ig = await resolverCuentaInstagramParaPublicar(usuario.meta_page_id, usuario.meta_access_token);
    if ("error" in ig) {
      return NextResponse.json(ig, { status: 400 });
    }

    const resultado = await crearContenedorInstagram({
      igUserId: ig.igUserId,
      accessToken: usuario.meta_access_token,
      videoUrl: video.url_imagen,
      caption,
    });
    if ("error" in resultado) {
      return NextResponse.json(resultado, { status: 400 });
    }
    return NextResponse.json({ container_id: resultado.container_id, ig_user_id: ig.igUserId });
  }

  if (accion === "verificar_estado") {
    const containerId = body?.container_id;
    if (typeof containerId !== "string") {
      return NextResponse.json({ error: "Falta el contenedor a verificar." }, { status: 400 });
    }
    const resultado = await verificarEstadoContenedorInstagram({ accessToken: usuario.meta_access_token, containerId });
    if ("error" in resultado) {
      return NextResponse.json(resultado, { status: 400 });
    }
    return NextResponse.json(resultado);
  }

  if (accion === "publicar") {
    const containerId = body?.container_id;
    const igUserId = body?.ig_user_id;
    if (typeof containerId !== "string" || typeof igUserId !== "string") {
      return NextResponse.json({ error: "Falta el contenedor a publicar." }, { status: 400 });
    }
    const resultado = await publicarContenedorInstagram({ accessToken: usuario.meta_access_token, igUserId, containerId });
    if ("error" in resultado) {
      return NextResponse.json(resultado, { status: 400 });
    }
    return NextResponse.json(resultado);
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}
