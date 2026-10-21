import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function esAdmin(email: string) {
  const { data } = await supabaseAdmin.from("usuarios").select("rol").eq("email", email).single();
  return data?.rol === "admin";
}

const CAMPOS_EDITABLES = [
  "titulo",
  "texto",
  "boton_texto",
  "boton_url",
  "imagen_desktop_url",
  "imagen_mobile_url",
  "fecha_inicio",
  "fecha_fin",
  "planes",
  "incluye_prueba",
  "activo",
  "orden",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await esAdmin(session.user.email.trim().toLowerCase()))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // Solo se aplican los campos permitidos que de verdad vinieron en el
  // body -- así un PATCH parcial (ej. solo {activo: false} para el
  // interruptor, o solo {orden} para una flecha ↑↓) no pisa el resto.
  const actualizacion: Record<string, unknown> = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (campo in body) actualizacion[campo] = body[campo];
  }
  if (Object.keys(actualizacion).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }
  actualizacion.actualizado_en = new Date().toISOString();

  const { error } = await supabaseAdmin.from("banners_home").update(actualizacion).eq("id", id);

  if (error) {
    console.error("Error actualizando banner:", error);
    return NextResponse.json({ error: "No se pudo actualizar el banner" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await esAdmin(session.user.email.trim().toLowerCase()))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const { error } = await supabaseAdmin.from("banners_home").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "No se pudo eliminar el banner" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
