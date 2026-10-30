import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type RespuestaSalud = {
  conectado: boolean;
  username: string | null;
  followers_count: number | null;
};

// ¿Tiene una cuenta de Instagram profesional vinculada a su página de
// Facebook? Lo usa /metas/crear para decidir si ofrece seguidores_instagram
// (no se puede fotografiar lo que no existe), igual que /api/meta/pixel/salud
// decide si ofrece ventas_web.
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

  if (!usuario?.meta_page_id || !usuario.meta_access_token) {
    const vacia: RespuestaSalud = { conectado: false, username: null, followers_count: null };
    return NextResponse.json(vacia);
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${usuario.meta_page_id}?fields=instagram_business_account{username,followers_count}&access_token=${usuario.meta_access_token}`
    );
    const data = await res.json();
    const ig = data.instagram_business_account;
    if (!ig) {
      const vacia: RespuestaSalud = { conectado: false, username: null, followers_count: null };
      return NextResponse.json(vacia);
    }
    const respuesta: RespuestaSalud = {
      conectado: true,
      username: typeof ig.username === "string" ? ig.username : null,
      followers_count: typeof ig.followers_count === "number" ? ig.followers_count : null,
    };
    return NextResponse.json(respuesta);
  } catch (err) {
    console.error("Error consultando salud de Instagram:", err);
    const vacia: RespuestaSalud = { conectado: false, username: null, followers_count: null };
    return NextResponse.json(vacia);
  }
}
