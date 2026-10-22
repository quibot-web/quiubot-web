import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
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
    .from("costos_referencia")
    .select("tipo, costo_referencia_cop, actualizado_en");

  if (error) {
    return NextResponse.json({ error: "No se pudo cargar la configuración" }, { status: 500 });
  }

  return NextResponse.json({ config });
}

export async function PATCH(req: NextRequest) {
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

  const { tipo, costo_referencia_cop } = await req.json();
  const valor = Number(costo_referencia_cop);
  if ((tipo !== "conversaciones_whatsapp" && tipo !== "leads") || !Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("costos_referencia")
    .update({ costo_referencia_cop: valor, actualizado_en: new Date().toISOString() })
    .eq("tipo", tipo);

  if (error) {
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
