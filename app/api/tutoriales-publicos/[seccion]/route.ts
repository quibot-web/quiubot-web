import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Solo estas secciones pueden consultarse sin sesión iniciada.
// Cualquier otra sección del sistema de tutoriales sigue exigiendo login
// (ver app/api/tutoriales/[seccion]/route.ts).
const SECCIONES_PUBLICAS = ["bienvenida"];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ seccion: string }> }
) {
  const { seccion } = await params;

  if (!SECCIONES_PUBLICAS.includes(seccion)) {
    return NextResponse.json({ configurado: false }, { status: 404 });
  }

  const { data: video } = await supabaseAdmin
    .from("tutoriales_videos")
    .select("seccion, titulo, url_video, descripcion")
    .eq("seccion", seccion)
    .maybeSingle();

  if (!video) {
    return NextResponse.json({ configurado: false });
  }

  return NextResponse.json({ configurado: true, ...video });
}