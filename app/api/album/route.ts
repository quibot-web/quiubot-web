import { NextResponse } from "next/server";
import { auth } from "@/auth"; 
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: usuario, error: errorUsuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (errorUsuario || !usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("album_creativos") 
    .select("id, url_imagen, public_id, tipo, creado_en")
    .eq("user_id", usuario.id) 
    .order("creado_en", { ascending: false });

  if (error) {
    console.error("Error en consulta de álbum:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imagenes: data });
}