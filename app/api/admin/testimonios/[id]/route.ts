// Guardar en: app/api/admin/testimonios/[id]/route.ts
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  const body = await req.json();

  const cambios: Record<string, unknown> = { actualizado_en: new Date().toISOString() };
  if (typeof body.nombre_empresa === "string") cambios.nombre_empresa = body.nombre_empresa.trim();
  if (typeof body.imagen_url === "string") cambios.imagen_url = body.imagen_url.trim();
  if (typeof body.url_video === "string") cambios.url_video = body.url_video.trim();
  if (typeof body.cita === "string") cambios.cita = body.cita.trim() || null;
  if (typeof body.orden === "number") cambios.orden = body.orden;
  if (typeof body.activo === "boolean") cambios.activo = body.activo;

  const { data, error } = await supabaseAdmin
    .from("tutoriales_testimonios")
    .update(cambios)
    .eq("id", id)
    .select("id, nombre_empresa, imagen_url, url_video, cita, orden, activo, actualizado_en")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ testimonio: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("tutoriales_testimonios")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}