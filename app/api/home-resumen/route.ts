import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizarBloques } from "@/app/lib/configHome";
import { hoyBogota } from "@/app/lib/fechaBogota";
import { obtenerPropuestasPendientes } from "@/app/lib/propuestas";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

// Un banner aplica si está dentro de su rango de fechas (o no tiene) Y
// (no tiene restricción de plan/prueba, O el usuario cae en alguna de las
// dos). planes y "prueba" son un OR entre sí, no un AND -- un banner con
// planes:["arranque"] + incluye_prueba:true se le muestra a cualquier
// usuario de Arranque, Y también a cualquiera en prueba sin importar su plan.
function bannerAplicaAUsuario(banner: any, hoy: string, plan: string, enTrial: boolean): boolean {
  if (banner.fecha_inicio && hoy < banner.fecha_inicio) return false;
  if (banner.fecha_fin && hoy > banner.fecha_fin) return false;
  const tienePlanes = Array.isArray(banner.planes) && banner.planes.length > 0;
  if (!tienePlanes && !banner.incluye_prueba) return true;
  if (tienePlanes && banner.planes.includes(plan)) return true;
  if (banner.incluye_prueba && enTrial) return true;
  return false;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, plan, en_trial, rol, fecha_vencimiento, beta_autopiloto")
    .eq("email", emailBusqueda)
    .single();
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    campanasRes,
    snapshotsHoyRes,
    snapshots7diasRes,
    ultimaSincRes,
    notisRes,
    albumRes,
    novedadesRes,
    capacitacionesRes,
    bannersRes,
    configHomeRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("campanas_publicadas")
      .select("id, estado, nombre, presupuesto_diario")
      .eq("user_id", usuario.id),
    supabaseAdmin
      .from("campanas_snapshots")
      .select("spend")
      .eq("user_id", usuario.id)
      .eq("fecha_bogota", hoyBogota()),
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
    // Sin .limit() -- el total real (para el saludo y, para admin, para
    // "Tu Director tiene N cosas") necesita contar TODAS las pendientes,
    // no solo las primeras 5 que se van a mostrar en la lista.
    supabaseAdmin
      .from("notificaciones")
      .select("id, tipo, titulo, mensaje, campana_id, accion_sugerida")
      .eq("user_id", usuario.id)
      .eq("estado", "pendiente")
      .order("creado_en", { ascending: false }),
    supabaseAdmin
      .from("album_creativos")
      .select("id, url_imagen, creado_en")
      .eq("user_id", usuario.id)
      .order("creado_en", { ascending: false })
      .limit(3),
    supabaseAdmin
      .from("novedades")
      .select("id, titulo, descripcion, tipo, imagen_url, enlace, creado_en")
      .eq("categoria", "novedad")
      .eq("activo", true)
      .order("orden", { ascending: true })
      .limit(5),
    supabaseAdmin
      .from("novedades")
      .select("id, titulo, descripcion, tipo, imagen_url, enlace, creado_en")
      .eq("categoria", "capacitacion")
      .eq("activo", true)
      .order("orden", { ascending: true })
      .limit(5),
    supabaseAdmin
      .from("banners_home")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabaseAdmin.from("config_home").select("bloques").eq("id", 1).maybeSingle(),
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

  const notisPendientes = notisRes.data ?? [];
  const tieneDirector = tieneAutopiloto(usuario);

  // Para quien tiene Autopiloto, todo pasa por el Director: el bloque
  // "Decisiones pendientes" y el saludo del Inicio dejan de mostrar esta
  // lista y en su lugar cuentan cuántas cosas tiene el Director para
  // hablar. obtenerPropuestasPendientes ya trae las 4 categorías
  // (propuestas, notificaciones con accion_sugerida, campañas con
  // problema, notificaciones sin accion_sugerida) en un solo arreglo
  // sin duplicar nada -- su length es directamente el total.
  let directorTotal: number | null = null;
  if (tieneDirector) {
    const propuestasPendientes = await obtenerPropuestasPendientes(usuario.id);
    directorTotal = propuestasPendientes.length;
  }

  // Sin Autopiloto: se queda igual que siempre (la lista sigue mostrando
  // como mucho 5), pero el total ya no se recorta antes de contarlo --
  // antes "Tienes 5 cosas" salía siempre que hubiera 5 o más, sin decir
  // cuántas había de verdad.
  const pendientesTotal = pendientesProblemas.length + notisPendientes.length;
  const pendientes = tieneDirector ? [] : [...pendientesProblemas, ...notisPendientes].slice(0, 5);

  const hoy = new Date().toISOString().slice(0, 10);
  const plan = usuario.plan || "arranque";
  const enTrial = !!usuario.en_trial;
  const banners = (bannersRes.data ?? []).filter((b) => bannerAplicaAUsuario(b, hoy, plan, enTrial));

  return NextResponse.json({
    kpis: {
      gasto_activo: gastoActivo,
      presupuesto_diario_total: presupuestoDiarioTotal,
      cpa_promedio: cpaPromedio,
      campanas_activas: activas.length,
      resultados_7dias: conversionesTotal,
    },
    ultima_sincronizacion: ultimaSincRes.data?.corrida_en ?? null,
    // El nombre quedó de cuando esto era admin-only -- hoy es
    // "¿tiene Autopiloto?" (tieneAutopiloto), no "¿es admin?".
    es_admin: tieneDirector,
    pendientes,
    pendientes_total: tieneDirector ? null : pendientesTotal,
    director_resumen: tieneDirector ? { total: directorTotal } : null,
    actividad_reciente: (albumRes.data ?? []).map((a) => ({ tipo: "creativo", ...a })),
    novedades: novedadesRes.data ?? [],
    capacitaciones: capacitacionesRes.data ?? [],
    banners,
    bloques: normalizarBloques(configHomeRes.data?.bloques),
  });
}