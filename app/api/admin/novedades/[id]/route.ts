import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function esAdmin(email: string) {
  const { data } = await supabaseAdmin.from("usuarios").select("rol").eq("email", email).single();
  return data?.rol === "admin";
}

const CAMPOS_EDITABLES = ["titulo", "descripcion", "tipo", "imagen_url", "categoria", "enlace", "activo", "orden"] as const;

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

  const actualizacion: Record<string, unknown> = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (campo in body) actualizacion[campo] = body[campo];
  }
  if (Object.keys(actualizacion).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("novedades").update(actualizacion).eq("id", id);

  if (error) {
    console.error("Error actualizando novedad:", error);
    return NextResponse.json({ error: "No se pudo actualizar la novedad" }, { status: 500 });
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
  const { error } = await supabaseAdmin.from("novedades").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "No se pudo eliminar la novedad" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
