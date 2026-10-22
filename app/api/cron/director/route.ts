import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import {
  obtenerCampanasDeMeta,
  obtenerSnapshotsDiarios,
  calcularAvanceMeta,
  calcularCostoReferencia,
  campanaCoincideConTipo,
  type Meta,
  type TipoMeta,
  type SnapshotDiario,
} from "@/app/lib/metas";
import { esPropuestaDePrueba } from "@/app/lib/propuestas";
import { hoyBogota, fechaBogota, inicioDiaBogota } from "@/app/lib/fechaBogota";
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
const DIAS_META_SIMULADA = 30;
const HORAS_SIN_DATOS_ESTADO_DESCONOCIDO_MS = 48 * 60 * 60 * 1000;

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

function promedio(valores: number[]): number | null {
  return valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
}

// Llamado una vez al día (8:00am Bogotá) por un Schedule Trigger en n8n
// -- mismo patrón ADMIN_SECRET que los demás crons. Revisa cada meta
// activa y sin el Autopiloto pausado, de un usuario admin (Autopiloto
// sigue oculto para el resto), y propone -- nunca ejecuta nada por sí
// solo.
//
// ?simular=<email>: modo simulación (requiere el mismo ADMIN_SECRET).
// Corre las mismas reglas sobre las campañas reales de ese usuario (su
// meta activa si tiene, o una meta ficticia en memoria si no) y
// devuelve qué propondría, sin escribir nada -- ni propuestas, ni
// bitácora. Cada función que normalmente inserta recibe `simular` y
// hace `if (simular) return ...` antes de tocar la base, así que es
// imposible que esta ruta escriba algo mientras simula.
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

  const emailSimular = req.nextUrl.searchParams.get("simular");

  if (emailSimular) {
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id, email")
      .eq("email", emailSimular.trim().toLowerCase())
      .maybeSingle();

    if (!usuario) {
      return NextResponse.json({ error: "No existe un usuario con ese correo." }, { status: 404 });
    }

    const { data: metaReal } = await supabaseAdmin
      .from("metas")
      .select("*")
      .eq("user_id", usuario.id)
      .eq("estado", "activa")
      .maybeSingle();

    const metaParaSimular = (metaReal as Meta | null) ?? (await construirMetaSimulada(usuario.id));

    if (!metaParaSimular) {
      return NextResponse.json({
        ok: true,
        simulado: true,
        email: emailSimular,
        meta_usada: null,
        motivo: "sin_campanas_activas_para_construir_una_meta_ficticia",
        resumen: null,
      });
    }

    // Overrides opcionales para probar escenarios concretos (ej. "si la
    // meta fuera más ambiciosa, ¿proponés subir presupuesto?") sin
    // depender de que el costo de referencia por defecto -- que para un
    // usuario con una sola campaña real termina siendo básicamente el
    // costo de ESA misma campaña, por lo que la regla de "va atrasada"
    // nunca se puede disparar sola. Sin overrides, se sigue usando el
    // costo de referencia de 3 niveles (igual que /api/metas/previsualizar).
    const cantidadParam = req.nextUrl.searchParams.get("cantidad");
    if (cantidadParam != null) {
      const n = Number(cantidadParam);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ error: "cantidad debe ser un número mayor a cero." }, { status: 400 });
      }
      metaParaSimular.cantidad_objetivo = n;
    }
    const costoObjetivoParam = req.nextUrl.searchParams.get("costo_objetivo_cop");
    if (costoObjetivoParam != null) {
      const n = Number(costoObjetivoParam);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ error: "costo_objetivo_cop debe ser un número mayor a cero." }, { status: 400 });
      }
      metaParaSimular.costo_objetivo_cop = n;
    }
    const presupuestoMaximoParam = req.nextUrl.searchParams.get("presupuesto_maximo_cop");
    if (presupuestoMaximoParam != null) {
      const n = Number(presupuestoMaximoParam);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ error: "presupuesto_maximo_cop debe ser un número mayor a cero." }, { status: 400 });
      }
      metaParaSimular.presupuesto_maximo_cop = n;
    }
    const fechaFinParam = req.nextUrl.searchParams.get("fecha_fin");
    if (fechaFinParam != null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaFinParam)) {
        return NextResponse.json({ error: "fecha_fin debe tener el formato YYYY-MM-DD." }, { status: 400 });
      }
      metaParaSimular.fecha_fin = fechaFinParam;
    }

    const resumen = await revisarMeta(metaParaSimular, true);
    return NextResponse.json({
      ok: true,
      simulado: true,
      email: emailSimular,
      meta_usada: metaReal ? "real" : "ficticia",
      meta: metaParaSimular,
      resumen,
    });
  }

  const { data: metasActivas } = await supabaseAdmin
    .from("metas")
    .select("*, usuarios!inner(rol)")
    .eq("estado", "activa")
    .eq("pausado_autopiloto", false);

  const metasAdmin = (metasActivas ?? []).filter((m: any) => m.usuarios?.rol === "admin") as (Meta & { usuarios: any })[];

  const resumen: any[] = [];
  for (const meta of metasAdmin) {
    resumen.push(await revisarMeta(meta, false));
  }

  return NextResponse.json({ ok: true, metas_evaluadas: metasAdmin.length, resumen });
}

// Meta ficticia en memoria para el modo simulación, cuando el usuario
// no tiene una meta activa de verdad -- nunca se inserta en "metas".
// Tipo: según el objetivo de sus campañas activas (leads si alguna
// coincide con ese tipo, si no conversaciones_whatsapp -- son los
// únicos dos tipos que existen hoy; si ninguna campaña coincide con
// ninguno, conversaciones_whatsapp queda como default declarado).
// Ventana: 30 días terminando hoy (para que SÍ haya historial real en
// campanas_snapshots que las reglas puedan leer -- una ventana que
// arrancara hoy no tendría ningún día con datos todavía).
// Presupuesto: gasto diario actual (suma de presupuesto_diario de sus
// campañas activas del tipo elegido) × 30. Costo objetivo: el mismo
// costo de referencia de 3 niveles que ya usa /api/metas/previsualizar
// para sugerir una meta realista cuando no hay un valor explícito.
async function construirMetaSimulada(userId: string): Promise<Meta | null> {
  const { data: campanasActivas } = await supabaseAdmin
    .from("campanas_publicadas")
    .select("id, estado, objetivo, objetivo_id, presupuesto_diario")
    .eq("user_id", userId)
    .eq("estado", "activa");

  if (!campanasActivas || campanasActivas.length === 0) return null;

  const tipo: TipoMeta = campanasActivas.some((c) => campanaCoincideConTipo(c, "leads"))
    ? "leads"
    : "conversaciones_whatsapp";

  const campanasDelTipo = campanasActivas.filter((c) => campanaCoincideConTipo(c, tipo));
  const campanasParaGasto = campanasDelTipo.length > 0 ? campanasDelTipo : campanasActivas;
  const gastoDiarioActual = campanasParaGasto.reduce((acc, c) => acc + (c.presupuesto_diario || 0), 0);

  const hoy = hoyBogota();
  const fechaInicio = fechaBogota(new Date(Date.now() - (DIAS_META_SIMULADA - 1) * 24 * 60 * 60 * 1000));
  const presupuestoMaximo = gastoDiarioActual * DIAS_META_SIMULADA;

  const costoReferencia = await calcularCostoReferencia(tipo, userId);
  const costoObjetivo = costoReferencia.valorCop > 0 ? costoReferencia.valorCop : 1;
  const cantidadObjetivo = Math.max(1, Math.round(presupuestoMaximo / costoObjetivo));

  return {
    id: `simulacion-${userId}`,
    user_id: userId,
    tipo,
    cantidad_objetivo: cantidadObjetivo,
    fecha_inicio: fechaInicio,
    fecha_fin: hoy,
    presupuesto_maximo_cop: presupuestoMaximo,
    costo_objetivo_cop: costoObjetivo,
    nivel_autonomia: "copiloto",
    estado: "activa",
    pausado_autopiloto: false,
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
  };
}

async function revisarMeta(meta: Meta, simular: boolean) {
  const hoy = hoyBogota();
  const inicioHoy = inicioDiaBogota(hoy).toISOString();

  let propuestasCreadasEnEstaCorrida = 0;
  let cupoDisponible = () => true;

  if (!simular) {
    // Cuenta leyendo filas (no un count de cabecera) porque hay que
    // descartar las de prueba en memoria -- un filtro .neq() sobre un
    // campo JSON que puede no existir no distingue "false" de "no
    // existe" en SQL, y contaría de más.
    const { data: filasHoy } = await supabaseAdmin
      .from("propuestas")
      .select("titulo, parametros")
      .eq("meta_id", meta.id)
      .gte("creado_en", inicioHoy);

    const propuestasHoy = (filasHoy ?? []).filter((p) => !esPropuestaDePrueba(p)).length;
    cupoDisponible = () => propuestasHoy + propuestasCreadasEnEstaCorrida < MAX_PROPUESTAS_POR_META_POR_DIA;

    if (!cupoDisponible()) {
      await registrarRevision(meta, { motivo: "tope_diario_alcanzado", propuestas_hoy: propuestasHoy }, simular);
      return { meta_id: meta.id, propuestas_creadas: 0, motivo: "tope_diario_alcanzado" };
    }
  }

  // calcularAvanceMeta ahora lanza si la consulta de snapshots falla
  // (ver app/lib/metas.ts) en vez de devolver 0 en silencio -- un error
  // acá no puede tirar abajo la corrida completa del cron (afectaría a
  // TODAS las metas, no solo esta), así que se atrapa, se deja
  // constancia (bitacora si es la corrida real) y se sigue evaluando
  // con avance "desconocido" -- la regla 2 (meta atrasada) simplemente
  // no aplica con proyeccion=null, igual que si no hubiera datos.
  let avance;
  let errorAvance: string | null = null;
  try {
    avance = await calcularAvanceMeta({
      tipo: meta.tipo,
      user_id: meta.user_id,
      fecha_inicio: meta.fecha_inicio,
      fecha_fin: meta.fecha_fin,
    });
  } catch (err) {
    errorAvance = err instanceof Error ? err.message : "Error desconocido calculando el avance.";
    avance = { conversiones: 0, spend: 0, diasTranscurridos: 0, diasRestantes: 0, proyeccion: null };
    if (!simular) {
      await supabaseAdmin.from("bitacora").insert({
        user_id: meta.user_id,
        meta_id: meta.id,
        propuesta_id: null,
        tipo_evento: "director_revision_error",
        detalle: { paso: "calcular_avance", error: errorAvance },
      });
    }
  }
  const avanceResumen = {
    conversiones: avance.conversiones,
    gasto: avance.spend,
    proyeccion: avance.proyeccion,
    ...(errorAvance ? { error: errorAvance } : {}),
  };

  const campanas = await obtenerCampanasDeMeta(meta.tipo, meta.user_id);
  const campanasActivas = campanas.filter((c) => c.estado === "activa");

  const evaluaciones: any[] = [];

  if (campanasActivas.length === 0) {
    const resultado = await proponerSiNoDuplicado(
      meta,
      {
        asistente: "estratega",
        accion: "generar_estrategia",
        parametros: {},
        texto: textoGenerarEstrategia({ tipo: meta.tipo, cantidadObjetivo: meta.cantidad_objetivo }),
      },
      simular
    );
    if (resultado.propuso && !simular) propuestasCreadasEnEstaCorrida++;
    evaluaciones.push({ regla: "sin_campanas_activas", propuso: resultado.propuso, propuesta: resultado.propuesta });
    await registrarRevision(meta, { evaluaciones, avance_resumen: avanceResumen }, simular);
    return { meta_id: meta.id, simulado: simular, propuestas_creadas: propuestasCreadasEnEstaCorrida, avance: avanceResumen, evaluaciones };
  }

  const hastaEfectivo = hoy < meta.fecha_fin ? hoy : meta.fecha_fin;
  const ultimosEjecutados = await obtenerUltimosCambiosEjecutados(meta.user_id);
  let contadorEstadoDesconocido = 0;

  for (const campana of campanasActivas) {
    // El tope diario nunca frena una simulación -- el punto es ver qué
    // propondría cada campaña con cada regla, no el límite de hoy.
    if (!simular && !cupoDisponible()) break;

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

    // obtenerSnapshotsDiarios ahora lanza si la consulta falla, en vez
    // de devolver [] -- eso se veía indistinguible de "campaña sin
    // actividad real" (así se descubrió que fecha_bogota no existía en
    // la base: toda campaña, sin importar su actividad, veía 0 días).
    // Un error acá es por campaña, no por meta: se registra y se sigue
    // con las demás campañas en vez de abortar toda la corrida.
    let snapshotsCampana;
    try {
      snapshotsCampana = await obtenerSnapshotsDiarios(campana.id, meta.fecha_inicio, hastaEfectivo);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error desconocido leyendo los datos de la campaña.";
      evaluacion.motivo = "error_leyendo_datos";
      evaluacion.error = mensaje;
      evaluaciones.push(evaluacion);
      if (!simular) {
        await supabaseAdmin.from("bitacora").insert({
          user_id: meta.user_id,
          meta_id: meta.id,
          propuesta_id: null,
          tipo_evento: "director_revision_error",
          detalle: { paso: "leer_snapshots", campana_id: campana.id, error: mensaje },
        });
      }
      continue;
    }

    if (snapshotsCampana.length < MIN_DIAS_CON_DATOS) {
      evaluacion.motivo = "sin_suficientes_dias_de_datos";
      evaluacion.dias_con_datos = snapshotsCampana.length;
      evaluaciones.push(evaluacion);
      continue;
    }

    // Capa 2 contra el estado cacheado de campanas_publicadas: por
    // GASTO, no por filas -- sync-meta-insights escribe una fila diaria
    // para toda campaña que no esté "eliminada", incluso con $0 (una
    // campaña pausada en Meta sigue generando filas), así que "hay una
    // fila reciente" no prueba que de verdad esté corriendo. Una
    // campaña "activa" con $0 de gasto en sus últimos 2 días con datos
    // (o sin ninguna fila en las últimas 48h) se trata como "estado
    // desconocido" -- no se confía en que siga corriendo en Meta, y no
    // se dispara ninguna regla sobre ella. snapshotsCampana viene
    // ordenado ascendente por fecha_bogota (ver obtenerSnapshotsDiarios).
    const ultimoDiaConDatos = snapshotsCampana[snapshotsCampana.length - 1].fecha_bogota;
    const diasDesdeUltimoDato = Date.now() - inicioDiaBogota(ultimoDiaConDatos).getTime();
    const sinFilasRecientes = diasDesdeUltimoDato > HORAS_SIN_DATOS_ESTADO_DESCONOCIDO_MS;
    const ultimosDosConDatos = snapshotsCampana.slice(-2);
    const sinGastoReciente = ultimosDosConDatos.every((f) => f.spend === 0);
    if (sinFilasRecientes || sinGastoReciente) {
      evaluacion.motivo = "estado_desconocido_sin_gasto_reciente";
      evaluacion.dias_con_datos = snapshotsCampana.length;
      evaluacion.ultimo_dia_con_datos = ultimoDiaConDatos;
      evaluaciones.push(evaluacion);
      contadorEstadoDesconocido++;
      continue;
    }

    const { spend: gastoCampana, conversiones: conversionesCampana } = sumarSnapshots(snapshotsCampana);
    const costoCampana = costoPorResultado(snapshotsCampana);
    const frecuenciaPromedio = promedio(
      snapshotsCampana.map((f) => f.frequency).filter((f): f is number => f != null)
    );

    // Datos que usó esta evaluación -- siempre presentes desde acá en
    // adelante, sin importar qué regla dispare o no.
    evaluacion.dias_con_datos = snapshotsCampana.length;
    evaluacion.gasto = gastoCampana;
    evaluacion.resultados = conversionesCampana;
    evaluacion.costo_por_resultado = costoCampana;
    evaluacion.frecuencia_promedio = frecuenciaPromedio;

    // 1) Gasta sin resultados -> pausar. Nunca si es la única activa.
    if (
      campanasActivas.length > 1 &&
      conversionesCampana === 0 &&
      gastoCampana >= MULTIPLO_GASTO_SIN_RESULTADOS * meta.costo_objetivo_cop
    ) {
      const resultado = await proponerSiNoDuplicado(
        meta,
        {
          asistente: "optimizador",
          accion: "pausar",
          parametros: { campana_id: campana.id },
          texto: textoPausar({ nombreCampana: campana.nombre, gasto: gastoCampana, costoObjetivo: meta.costo_objetivo_cop }),
        },
        simular
      );
      if (resultado.propuso && !simular) propuestasCreadasEnEstaCorrida++;
      evaluacion.regla = "gasta_sin_resultados";
      evaluacion.propuso = resultado.propuso;
      evaluacion.propuesta = resultado.propuesta;
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
        const resultado = await proponerSiNoDuplicado(
          meta,
          {
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
          },
          simular
        );
        if (resultado.propuso && !simular) propuestasCreadasEnEstaCorrida++;
        evaluacion.regla = "meta_atrasada_sube_presupuesto";
        evaluacion.propuso = resultado.propuso;
        evaluacion.propuesta = resultado.propuesta;
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
      const resultado = await proponerSiNoDuplicado(
        meta,
        {
          asistente: "creativo",
          accion: "crear_creativos",
          parametros: { campana_id: campana.id },
          texto: textoCrearCreativos({ nombreCampana: campana.nombre, motivo: motivoCansancio }),
        },
        simular
      );
      if (resultado.propuso && !simular) propuestasCreadasEnEstaCorrida++;
      evaluacion.regla = "campana_cansada";
      evaluacion.propuso = resultado.propuso;
      evaluacion.propuesta = resultado.propuesta;
    } else if (!evaluacion.regla) {
      evaluacion.motivo = evaluacion.motivo || "ninguna_regla_aplico";
    }
    evaluaciones.push(evaluacion);
  }

  // Si NINGUNA campaña activa tenía gasto reciente (todas "estado
  // desconocido"), pausar/ajustar_presupuesto/crear_creativos no se
  // pudieron evaluar en ninguna -- a efectos prácticos no hay ninguna
  // campaña corriendo de verdad, así que se trata igual que si
  // campanasActivas.length fuera 0: se propone generar una estrategia
  // nueva en vez de quedarse sin proponer nada.
  if (contadorEstadoDesconocido === campanasActivas.length) {
    const resultado = await proponerSiNoDuplicado(
      meta,
      {
        asistente: "estratega",
        accion: "generar_estrategia",
        parametros: {},
        texto: textoGenerarEstrategia({ tipo: meta.tipo, cantidadObjetivo: meta.cantidad_objetivo }),
      },
      simular
    );
    if (resultado.propuso && !simular) propuestasCreadasEnEstaCorrida++;
    evaluaciones.push({ regla: "ninguna_campana_con_gasto_reciente", propuso: resultado.propuso, propuesta: resultado.propuesta });
  }

  await registrarRevision(meta, { evaluaciones, avance_resumen: avanceResumen }, simular);
  return { meta_id: meta.id, simulado: simular, propuestas_creadas: propuestasCreadasEnEstaCorrida, avance: avanceResumen, evaluaciones };
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

type TextoPropuesta = { titulo: string; justificacion: string; impactoEsperado: string; costoEstimadoCop: number | null };

// Antiduplicado por (meta, campaña opcional, acción): si ya hay una
// propuesta pendiente igual -- sin contar las de prueba -- no crea
// otra. En modo simulación nunca inserta: el "if (simular) return"
// está antes de cualquier .insert(), así que no hay forma de que esta
// función escriba mientras simula.
async function proponerSiNoDuplicado(
  meta: Meta,
  datos: {
    asistente: "estratega" | "optimizador" | "creativo";
    accion: "generar_estrategia" | "pausar" | "ajustar_presupuesto" | "crear_creativos";
    parametros: Record<string, unknown>;
    texto: TextoPropuesta;
  },
  simular: boolean
): Promise<{ propuso: boolean; propuesta?: TextoPropuesta; yaExistiaPendiente?: boolean }> {
  let query = supabaseAdmin
    .from("propuestas")
    .select("titulo, parametros")
    .eq("meta_id", meta.id)
    .eq("accion", datos.accion)
    .eq("estado", "pendiente");

  if (datos.parametros.campana_id) {
    query = query.eq("parametros->>campana_id", datos.parametros.campana_id as string);
  }

  const { data: filasExistentes } = await query;
  const yaExiste = (filasExistentes ?? []).some((p) => !esPropuestaDePrueba(p));
  if (yaExiste) return { propuso: false, yaExistiaPendiente: true };

  if (simular) {
    return { propuso: true, propuesta: datos.texto };
  }

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
    return { propuso: false };
  }

  await supabaseAdmin.from("bitacora").insert({
    user_id: meta.user_id,
    meta_id: meta.id,
    propuesta_id: propuesta.id,
    tipo_evento: "propuesta_creada",
    detalle: { asistente: datos.asistente, accion: datos.accion, parametros: datos.parametros },
  });

  return { propuso: true, propuesta: datos.texto };
}

async function registrarRevision(meta: Meta, detalle: Record<string, unknown>, simular: boolean) {
  if (simular) return; // la simulación nunca escribe en bitacora.
  await supabaseAdmin.from("bitacora").insert({
    user_id: meta.user_id,
    meta_id: meta.id,
    propuesta_id: null,
    tipo_evento: "director_revision",
    detalle,
  });
}
