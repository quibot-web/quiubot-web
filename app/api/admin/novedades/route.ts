import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function esAdmin(email: string) {
  const { data } = await supabaseAdmin.from("usuarios").select("rol").eq("email", email).single();
  return data?.rol === "admin";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await esAdmin(session.user.email.trim().toLowerCase()))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("novedades")
    .select("*")
    .order("creado_en", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "No se pudieron cargar las novedades" }, { status: 500 });
  }
  return NextResponse.json({ novedades: data || [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await esAdmin(session.user.email.trim().toLowerCase()))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { titulo, descripcion, tipo, imagen_url } = await req.json();

  if (!titulo || typeof titulo !== "string" || !titulo.trim()) {
    return NextResponse.json({ error: "Falta el título" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("novedades").insert({
    titulo: titulo.trim(),
    descripcion: descripcion?.trim() || null,
    tipo: tipo || "nuevo",
    imagen_url: imagen_url?.trim() || null,
  });

  if (error) {
    console.error("Error creando novedad:", error);
    return NextResponse.json({ error: "No se pudo crear la novedad" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}