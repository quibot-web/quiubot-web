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
    .select("rol, plan")
    .eq("email", emailBusqueda)
    .single();

  const esAdmin = usuario?.rol === "admin";
  const planUsuario = usuario?.plan || "arranque";

  const { data: config, error } = await supabaseAdmin
    .from("objetivos_config")
    .select("id, activo, plan_minimo");

  if (error) {
    return NextResponse.json({ error: "No se pudo cargar la configuracion de objetivos" }, { status: 500 });
  }

  const activos = (config ?? []).filter((c) => c.activo).map((c) => c.id);
  const planMinimoPorId = Object.fromEntries((config ?? []).map((c) => [c.id, c.plan_minimo]));

  return NextResponse.json({ activos, esAdmin, planUsuario, planMinimoPorId });
}