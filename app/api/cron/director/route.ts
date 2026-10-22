import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import {
  obtenerCampanasDeMeta,
  obtenerSnapshotsDiarios,
  calcularAvanceMeta,
  type Meta,
  type SnapshotDiario,
} from "@/app/lib/metas";
import { hoyBogota, inicioDiaBogota } from "@/app/lib/fechaBogota";
import { textoGenerarEstrategia, textoPausar, textoAjustarPresupuesto, textoCrearCreativos } from "@/app/lib/directorTextos";

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const MAX_PROPUESTAS_POR_META_POR_DIA = 3;
const ENFRIAMIENTO_MS = 72 * 60 * 60 * 1000;
const MIN_DIAS_CON_DATOS = 3;
const MULTIPLO_GASTO_SIN_RESULTADOS = 2;
const UMBRAL_COSTO_AJUSTAR = 0.8;
const AJUSTE_PRESUPUESTO_PORCENTAJE = 20;
const MULTIPLO_COSTO_CANSANCIO = 1.3;
const UMBRAL_FRECUENCIA_CANSANCIO = 3;
const VENCE_EN_HORAS = 24;

function sumarSnapshots(filas: SnapshotDiario[]): { spend: number; conversiones: number } {
  return filas.reduce(
    (acc, f) => ({ spend: acc.spend + f.spend, conversiones: acc.conversiones + f.conversiones }),
    { spend: 0, conversiones: 0 }
  );
}

function costoPorResultado(filas: SnapshotDiario[]): number | null {
  const { spend, conversiones } = sumarSnapshots(filas);
  return conversiones > 0 ? spend / conversiones : null;
}

// Llamado una vez al día (8:00am Bogotá) por un Schedule Trigger en n8n
// -- mismo patrón ADMIN_SECRET que los demás crons. Revisa cada meta
// activa y sin el Autopiloto pausado, de un usuario admin (Autopiloto
// sigue oculto para el resto), y propone -- nunca ejecuta nada por sí
// solo.
export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error("ADMIN_SECRET no configurado.");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const authHeader = req.headers.get("authorization") || "";
  if (!compararSeguro(authHeader, `Bearer ${adminSecret}`)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: metasActivas } = await supabaseAdmin
    .from("metas")
    .select("*, usuarios!inner(rol)")
    .eq("estado", "activa")
    .eq("pausado_autopiloto", false);

  const metasAdmin = (metasActivas ?? []).filter((m: any) => m.usuarios?.rol === "admin") as (Meta & { usuarios: any })[];

  const resumen: any[] = [];
  for (const meta of metasAdmin) {
    resumen.push(await revisarMeta(meta));
  }

  return NextResponse.json({ ok: true, metas_evaluadas: metasAdmin.length, resumen });
}

async function revisarMeta(meta: Meta) {
  const hoy = hoyBogota();
  const inicioHoy = inicioDiaBogota(hoy).toISOString();

  const { count: propuestasHoy } = await supabaseAdmin
    .from("propuestas")
    .select("*", { count: "exact", head: true })
    .eq("meta_id", meta.id)
    .gte("creado_en", inicioHoy);

  let propuestasCreadasEnEstaCorrida = 0;
  const cupoDisponible = () => (propuestasHoy ?? 0) + propuestasCreadasEnEstaCorrida < MAX_PROPUESTAS_POR_META_POR_DIA;

  if (!cupoDisponible()) {
    await registrarRevision(meta, { motivo: "tope_diario_alcanzado", propuestas_hoy: propuestasHoy ?? 0 });
    return { meta_id: meta.id, propuestas_creadas: 0, motivo: "tope_diario_alcanzado" };
  }

  const avance = await calcularAvanceMeta({
    tipo: meta.tipo,
    user_id: meta.user_id,
    fecha_inicio: meta.fecha_inicio,
    fecha_fin: meta.fecha_fin,
  });

  const campanas = await obtenerCampanasDeMeta(meta.tipo, meta.user_id);
  const campanasActivas = campanas.filter((c) => c.estado === "activa");

  const evaluaciones: any[] = [];

  if (campanasActivas.length === 0) {
    const creada = await proponerSiNoDuplicado(meta, {
      asistente: "estratega",
      accion: "generar_estrategia",
      parametros: {},
      texto: textoGenerarEstrategia({ tipo: meta.tipo, cantidadObjetivo: meta.cantidad_objetivo }),
    });
    if (creada) propuestasCreadasEnEstaCorrida++;
    evaluaciones.push({ regla: "sin_campanas_activas", propuso: creada });
    await registrarRevision(meta, { evaluaciones });
    return { meta_id: meta.id, propuestas_creadas: propuestasCreadasEnEstaCorrida, evaluaciones };
  }

  const hastaEfectivo = hoy < meta.fecha_fin ? hoy : meta.fecha_fin;
  const ultimosEjecutados = await obtenerUltimosCambiosEjecutados(meta.user_id);

  for (const campana of campanasActivas) {
    if (!cupoDisponible()) break;

    const evaluacion: any = { campana_id: campana.id, campana_nombre: campana.nombre };

    // Enfriamiento: cualquier cambio ejecutado (propuesta aprobada o
    // notificación legada aceptada) en los últimos 72h detiene toda
    // evaluación de esta campaña, para no romper el aprendizaje de Meta.
    const ultimoCambio = ultimosEjecutados.get(campana.id);
    if (ultimoCambio && Date.now() - new Date(ultimoCambio).getTime() < ENFRIAMIENTO_MS) {
      evaluacion.motivo = "enfriamiento_72h";
      evaluaciones.push(evaluacion);
      continue;
    }

    // Si el monitoreo viejo ya dejó una sugerencia pendiente para esta
    // campaña, no se propone nada nuevo encima.
    const { count: notisPendientes } = await supabaseAdmin
      .from("notificaciones")
      .select("*", { count: "exact", head: true })
      .eq("campana_id", campana.id)
      .eq("estado", "pendiente")
      .in("tipo", ["alerta", "sugerencia"])
      .not("accion_sugerida", "is", null);

    if ((notisPendientes ?? 0) > 0) {
      evaluacion.motivo = "sugerencia_monitoreo_pendiente";
      evaluaciones.push(evaluacion);
      continue;
    }

    const snapshotsCampana = await obtenerSnapshotsDiarios(campana.id, meta.fecha_inicio, hastaEfectivo);
    if (snapshotsCampana.length < MIN_DIAS_CON_DATOS) {
      evaluacion.motivo = "sin_suficientes_dias_de_datos";
      evaluaciones.push(evaluacion);
      continue;
    }

    const { spend: gastoCampana, conversiones: conversionesCampana } = sumarSnapshots(snapshotsCampana);
    const costoCampana = costoPorResultado(snapshotsCampana);

    // 1) Gasta sin resultados -> pausar. Nunca si es la única activa.
    if (
      campanasActivas.length > 1 &&
      conversionesCampana === 0 &&
      gastoCampana >= MULTIPLO_GASTO_SIN_RESULTADOS * meta.costo_objetivo_cop
    ) {
      const creada = await proponerSiNoDuplicado(meta, {
        asistente: "optimizador",
        accion: "pausar",
        parametros: { campana_id: campana.id },
        texto: textoPausar({ nombreCampana: campana.nombre, gasto: gastoCampana, costoObjetivo: meta.costo_objetivo_cop }),
      });
      if (creada) propuestasCreadasEnEstaCorrida++;
      evaluacion.regla = "gasta_sin_resultados";
      evaluacion.propuso = creada;
      evaluaciones.push(evaluacion);
      continue;
    }

    // 2) Funciona y la meta va atrasada -> subir presupuesto 20%.
    if (
      costoCampana != null &&
      costoCampana <= UMBRAL_COSTO_AJUSTAR * meta.costo_objetivo_cop &&
      avance.proyeccion != null &&
      avance.proyeccion < meta.cantidad_objetivo &&
      campana.presupuesto_diario != null
    ) {
      const presupuestoNuevo = Math.round(campana.presupuesto_diario * (1 + AJUSTE_PRESUPUESTO_PORCENTAJE / 100));
      const cabePresupuesto =
        avance.spend + presupuestoNuevo * avance.diasRestantes <= meta.presupuesto_maximo_cop;

      if (cabePresupuesto) {
        const proyeccionNueva = Math.round(avance.proyeccion * (1 + AJUSTE_PRESUPUESTO_PORCENTAJE / 100));
        const creada = await proponerSiNoDuplicado(meta, {
          asistente: "optimizador",
          accion: "ajustar_presupuesto",
          parametros: { campana_id: campana.id, ajuste_porcentaje: AJUSTE_PRESUPUESTO_PORCENTAJE },
          texto: textoAjustarPresupuesto({
            nombreCampana: campana.nombre,
            costoActual: costoCampana,
            costoObjetivo: meta.costo_objetivo_cop,
            presupuestoActual: campana.presupuesto_diario,
            presupuestoNuevo,
            proyeccionNueva,
            cantidadObjetivo: meta.cantidad_objetivo,
          }),
        });
        if (creada) propuestasCreadasEnEstaCorrida++;
        evaluacion.regla = "meta_atrasada_sube_presupuesto";
        evaluacion.propuso = creada;
        evaluaciones.push(evaluacion);
        continue;
      }
      evaluacion.motivo = "ajuste_no_cabe_en_presupuesto_maximo";
    }

    // 3) Se está cansando -> refrescar creativos. Compara los primeros 3
    // días con datos contra los últimos 3 días con datos dentro de la
    // ventana de la meta (necesita al menos 6 días para no solaparse).
    let motivoCansancio: "costo" | "frecuencia" | "ambos" | null = null;
    if (snapshotsCampana.length >= 6) {
      const primeros = snapshotsCampana.slice(0, 3);
      const ultimos = snapshotsCampana.slice(-3);
      const costoPrimeros = costoPorResultado(primeros);
      const costoUltimos = costoPorResultado(ultimos);
      const costoSubio = costoPrimeros != null && costoUltimos != null && costoUltimos >= MULTIPLO_COSTO_CANSANCIO * costoPrimeros;

      const frecuenciasUltimos = ultimos.map((f) => f.frequency).filter((f): f is number => f != null);
      const frecuenciaAlta =
        frecuenciasUltimos.length > 0 &&
        frecuenciasUltimos.reduce((a, b) => a + b, 0) / frecuenciasUltimos.length >= UMBRAL_FRECUENCIA_CANSANCIO;

      if (costoSubio && frecuenciaAlta) motivoCansancio = "ambos";
      else if (costoSubio) motivoCansancio = "costo";
      else if (frecuenciaAlta) motivoCansancio = "frecuencia";
    }

    if (motivoCansancio) {
      const creada = await proponerSiNoDuplicado(meta, {
        asistente: "creativo",
        accion: "crear_creativos",
        parametros: { campana_id: campana.id },
        texto: textoCrearCreativos({ nombreCampana: campana.nombre, motivo: motivoCansancio }),
      });
      if (creada) propuestasCreadasEnEstaCorrida++;
      evaluacion.regla = "campana_cansada";
      evaluacion.propuso = creada;
    } else if (!evaluacion.regla) {
      evaluacion.motivo = evaluacion.motivo || "ninguna_regla_aplico";
    }
    evaluaciones.push(evaluacion);
  }

  await registrarRevision(meta, { evaluaciones, avance_resumen: { conversiones: avance.conversiones, proyeccion: avance.proyeccion } });
  return { meta_id: meta.id, propuestas_creadas: propuestasCreadasEnEstaCorrida, evaluaciones };
}

// Último cambio EJECUTADO por campaña (de propuestas aprobadas o de
// notificaciones legadas aceptadas) -- un solo fetch por meta/usuario,
// filtrado en memoria por campana_id, en vez de una consulta por
// campaña.
async function obtenerUltimosCambiosEjecutados(userId: string): Promise<Map<string, string>> {
  const { data: eventos } = await supabaseAdmin
    .from("bitacora")
    .select("creado_en, detalle")
    .eq("user_id", userId)
    .eq("tipo_evento", "propuesta_aprobada_ejecutada")
    .order("creado_en", { ascending: false })
    .limit(200);

  const ultimoPorCampana = new Map<string, string>();
  for (const evento of eventos ?? []) {
    const campanaId = (evento.detalle as any)?.campana_id;
    if (campanaId && !ultimoPorCampana.has(campanaId)) {
      ultimoPorCampana.set(campanaId, evento.creado_en);
    }
  }
  return ultimoPorCampana;
}

// Antiduplicado por (meta, campaña opcional, acción): si ya hay una
// propuesta pendiente igual, no crea otra. Crea la propuesta y registra
// bitacora "propuesta_creada" (no confundir con
// propuesta_aprobada_ejecutada, que es al aprobar).
async function proponerSiNoDuplicado(
  meta: Meta,
  datos: {
    asistente: "estratega" | "optimizador" | "creativo";
    accion: "generar_estrategia" | "pausar" | "ajustar_presupuesto" | "crear_creativos";
    parametros: Record<string, unknown>;
    texto: { titulo: string; justificacion: string; impactoEsperado: string; costoEstimadoCop: number | null };
  }
): Promise<boolean> {
  let query = supabaseAdmin
    .from("propuestas")
    .select("id", { count: "exact", head: true })
    .eq("meta_id", meta.id)
    .eq("accion", datos.accion)
    .eq("estado", "pendiente");

  if (datos.parametros.campana_id) {
    query = query.eq("parametros->>campana_id", datos.parametros.campana_id as string);
  }

  const { count } = await query;
  if ((count ?? 0) > 0) return false;

  const venceEn = new Date(Date.now() + VENCE_EN_HORAS * 60 * 60 * 1000).toISOString();

  const { data: propuesta, error } = await supabaseAdmin
    .from("propuestas")
    .insert({
      meta_id: meta.id,
      user_id: meta.user_id,
      asistente: datos.asistente,
      accion: datos.accion,
      parametros: datos.parametros,
      titulo: datos.texto.titulo,
      justificacion: datos.texto.justificacion,
      impacto_esperado: datos.texto.impactoEsperado,
      costo_estimado_cop: datos.texto.costoEstimadoCop,
      estado: "pendiente",
      vence_en: venceEn,
    })
    .select()
    .single();

  if (error || !propuesta) {
    console.error("Director: error creando propuesta:", error);
    return false;
  }

  await supabaseAdmin.from("bitacora").insert({
    user_id: meta.user_id,
    meta_id: meta.id,
    propuesta_id: propuesta.id,
    tipo_evento: "propuesta_creada",
    detalle: { asistente: datos.asistente, accion: datos.accion, parametros: datos.parametros },
  });

  return true;
}

async function registrarRevision(meta: Meta, detalle: Record<string, unknown>) {
  await supabaseAdmin.from("bitacora").insert({
    user_id: meta.user_id,
    meta_id: meta.id,
    propuesta_id: null,
    tipo_evento: "director_revision",
    detalle,
  });
}
