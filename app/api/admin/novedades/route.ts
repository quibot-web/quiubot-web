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
    .order("categoria", { ascending: true })
    .order("orden", { ascending: true });

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

  const { titulo, descripcion, tipo, imagen_url, categoria, enlace } = await req.json();

  if (!titulo || typeof titulo !== "string" || !titulo.trim()) {
    return NextResponse.json({ error: "Falta el título" }, { status: 400 });
  }

  const categoriaFinal = categoria === "capacitacion" ? "capacitacion" : "novedad";

  // Nuevo item al final de su categoría -- max(orden) + 1, calculado solo
  // entre los de la misma categoría (novedades y capacitaciones se
  // reordenan por separado, son listas distintas en el Inicio).
  const { data: ultimo } = await supabaseAdmin
    .from("novedades")
    .select("orden")
    .eq("categoria", categoriaFinal)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("novedades").insert({
    titulo: titulo.trim(),
    descripcion: descripcion?.trim() || null,
    tipo: tipo || "nuevo",
    imagen_url: imagen_url?.trim() || null,
    categoria: categoriaFinal,
    enlace: enlace?.trim() || null,
    orden: (ultimo?.orden ?? -1) + 1,
  });

  if (error) {
    console.error("Error creando novedad:", error);
    return NextResponse.json({ error: "No se pudo crear la novedad" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
