// Lógica compartida de la bandeja de decisiones: lectura dual
// (propuestas nuevas + notificaciones.accion_sugerida existentes, sin
// tocar el flujo actual de estas últimas), y la ejecución real de
// pausar/ajustar_presupuesto contra el webhook aplicar_sugerencia de
// n8n -- la misma llamada que ya hace /api/notificaciones/[id]/aceptar,
// factorizada para reusarla desde /api/propuestas/[id]/aprobar y
// /ajustar sin duplicar sus verificaciones de seguridad.
import { supabaseAdmin } from "@/lib/supabase";
import type { Asistente, AccionPropuesta, Propuesta } from "@/app/lib/metas";

export type PropuestaUnificada = {
  id: string; // id real de "propuestas", o "notif-<id>" para las de notificaciones
  origen: "propuesta" | "notificacion";
  asistente: Asistente;
  accion: AccionPropuesta | null; // null para las de notificaciones (su accion_sugerida tiene otra forma)
  titulo: string;
  justificacion: string;
  impactoEsperado: string | null;
  costoEstimadoCop: number | null;
  venceEn: string | null;
  creadoEn: string;
};

export const CATALOGO_ACCIONES: Record<
  AccionPropuesta,
  { label: string; titulo: string; justificacion: string; impactoEsperado: string; requiereCampana: boolean }
> = {
  generar_estrategia: {
    label: "Generar estrategia",
    titulo: "Generar una nueva estrategia",
    justificacion: "Propuesta de prueba: el Estratega generaría una campaña nueva alineada a tu meta activa.",
    impactoEsperado: "Una campaña nueva lista para revisar antes de publicarla.",
    requiereCampana: false,
  },
  crear_creativos: {
    label: "Crear creativos",
    titulo: "Crear un nuevo set de creativos",
    justificacion: "Propuesta de prueba: el Creativo generaría imágenes nuevas para probar ángulos distintos.",
    impactoEsperado: "Creativos nuevos disponibles en tu álbum.",
    requiereCampana: false,
  },
  publicar_campana: {
    label: "Publicar campaña",
    titulo: "Publicar una campaña",
    justificacion: "Propuesta de prueba: el Publicador lanzaría la campaña ya revisada en Meta.",
    impactoEsperado: "La campaña queda activa en el Administrador de Anuncios.",
    requiereCampana: false,
  },
  pausar: {
    label: "Pausar campaña",
    titulo: "Pausar una campaña",
    justificacion: "Propuesta de prueba: el Optimizador pausaría esta campaña por bajo rendimiento.",
    impactoEsperado: "La campaña deja de gastar presupuesto.",
    requiereCampana: true,
  },
  ajustar_presupuesto: {
    label: "Ajustar presupuesto",
    titulo: "Ajustar el presupuesto de una campaña",
    justificacion: "Propuesta de prueba: el Optimizador subiría el presupuesto diario de esta campaña.",
    impactoEsperado: "Más alcance diario para esta campaña.",
    requiereCampana: true,
  },
  agregar_anuncios: {
    label: "Agregar anuncios",
    titulo: "Agregar anuncios a una campaña",
    justificacion: "Propuesta de prueba: el Creativo agregaría anuncios nuevos a esta campaña.",
    impactoEsperado: "Más variedad de anuncios compitiendo dentro de la misma campaña.",
    requiereCampana: false,
  },
};

// Vence al leer: cualquier pendiente con vence_en ya pasado se marca
// "vencida" antes de construir la lista. El cron horario
// (/api/cron/vencer-propuestas) cubre el caso de que nadie abra la
// bandeja -- esto es el respaldo inmediato.
async function vencerPropuestasDelUsuario(userId: string) {
  await supabaseAdmin
    .from("propuestas")
    .update({ estado: "vencida" })
    .eq("user_id", userId)
    .eq("estado", "pendiente")
    .lt("vence_en", new Date().toISOString());
}

export async function obtenerPropuestasPendientes(userId: string): Promise<PropuestaUnificada[]> {
  await vencerPropuestasDelUsuario(userId);

  const [propuestasRes, notisRes] = await Promise.all([
    supabaseAdmin
      .from("propuestas")
      .select("*")
      .eq("user_id", userId)
      .eq("estado", "pendiente")
      .order("creado_en", { ascending: false }),
    supabaseAdmin
      .from("notificaciones")
      .select("*")
      .eq("user_id", userId)
      .eq("estado", "pendiente")
      .in("tipo", ["alerta", "sugerencia"])
      .not("accion_sugerida", "is", null)
      .order("creado_en", { ascending: false }),
  ]);

  const dePropuestas: PropuestaUnificada[] = (propuestasRes.data ?? []).map((p) => ({
    id: p.id,
    origen: "propuesta",
    asistente: p.asistente,
    accion: p.accion,
    titulo: p.titulo,
    justificacion: p.justificacion,
    impactoEsperado: p.impacto_esperado,
    costoEstimadoCop: p.costo_estimado_cop,
    venceEn: p.vence_en,
    creadoEn: p.creado_en,
  }));

  // El monitoreo de Meta de hoy no distingue asistente -- se etiqueta
  // como "analista" (el que, en el equipo, lee resultados y detecta
  // estas situaciones) solo para poder mostrar una esfera coherente.
  const deNotificaciones: PropuestaUnificada[] = (notisRes.data ?? []).map((n) => ({
    id: `notif-${n.id}`,
    origen: "notificacion",
    asistente: "analista",
    accion: null,
    titulo: n.titulo,
    justificacion: n.mensaje,
    impactoEsperado: null,
    costoEstimadoCop: null,
    venceEn: null,
    creadoEn: n.creado_en,
  }));

  return [...dePropuestas, ...deNotificaciones].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
}

type UsuarioEjecutor = { id: string; email: string; meta_access_token: string | null };

type ResultadoEjecucion = { ok: true } | { ok: false; error: string; status: number };

// Ejecuta de verdad pausar/ajustar_presupuesto contra Meta (via
// aplicar_sugerencia), con las verificaciones pedidas: la campaña debe
// ser del usuario que aprueba, y el Autopiloto de su meta activa no
// puede estar pausado. Cualquier otra acción del catálogo todavía no
// tiene ejecutor real (fase 2) -- solo queda "aprobada".
export async function ejecutarPropuesta(propuesta: Propuesta, usuario: UsuarioEjecutor): Promise<ResultadoEjecucion> {
  const ahora = new Date().toISOString();

  if (propuesta.accion !== "pausar" && propuesta.accion !== "ajustar_presupuesto") {
    await supabaseAdmin
      .from("propuestas")
      .update({ estado: "aprobada", decidido_en: ahora, decidido_por: usuario.id })
      .eq("id", propuesta.id);
    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: propuesta.meta_id,
      propuesta_id: propuesta.id,
      tipo_evento: "propuesta_aprobada",
      detalle: { accion: propuesta.accion },
    });
    return { ok: true };
  }

  const campanaId = (propuesta.parametros as any)?.campana_id;
  if (!campanaId) {
    return { ok: false, error: "A esta propuesta le falta la campaña en sus parámetros.", status: 400 };
  }

  const { data: campana } = await supabaseAdmin
    .from("campanas_publicadas")
    .select("id, user_id, meta_campaign_id, meta_adset_id, presupuesto_diario")
    .eq("id", campanaId)
    .eq("user_id", usuario.id)
    .maybeSingle();

  if (!campana) {
    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: propuesta.meta_id,
      propuesta_id: propuesta.id,
      tipo_evento: "propuesta_error_campana_ajena",
      detalle: { campana_id: campanaId },
    });
    return { ok: false, error: "Esa campaña no pertenece a tu cuenta.", status: 403 };
  }

  const { data: metaActiva } = await supabaseAdmin
    .from("metas")
    .select("id, pausado_autopiloto")
    .eq("user_id", usuario.id)
    .eq("estado", "activa")
    .maybeSingle();

  if (metaActiva?.pausado_autopiloto) {
    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: metaActiva.id,
      propuesta_id: propuesta.id,
      tipo_evento: "propuesta_bloqueada_autopiloto_pausado",
      detalle: { accion: propuesta.accion },
    });
    return { ok: false, error: "El Autopiloto está pausado. Reanúdalo desde «Mi meta» para aplicar esto.", status: 409 };
  }

  if (!usuario.meta_access_token) {
    return { ok: false, error: "Tu cuenta de Meta no está conectada.", status: 400 };
  }

  try {
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/aplicar_sugerencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: usuario.email,
        meta_access_token: usuario.meta_access_token,
        campana_id: campana.id,
        meta_campaign_id: campana.meta_campaign_id,
        meta_adset_id: campana.meta_adset_id,
        presupuesto_actual: campana.presupuesto_diario,
        accion: { accion: propuesta.accion, ...(propuesta.parametros as object) },
      }),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      const mensajeError = data.error || "No se pudo aplicar la propuesta en Meta";
      await supabaseAdmin
        .from("propuestas")
        .update({ estado: "fallida", decidido_en: ahora, decidido_por: usuario.id, resultado: { error: mensajeError } })
        .eq("id", propuesta.id);
      await supabaseAdmin.from("bitacora").insert({
        user_id: usuario.id,
        meta_id: propuesta.meta_id,
        propuesta_id: propuesta.id,
        tipo_evento: "propuesta_aprobada_fallo",
        detalle: { accion: propuesta.accion, error: mensajeError },
      });
      return { ok: false, error: mensajeError, status: n8nRes.status || 502 };
    }

    await supabaseAdmin
      .from("propuestas")
      .update({ estado: "ejecutada", decidido_en: ahora, decidido_por: usuario.id, resultado: { ok: true } })
      .eq("id", propuesta.id);
    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: propuesta.meta_id,
      propuesta_id: propuesta.id,
      tipo_evento: "propuesta_aprobada_ejecutada",
      detalle: { accion: propuesta.accion, campana_id: campana.id },
    });
    return { ok: true };
  } catch (err) {
    const mensajeError = "No se pudo conectar con n8n";
    await supabaseAdmin
      .from("propuestas")
      .update({ estado: "fallida", decidido_en: ahora, decidido_por: usuario.id, resultado: { error: mensajeError } })
      .eq("id", propuesta.id);
    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: propuesta.meta_id,
      propuesta_id: propuesta.id,
      tipo_evento: "propuesta_aprobada_fallo",
      detalle: { accion: propuesta.accion, error: mensajeError },
    });
    return { ok: false, error: mensajeError, status: 503 };
  }
}
