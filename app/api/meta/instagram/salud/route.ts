import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { obtenerSaludInstagram } from "@/app/lib/metaInstagramSalud";

// ¿Tiene una cuenta de Instagram profesional vinculada a su página de
// Facebook? Lo usa /metas/crear para decidir si ofrece seguidores_instagram
// (no se puede fotografiar lo que no existe), igual que /api/meta/pixel/salud
// decide si ofrece ventas_web. La lógica real vive en
// app/lib/metaInstagramSalud.ts (compartida con verificarRequisitosMeta(),
// ver app/lib/metas.ts) -- esta ruta solo resuelve el usuario y delega.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("meta_page_id, meta_access_token")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) {
    return NextResponse.json({ conectado: false, username: null, followers_count: null });
  }

  const salud = await obtenerSaludInstagram(usuario);
  return NextResponse.json({ conectado: salud.conectado, username: salud.username, followers_count: salud.followers_count });
}
