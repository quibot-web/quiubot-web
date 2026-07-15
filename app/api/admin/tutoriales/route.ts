import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) {
    return { error: NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 }) };
  }
  if (usuario.rol !== "admin") {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }

  return { usuario };
}

export async function GET() {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { data, error } = await supabaseAdmin
    .from("tutoriales_videos")
    .select("id, seccion, titulo, url_video, descripcion, actualizado_en");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ videos: data });
}

export async function POST(req: Request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { seccion, titulo, url_video, descripcion } = await req.json();

  if (!seccion?.trim() || !titulo?.trim() || !url_video?.trim()) {
    return NextResponse.json(
      { error: "Sección, título y URL del video son obligatorios" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("tutoriales_videos")
    .upsert(
      {
        seccion: seccion.trim(),
        titulo: titulo.trim(),
        url_video: url_video.trim(),
        descripcion: descripcion?.trim() || null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "seccion" }
    )
    .select("id, seccion, titulo, url_video, descripcion, actualizado_en")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ video: data });
}