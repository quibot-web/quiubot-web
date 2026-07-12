import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
  if (usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("ai_playbook")
    .update({ revisado: true, activo: false })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Borra la notificación asociada a esta versión, ya que fue resuelta (descartada)
  await supabaseAdmin
    .from("notificaciones")
    .delete()
    .eq("accion_sugerida->>playbook_id", id);

  return NextResponse.json({ playbook: data });
}