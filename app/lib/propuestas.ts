// Lógica compartida de la bandeja de decisiones: lectura dual
// (propuestas nuevas + notificaciones.accion_sugerida existentes, sin
// tocar el flujo actual de estas últimas), y la ejecución real de
// pausar/ajustar_presupuesto contra el webhook aplicar_sugerencia de
// n8n -- la misma llamada que ya hace /api/notificaciones/[id]/aceptar,
// factorizada para reusarla desde /api/propuestas/[id]/aprobar y
// /ajustar sin duplicar sus verificaciones de seguridad.
import { randomUUID } from "crypto";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { inferirObjetivoId, objetivoParaCampana, type TipoMeta } from "@/app/lib/metas";
import type { Asistente, AccionPropuesta, Propuesta } from "@/app/lib/metas";
import { procesarAgregarAnuncios, TIPO_TRABAJO as TIPO_TRABAJO_AGREGAR_ANUNCIOS } from "@/app/lib/agregarAnunciosJobs";

export type PropuestaUnificada = {
  id: string; // id real de "propuestas", o "notif-<id>" para las de notificaciones
  // "problema_campana" y "notificacion_informativa" son mensajes del
  // Director solo informativos -- nunca llevan botones de aprobar/
  // ajustar/rechazar (ver /decisiones). Vienen de campañas rechazada/
  // con_problemas, y de notificaciones pendientes sin accion_sugerida
  // (las que sí tienen accion_sugerida ya entran como "notificacion").
  origen: "propuesta" | "notificacion" | "problema_campana" | "notificacion_informativa";
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
  // Ajustar edita antes de aprobar. Para problema_campana/
  // notificacion_informativa, campana_id (si existe) es el enlace a
  // "Ver campaña". null para el resto.
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

  const [propuestasRes, enProgresoRes, enProgresoAgregarRes, notisRes, campanasProblemaRes, notisInformativasRes] = await Promise.all([
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
    // agregar_anuncios ya aprobada, corriendo en segundo plano (ver
    // dispararAgregarAnunciosEnSegundoPlano) -- mismo motivo que
    // crear_creativos arriba.
    supabaseAdmin
      .from("propuestas")
      .select("*")
      .eq("user_id", userId)
      .eq("estado", "aprobada")
      .eq("accion", "agregar_anuncios")
      .eq("resultado->>etapa", "procesando")
      .order("creado_en", { ascending: false }),
    supabaseAdmin
      .from("notificaciones")
      .select("*")
      .eq("user_id", userId)
      .eq("estado", "pendiente")
      .in("tipo", ["alerta", "sugerencia"])
      .not("accion_sugerida", "is", null)
      .order("creado_en", { ascending: false }),
    // Todo pasa por el Director: las campañas que Meta rechazó o
    // marcó con problema entran a la conversación como mensaje
    // informativo (sin botones), en vez de vivir en un bloque aparte
    // del Inicio.
    supabaseAdmin
      .from("campanas_publicadas")
      .select("id, nombre, estado")
      .eq("user_id", userId)
      .in("estado", ["rechazada", "con_problemas"]),
    // Notificaciones pendientes SIN accion_sugerida -- informativas,
    // ya no tienen un botón de aprobar que ofrecer. Las que sí tienen
    // accion_sugerida ya entran arriba como "notificacion".
    supabaseAdmin
      .from("notificaciones")
      .select("*")
      .eq("user_id", userId)
      .eq("estado", "pendiente")
      .is("accion_sugerida", null)
      .order("creado_en", { ascending: false }),
  ]);

  const dePropuestas: PropuestaUnificada[] = [...(propuestasRes.data ?? []), ...(enProgresoRes.data ?? []), ...(enProgresoAgregarRes.data ?? [])].map((p) => ({
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

  const deProblemas: PropuestaUnificada[] = (campanasProblemaRes.data ?? []).map((c) => ({
    id: `problema-${c.id}`,
    origen: "problema_campana",
    asistente: "analista",
    accion: null,
    titulo: "Meta señaló un problema",
    justificacion: `El Analista me avisó que Meta ${c.estado === "rechazada" ? "rechazó" : "reportó un problema de configuración o facturación en"} "${c.nombre}".`,
    impactoEsperado: null,
    costoEstimadoCop: null,
    venceEn: null,
    // No tiene un creado_en propio (es el estado actual de la campaña,
    // no un evento con fecha) -- va siempre al tope de los informativos.
    creadoEn: new Date().toISOString(),
    metaId: null,
    resultado: null,
    parametros: { campana_id: c.id },
  }));

  const deInformativas: PropuestaUnificada[] = (notisInformativasRes.data ?? []).map((n) => ({
    id: `inform-${n.id}`,
    origen: "notificacion_informativa",
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
    parametros: n.campana_id ? { campana_id: n.campana_id } : null,
  }));

  return [...dePropuestas, ...deNotificaciones, ...deProblemas, ...deInformativas].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
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

  // El freno de mano es por meta (pausado_autopiloto vive en "metas",
  // nunca hubo un interruptor global) -- con varias metas activas a la
  // vez, lo correcto es mirar la meta QUE ESTA PROPUESTA trae consigo
  // (propuesta.meta_id), no "la" meta activa del usuario (eso ya no es
  // único: .maybeSingle() con 2+ filas devolvía null sin avisar).
  if (propuesta.meta_id) {
    const { data: metaDeLaPropuesta } = await supabaseAdmin
      .from("metas")
      .select("id, pausado_autopiloto")
      .eq("id", propuesta.meta_id)
      .maybeSingle();

    if (metaDeLaPropuesta?.pausado_autopiloto) {
      await supabaseAdmin.from("bitacora").insert({
        user_id: usuario.id,
        meta_id: metaDeLaPropuesta.id,
        propuesta_id: propuesta.id,
        tipo_evento: "propuesta_bloqueada_autopiloto_pausado",
        detalle: { accion: propuesta.accion },
      });
      return { ok: false, error: "El Autopiloto de esa meta está pausado. Reanúdalo desde «Mis metas» para aplicar esto.", status: 409 };
    }
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
    return dispararAgregarAnunciosEnSegundoPlano(propuesta, usuario, campana, ahora);
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

    // Para ajustar_presupuesto, la conversación necesita el "de $X a $Y"
    // real al momento de ejecutar -- campana.presupuesto_diario sigue
    // cambiando después (otros ajustes), así que hay que guardarlo
    // ahora o se pierde para siempre.
    const resultadoExito: Record<string, unknown> = { ok: true };
    if (propuesta.accion === "ajustar_presupuesto") {
      const porcentaje = (propuesta.parametros as any)?.ajuste_porcentaje ?? 0;
      resultadoExito.presupuesto_antes = campana.presupuesto_diario;
      resultadoExito.presupuesto_despues = Math.round((campana.presupuesto_diario ?? 0) * (1 + porcentaje / 100));
    }

    await supabaseAdmin
      .from("propuestas")
      .update({ estado: "ejecutada", decidido_en: ahora, decidido_por: usuario.id, resultado: resultadoExito })
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

// Dispara agregar_anuncios en segundo plano (trabajos_ia, ver
// app/lib/agregarAnunciosJobs.ts) en vez de esperar la respuesta de n8n
// dentro del ciclo de esta petición -- mismo motivo que crear_creativos/
// generar_estrategia: el proxy de Coolify corta la conexión antes de
// que n8n termine, y mata con ella el trabajo del lado del servidor.
// after() se llama acá mismo (no en el route.ts que la dispara) porque
// esta función la comparten dos rutas distintas (/aprobar y /ajustar) y
// Next.js permite registrar after() desde cualquier punto de la cadena
// de la petición, no solo desde el propio route handler.
async function dispararAgregarAnunciosEnSegundoPlano(
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

  const { data: trabajo, error: errorTrabajo } = await supabaseAdmin
    .from("trabajos_ia")
    .insert({ user_id: usuario.id, tipo: TIPO_TRABAJO_AGREGAR_ANUNCIOS, estado: "pendiente", intento_desde: ahora })
    .select()
    .single();

  if (errorTrabajo || !trabajo) {
    console.error("Error creando trabajos_ia (agregar_anuncios):", errorTrabajo);
    return { ok: false, error: "No se pudo iniciar el proceso. Intenta de nuevo.", status: 500 };
  }

  await supabaseAdmin
    .from("propuestas")
    .update({
      estado: "aprobada",
      decidido_en: ahora,
      decidido_por: usuario.id,
      resultado: { etapa: "procesando", job_id: trabajo.id },
    })
    .eq("id", propuesta.id);

  after(() =>
    procesarAgregarAnuncios(trabajo.id, propuesta.id, {
      userId: usuario.id,
      metaId: propuesta.meta_id,
      payloadN8n,
    }).catch(async (err) => {
      console.error("Error no manejado en procesarAgregarAnuncios:", err);
      await supabaseAdmin
        .from("trabajos_ia")
        .update({ estado: "fallida", error: "Error inesperado agregando los anuncios." })
        .eq("id", trabajo.id);
      await supabaseAdmin
        .from("propuestas")
        .update({ estado: "fallida", resultado: { error: "Error inesperado agregando los anuncios." } })
        .eq("id", propuesta.id);
    })
  );

  return { ok: true };
}

// El límite de generando_conceptos (sin job_id todavía -- generar_estrategia
// o crear_creativos no han respondido) es más corto que el de generando
// (ya con job_id, esperando a que n8n termine, 4 a 24 min en lo normal).
const TIMEOUT_GENERANDO_CONCEPTOS_MS = 40 * 60 * 1000;
const TIMEOUT_GENERANDO_MS = 60 * 60 * 1000;

// Una propuesta es "de prueba" si parametros.es_prueba === true (lo que
// pone /api/admin/propuestas/prueba al crearla), o -- de respaldo, para
// las que ya existían antes de que ese campo existiera -- si su título
// empieza con "[Prueba]". La usan tanto el Director (para no contar
// estas propuestas en el tope diario ni en los antiduplicados) como
// encadenarAgregarAnuncios (para que lo que nace de una prueba también
// quede marcado como prueba).
export function esPropuestaDePrueba(propuesta: { parametros?: unknown; titulo?: string | null }): boolean {
  if ((propuesta.parametros as any)?.es_prueba === true) return true;
  return typeof propuesta.titulo === "string" && propuesta.titulo.startsWith("[Prueba]");
}

async function marcarCrearCreativosFallida(
  propuesta: { user_id: string; meta_id: string | null },
  propuestaId: string,
  mensajeError: string,
  paso: string,
  jobId?: string | null
) {
  await supabaseAdmin
    .from("propuestas")
    .update({ estado: "fallida", resultado: { etapa: "fallida", error: mensajeError, job_id: jobId ?? null } })
    .eq("id", propuestaId);
  await supabaseAdmin.from("bitacora").insert({
    user_id: propuesta.user_id,
    meta_id: propuesta.meta_id,
    propuesta_id: propuestaId,
    tipo_evento: "propuesta_aprobada_fallo",
    detalle: { accion: "crear_creativos", error: mensajeError, paso },
  });
}

// Encadena agregar_anuncios a partir de un creativos_jobs ya "listo" --
// la usan tanto el polling normal (revisarGeneracionCreativos) como la
// recuperación manual (recuperarCreativosFallidos, para cuando el
// timeout alcanzó a marcar fallida la propuesta unos segundos antes de
// que se viera que el job ya había terminado bien -- las imágenes ya
// se generaron y se pagaron, no se pierden). Idempotente vía
// parametros->>propuesta_origen_id.
async function encadenarAgregarAnuncios(
  propuesta: { meta_id: string | null; user_id: string; parametros: unknown; titulo?: string | null },
  propuestaId: string,
  job: { id: string; creativos: unknown }
) {
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
          // Si el crear_creativos de origen era de prueba, lo que
          // encadena de ahí también lo es -- no debe contar en el
          // tope diario ni en los antiduplicados del Director.
          ...(esPropuestaDePrueba(propuesta) ? { es_prueba: true } : {}),
        },
        titulo: "Agregar los creativos nuevos a la campaña",
        justificacion: `El Creativo terminó de generar ${((job.creativos as unknown[]) ?? []).length} creativo(s) nuevo(s). Revísalos antes de que salgan al aire.`,
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
    .update({ estado: "ejecutada", resultado: { etapa: "completado", job_id: job.id } })
    .eq("id", propuestaId);
}

// Revisa una propuesta crear_creativos en etapa "generando_conceptos" o
// "generando" -- la llama tanto el polling desde /decisiones (mientras
// el cliente sigue ahí, sin esperar la corrida horaria) como el cron de
// respaldo. El reloj de cada etapa es resultado.intento_desde, fijado
// por procesarCreacionCreativos cuando ESE intento tomó el candado --
// nunca resultado.generando_desde (la primera subida de fotos): un
// reintento que arranca horas después, porque el intento anterior
// murió sin avisar, no puede heredar el tiempo ya consumido por ese
// intento muerto (visto en vivo: por eso venció por tiempo un intento
// que sí había terminado bien).
export async function revisarGeneracionCreativos(propuestaId: string): Promise<{ estado: string; etapa?: string }> {
  const { data: propuesta } = await supabaseAdmin.from("propuestas").select("*").eq("id", propuestaId).single();
  if (!propuesta || propuesta.accion !== "crear_creativos") return { estado: propuesta?.estado || "no_encontrada" };

  const resultado = (propuesta.resultado as any) || {};
  const desdeIntento = resultado.intento_desde || resultado.generando_desde || propuesta.decidido_en;

  if (resultado.etapa === "generando_conceptos") {
    // Todavía no hay job_id -- generar_estrategia o crear_creativos no
    // han respondido. Si sigue acá, el candado de procesarCreacionCreativos
    // decide si reintentarla (el cron la retoma por su cuenta); esto
    // solo cubre el timeout.
    if (desdeIntento && Date.now() - new Date(desdeIntento).getTime() > TIMEOUT_GENERANDO_CONCEPTOS_MS) {
      await marcarCrearCreativosFallida(
        propuesta,
        propuestaId,
        "La generación de creativos no terminó en 40 minutos -- el workflow pudo haberse detenido sin avisar.",
        "timeout_generando_conceptos",
        resultado.job_id
      );
      return { estado: "fallida" };
    }
    return { estado: propuesta.estado, etapa: resultado.etapa };
  }

  if (resultado.etapa !== "generando" || !resultado.job_id) {
    return { estado: propuesta.estado, etapa: resultado.etapa };
  }

  const { data: job } = await supabaseAdmin
    .from("creativos_jobs")
    .select("id, estado, creativos, error_mensaje")
    .eq("id", resultado.job_id)
    .maybeSingle();

  // Ya hay job_id -- antes de vencer por tiempo SIEMPRE se revisa el
  // job real primero: si ya quedó "listo", se encadena aunque el reloj
  // ya se haya pasado (las imágenes ya se generaron y se pagaron, no
  // se pierden por un timeout que llegó unos segundos tarde).
  if (job?.estado === "listo") {
    await encadenarAgregarAnuncios(propuesta, propuestaId, job as { id: string; creativos: unknown });
    return { estado: "ejecutada", etapa: "completado" };
  }

  if (job?.estado === "error") {
    const mensajeError = job.error_mensaje || "La generación de creativos falló.";
    await marcarCrearCreativosFallida(propuesta, propuestaId, mensajeError, "job_error", resultado.job_id);
    return { estado: "fallida" };
  }

  // Sigue "procesando" en creativos_jobs (o el job todavía no existe) --
  // 60 min desde el intento actual.
  if (desdeIntento && Date.now() - new Date(desdeIntento).getTime() > TIMEOUT_GENERANDO_MS) {
    await marcarCrearCreativosFallida(
      propuesta,
      propuestaId,
      "La generación de creativos no terminó en 60 minutos -- el workflow pudo haberse detenido sin avisar.",
      "timeout_generando",
      resultado.job_id
    );
    return { estado: "fallida" };
  }

  return { estado: propuesta.estado, etapa: "generando" };
}

// Recuperación manual (solo admin, ver /api/propuestas/[id]/recuperar-creativos):
// para una crear_creativos que quedó "fallida" pero tiene job_id -- por
// ejemplo porque el timeout la marcó fallida unos segundos antes de que
// revisarGeneracionCreativos alcanzara a ver que el job ya estaba
// "listo" (pasó en vivo: las imágenes ya se generaron y se pagaron).
// Reusa encadenarAgregarAnuncios, que ya protege contra duplicados.
export async function recuperarCreativosFallidos(propuestaId: string): Promise<{ ok: boolean; mensaje: string }> {
  const { data: propuesta } = await supabaseAdmin.from("propuestas").select("*").eq("id", propuestaId).single();
  if (!propuesta || propuesta.accion !== "crear_creativos") {
    return { ok: false, mensaje: "Esta propuesta no es de crear creativos." };
  }
  if (propuesta.estado !== "fallida") {
    return { ok: false, mensaje: "Esta propuesta no está fallida." };
  }

  const resultado = (propuesta.resultado as any) || {};
  const jobId = resultado.job_id;
  if (!jobId) {
    return { ok: false, mensaje: "Esta propuesta no tiene un job de creativos asociado para revisar." };
  }

  const { data: job } = await supabaseAdmin
    .from("creativos_jobs")
    .select("id, estado, creativos, error_mensaje")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) {
    return { ok: false, mensaje: "No se encontró el job de creativos asociado." };
  }
  if (job.estado !== "listo") {
    return { ok: false, mensaje: `El job todavía no está listo (estado: ${job.estado}).` };
  }

  await encadenarAgregarAnuncios(propuesta, propuestaId, job);
  await supabaseAdmin.from("bitacora").insert({
    user_id: propuesta.user_id,
    meta_id: propuesta.meta_id,
    propuesta_id: propuestaId,
    tipo_evento: "propuesta_crear_creativos_recuperada",
    detalle: { job_id: jobId },
  });

  return { ok: true, mensaje: "Se encontraron los creativos ya listos y se creó la propuesta de agregar anuncios." };
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
export async function obtenerAngulosUsados(metaCampaignId: string, metaAccessToken: string): Promise<string[]> {
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
  datosProducto: string | null;
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
      datos_producto: datos.datosProducto,
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
      // Mismo datos.tipoContenido/descripcionServicio que ya recibió
      // generar_estrategia arriba -- un solo objeto "datos", nunca dos
      // valores que puedan desincronizarse entre las dos llamadas.
      // datos_producto no viaja acá: crear_creativos ya trabaja sobre el
      // concepto/copy que generar_estrategia ya escribió con ese dato en
      // cuenta, no necesita que se le repita.
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

  // No confiamos en lo que devuelva este update().select() para saber
  // si de verdad tomamos el candado -- visto en vivo: el UPDATE puede
  // aplicarse en la base (procesando_desde cambia de verdad) y aun así
  // llegar al cliente como si no hubiera devuelto fila. En vez de eso,
  // cada intento escribe su propio lock_id (uuid) junto con
  // procesando_desde, e ignora el resultado de este update; lo que de
  // verdad decide si ganamos el candado es el SELECT de abajo, leyendo
  // si el lock_id que quedó en la base es el nuestro.
  const loqueIntentoTomar = randomUUID();
  const ahoraClaim = new Date().toISOString();
  const haceCincoMin = new Date(Date.now() - VENTANA_CANDADO_MS).toISOString();
  await supabaseAdmin
    .from("propuestas")
    // intento_desde es el reloj de este intento (lo usa revisarGeneracionCreativos
    // para el timeout) -- nunca generando_desde, que sigue marcando solo
    // la primera subida de fotos y no se vuelve a tocar.
    .update({
      resultado: {
        ...resultadoActual,
        procesando_desde: ahoraClaim,
        lock_id: loqueIntentoTomar,
        intento_desde: ahoraClaim,
      },
    })
    .eq("id", propuestaId)
    .eq("resultado->>etapa", "generando_conceptos")
    .or(`resultado->>procesando_desde.is.null,resultado->>procesando_desde.lt.${haceCincoMin}`);

  const { data: trasIntentoClaim } = await supabaseAdmin
    .from("propuestas")
    .select("resultado")
    .eq("id", propuestaId)
    .single();

  const resultadoTrasClaim = (trasIntentoClaim?.resultado as any) || {};
  if (resultadoTrasClaim.lock_id !== loqueIntentoTomar) {
    // Ya lo tiene otro intento en curso (su lock_id quedó en la base),
    // o ya avanzó de etapa entre que se eligió esta propuesta y que se
    // intentó tomar el candado -- no es necesariamente un error, pero
    // queda en bitacora para poder distinguirlo de una muerte en
    // silencio si vuelve a pasar.
    console.log(
      `[procesarCreacionCreativos] ${propuestaId}: no se tomó el candado (lock actual="${resultadoTrasClaim.lock_id ?? "null"}", el nuestro="${loqueIntentoTomar}")`
    );
    await supabaseAdmin.from("bitacora").insert({
      user_id: propuesta.user_id,
      meta_id: propuesta.meta_id,
      propuesta_id: propuestaId,
      tipo_evento: "propuesta_crear_creativos_candado_no_tomado",
      detalle: { lock_id_propio: loqueIntentoTomar, lock_id_actual: resultadoTrasClaim.lock_id ?? null },
    });
    return;
  }

  console.log(`[procesarCreacionCreativos] ${propuestaId}: candado tomado, empieza a procesar`);
  resultadoActual.procesando_desde = resultadoTrasClaim.procesando_desde;
  resultadoActual.lock_id = loqueIntentoTomar;
  resultadoActual.intento_desde = resultadoTrasClaim.intento_desde;

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, email, openai_key, cloudinary_name, cloudinary_key, cloudinary_secret, meta_access_token")
    .eq("id", propuesta.user_id)
    .single();

  const parametros = (propuesta.parametros as any) || {};
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
        datosProducto: parametros.tipo_contenido !== "servicio" ? parametros.datos_producto ?? null : null,
        angulosAEvitar,
        cloudinaryName: usuario.cloudinary_name,
        cloudinaryKey,
        cloudinarySecret,
      });

      await supabaseAdmin
        .from("propuestas")
        .update({
          resultado: {
            ...resultadoActual,
            etapa: "generando",
            job_id: jobId,
            intentos: intento,
            procesando_desde: null,
            lock_id: null,
          },
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
        .update({ resultado: { ...resultadoActual, intentos: intento, procesando_desde: null, lock_id: null } })
        .eq("id", propuestaId);
    }
  }

  await marcarFallida(`No se pudo completar, vuelve a intentarlo. (${ultimoError})`, ultimoPaso);
}
