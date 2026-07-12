import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("rol")
    .eq("email", emailBusqueda)
    .single();

  if (usuario?.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: config, error } = await supabaseAdmin
    .from("objetivos_config")
    .select("id, activo, actualizado_en");

  if (error) {
    return NextResponse.json({ error: "No se pudo cargar la configuracion" }, { status: 500 });
  }

  return NextResponse.json({ config });
}