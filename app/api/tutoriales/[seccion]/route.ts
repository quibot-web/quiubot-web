import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ seccion: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { seccion } = await params;

  const { data: video } = await supabaseAdmin
    .from("tutoriales_videos")
    .select("seccion, titulo, url_video, descripcion")
    .eq("seccion", seccion)
    .maybeSingle();

  if (!video) {
    return NextResponse.json({ configurado: false });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", emailBusqueda)
    .maybeSingle();

  let visto = false;
  if (usuario) {
    const { data: vistoRow } = await supabaseAdmin
      .from("usuarios_tutoriales_vistos")
      .select("id")
      .eq("user_id", usuario.id)
      .eq("seccion", seccion)
      .maybeSingle();
    visto = !!vistoRow;
  }

  return NextResponse.json({ configurado: true, ...video, visto });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ seccion: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { seccion } = await params;
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", emailBusqueda)
    .maybeSingle();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("usuarios_tutoriales_vistos")
    .upsert({ user_id: usuario.id, seccion }, { onConflict: "user_id,seccion" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}