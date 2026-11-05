// Paso 3/6 de la burbuja del Director -- resumen de cuenta para las
// tarjetas de contexto del chat (conexiones, metas activas, campañas,
// propuestas pendientes). Puro backend, sin IA: el "cerebro" del
// Director (Paso 4) consume esto como datos (vía obtenerContextoCuenta,
// la misma función), nunca los calcula él mismo. No existía ningún
// endpoint que juntara todo esto en una sola llamada -- lo más cercano
// era home-resumen (metas/campañas/pendientes) y meta/estado (solo
// Meta/píxel), repartidos.
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { obtenerContextoCuenta } from "@/app/lib/director/contextoCuenta";

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

  const contexto = await obtenerContextoCuenta(usuario);
  return NextResponse.json(contexto);
}
