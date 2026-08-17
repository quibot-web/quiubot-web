import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Mismo patron que /api/creativos-jobs/[id]: GET simple para que el
// frontend haga polling del estado de un job de video (generacion,
// revision, union) sin depender de que el usuario se quede en la misma
// pestaña -- el ?job=<id> de la notificacion apunta aca.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) {
    return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
  }

  const { data: job, error } = await supabaseAdmin
    .from("video_jobs")
    .select("id, estado, segmentos, total_segmentos, video_final_url, texto_cta, regeneraciones_usadas, error_mensaje, user_id")
    .eq("id", id)
    .single();

  if (error || !job || job.user_id !== usuario.id) {
    return NextResponse.json({ ok: false, error: "Video no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    estado: job.estado,
    segmentos: job.segmentos || [],
    total_segmentos: job.total_segmentos,
    video_final_url: job.video_final_url,
    texto_cta: job.texto_cta,
    regeneraciones_usadas: job.regeneraciones_usadas ?? 0,
    error_mensaje: job.error_mensaje,
  });
}
