// Lógica compartida de la bandeja de decisiones: lectura dual
// (propuestas nuevas + notificaciones.accion_sugerida existentes, sin
// tocar el flujo actual de estas últimas), y la ejecución real de
// pausar/ajustar_presupuesto contra el webhook aplicar_sugerencia de
// n8n -- la misma llamada que ya hace /api/notificaciones/[id]/aceptar,
// factorizada para reusarla desde /api/propuestas/[id]/aprobar y
// /ajustar sin duplicar sus verificaciones de seguridad.
import { supabaseAdmin } from "@/lib/supabase";
import { inferirObjetivoId } from "@/app/lib/metas";
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
  metaId: string | null;
  // Solo relevante para crear_creativos "en progreso" (estado aprobada,
  // no pendiente): etapa "esperando_fotos" | "generando", y el job_id
  // una vez que empezó a generar. null para el resto.
  resultado: Record<string, unknown> | null;
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

const VENCE_ESPERANDO_FOTOS_MS = 72 * 60 * 60 * 1000;

// Vence al leer: cualquier pendiente con vence_en ya pasado se marca
// "vencida" antes de construir la lista. El cron horario
// (/api/cron/vencer-propuestas) cubre el caso de que nadie abra la
// bandeja -- esto es el respaldo inmediato. También vence una
// crear_creativos aprobada que lleva más de 72h esperando que el
// cliente suba las fotos (estado "aprobada", no "pendiente" -- ya se
// decidió, solo falta un dato), para que ninguna quede colgada.
export async function vencerPropuestasDelUsuario(userId: string) {
  await supabaseAdmin
    .from("propuestas")
    .update({ estado: "vencida" })
    .eq("user_id", userId)
    .eq("estado", "pendiente")
    .lt("vence_en", new Date().toISOString());

  await supabaseAdmin
    .from("propuestas")
    .update({ estado: "vencida" })
    .eq("user_id", userId)
    .eq("estado", "aprobada")
    .eq("accion", "crear_creativos")
    .eq("resultado->>etapa", "esperando_fotos")
    .lt("decidido_en", new Date(Date.now() - VENCE_ESPERANDO_FOTOS_MS).toISOString());
}

export async function obtenerPropuestasPendientes(userId: string): Promise<PropuestaUnificada[]> {
  await vencerPropuestasDelUsuario(userId);

  const [propuestasRes, enProgresoRes, notisRes] = await Promise.all([
    supabaseAdmin
      .from("propuestas")
      .select("*")
      .eq("user_id", userId)
      .eq("estado", "pendiente")
      .order("creado_en", { ascending: false }),
    // crear_creativos ya aprobada pero todavía esperando fotos o
    // generando -- no es "pendiente" (ya se decidió aprobarla), pero
    // sigue necesitando que el cliente la vea y actúe.
    supabaseAdmin
      .from("propuestas")
      .select("*")
      .eq("user_id", userId)
      .eq("estado", "aprobada")
      .eq("accion", "crear_creativos")
      .in("resultado->>etapa", ["esperando_fotos", "generando"])
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

  const dePropuestas: PropuestaUnificada[] = [...(propuestasRes.data ?? []), ...(enProgresoRes.data ?? [])].map((p) => ({
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
    metaId: p.meta_id,
    resultado: p.resultado,
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
    metaId: null,
    resultado: null,
  }));

  return [...dePropuestas, ...deNotificaciones].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
}

type UsuarioEjecutor = { id: string; email: string; meta_access_token: string | null };

// motivo viene tal cual de n8n (aplicar_sugerencia responde 422
// {ok:false, motivo, error} cuando falla -- token_meta | meta | accion).
type ResultadoEjecucion = { ok: true } | { ok: false; error: string; motivo?: string; status: number };

type CampanaEjecucion = {
  id: string;
  user_id: string;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  presupuesto_diario: number | null;
  objetivo: string | null;
  objetivo_id: string | null;
};

// Validación compartida por toda acción que de verdad toca Meta
// (pausar, ajustar_presupuesto, agregar_anuncios): la campaña debe ser
// del usuario que aprueba, y el Autopiloto de su meta activa no puede
// estar pausado.
async function verificarCampanaYAutopiloto(
  propuesta: Propuesta,
  usuario: UsuarioEjecutor
): Promise<{ ok: true; campana: CampanaEjecucion } | { ok: false; error: string; status: number }> {
  const campanaId = (propuesta.parametros as any)?.campana_id;
  if (!campanaId) {
    return { ok: false, error: "A esta propuesta le falta la campaña en sus parámetros.", status: 400 };
  }

  const { data: campana } = await supabaseAdmin
    .from("campanas_publicadas")
    .select("id, user_id, meta_campaign_id, meta_adset_id, presupuesto_diario, objetivo, objetivo_id")
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

  return { ok: true, campana };
}

// Ejecuta de verdad pausar/ajustar_presupuesto (via aplicar_sugerencia)
// y agregar_anuncios (via el webhook nuevo), con la misma verificación
// de campaña+Autopiloto para las tres. crear_creativos queda "aprobada"
// con resultado.etapa="esperando_fotos" (no ejecuta nada todavía -- no
// hay fotos de producto guardadas por campaña, ver
// /api/propuestas/[id]/subir-fotos). generar_estrategia queda solo
// "aprobada" -- /decisiones redirige a /estrategia.
export async function ejecutarPropuesta(propuesta: Propuesta, usuario: UsuarioEjecutor): Promise<ResultadoEjecucion> {
  const ahora = new Date().toISOString();

  if (propuesta.accion === "crear_creativos") {
    await supabaseAdmin
      .from("propuestas")
      .update({ estado: "aprobada", decidido_en: ahora, decidido_por: usuario.id, resultado: { etapa: "esperando_fotos" } })
      .eq("id", propuesta.id);
    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: propuesta.meta_id,
      propuesta_id: propuesta.id,
      tipo_evento: "propuesta_aprobada",
      detalle: { accion: propuesta.accion, etapa: "esperando_fotos" },
    });
    return { ok: true };
  }

  if (propuesta.accion === "generar_estrategia") {
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

  const validacion = await verificarCampanaYAutopiloto(propuesta, usuario);
  if (!validacion.ok) return validacion;
  const { campana } = validacion;

  if (propuesta.accion === "agregar_anuncios") {
    return ejecutarAgregarAnuncios(propuesta, usuario, campana, ahora);
  }

  // pausar / ajustar_presupuesto, via aplicar_sugerencia.
  // accion.tipo (no "accion.accion") y accion.porcentaje solo para
  // ajustar_presupuesto -- contrato de aplicar_sugerencia en n8n.
  // meta_adset_id solo si la campaña tiene uno.
  const accionPayload: Record<string, unknown> = { tipo: propuesta.accion };
  if (propuesta.accion === "ajustar_presupuesto") {
    const porcentaje = (propuesta.parametros as any)?.ajuste_porcentaje;
    if (porcentaje != null) accionPayload.porcentaje = porcentaje;
  }
  const payloadN8n: Record<string, unknown> = {
    email: usuario.email,
    meta_access_token: usuario.meta_access_token,
    campana_id: campana.id,
    meta_campaign_id: campana.meta_campaign_id,
    presupuesto_actual: campana.presupuesto_diario,
    accion: accionPayload,
  };
  if (campana.meta_adset_id) payloadN8n.meta_adset_id = campana.meta_adset_id;

  try {
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/aplicar_sugerencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadN8n),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      // n8n responde 422 {ok:false, motivo, error} -- se muestra tal cual,
      // sin reescribirlo, y motivo (token_meta|meta|accion) queda en bitacora.
      const mensajeError = data.error || "No se pudo aplicar la propuesta en Meta";
      const motivo = data.motivo as string | undefined;
      await supabaseAdmin
        .from("propuestas")
        .update({ estado: "fallida", decidido_en: ahora, decidido_por: usuario.id, resultado: { error: mensajeError, motivo } })
        .eq("id", propuesta.id);
      await supabaseAdmin.from("bitacora").insert({
        user_id: usuario.id,
        meta_id: propuesta.meta_id,
        propuesta_id: propuesta.id,
        tipo_evento: "propuesta_aprobada_fallo",
        detalle: { accion: propuesta.accion, error: mensajeError, motivo },
      });
      return { ok: false, error: mensajeError, motivo, status: n8nRes.status || 502 };
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

// Ejecuta agregar_anuncios contra el webhook nuevo de n8n -- publica los
// creativos que generó crear_creativos (ya revisados/ajustados por el
// cliente) como anuncios reales dentro de la campaña existente.
async function ejecutarAgregarAnuncios(
  propuesta: Propuesta,
  usuario: UsuarioEjecutor,
  campana: CampanaEjecucion,
  ahora: string
): Promise<ResultadoEjecucion> {
  const objetivoId = inferirObjetivoId(campana);
  const creativos = (propuesta.parametros as any)?.creativos;

  if (!objetivoId || !Array.isArray(creativos) || creativos.length === 0) {
    return { ok: false, error: "A esta propuesta le faltan los creativos o el objetivo de la campaña.", status: 400 };
  }

  const payloadN8n: Record<string, unknown> = {
    email: usuario.email,
    propuesta_id: propuesta.id,
    meta_campaign_id: campana.meta_campaign_id,
    objetivo_id: objetivoId,
    estado: "ACTIVE",
    creativos,
  };
  if (campana.meta_adset_id) payloadN8n.meta_adset_id = campana.meta_adset_id;

  try {
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/agregar_anuncios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadN8n),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      // 422/400 {ok:false, paso, motivo?, error} -- se muestra tal cual,
      // igual que aplicar_sugerencia. motivo:"token_meta" se traduce a
      // un aviso concreto de reconectar Meta.
      const motivo = data.motivo as string | undefined;
      const mensajeError =
        motivo === "token_meta"
          ? "Tu conexión con Meta expiró o no es válida. Reconéctala en Integraciones."
          : data.error || "No se pudo agregar los anuncios en Meta";

      await supabaseAdmin
        .from("propuestas")
        .update({ estado: "fallida", decidido_en: ahora, decidido_por: usuario.id, resultado: { error: mensajeError, motivo, paso: data.paso } })
        .eq("id", propuesta.id);
      await supabaseAdmin.from("bitacora").insert({
        user_id: usuario.id,
        meta_id: propuesta.meta_id,
        propuesta_id: propuesta.id,
        tipo_evento: "propuesta_aprobada_fallo",
        detalle: { accion: "agregar_anuncios", error: mensajeError, motivo, paso: data.paso },
      });
      return { ok: false, error: mensajeError, motivo, status: n8nRes.status || 502 };
    }

    await supabaseAdmin
      .from("propuestas")
      .update({
        estado: "ejecutada",
        decidido_en: ahora,
        decidido_por: usuario.id,
        resultado: {
          meta_adset_id: data.meta_adset_id ?? campana.meta_adset_id,
          anuncios_creados: data.anuncios_creados ?? [],
          anuncios_fallidos: data.anuncios_fallidos ?? [],
          omitidos: data.omitidos ?? [],
        },
      })
      .eq("id", propuesta.id);
    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: propuesta.meta_id,
      propuesta_id: propuesta.id,
      tipo_evento: "propuesta_aprobada_ejecutada",
      detalle: { accion: "agregar_anuncios", campana_id: campana.id, anuncios_creados: (data.anuncios_creados ?? []).length },
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
      detalle: { accion: "agregar_anuncios", error: mensajeError },
    });
    return { ok: false, error: mensajeError, status: 503 };
  }
}

// Revisa el job de creativos_jobs de una propuesta crear_creativos en
// etapa "generando" -- la llama tanto el polling desde /decisiones
// (mientras el cliente sigue ahí, sin esperar la corrida horaria) como
// el cron de respaldo. Idempotente: si el job ya quedó "listo" y ya
// existe su propuesta agregar_anuncios (parametros.propuesta_origen_id
// = esta propuesta), no crea una segunda.
export async function revisarGeneracionCreativos(propuestaId: string): Promise<{ estado: string; etapa?: string }> {
  const { data: propuesta } = await supabaseAdmin.from("propuestas").select("*").eq("id", propuestaId).single();
  if (!propuesta || propuesta.accion !== "crear_creativos") return { estado: propuesta?.estado || "no_encontrada" };

  const resultado = (propuesta.resultado as any) || {};
  if (resultado.etapa !== "generando" || !resultado.job_id) {
    return { estado: propuesta.estado, etapa: resultado.etapa };
  }

  const { data: job } = await supabaseAdmin
    .from("creativos_jobs")
    .select("id, estado, creativos, error_mensaje")
    .eq("id", resultado.job_id)
    .maybeSingle();

  if (!job || job.estado === "procesando") {
    return { estado: propuesta.estado, etapa: "generando" };
  }

  if (job.estado === "error") {
    const mensajeError = job.error_mensaje || "La generación de creativos falló.";
    await supabaseAdmin
      .from("propuestas")
      .update({ estado: "fallida", resultado: { etapa: "fallida", error: mensajeError } })
      .eq("id", propuestaId);
    await supabaseAdmin.from("bitacora").insert({
      user_id: propuesta.user_id,
      meta_id: propuesta.meta_id,
      propuesta_id: propuestaId,
      tipo_evento: "propuesta_aprobada_fallo",
      detalle: { accion: "crear_creativos", error: mensajeError },
    });
    return { estado: "fallida" };
  }

  // job.estado === "listo"
  const { data: yaExiste } = await supabaseAdmin
    .from("propuestas")
    .select("id")
    .eq("accion", "agregar_anuncios")
    .eq("parametros->>propuesta_origen_id", propuestaId)
    .maybeSingle();

  if (!yaExiste) {
    const venceEn = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: nueva } = await supabaseAdmin
      .from("propuestas")
      .insert({
        meta_id: propuesta.meta_id,
        user_id: propuesta.user_id,
        asistente: "publicador",
        accion: "agregar_anuncios",
        parametros: {
          campana_id: (propuesta.parametros as any)?.campana_id ?? null,
          creativos: job.creativos ?? [],
          propuesta_origen_id: propuestaId,
        },
        titulo: "Agregar los creativos nuevos a la campaña",
        justificacion: `El Creativo terminó de generar ${(job.creativos ?? []).length} creativo(s) nuevo(s). Revísalos antes de que salgan al aire.`,
        impacto_esperado: "Anuncios nuevos compitiendo dentro de la misma campaña.",
        costo_estimado_cop: null,
        estado: "pendiente",
        vence_en: venceEn,
      })
      .select()
      .single();

    await supabaseAdmin.from("bitacora").insert({
      user_id: propuesta.user_id,
      meta_id: propuesta.meta_id,
      propuesta_id: nueva?.id ?? null,
      tipo_evento: "propuesta_creada",
      detalle: { accion: "agregar_anuncios", origen_propuesta_id: propuestaId },
    });
  }

  await supabaseAdmin
    .from("propuestas")
    .update({ estado: "ejecutada", resultado: { etapa: "completado", job_id: resultado.job_id } })
    .eq("id", propuestaId);

  return { estado: "ejecutada", etapa: "completado" };
}
