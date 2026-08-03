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
    .from("admin_contactos")
    .select("*")
    .order("creado_en", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "No se pudieron cargar los contactos" }, { status: 500 });
  }
  return NextResponse.json({ contactos: data || [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await esAdmin(session.user.email.trim().toLowerCase()))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { nombre, email } = await req.json();
  const emailLimpio = String(email || "").trim().toLowerCase();
  if (!emailLimpio || !emailLimpio.includes("@")) {
    return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("admin_contactos")
    .insert({ nombre: nombre || null, email: emailLimpio, activo: true });

  if (error) {
    // onConflict del email unico -- mensaje claro si ya existia
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ese correo ya está registrado" }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo agregar el contacto" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}