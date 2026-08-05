// Guardar en: app/api/tutoriales-publicos/testimonios/route.ts
// Publica, sin autenticacion -- la consume la landing de bienvenida.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("tutoriales_testimonios")
    .select("id, nombre_empresa, imagen_url, url_video, cita")
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error al leer tutoriales_testimonios:", error.message);
    return NextResponse.json({ testimonios: [] });
  }

  return NextResponse.json({ testimonios: data ?? [] });
}