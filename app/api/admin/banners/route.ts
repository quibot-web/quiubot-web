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
    .from("banners_home")
    .select("*")
    .order("orden", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "No se pudieron cargar los banners" }, { status: 500 });
  }
  return NextResponse.json({ banners: data || [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await esAdmin(session.user.email.trim().toLowerCase()))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const {
    titulo,
    texto,
    boton_texto,
    boton_url,
    imagen_desktop_url,
    imagen_mobile_url,
    fecha_inicio,
    fecha_fin,
    planes,
    incluye_prueba,
  } = await req.json();

  if (!titulo || typeof titulo !== "string" || !titulo.trim()) {
    return NextResponse.json({ error: "Falta el título" }, { status: 400 });
  }
  if (!imagen_desktop_url || typeof imagen_desktop_url !== "string") {
    return NextResponse.json({ error: "Falta la imagen para computador" }, { status: 400 });
  }

  // El nuevo banner entra al final de la lista -- max(orden) + 1.
  const { data: ultimo } = await supabaseAdmin
    .from("banners_home")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("banners_home").insert({
    titulo: titulo.trim(),
    texto: texto?.trim() || null,
    boton_texto: boton_texto?.trim() || null,
    boton_url: boton_url?.trim() || null,
    imagen_desktop_url: imagen_desktop_url.trim(),
    imagen_mobile_url: imagen_mobile_url?.trim() || null,
    fecha_inicio: fecha_inicio || null,
    fecha_fin: fecha_fin || null,
    planes: Array.isArray(planes) && planes.length > 0 ? planes : null,
    incluye_prueba: incluye_prueba === true,
    orden: (ultimo?.orden ?? -1) + 1,
  });

  if (error) {
    console.error("Error creando banner:", error);
    return NextResponse.json({ error: "No se pudo crear el banner" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
