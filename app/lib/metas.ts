// Tipos y cálculo de avance de las metas de Autopiloto. Una sola fuente
// de verdad para los tipos (usados por las rutas /api/metas y por el
// bloque "Mi meta" del Inicio) y para la fórmula de progreso, que no debe
// reinventarse en cada lugar que la necesite.
import { supabaseAdmin } from "@/lib/supabase";
import { diasEntre, hoyBogota, ayerBogota } from "@/app/lib/fechaBogota";

export type TipoMeta = "conversaciones_whatsapp" | "leads";
export type EstadoMeta = "activa" | "pausada" | "cumplida" | "vencida" | "cancelada";
export type NivelAutonomia = "copiloto" | "autopiloto_con_limites";

export type Asistente =
  | "director"
  | "marca"
  | "estratega"
  | "creativo"
  | "publicador"
  | "analista"
  | "optimizador";

export type AccionPropuesta =
  | "generar_estrategia"
  | "crear_creativos"
  | "publicar_campana"
  | "pausar"
  | "ajustar_presupuesto"
  | "agregar_anuncios";

export type EstadoPropuesta = "pendiente" | "aprobada" | "rechazada" | "vencida" | "ejecutada" | "fallida";

export type Meta = {
  id: string;
  user_id: string;
  tipo: TipoMeta;
  cantidad_objetivo: number;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto_maximo_cop: number;
  costo_objetivo_cop: number;
  nivel_autonomia: NivelAutonomia;
  estado: EstadoMeta;
  pausado_autopiloto: boolean;
  creado_en: string;
  actualizado_en: string;
};

export type Propuesta = {
  id: string;
  meta_id: string | null;
  user_id: string;
  asistente: Asistente;
  accion: AccionPropuesta;
  parametros: Record<string, unknown>;
  titulo: string;
  justificacion: string;
  impacto_esperado: string | null;
  costo_estimado_cop: number | null;
  estado: EstadoPropuesta;
  vence_en: string;
  decidido_en: string | null;
  decidido_por: string | null;
  resultado: Record<string, unknown> | null;
  creado_en: string;
};

export type EventoBitacora = {
  id: string;
  user_id: string;
  meta_id: string | null;
  propuesta_id: string | null;
  tipo_evento: string;
  detalle: Record<string, unknown>;
  creado_en: string;
};

// A que campanas_publicadas.objetivo_id (ancla estable, ver
// publicar-estrategia/route.ts) le corresponde cada tipo de meta, con
// fallback al objetivo crudo de Meta para campañas publicadas antes de
// que objetivo_id existiera.
const OBJETIVO_ID_POR_TIPO: Record<TipoMeta, string> = {
  conversaciones_whatsapp: "venta_directa_whatsapp",
  leads: "leads",
};
const OBJETIVO_META_POR_TIPO: Record<TipoMeta, string> = {
  conversaciones_whatsapp: "OUTCOME_ENGAGEMENT",
  leads: "OUTCOME_LEADS",
};

export function campanaCoincideConTipo(
  campana: { objetivo_id: string | null; objetivo: string | null },
  tipo: TipoMeta
): boolean {
  if (campana.objetivo_id) return campana.objetivo_id === OBJETIVO_ID_POR_TIPO[tipo];
  return campana.objetivo === OBJETIVO_META_POR_TIPO[tipo];
}

// Para el body de agregar_anuncios (necesita objetivo_id siempre, no el
// objetivo crudo de Meta) -- mismo fallback que campanaCoincideConTipo,
// pero devolviendo el id en vez de un booleano. Solo cubre los dos tipos
// de meta que existen hoy (conversaciones_whatsapp, leads); como toda
// propuesta de agregar_anuncios nace de una campaña ya asociada a una
// meta, no hace falta cubrir los demás objetivos del catálogo.
export function inferirObjetivoId(campana: { objetivo_id: string | null; objetivo: string | null }): string | null {
  if (campana.objetivo_id) return campana.objetivo_id;
  for (const tipo of Object.keys(OBJETIVO_META_POR_TIPO) as TipoMeta[]) {
    if (campana.objetivo === OBJETIVO_META_POR_TIPO[tipo]) return OBJETIVO_ID_POR_TIPO[tipo];
  }
  return null;
}

export type CampanaDeMeta = {
  id: string;
  nombre: string;
  estado: string;
  objetivo: string | null;
  objetivo_id: string | null;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  presupuesto_diario: number | null;
  fecha_publicacion: string | null;
};

// Campañas del usuario que coinciden con el tipo de una meta -- mismo
// matcheo que usa sumarResultados (objetivo_id con fallback a objetivo),
// pero con los campos que necesita el Director para evaluar reglas y
// armar propuestas, no solo para sumar spend/conversiones.
export async function obtenerCampanasDeMeta(tipo: TipoMeta, userId: string): Promise<CampanaDeMeta[]> {
  const { data: campanas } = await supabaseAdmin
    .from("campanas_publicadas")
    .select("id, nombre, estado, objetivo, objetivo_id, meta_campaign_id, meta_adset_id, presupuesto_diario, fecha_publicacion")
    .eq("user_id", userId);

  return (campanas ?? []).filter((c) => campanaCoincideConTipo(c, tipo));
}

export type SnapshotDiario = {
  fecha_bogota: string;
  spend: number;
  conversiones: number;
  frequency: number | null;
  ctr: number | null;
  impresiones: number | null;
};

// Snapshots diarios de UNA campaña, deduplicados por día (misma defensa
// que sumarResultados), con frequency/ctr/impresiones incluidos -- lo
// que sumarResultados no trae porque solo le hacía falta spend y
// conversiones. Pensado para que el Director compare "los últimos 3
// días" contra "los primeros días" de una campaña.
export async function obtenerSnapshotsDiarios(campanaId: string, desde: string, hasta: string): Promise<SnapshotDiario[]> {
  const { data: filas } = await supabaseAdmin
    .from("campanas_snapshots")
    .select("fecha_bogota, spend, conversiones, frequency, ctr, impresiones, corrida_en")
    .eq("campana_id", campanaId)
    .gte("fecha_bogota", desde)
    .lte("fecha_bogota", hasta);

  const porDia = new Map<string, SnapshotDiario & { corrida_en: string }>();
  for (const fila of filas ?? []) {
    const existente = porDia.get(fila.fecha_bogota);
    if (!existente || fila.corrida_en > existente.corrida_en) {
      porDia.set(fila.fecha_bogota, {
        fecha_bogota: fila.fecha_bogota,
        spend: Number(fila.spend) || 0,
        conversiones: Number(fila.conversiones) || 0,
        frequency: fila.frequency != null ? Number(fila.frequency) : null,
        ctr: fila.ctr != null ? Number(fila.ctr) : null,
        impresiones: fila.impresiones != null ? Number(fila.impresiones) : null,
        corrida_en: fila.corrida_en,
      });
    }
  }
  return [...porDia.values()].sort((a, b) => (a.fecha_bogota < b.fecha_bogota ? -1 : 1));
}

// Suma spend/conversiones de las campañas de un tipo (de un usuario, o de
// todos si userId es null) entre dos fechas Bogotá (inclusive), con una
// sola fila por campaña por día -- defensivo ante un futuro segundo
// escritor en campanas_snapshots, aunque el indice unico (campana_id,
// fecha_bogota) ya no deberia permitir duplicados.
async function sumarResultados(params: {
  tipo: TipoMeta;
  userId: string | null;
  desde: string;
  hasta: string;
}): Promise<{ spend: number; conversiones: number; campanas: number }> {
  let query = supabaseAdmin.from("campanas_publicadas").select("id, objetivo_id, objetivo");
  if (params.userId) query = query.eq("user_id", params.userId);
  const { data: campanas } = await query;

  const idsCoinciden = (campanas ?? [])
    .filter((c) => campanaCoincideConTipo(c, params.tipo))
    .map((c) => c.id);

  if (idsCoinciden.length === 0) return { spend: 0, conversiones: 0, campanas: 0 };

  const { data: filas } = await supabaseAdmin
    .from("campanas_snapshots")
    .select("campana_id, fecha_bogota, spend, conversiones, corrida_en")
    .in("campana_id", idsCoinciden)
    .gte("fecha_bogota", params.desde)
    .lte("fecha_bogota", params.hasta);

  const porDia = new Map<string, { spend: number; conversiones: number; corrida_en: string }>();
  for (const fila of filas ?? []) {
    const clave = `${fila.campana_id}|${fila.fecha_bogota}`;
    const existente = porDia.get(clave);
    if (!existente || fila.corrida_en > existente.corrida_en) {
      porDia.set(clave, {
        spend: Number(fila.spend) || 0,
        conversiones: Number(fila.conversiones) || 0,
        corrida_en: fila.corrida_en,
      });
    }
  }

  const campanasConDatos = new Set<string>();
  let spend = 0;
  let conversiones = 0;
  for (const [clave, valores] of porDia) {
    spend += valores.spend;
    conversiones += valores.conversiones;
    campanasConDatos.add(clave.split("|")[0]);
  }

  return { spend, conversiones, campanas: campanasConDatos.size };
}

export type AvanceMeta = {
  conversiones: number;
  spend: number;
  diasTranscurridos: number;
  diasRestantes: number;
  proyeccion: number | null;
};

// Progreso de una meta: conversiones/spend solo dentro de su propia
// ventana de fechas (aunque la campaña haya arrancado antes). La
// proyección usa el ritmo de los días ya TERMINADOS (sin hoy, que viene
// parcial) y le suma lo que ya lleva hoy -- exige al menos 3 días
// terminados, porque con menos una racha corta puede dar una proyección
// absurda.
export async function calcularAvanceMeta(meta: {
  tipo: TipoMeta;
  user_id: string;
  fecha_inicio: string;
  fecha_fin: string;
}): Promise<AvanceMeta> {
  const hoy = hoyBogota();
  const metaEnCurso = hoy <= meta.fecha_fin;
  const hastaEfectivo = metaEnCurso ? hoy : meta.fecha_fin;

  const resultadoTotal = await sumarResultados({
    tipo: meta.tipo,
    userId: meta.user_id,
    desde: meta.fecha_inicio,
    hasta: hastaEfectivo,
  });

  const diasTranscurridos = diasEntre(meta.fecha_inicio, hastaEfectivo).length;
  const duracionTotal = diasEntre(meta.fecha_inicio, meta.fecha_fin).length;
  const diasRestantes = hoy > meta.fecha_fin ? 0 : diasEntre(hoy, meta.fecha_fin).length;

  // Días terminados: toda la ventana si ya cerró, o hasta ayer si sigue
  // en curso (si la meta arranca hoy mismo, todavía no hay ninguno).
  const ayer = ayerBogota();
  const diasCompletos = metaEnCurso
    ? ayer >= meta.fecha_inicio
      ? diasEntre(meta.fecha_inicio, ayer)
      : []
    : diasEntre(meta.fecha_inicio, meta.fecha_fin);

  let proyeccion: number | null = null;
  if (diasCompletos.length >= 3) {
    const resultadoDiasCompletos =
      diasCompletos.length > 0
        ? await sumarResultados({
            tipo: meta.tipo,
            userId: meta.user_id,
            desde: diasCompletos[0],
            hasta: diasCompletos[diasCompletos.length - 1],
          })
        : { spend: 0, conversiones: 0, campanas: 0 };

    // Lo de hoy = total - dias completos (mismo rango, sin una tercera
    // consulta): si la meta ya cerró, hoy no aporta nada.
    const conversionesHoy = metaEnCurso ? resultadoTotal.conversiones - resultadoDiasCompletos.conversiones : 0;

    const ritmo = resultadoDiasCompletos.conversiones / diasCompletos.length;
    proyeccion = Math.round(ritmo * duracionTotal) + conversionesHoy;
  }

  return {
    conversiones: resultadoTotal.conversiones,
    spend: resultadoTotal.spend,
    diasTranscurridos,
    diasRestantes,
    proyeccion,
  };
}

export type FuenteCostoReferencia = "tu_historial" | "promedio_quiubot" | "referencia_admin";

export type CostoReferencia = {
  valorCop: number;
  fuente: FuenteCostoReferencia;
};

// Costo por resultado en 3 niveles, SUM(spend)/SUM(conversiones) sobre
// filas ya deduplicadas por día (nunca un promedio de razones por
// campaña, que pesa igual a una campaña con 1 conversión que a una con
// 100): primero el historial del propio cliente (solo si tiene al menos
// 10 resultados en los últimos 60 días -- con menos, no es confiable),
// si no hay el promedio de todos los clientes de Quiubot (solo si
// califican al menos 5 campañas con datos), y si tampoco hay, el valor
// de referencia editable por el admin.
const MINIMO_RESULTADOS_HISTORIAL_PROPIO = 10;

export async function calcularCostoReferencia(tipo: TipoMeta, userId: string): Promise<CostoReferencia> {
  const hoy = hoyBogota();
  const hace60dias = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  });

  const propio = await sumarResultados({ tipo, userId, desde: hace60dias, hasta: hoy });
  if (propio.conversiones >= MINIMO_RESULTADOS_HISTORIAL_PROPIO) {
    return { valorCop: propio.spend / propio.conversiones, fuente: "tu_historial" };
  }

  const global = await sumarResultados({ tipo, userId: null, desde: hace60dias, hasta: hoy });
  if (global.campanas >= 5 && global.conversiones > 0) {
    return { valorCop: global.spend / global.conversiones, fuente: "promedio_quiubot" };
  }

  const { data } = await supabaseAdmin
    .from("costos_referencia")
    .select("costo_referencia_cop")
    .eq("tipo", tipo)
    .single();

  return { valorCop: Number(data?.costo_referencia_cop) || 0, fuente: "referencia_admin" };
}
