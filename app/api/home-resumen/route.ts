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
    .select("id")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [campanasRes, snapshotsRes, notisRes, albumRes, novedadesRes] = await Promise.all([
    supabaseAdmin
      .from("campanas_publicadas")
      .select("id, estado, presupuesto_dia")
      .eq("user_id", usuario.id),
    supabaseAdmin
      .from("campanas_snapshots")
      .select("spend, conversiones")
      .eq("user_id", usuario.id)
      .gte("corrida_en", hace7dias),
    supabaseAdmin
      .from("notificaciones")
      .select("id, tipo, titulo, mensaje, campana_id, accion_sugerida")
      .eq("user_id", usuario.id)
      .eq("estado", "pendiente")
      .order("creado_en", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("album_creativos")
      .select("id, url_imagen, creado_en")
      .eq("user_id", usuario.id)
      .order("creado_en", { ascending: false })
      .limit(3),
    supabaseAdmin
      .from("novedades")
      .select("id, titulo, descripcion, tipo, creado_en")
      .order("creado_en", { ascending: false })
      .limit(3),
  ]);

  const campanas = campanasRes.data ?? [];
  const activas = campanas.filter((c) => c.estado === "activa");
  const gastoActivo = activas.reduce((sum, c) => sum + (Number(c.presupuesto_dia) || 0), 0);

  const snapshots = snapshotsRes.data ?? [];
  const spendTotal = snapshots.reduce((sum, s) => sum + (Number(s.spend) || 0), 0);
  const conversionesTotal = snapshots.reduce((sum, s) => sum + (Number(s.conversiones) || 0), 0);
  const cpaPromedio = conversionesTotal > 0 ? spendTotal / conversionesTotal : null;

  return NextResponse.json({
    kpis: {
      gasto_activo: gastoActivo,
      cpa_promedio: cpaPromedio,
      campanas_activas: activas.length,
    },
    pendientes: notisRes.data ?? [],
    actividad_reciente: (albumRes.data ?? []).map((a) => ({ tipo: "creativo", ...a })),
    novedades: novedadesRes.data ?? [],
  });
}