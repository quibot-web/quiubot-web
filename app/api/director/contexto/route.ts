// Paso 3/6 de la burbuja del Director -- resumen de cuenta para las
// tarjetas de contexto del chat (conexiones, metas activas, campañas,
// propuestas pendientes). Puro backend, sin IA: el "cerebro" del
// Director (Paso 4) consume esto como datos, nunca los calcula él
// mismo. No existía ningún endpoint que juntara todo esto en una sola
// llamada -- lo más cercano era home-resumen (metas/campañas/pendientes)
// y meta/estado (solo Meta/píxel), repartidos.
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { obtenerSaludInstagram } from "@/app/lib/metaInstagramSalud";
import { obtenerPropuestasPendientes } from "@/app/lib/propuestas";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select(
      "id, openai_key, cloudinary_name, cloudinary_key, cloudinary_secret, meta_ad_account_id, meta_ad_account_nombre, meta_user_name, meta_token_expira, meta_page_id, meta_page_name, meta_pixel_id, meta_pixel_nombre, meta_access_token"
    )
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const tokenVencido = !!(usuario.meta_token_expira && new Date(usuario.meta_token_expira) <= new Date());
  const metaConectado = !!usuario.meta_ad_account_id && !tokenVencido;

  const [metasRes, campanasRes, saludInstagram, propuestasPendientes] = await Promise.all([
    supabaseAdmin
      .from("metas")
      .select("tipo, cantidad_objetivo, fecha_fin")
      .eq("user_id", usuario.id)
      .eq("estado", "activa"),
    supabaseAdmin
      .from("campanas_publicadas")
      .select("id", { count: "exact", head: true })
      .eq("user_id", usuario.id)
      .eq("estado", "activa"),
    obtenerSaludInstagram({ meta_page_id: usuario.meta_page_id, meta_access_token: usuario.meta_access_token }),
    obtenerPropuestasPendientes(usuario.id),
  ]);

  return NextResponse.json({
    conexiones: {
      meta: {
        conectado: metaConectado,
        tokenVencido,
        cuentaPublicitariaNombre: usuario.meta_ad_account_nombre,
        paginaNombre: usuario.meta_page_name,
      },
      pixel: {
        conectado: metaConectado && !!usuario.meta_pixel_id,
        nombre: usuario.meta_pixel_nombre,
      },
      instagram: {
        conectado: saludInstagram.conectado,
        username: saludInstagram.username,
        seguidores: saludInstagram.followers_count,
      },
      openai: { conectado: !!usuario.openai_key },
      cloudinary: {
        conectado: !!(usuario.cloudinary_name && usuario.cloudinary_key && usuario.cloudinary_secret),
      },
    },
    metasActivas: metasRes.data ?? [],
    campanasActivas: campanasRes.count ?? 0,
    propuestasPendientes: propuestasPendientes.length,
  });
}
