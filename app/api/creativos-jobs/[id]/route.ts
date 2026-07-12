import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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
    .from("creativos_jobs")
    .select("id, estado, creativos, error_mensaje, user_id")
    .eq("id", id)
    .single();

  if (error || !job || job.user_id !== usuario.id) {
    return NextResponse.json({ ok: false, error: "Job no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    estado: job.estado,
    creativos: job.creativos || [],
    error_mensaje: job.error_mensaje,
  });
}