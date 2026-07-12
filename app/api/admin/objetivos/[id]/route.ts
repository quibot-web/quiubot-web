import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  const { activo } = await req.json();

  const { data, error } = await supabaseAdmin
    .from("objetivos_config")
    .update({ activo, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }

  if (activo) {
    const nombres: Record<string, string> = {
      venta_directa_web: "Venta Directa",
      venta_directa_whatsapp: "Venta Directa (WhatsApp)",
      reconocimiento: "Reconocimiento",
      retargeting: "Retargeting",
      leads: "Generacion de Leads",
      trafico_mensajes: "Trafico / Mensajes",
    };
    await supabaseAdmin.from("novedades").insert({
      tipo: "objetivo_activado",
      titulo: `Objetivo ${nombres[id] || id} ya disponible`,
      descripcion: "Puedes usarlo desde el Motor de Estrategia.",
    });
  }

  return NextResponse.json({ config: data });
}