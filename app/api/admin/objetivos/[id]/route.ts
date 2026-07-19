import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const PLANES_VALIDOS = ["arranque", "crecimiento", "escala"];

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

  const body = await req.json().catch(() => ({}));
  const { activo, plan_minimo } = body as { activo?: boolean; plan_minimo?: string };

  if (activo === undefined && plan_minimo === undefined) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  if (plan_minimo !== undefined && !PLANES_VALIDOS.includes(plan_minimo)) {
    return NextResponse.json({ error: "Plan minimo invalido" }, { status: 400 });
  }

  const cambios: Record<string, any> = { actualizado_en: new Date().toISOString() };
  if (activo !== undefined) cambios.activo = activo;
  if (plan_minimo !== undefined) cambios.plan_minimo = plan_minimo;

  const { data, error } = await supabaseAdmin
    .from("objetivos_config")
    .update(cambios)
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