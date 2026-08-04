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

  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);
  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [campanasRes, snapshotsHoyRes, snapshots7diasRes, ultimaSincRes, notisRes, albumRes, novedadesRes] = await Promise.all([
    supabaseAdmin
      .from("campanas_publicadas")
      .select("id, estado, nombre, presupuesto_diario")
      .eq("user_id", usuario.id),
    supabaseAdmin
      .from("campanas_snapshots")
      .select("spend")
      .eq("user_id", usuario.id)
      .gte("corrida_en", hoyInicio.toISOString()),
    supabaseAdmin
      .from("campanas_snapshots")
      .select("spend, conversiones")
      .eq("user_id", usuario.id)
      .gte("corrida_en", hace7dias),
    // La corrida mas reciente -- se usa para mostrarle al usuario "hace
    // cuanto revisamos tus campañas por ultima vez", el tipo de detalle
    // que transmite que esto esta vivo, no que son numeros viejos.
    supabaseAdmin
      .from("campanas_snapshots")
      .select("corrida_en")
      .eq("user_id", usuario.id)
      .order("corrida_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
      .select("id, titulo, descripcion, tipo, imagen_url, creado_en")
      .order("creado_en", { ascending: false })
      .limit(3),
  ]);

  const campanas = campanasRes.data ?? [];
  const activas = campanas.filter((c) => c.estado === "activa");

  const snapshotsHoy = snapshotsHoyRes.data ?? [];
  const gastoActivo = snapshotsHoy.reduce((sum, s) => sum + (Number(s.spend) || 0), 0);

  // Presupuesto diario planeado (suma de las campañas activas) -- sirve
  // de referencia para mostrar "vas dentro de lo esperado" en vez de un
  // numero suelto sin contexto.
  const presupuestoDiarioTotal = activas.reduce((sum, c) => sum + (Number(c.presupuesto_diario) || 0), 0);

  const snapshots7dias = snapshots7diasRes.data ?? [];
  const spendTotal = snapshots7dias.reduce((sum, s) => sum + (Number(s.spend) || 0), 0);
  const conversionesTotal = snapshots7dias.reduce((sum, s) => sum + (Number(s.conversiones) || 0), 0);
  const cpaPromedio = conversionesTotal > 0 ? spendTotal / conversionesTotal : null;

  const conProblemas = campanas.filter((c) => c.estado === "rechazada" || c.estado === "con_problemas");
  const pendientesProblemas = conProblemas.map((c) => ({
    id: `problema-${c.id}`,
    tipo: "alerta",
    titulo: "Una campaña necesita tu atención",
    mensaje: `"${c.nombre}" ${c.estado === "rechazada" ? "fue rechazada por Meta" : "tiene un problema de configuración o facturación"}.`,
    campana_id: c.id,
  }));

  const pendientes = [...pendientesProblemas, ...(notisRes.data ?? [])].slice(0, 5);

  return NextResponse.json({
    kpis: {
      gasto_activo: gastoActivo,
      presupuesto_diario_total: presupuestoDiarioTotal,
      cpa_promedio: cpaPromedio,
      campanas_activas: activas.length,
      resultados_7dias: conversionesTotal,
    },
    ultima_sincronizacion: ultimaSincRes.data?.corrida_en ?? null,
    pendientes,
    actividad_reciente: (albumRes.data ?? []).map((a) => ({ tipo: "creativo", ...a })),
    novedades: novedadesRes.data ?? [],
  });
}