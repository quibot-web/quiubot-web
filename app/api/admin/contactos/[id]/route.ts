import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function esAdmin(email: string) {
  const { data } = await supabaseAdmin.from("usuarios").select("rol").eq("email", email).single();
  return data?.rol === "admin";
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
  const { error } = await supabaseAdmin.from("admin_contactos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "No se pudo eliminar el contacto" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}