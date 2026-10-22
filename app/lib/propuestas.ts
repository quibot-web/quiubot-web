// Lógica compartida de la bandeja de decisiones: lectura dual
// (propuestas nuevas + notificaciones.accion_sugerida existentes, sin
// tocar el flujo actual de estas últimas), y la ejecución real de
// pausar/ajustar_presupuesto contra el webhook aplicar_sugerencia de
// n8n -- la misma llamada que ya hace /api/notificaciones/[id]/aceptar,
// factorizada para reusarla desde /api/propuestas/[id]/aprobar y
// /ajustar sin duplicar sus verificaciones de seguridad.
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { inferirObjetivoId, objetivoParaCampana, type TipoMeta } from "@/app/lib/metas";
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
  // Para agregar_anuncios: parametros.creativos trae la vista previa
  // (título, texto, url_imagen, etc.) que la bandeja muestra y que
  // Ajustar edita antes de aprobar. null para las de notificaciones.
  parametros: Record<string, unknown> | null;
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
    requiereCampana: true,
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
    justificacion: "Propuesta de prueba: el Publicador agregaría anuncios nuevos a esta campaña.",
    impactoEsperado: "Más variedad de anuncios compitiendo dentro de la misma campaña.",
    requiereCampana: true,
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
      .in("resultado->>etapa", ["esperando_fotos", "generando_conceptos", "generando"])
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
    parametros: p.parametros,
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
    parametros: null,
  }));

  return [...dePropuestas, ...deNotificaciones].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
}

type UsuarioEjecutor = { id: string; email: string; meta_access_token: string | null };

// motivo viene tal cual de n8n (aplicar_sugerencia responde 422
// {ok:false, motivo, error} cuando falla -- token_meta | meta | accion).
type ResultadoEjecucion = { ok: true } | { ok: false; error: string; motivo?: string; paso?: string; status: number };

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
  // objetivo_id es solo respaldo para el webhook (lo usa cuando el
  // conjunto todavía no tiene ningún anuncio del que copiar botón/link;
  // si ya tiene uno, ni lo necesita) -- nunca bloquea acá. Se manda si
  // se puede resolver (propio o inferido, ver inferirObjetivoId), vacío
  // si no -- el webhook es quien decide si realmente le hace falta y
  // responde su propio error claro en ese caso.
  const objetivoId = inferirObjetivoId(campana) ?? "";
  const creativosEntrada = (propuesta.parametros as any)?.creativos;
  const creativosValidos = Array.isArray(creativosEntrada) ? creativosEntrada.filter((c: any) => c?.url_imagen) : [];

  if (!campana.meta_campaign_id) {
    return { ok: false, error: "A esta campaña le falta el meta_campaign_id.", status: 400 };
  }
  if (creativosValidos.length === 0) {
    return { ok: false, error: "Ningún creativo de esta propuesta tiene url_imagen.", status: 400 };
  }

  const payloadN8n: Record<string, unknown> = {
    email: usuario.email,
    propuesta_id: propuesta.id,
    meta_campaign_id: campana.meta_campaign_id,
    objetivo_id: objetivoId,
    estado: "ACTIVE",
    creativos: creativosValidos,
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
      // sin reescribirlo (igual que aplicar_sugerencia). motivo:"token_meta"
      // además dispara un aviso de reconectar Meta en la bandeja, sin
      // reemplazar el mensaje real del webhook.
      const motivo = data.motivo as string | undefined;
      const paso = data.paso as string | undefined;
      const mensajeError = data.error || "No se pudo agregar los anuncios en Meta";

      await supabaseAdmin
        .from("propuestas")
        .update({ estado: "fallida", decidido_en: ahora, decidido_por: usuario.id, resultado: { error: mensajeError, motivo, paso } })
        .eq("id", propuesta.id);
      await supabaseAdmin.from("bitacora").insert({
        user_id: usuario.id,
        meta_id: propuesta.meta_id,
        propuesta_id: propuesta.id,
        tipo_evento: "propuesta_aprobada_fallo",
        detalle: { accion: "agregar_anuncios", error: mensajeError, motivo, paso },
      });
      return { ok: false, error: mensajeError, motivo, paso, status: n8nRes.status || 502 };
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

const TIMEOUT_GENERANDO_MS = 40 * 60 * 1000;

// Revisa el job de creativos_jobs de una propuesta crear_creativos en
// etapa "generando" -- la llama tanto el polling desde /decisiones
// (mientras el cliente sigue ahí, sin esperar la corrida horaria) como
// el cron de respaldo. Idempotente: si el job ya quedó "listo" y ya
// existe su propuesta agregar_anuncios (parametros.propuesta_origen_id
// = esta propuesta), no crea una segunda. El workflow de n8n puede
// detenerse sin avisar (sin pasar a "listo" ni a "error"), así que
// además de revisar el job, vence por tiempo: 40 minutos desde que
// empezó a generar (resultado.generando_desde, o decidido_en como
// respaldo para propuestas que quedaron "generando" antes de que ese
// campo existiera) sin quedar lista -> fallida, con mensaje explícito.
export async function revisarGeneracionCreativos(propuestaId: string): Promise<{ estado: string; etapa?: string }> {
  const { data: propuesta } = await supabaseAdmin.from("propuestas").select("*").eq("id", propuestaId).single();
  if (!propuesta || propuesta.accion !== "crear_creativos") return { estado: propuesta?.estado || "no_encontrada" };

  const resultado = (propuesta.resultado as any) || {};

  // El límite de 40 min cuenta desde que se subieron las fotos
  // (resultado.generando_desde, fijado una sola vez), sin importar si
  // sigue en "generando_conceptos" o ya pasó a "generando" -- el reloj
  // no se reinicia entre esas dos etapas.
  if (resultado.etapa === "generando_conceptos" || resultado.etapa === "generando") {
    const desde = resultado.generando_desde || propuesta.decidido_en;
    if (desde && Date.now() - new Date(desde).getTime() > TIMEOUT_GENERANDO_MS) {
      const mensajeError = "La generación de creativos no terminó en 40 minutos -- el workflow pudo haberse detenido sin avisar.";
      await supabaseAdmin
        .from("propuestas")
        .update({ estado: "fallida", resultado: { etapa: "fallida", error: mensajeError, job_id: resultado.job_id ?? null } })
        .eq("id", propuestaId);
      await supabaseAdmin.from("bitacora").insert({
        user_id: propuesta.user_id,
        meta_id: propuesta.meta_id,
        propuesta_id: propuestaId,
        tipo_evento: "propuesta_aprobada_fallo",
        detalle: { accion: "crear_creativos", error: mensajeError, paso: "timeout_generando" },
      });
      return { estado: "fallida" };
    }
  }

  // Si sigue en "generando_conceptos", el candado de procesarCreacionCreativos
  // es quien decide si reintentarla -- el cron la vuelve a intentar por
  // su cuenta (ver /api/cron/vencer-propuestas), esto solo cubre el
  // timeout de arriba para esa etapa.
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

// ============================================================
// Generación de creativos en segundo plano (after()) -- ver
// /api/propuestas/[id]/subir-fotos, que ya no espera nada de esto: solo
// sube las fotos a Cloudinary y dispara procesarCreacionCreativos sin
// esperarlo. Nada de lo de acá puede vivir dentro del ciclo de una
// petición HTTP: generar_estrategia tarda 1.5-2 min y el proxy de
// Coolify corta la conexión antes de que termine (confirmado: cuando
// eso pasó, la propuesta se quedó sin avanzar -- no bastaba con que el
// navegador reintentara, el trabajo del lado del servidor también se
// abandonó).
// ============================================================

const MAX_INTENTOS_CREATIVOS = 2;
const VENTANA_CANDADO_MS = 5 * 60 * 1000;

// Convierte una imagen (base64 o URL de Cloudinary) a base64 -- mismo
// helper que usaba /subir-fotos, ahora compartido porque tanto la ruta
// (para subir a Cloudinary) como este archivo (para mandarla a
// generar_estrategia/crear_creativos) lo necesitan.
export async function aBase64(imagen: { tipo: "base64" | "url"; valor: string }): Promise<string> {
  if (imagen.tipo === "base64") return imagen.valor;
  const res = await fetch(imagen.valor);
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
}

// Deduce los ángulos que la campaña ya tiene a partir de los nombres de
// sus anuncios en Meta (convención QB_IMG_<Angulo>_...), para pedirle a
// generar_estrategia que no los repita. Nunca bloquea: si Graph API
// falla o no hay match, sigue sin ángulos.
async function obtenerAngulosUsados(metaCampaignId: string, metaAccessToken: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${metaCampaignId}/ads?fields=name&limit=200&access_token=${metaAccessToken}`
    );
    const data = await res.json();
    if (!res.ok || data.error) return [];

    const angulos = new Set<string>();
    for (const ad of data.data ?? []) {
      const match = /^QB_IMG_([^_]+)_/.exec(ad.name || "");
      if (match) angulos.add(match[1]);
    }
    return [...angulos];
  } catch (err) {
    console.error("No se pudieron leer los ángulos existentes de la campaña:", err);
    return [];
  }
}

// Un intento completo: generar_estrategia -> elegir anuncios ->
// crear_creativos. Tira un Error (con .paso) en cualquier falla -- lo
// atrapa el loop de reintentos de procesarCreacionCreativos.
class ErrorPasoCreativos extends Error {
  paso: string;
  constructor(mensaje: string, paso: string) {
    super(mensaje);
    this.paso = paso;
  }
}

async function intentarGenerarYCrearCreativos(datos: {
  propuestaId: string;
  emailBusqueda: string;
  imagenesBase64: string[];
  objetivoParaWebhook: ReturnType<typeof objetivoParaCampana>;
  presupuestoDiario: number | null;
  openaiKey: string;
  tipoContenido: "producto" | "servicio";
  descripcionServicio: string | null;
  angulosAEvitar: string[];
  cloudinaryName: string;
  cloudinaryKey: string;
  cloudinarySecret: string;
}): Promise<{ jobId: string }> {
  // Paso 1: conceptos nuevos. generar_estrategia no responde {ok:false}
  // siempre que falla -- sin llave de OpenAI responde HTTP 200 con solo
  // {error:"..."} (sin "ok"). Éxito es ÚNICAMENTE data.ok === true.
  console.log(`[procesarCreacionCreativos] ${datos.propuestaId}: llamando a generar_estrategia`);
  const n8nRes1 = await fetch("https://n8n.quiubot.site/webhook/generar_estrategia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: datos.emailBusqueda,
      imagenes_base64: datos.imagenesBase64,
      objetivo: datos.objetivoParaWebhook,
      presupuesto_diario_cop: datos.presupuestoDiario,
      openai_key: datos.openaiKey,
      tipo_contenido: datos.tipoContenido,
      descripcion_servicio: datos.descripcionServicio,
      modo_estructura: "advantage",
      angulos_a_evitar: datos.angulosAEvitar,
    }),
  }).catch((err) => {
    throw new ErrorPasoCreativos("No se pudo conectar con el servidor para generar los conceptos.", "generar_estrategia");
  });

  const data1 = await n8nRes1.json().catch(() => ({}));
  if (!n8nRes1.ok || data1.ok !== true) {
    throw new ErrorPasoCreativos(data1.error || "No se pudo generar los conceptos nuevos.", "generar_estrategia");
  }

  // data.campanas[] trae varias estrategias candidatas (cada una ya con
  // su propio campana/conjuntos/efectividad) -- se elige la de mayor
  // efectividad, igual que haría un humano en /estrategia.
  const campanas: any[] = Array.isArray(data1.campanas) ? data1.campanas : [];
  const campanaElegida = campanas.reduce(
    (mejor: any, actual: any) => (!mejor || (actual?.efectividad ?? 0) > (mejor?.efectividad ?? 0) ? actual : mejor),
    null
  );
  const conjunto = campanaElegida?.conjuntos?.[0];
  const descripcionVisualGenerada =
    typeof data1.descripcion_visual_producto === "string" ? data1.descripcion_visual_producto : null;

  // Al elegir los anuncios: primero los que no repiten un ángulo ya
  // usado en la campaña, después el filtro de copy.titulo/copy.texto
  // obligatorios, máximo 3.
  const angulosAEvitarSet = new Set(datos.angulosAEvitar);
  const anunciosConCopy = (conjunto?.anuncios ?? []).filter((a: any) => a?.copy?.titulo && a?.copy?.texto);
  const sinRepetirAngulo = anunciosConCopy.filter((a: any) => !angulosAEvitarSet.has(a?.concepto?.angulo));
  const conAnguloRepetido = anunciosConCopy.filter((a: any) => angulosAEvitarSet.has(a?.concepto?.angulo));
  const anunciosValidos = [...sinRepetirAngulo, ...conAnguloRepetido].slice(0, 3);

  if (!campanaElegida || !conjunto || anunciosValidos.length === 0) {
    throw new ErrorPasoCreativos(
      "generar_estrategia no devolvió ningún anuncio con título y texto -- no se generaron creativos.",
      "generar_estrategia_sin_anuncios"
    );
  }
  if (!descripcionVisualGenerada) {
    throw new ErrorPasoCreativos(
      "generar_estrategia no devolvió la descripción visual del producto -- no se puede recrear en las imágenes.",
      "generar_estrategia_sin_descripcion"
    );
  }

  // Paso 2: las imágenes -- crear_creativos con la estrategia real (la
  // campaña candidata elegida, con su conjunto recortado a los
  // anuncios elegidos). Este webhook responde enseguida con un job_id
  // (la generación real -- 4 a 24 min -- la termina n8n aparte,
  // escribiendo directo en creativos_jobs); si algún día respondiera
  // solo al terminar, el problema sería el mismo que el de arriba, pero
  // como esta función entera ya corre fuera del ciclo de una petición
  // HTTP (ver procesarCreacionCreativos), no importa cuánto tarde.
  const estrategiaReal = { ...campanaElegida, conjuntos: [{ ...conjunto, anuncios: anunciosValidos }] };

  console.log(`[procesarCreacionCreativos] ${datos.propuestaId}: llamando a crear_creativos`);
  const n8nRes2 = await fetch("https://n8n.quiubot.site/webhook/crear_creativos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: datos.emailBusqueda,
      estrategia: estrategiaReal,
      descripcion_visual_producto: descripcionVisualGenerada,
      imagenes_producto_base64: datos.imagenesBase64,
      openai_key: datos.openaiKey,
      cloudinary_name: datos.cloudinaryName,
      cloudinary_key: datos.cloudinaryKey,
      cloudinary_secret: datos.cloudinarySecret,
      tipo_contenido: datos.tipoContenido,
      descripcion_servicio: datos.descripcionServicio,
      mostrar_precio: false,
      precio: null,
    }),
  }).catch(() => {
    throw new ErrorPasoCreativos("No se pudo conectar con el servidor.", "crear_creativos");
  });

  const data2 = await n8nRes2.json().catch(() => ({}));
  if (!n8nRes2.ok || data2.ok === false || !data2.job_id) {
    throw new ErrorPasoCreativos(data2.error || "No se pudo iniciar la generación de creativos.", "crear_creativos");
  }

  return { jobId: data2.job_id };
}

// Candado + reintentos + la cadena completa, corriendo fuera del ciclo
// de la petición que la disparó (ver after() en /subir-fotos y en el
// cron). Reclama la propuesta con un UPDATE condicional: solo tiene
// efecto si sigue en "generando_conceptos" y nadie más la tomó hace
// menos de 5 minutos -- así /subir-fotos, el cron de respaldo, y
// cualquier reintento futuro pueden llamar a esta misma función sin
// pisarse ni procesarla dos veces.
export async function procesarCreacionCreativos(propuestaId: string): Promise<void> {
  console.log(`[procesarCreacionCreativos] ${propuestaId}: invocada`);

  const { data: propuesta } = await supabaseAdmin.from("propuestas").select("*").eq("id", propuestaId).single();
  if (!propuesta || propuesta.accion !== "crear_creativos") {
    console.log(`[procesarCreacionCreativos] ${propuestaId}: no existe o no es crear_creativos, no hace nada`);
    return;
  }

  const resultadoActual = (propuesta.resultado as any) || {};
  if (resultadoActual.etapa !== "generando_conceptos") {
    console.log(`[procesarCreacionCreativos] ${propuestaId}: etapa actual es "${resultadoActual.etapa}", no "generando_conceptos", no hace nada`);
    return;
  }

  const haceCincoMin = new Date(Date.now() - VENTANA_CANDADO_MS).toISOString();
  const { data: reclamada } = await supabaseAdmin
    .from("propuestas")
    .update({ resultado: { ...resultadoActual, procesando_desde: new Date().toISOString() } })
    .eq("id", propuestaId)
    .eq("resultado->>etapa", "generando_conceptos")
    .or(`resultado->>procesando_desde.is.null,resultado->>procesando_desde.lt.${haceCincoMin}`)
    .select()
    .maybeSingle();

  if (!reclamada) {
    // Ya lo tiene otro intento en curso (procesando_desde reciente), o
    // ya avanzó de etapa entre que se eligió esta propuesta y que se
    // intentó tomar el candado -- no es necesariamente un error, pero
    // queda en bitacora para poder distinguirlo de una muerte en
    // silencio si vuelve a pasar.
    console.log(
      `[procesarCreacionCreativos] ${propuestaId}: no se tomó el candado (procesando_desde="${resultadoActual.procesando_desde ?? "null"}"), no hace nada`
    );
    await supabaseAdmin.from("bitacora").insert({
      user_id: propuesta.user_id,
      meta_id: propuesta.meta_id,
      propuesta_id: propuestaId,
      tipo_evento: "propuesta_crear_creativos_candado_no_tomado",
      detalle: { procesando_desde_actual: resultadoActual.procesando_desde ?? null },
    });
    return;
  }

  console.log(`[procesarCreacionCreativos] ${propuestaId}: candado tomado, empieza a procesar`);

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, email, openai_key, cloudinary_name, cloudinary_key, cloudinary_secret, meta_access_token")
    .eq("id", propuesta.user_id)
    .single();

  const parametros = (reclamada.parametros as any) || {};
  const { data: campana } = await supabaseAdmin
    .from("campanas_publicadas")
    .select("id, nombre, objetivo, objetivo_id, presupuesto_diario, meta_campaign_id")
    .eq("id", parametros.campana_id)
    .maybeSingle();

  const { data: meta } = await supabaseAdmin.from("metas").select("tipo").eq("id", propuesta.meta_id).maybeSingle();

  async function marcarFallida(mensajeError: string, paso: string) {
    await supabaseAdmin
      .from("propuestas")
      .update({ estado: "fallida", resultado: { etapa: "fallida", error: mensajeError, paso } })
      .eq("id", propuestaId);
    await supabaseAdmin.from("bitacora").insert({
      user_id: propuesta.user_id,
      meta_id: propuesta.meta_id,
      propuesta_id: propuestaId,
      tipo_evento: "propuesta_aprobada_fallo",
      detalle: { accion: "crear_creativos", error: mensajeError, paso },
    });
  }

  if (!usuario || !campana || !meta?.tipo) {
    await marcarFallida("No se pudo recuperar la información necesaria para generar los creativos.", "datos_incompletos");
    return;
  }

  let openaiKey: string;
  let cloudinaryKey: string;
  let cloudinarySecret: string;
  try {
    openaiKey = desencriptarSiHaceFalta(usuario.openai_key);
    cloudinaryKey = desencriptarSiHaceFalta(usuario.cloudinary_key);
    cloudinarySecret = desencriptarSiHaceFalta(usuario.cloudinary_secret);
  } catch (err) {
    await marcarFallida("No se pudieron leer las credenciales guardadas.", "credenciales");
    return;
  }

  let imagenesBase64: string[];
  try {
    imagenesBase64 = await Promise.all(
      (resultadoActual.fotos_urls as string[]).map((url) => aBase64({ tipo: "url", valor: url }))
    );
  } catch (err) {
    await marcarFallida("No se pudo leer una de las fotos guardadas.", "leer_fotos");
    return;
  }

  const objetivoParaWebhook = objetivoParaCampana(campana, meta.tipo as TipoMeta);
  const angulosAEvitar =
    campana.meta_campaign_id && usuario.meta_access_token
      ? await obtenerAngulosUsados(campana.meta_campaign_id, usuario.meta_access_token)
      : [];

  const intentoDesde = (resultadoActual.intentos || 0) + 1;
  let ultimoError = "No se pudo completar.";
  let ultimoPaso = "desconocido";

  for (let intento = intentoDesde; intento <= MAX_INTENTOS_CREATIVOS; intento++) {
    try {
      const { jobId } = await intentarGenerarYCrearCreativos({
        propuestaId,
        emailBusqueda: usuario.email,
        imagenesBase64,
        objetivoParaWebhook,
        presupuestoDiario: campana.presupuesto_diario,
        openaiKey,
        tipoContenido: parametros.tipo_contenido === "servicio" ? "servicio" : "producto",
        descripcionServicio: parametros.tipo_contenido === "servicio" ? parametros.descripcion_servicio ?? null : null,
        angulosAEvitar,
        cloudinaryName: usuario.cloudinary_name,
        cloudinaryKey,
        cloudinarySecret,
      });

      await supabaseAdmin
        .from("propuestas")
        .update({
          resultado: { ...resultadoActual, etapa: "generando", job_id: jobId, intentos: intento, procesando_desde: null },
        })
        .eq("id", propuestaId);

      await supabaseAdmin.from("bitacora").insert({
        user_id: propuesta.user_id,
        meta_id: propuesta.meta_id,
        propuesta_id: propuestaId,
        tipo_evento: "propuesta_crear_creativos_iniciada",
        detalle: { job_id: jobId, campana_id: campana.id, angulos_evitados: angulosAEvitar, intento },
      });
      return;
    } catch (err) {
      ultimoError = err instanceof ErrorPasoCreativos ? err.message : "No se pudo completar.";
      ultimoPaso = err instanceof ErrorPasoCreativos ? err.paso : "desconocido";

      await supabaseAdmin.from("bitacora").insert({
        user_id: propuesta.user_id,
        meta_id: propuesta.meta_id,
        propuesta_id: propuestaId,
        tipo_evento: "propuesta_crear_creativos_intento_fallido",
        detalle: { intento, error: ultimoError, paso: ultimoPaso },
      });

      await supabaseAdmin
        .from("propuestas")
        .update({ resultado: { ...resultadoActual, intentos: intento, procesando_desde: null } })
        .eq("id", propuestaId);
    }
  }

  await marcarFallida(`No se pudo completar, vuelve a intentarlo. (${ultimoError})`, ultimoPaso);
}
