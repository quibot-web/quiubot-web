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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("tutoriales_videos")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}