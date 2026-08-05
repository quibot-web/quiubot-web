// Guardar en: app/api/admin/testimonios/route.ts
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

export async function GET() {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { data, error } = await supabaseAdmin
    .from("tutoriales_testimonios")
    .select("id, nombre_empresa, imagen_url, url_video, cita, orden, activo, actualizado_en")
    .order("orden", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ testimonios: data });
}

export async function POST(req: Request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { nombre_empresa, imagen_url, url_video, cita, orden } = await req.json();

  if (!nombre_empresa?.trim() || !imagen_url?.trim() || !url_video?.trim()) {
    return NextResponse.json(
      { error: "Nombre de la empresa, imagen y URL del video son obligatorios" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("tutoriales_testimonios")
    .insert({
      nombre_empresa: nombre_empresa.trim(),
      imagen_url: imagen_url.trim(),
      url_video: url_video.trim(),
      cita: cita?.trim() || null,
      orden: typeof orden === "number" ? orden : 0,
      activo: true,
      actualizado_en: new Date().toISOString(),
    })
    .select("id, nombre_empresa, imagen_url, url_video, cita, orden, activo, actualizado_en")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ testimonio: data });
}