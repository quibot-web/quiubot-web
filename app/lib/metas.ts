// Tipos y cálculo de avance de las metas de Autopiloto. Una sola fuente
// de verdad para los tipos (usados por las rutas /api/metas y por el
// bloque "Mi meta" del Inicio) y para la fórmula de progreso, que no debe
// reinventarse en cada lugar que la necesite.
import { supabaseAdmin } from "@/lib/supabase";
import { diasEntre, hoyBogota, ayerBogota } from "@/app/lib/fechaBogota";

// seguidores_instagram: a diferencia de todos los demás tipos, no se
// mide sumando conversiones de campañas (Meta no reporta "follow" como
// action_type en Instagram -- ya se probó en vivo). Se mide por foto
// diaria de followers_count (instagram_seguidores_snapshots) contra
// metas.valor_inicial, capturado al crear la meta -- ver
// calcularAvanceSeguidoresInstagram más abajo. Todavía no tiene un
// objetivo_id de campaña real (eso depende de si Meta permite crear una
// campaña OUTCOME_TRAFFIC con destino al perfil de Instagram), así que
// el Director no le propone nada por ahora (ver revisarMeta en
// app/api/cron/director/route.ts).
export type TipoMeta = "conversaciones_whatsapp" | "leads" | "ventas_web" | "visitas_web" | "seguidores_facebook" | "seguidores_instagram";
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
  // Solo aplica a tipo "ventas_web" -- cuánto retorno (ingreso/gasto)
  // necesita cada peso invertido para que la meta lo considere bueno.
  // null hasta que el asistente la pregunte, o en metas de otro tipo.
  roas_minimo: number | null;
  // Solo aplica a tipos que se miden por foto (hoy, seguidores_instagram)
  // -- el followers_count del momento en que se creó la meta, para poder
  // restar y saber cuánto creció. null en todos los demás tipos.
  valor_inicial: number | null;
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
// seguidores_instagram: reservado para cuando (si) exista una campaña
// real de Meta para esto -- hoy ninguna campaña puede tener este
// objetivo_id (no se ofrece en /estrategia todavía), así que
// obtenerCampanasDeMeta/sumarResultados siempre dan 0 campañas para
// este tipo, lo cual es correcto: el avance se calcula aparte, por
// snapshot (ver calcularAvanceSeguidoresInstagram).
const OBJETIVO_ID_POR_TIPO: Record<TipoMeta, string> = {
  conversaciones_whatsapp: "venta_directa_whatsapp",
  leads: "leads",
  ventas_web: "venta_directa_web",
  visitas_web: "visitas_web",
  seguidores_facebook: "seguidores_facebook",
  seguidores_instagram: "seguidores_instagram",
};
const OBJETIVO_META_POR_TIPO: Record<TipoMeta, string> = {
  conversaciones_whatsapp: "OUTCOME_ENGAGEMENT",
  leads: "OUTCOME_LEADS",
  ventas_web: "OUTCOME_SALES",
  visitas_web: "OUTCOME_TRAFFIC",
  seguidores_facebook: "OUTCOME_ENGAGEMENT",
  seguidores_instagram: "OUTCOME_ENGAGEMENT",
};

// Mismo objeto que manda /estrategia al webhook generar_estrategia (ver
// OBJETIVOS en app/estrategia/page.tsx), reconstruido del lado del
// servidor -- sin el campo "icon" (ahí es un componente React, no sirve
// fuera del cliente). Solo respaldo: ver objetivoParaCampana abajo, que
// es lo que de verdad usa el ejecutor de crear_creativos.
export const OBJETIVO_PARA_TIPO: Record<
  TipoMeta,
  { id: string; label: string; desc: string; meta_objective: string; destino: string }
> = {
  conversaciones_whatsapp: {
    id: "venta_directa_whatsapp",
    label: "Venta Directa (WhatsApp)",
    desc: "Ventas por conversación directa en WhatsApp.",
    meta_objective: "OUTCOME_ENGAGEMENT",
    destino: "whatsapp",
  },
  leads: {
    id: "leads",
    label: "Generación de Leads",
    desc: "Captura contactos interesados en tu producto.",
    meta_objective: "OUTCOME_LEADS",
    destino: "formulario",
  },
  ventas_web: {
    id: "venta_directa_web",
    label: "Venta Directa",
    desc: "Ventas inmediatas en tu sitio web.",
    meta_objective: "OUTCOME_SALES",
    destino: "sitio_web",
  },
  visitas_web: {
    id: "visitas_web",
    label: "Visitas a tu sitio web",
    desc: "Lleva visitas reales a tu página.",
    meta_objective: "OUTCOME_TRAFFIC",
    destino: "visitas_sitio",
  },
  seguidores_facebook: {
    id: "seguidores_facebook",
    label: "Seguidores de Facebook",
    desc: "Haz crecer los seguidores de tu página.",
    meta_objective: "OUTCOME_ENGAGEMENT",
    destino: "pagina",
  },
  // Sin campaña real dedicada todavía -- no se ofrece en /estrategia,
  // solo existe para que este Record quede completo.
  seguidores_instagram: {
    id: "seguidores_instagram",
    label: "Seguidores de Instagram",
    desc: "Haz crecer los seguidores de tu perfil de Instagram.",
    meta_objective: "OUTCOME_ENGAGEMENT",
    destino: "instagram",
  },
};

export type ObjetivoCatalogo = { id: string; label: string; desc: string; meta_objective: string; destino: string };

// Catálogo completo de objetivos publicitarios -- igual a OBJETIVOS en
// app/estrategia/page.tsx, sin "icon". A diferencia de OBJETIVO_PARA_TIPO
// (solo los 2 tipos de meta de Autopiloto), este cubre los 6 objetivos
// reales que puede tener cualquier campaña, para no asumir que el
// objetivo de la meta es el mismo que el de la campaña puntual que se
// está refrescando.
export const OBJETIVOS_CATALOGO: ObjetivoCatalogo[] = [
  { id: "venta_directa_web", label: "Venta Directa", desc: "Ventas inmediatas en tu sitio web.", meta_objective: "OUTCOME_SALES", destino: "sitio_web" },
  { id: "venta_directa_whatsapp", label: "Venta Directa (WhatsApp)", desc: "Ventas por conversación directa en WhatsApp.", meta_objective: "OUTCOME_ENGAGEMENT", destino: "whatsapp" },
  { id: "reconocimiento", label: "Reconocimiento", desc: "Más personas conocerán tu marca.", meta_objective: "OUTCOME_AWARENESS", destino: "pagina" },
  { id: "retargeting", label: "Retargeting", desc: "Impacta a quienes ya te conocen.", meta_objective: "OUTCOME_TRAFFIC", destino: "sitio_web" },
  { id: "leads", label: "Generación de Leads", desc: "Captura contactos interesados en tu producto.", meta_objective: "OUTCOME_LEADS", destino: "formulario" },
  { id: "trafico_mensajes", label: "Tráfico", desc: "Lleva más visitas nuevas a tu sitio web.", meta_objective: "OUTCOME_TRAFFIC", destino: "sitio_web" },
  // Agregados al final a propósito -- objetivoParaCampana usa el primer
  // match de este arreglo por meta_objective como respaldo para
  // campañas sin objetivo_id; con estos dos al final, una campaña vieja
  // de WhatsApp o de tráfico sigue resolviendo al objetivo de siempre
  // (venta_directa_whatsapp / retargeting), nunca a uno de estos nuevos.
  { id: "visitas_web", label: "Visitas a tu sitio web", desc: "Lleva visitas reales a tu página.", meta_objective: "OUTCOME_TRAFFIC", destino: "visitas_sitio" },
  { id: "seguidores_facebook", label: "Seguidores de Facebook", desc: "Haz crecer los seguidores de tu página.", meta_objective: "OUTCOME_ENGAGEMENT", destino: "pagina" },
];

const OBJETIVOS_POR_ID = new Map(OBJETIVOS_CATALOGO.map((o) => [o.id, o]));

// El objetivo real de LA CAMPAÑA manda (su objetivo_id, o el que se
// pueda inferir de su objetivo crudo de Meta) -- los anuncios nuevos
// van dentro de esa campaña puntual, así que su texto tiene que
// coincidir con el destino real (ej. no invitar a escribir por
// WhatsApp dentro de una campaña de reconocimiento). El tipo de la
// meta solo es respaldo si la campaña no resuelve a ningún objetivo
// conocido (ninguno de los dos campos sirve). "retargeting" y
// "trafico_mensajes" comparten OUTCOME_TRAFFIC -- si solo hay objetivo
// crudo (sin objetivo_id) y es OUTCOME_TRAFFIC, se resuelve al primero
// del catálogo (retargeting); no hay forma de distinguirlos sin
// objetivo_id.
export function objetivoParaCampana(
  campana: { objetivo_id: string | null; objetivo: string | null },
  tipoMeta: TipoMeta
): ObjetivoCatalogo {
  if (campana.objetivo_id) {
    const porId = OBJETIVOS_POR_ID.get(campana.objetivo_id);
    if (porId) return porId;
  }
  if (campana.objetivo) {
    const porMeta = OBJETIVOS_CATALOGO.find((o) => o.meta_objective === campana.objetivo);
    if (porMeta) return porMeta;
  }
  return OBJETIVO_PARA_TIPO[tipoMeta];
}

// Solo los tipos que ya existían antes de que objetivo_id existiera
// pueden tener campañas viejas de verdad que respaldar por el objetivo
// crudo de Meta -- los tipos nuevos (visitas_web, seguidores_facebook)
// nacieron CON objetivo_id desde el día uno, así que ninguna campaña
// vieja sin objetivo_id puede ser legítimamente de esos tipos. Esto
// importa porque seguidores_facebook comparte OUTCOME_ENGAGEMENT con
// conversaciones_whatsapp (ambos "me gusta"/"conversación" son
// engagement para Meta) -- sin este freno, una campaña vieja de
// WhatsApp sin objetivo_id calzaría también como "seguidores_facebook"
// con solo mirar el objetivo crudo.
const TIPOS_CON_RESPALDO_LEGACY = new Set<TipoMeta>(["conversaciones_whatsapp", "leads", "ventas_web"]);

export function campanaCoincideConTipo(
  campana: { objetivo_id: string | null; objetivo: string | null },
  tipo: TipoMeta
): boolean {
  if (campana.objetivo_id) return campana.objetivo_id === OBJETIVO_ID_POR_TIPO[tipo];
  if (!TIPOS_CON_RESPALDO_LEGACY.has(tipo)) return false;
  return campana.objetivo === OBJETIVO_META_POR_TIPO[tipo];
}

// Campañas de UNA meta puntual (no "del tipo" en general) --
// campanas_publicadas.meta_id es la fuente principal desde que existe
// (se escribe al publicar, ver publicar-estrategia/route.ts). Una
// campaña vieja sin meta_id se asocia por objetivo, pero solo tiene
// sentido hacerlo contra la meta ACTIVA de ese tipo -- con el índice
// único (user_id, tipo) WHERE estado='activa', nunca hay más de una,
// así que no hay ambigüedad real: el llamador simplemente nunca debe
// pasar una meta que no sea la activa de su tipo para este propósito.
export function campanaPerteneceAMeta(
  campana: { meta_id?: string | null; objetivo_id: string | null; objetivo: string | null },
  meta: { id: string; tipo: TipoMeta }
): boolean {
  if (campana.meta_id) return campana.meta_id === meta.id;
  return campanaCoincideConTipo(campana, meta.tipo);
}

// Para el body de agregar_anuncios (necesita objetivo_id siempre, no el
// objetivo crudo de Meta) -- mismo fallback que campanaCoincideConTipo,
// pero devolviendo el id en vez de un booleano. Solo cubre los dos tipos
// de meta que existen hoy (conversaciones_whatsapp, leads); como toda
// propuesta de agregar_anuncios nace de una campaña ya asociada a una
// meta, no hace falta cubrir los demás objetivos del catálogo.
export function inferirObjetivoId(campana: { objetivo_id: string | null; objetivo: string | null }): string | null {
  if (campana.objetivo_id) return campana.objetivo_id;
  // Mismo freno que campanaCoincideConTipo: solo los tipos que ya
  // existían antes de objetivo_id pueden resolverse por el objetivo
  // crudo -- si no, con conversaciones_whatsapp y seguidores_facebook
  // compartiendo OUTCOME_ENGAGEMENT, el orden de las claves del objeto
  // sería lo único que evitara el choque (implícito y frágil).
  for (const tipo of Object.keys(OBJETIVO_META_POR_TIPO) as TipoMeta[]) {
    if (!TIPOS_CON_RESPALDO_LEGACY.has(tipo)) continue;
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
  meta_id: string | null;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  presupuesto_diario: number | null;
  fecha_publicacion: string | null;
  // Moneda real de la cuenta publicitaria (campanas_publicadas.moneda) --
  // null hasta que sync-meta-insights la complete. Solo le hace falta a
  // ventas_web, para mostrar el ingreso en la moneda correcta.
  moneda: string | null;
};

// Campañas de UNA meta puntual (ver campanaPerteneceAMeta) -- con los
// campos que necesita el Director para evaluar reglas y armar
// propuestas, no solo para sumar spend/conversiones.
export async function obtenerCampanasDeMeta(meta: { id: string; tipo: TipoMeta }, userId: string): Promise<CampanaDeMeta[]> {
  const { data: campanas } = await supabaseAdmin
    .from("campanas_publicadas")
    .select("id, nombre, estado, objetivo, objetivo_id, meta_id, meta_campaign_id, meta_adset_id, presupuesto_diario, fecha_publicacion, moneda")
    .eq("user_id", userId);

  return (campanas ?? []).filter((c) => campanaPerteneceAMeta(c, meta));
}

export type SnapshotDiario = {
  fecha_bogota: string;
  spend: number;
  conversiones: number;
  frequency: number | null;
  ctr: number | null;
  impresiones: number | null;
  // Valor en dinero de las conversiones del día -- null cuando el tipo
  // de meta no lo trackea (WhatsApp, leads, tráfico) o cuando el pixel
  // nunca reportó valor, para distinguirlo de "0 pesos de verdad".
  valorConversion: number | null;
};

// Snapshots diarios de UNA campaña, deduplicados por día (misma defensa
// que sumarResultados), con frequency/ctr/impresiones incluidos -- lo
// que sumarResultados no trae porque solo le hacía falta spend y
// conversiones. Pensado para que el Director compare "los últimos 3
// días" contra "los primeros días" de una campaña.
export async function obtenerSnapshotsDiarios(campanaId: string, desde: string, hasta: string): Promise<SnapshotDiario[]> {
  const { data: filas, error } = await supabaseAdmin
    .from("campanas_snapshots")
    .select("fecha_bogota, spend, conversiones, frequency, ctr, impresiones, valor_conversion, corrida_en")
    .eq("campana_id", campanaId)
    .gte("fecha_bogota", desde)
    .lte("fecha_bogota", hasta);

  // Nunca tratar un error de la consulta como "0 días de datos" --
  // visto en vivo: una columna rota devuelve data:null sin lanzar nada
  // por sí sola, y eso se veía indistinguible de una campaña sin
  // actividad real.
  if (error) {
    throw new Error(`obtenerSnapshotsDiarios(${campanaId}): ${error.message}`);
  }

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
        valorConversion: fila.valor_conversion != null ? Number(fila.valor_conversion) : null,
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
//
// metaId (opcional): cuando viene, las campañas con meta_id se filtran
// por ESA meta puntual (campanaPerteneceAMeta), no por tipo en general --
// lo usa calcularAvanceMeta, que siempre es sobre una meta concreta. Sin
// metaId (calcularCostoReferencia, el histórico de 90 días) se sigue
// matcheando por objetivo a secas, cruzando todas las campañas del tipo
// sin importar a qué meta (activa o ya terminada) quedaron ligadas --
// ese cálculo necesita ver el historial completo, no solo la meta actual.
async function sumarResultados(params: {
  tipo: TipoMeta;
  userId: string | null;
  desde: string;
  hasta: string;
  metaId?: string;
}): Promise<{ spend: number; conversiones: number; ingreso: number; campanas: number }> {
  let query = supabaseAdmin.from("campanas_publicadas").select("id, meta_id, objetivo_id, objetivo");
  if (params.userId) query = query.eq("user_id", params.userId);
  const { data: campanas, error: errorCampanas } = await query;
  if (errorCampanas) {
    throw new Error(`sumarResultados (campanas_publicadas): ${errorCampanas.message}`);
  }

  const idsCoinciden = (campanas ?? [])
    .filter((c) => (params.metaId ? campanaPerteneceAMeta(c, { id: params.metaId, tipo: params.tipo }) : campanaCoincideConTipo(c, params.tipo)))
    .map((c) => c.id);

  if (idsCoinciden.length === 0) return { spend: 0, conversiones: 0, ingreso: 0, campanas: 0 };

  const { data: filas, error: errorSnapshots } = await supabaseAdmin
    .from("campanas_snapshots")
    .select("campana_id, fecha_bogota, spend, conversiones, valor_conversion, corrida_en")
    .in("campana_id", idsCoinciden)
    .gte("fecha_bogota", params.desde)
    .lte("fecha_bogota", params.hasta);

  // Mismo principio que obtenerSnapshotsDiarios: un error de la
  // consulta nunca debe verse igual que "sin resultados todavía".
  if (errorSnapshots) {
    throw new Error(`sumarResultados (campanas_snapshots): ${errorSnapshots.message}`);
  }

  const porDia = new Map<string, { spend: number; conversiones: number; ingreso: number; corrida_en: string }>();
  for (const fila of filas ?? []) {
    const clave = `${fila.campana_id}|${fila.fecha_bogota}`;
    const existente = porDia.get(clave);
    if (!existente || fila.corrida_en > existente.corrida_en) {
      porDia.set(clave, {
        spend: Number(fila.spend) || 0,
        conversiones: Number(fila.conversiones) || 0,
        ingreso: Number(fila.valor_conversion) || 0,
        corrida_en: fila.corrida_en,
      });
    }
  }

  const campanasConDatos = new Set<string>();
  let spend = 0;
  let conversiones = 0;
  let ingreso = 0;
  for (const [clave, valores] of porDia) {
    spend += valores.spend;
    conversiones += valores.conversiones;
    ingreso += valores.ingreso;
    campanasConDatos.add(clave.split("|")[0]);
  }

  return { spend, conversiones, ingreso, campanas: campanasConDatos.size };
}

export type AvanceMeta = {
  conversiones: number;
  spend: number;
  diasTranscurridos: number;
  diasRestantes: number;
  proyeccion: number | null;
  // Solo tienen sentido real en metas de tipo "ventas_web" -- en los
  // demás tipos ingreso siempre es 0 (nadie reporta valor) y roas queda
  // en null (0 ÷ gasto no es "sin retorno", es "no se mide retorno aquí").
  ingreso: number;
  roas: number | null;
};

// Progreso de una meta: conversiones/spend solo dentro de su propia
// ventana de fechas (aunque la campaña haya arrancado antes). La
// proyección usa el ritmo de los días ya TERMINADOS (sin hoy, que viene
// parcial) y le suma lo que ya lleva hoy -- exige al menos 3 días
// terminados, porque con menos una racha corta puede dar una proyección
// absurda.
export async function calcularAvanceMeta(meta: {
  id: string;
  tipo: TipoMeta;
  user_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  valor_inicial?: number | null;
}): Promise<AvanceMeta> {
  // seguidores_instagram no tiene campañas propias que sumar (ver
  // OBJETIVO_ID_POR_TIPO arriba) -- su avance es la foto de hoy menos la
  // foto del día en que se creó la meta, no una suma de conversiones.
  if (meta.tipo === "seguidores_instagram") {
    return calcularAvanceSeguidoresInstagram(meta);
  }

  const hoy = hoyBogota();
  const metaEnCurso = hoy <= meta.fecha_fin;
  const hastaEfectivo = metaEnCurso ? hoy : meta.fecha_fin;

  const resultadoTotal = await sumarResultados({
    tipo: meta.tipo,
    userId: meta.user_id,
    desde: meta.fecha_inicio,
    hasta: hastaEfectivo,
    metaId: meta.id,
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
            metaId: meta.id,
          })
        : { spend: 0, conversiones: 0, ingreso: 0, campanas: 0 };

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
    ingreso: resultadoTotal.ingreso,
    roas: calcularRoasDeTotales(resultadoTotal.ingreso, resultadoTotal.spend),
  };
}

// Valor vigente en una fecha dada: el snapshot más reciente con
// fecha_bogota <= fecha, o el valor por defecto si todavía no hay
// ninguno (meta recién creada hoy, antes de que corra el cron).
// `snapshots` viene ordenado ascendente por fecha_bogota.
function valorEnFecha(snapshots: { fecha_bogota: string; followers_count: number }[], fecha: string, porDefecto: number): number {
  let valor = porDefecto;
  for (const s of snapshots) {
    if (s.fecha_bogota > fecha) break;
    valor = s.followers_count;
  }
  return valor;
}

// Mismo criterio de ventana/proyección que calcularAvanceMeta, pero
// sobre instagram_seguidores_snapshots en vez de campanas_snapshots:
// "conversiones" aquí es followers ganados (foto de hoy - foto inicial),
// que puede ser negativo si el perfil perdió más de los que ganó. spend
// e ingreso quedan en 0 (no hay campaña propia que les dé sentido).
async function calcularAvanceSeguidoresInstagram(meta: {
  id: string;
  user_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  valor_inicial?: number | null;
}): Promise<AvanceMeta> {
  const hoy = hoyBogota();
  const metaEnCurso = hoy <= meta.fecha_fin;
  const hastaEfectivo = metaEnCurso ? hoy : meta.fecha_fin;

  const { data: filas, error } = await supabaseAdmin
    .from("instagram_seguidores_snapshots")
    .select("fecha_bogota, followers_count")
    .eq("user_id", meta.user_id)
    .gte("fecha_bogota", meta.fecha_inicio)
    .lte("fecha_bogota", hastaEfectivo)
    .order("fecha_bogota", { ascending: true });

  if (error) {
    throw new Error(`calcularAvanceSeguidoresInstagram(${meta.id}): ${error.message}`);
  }

  const snapshots = filas ?? [];
  // Si por lo que sea la meta no tiene valor_inicial (no debería pasar
  // para este tipo), se usa el primer snapshot disponible como piso --
  // mejor un avance de 0 ese primer tramo que una resta sin sentido
  // contra 0 seguidores.
  const valorInicial = meta.valor_inicial ?? snapshots[0]?.followers_count ?? 0;
  const valorHoy = valorEnFecha(snapshots, hastaEfectivo, valorInicial);
  const conversiones = valorHoy - valorInicial;

  const diasTranscurridos = diasEntre(meta.fecha_inicio, hastaEfectivo).length;
  const diasRestantes = hoy > meta.fecha_fin ? 0 : diasEntre(hoy, meta.fecha_fin).length;
  const duracionTotal = diasEntre(meta.fecha_inicio, meta.fecha_fin).length;

  const ayer = ayerBogota();
  const diasCompletos = metaEnCurso
    ? ayer >= meta.fecha_inicio
      ? diasEntre(meta.fecha_inicio, ayer)
      : []
    : diasEntre(meta.fecha_inicio, meta.fecha_fin);

  let proyeccion: number | null = null;
  if (diasCompletos.length >= 3) {
    const valorDiasCompletos = valorEnFecha(snapshots, diasCompletos[diasCompletos.length - 1], valorInicial);
    const ritmo = (valorDiasCompletos - valorInicial) / diasCompletos.length;
    const deltaHoy = metaEnCurso ? valorHoy - valorDiasCompletos : 0;
    proyeccion = Math.round(ritmo * duracionTotal) + deltaHoy;
  }

  return { conversiones, spend: 0, diasTranscurridos, diasRestantes, proyeccion, ingreso: 0, roas: null };
}

// ingreso ÷ gasto -- más alto es mejor (lo opuesto a costoPorResultado).
// null cuando no hay valor de compra registrado, nunca 0: "no se sabe
// el retorno" no es lo mismo que "el retorno fue cero".
function calcularRoasDeTotales(ingreso: number, spend: number): number | null {
  if (spend <= 0 || ingreso <= 0) return null;
  return ingreso / spend;
}

export type ResultadoCierreMeta = {
  metaId: string;
  userId: string;
  estadoNuevo: "vencida" | "cumplida";
  conversiones: number;
  cantidadObjetivo: number;
};

// Cierra de verdad (vencida o cumplida) las metas "activas" cuya
// fecha_fin ya pasó -- el estado nunca se queda en "activa" para
// siempre con la fecha vencida, porque con el índice único (user_id,
// tipo) WHERE estado='activa' eso bloquearía crear una meta nueva del
// mismo tipo. Dos llamadores: el cron horario (sin filtro, revisa a
// todos) y /api/metas al crear una meta (filtrado a ese usuario+tipo,
// por seguridad, para que una vencida vieja nunca frene la creación).
// "Cumplida" si llegó a la cantidad objetivo, "vencida" si no -- deja
// un evento en bitácora y una notificación (tipo "meta_terminada",
// renderiza con el ícono genérico de NotificacionIcono) para que el
// cliente se entere.
export async function cerrarMetasVencidas(filtro: { userId?: string; tipo?: TipoMeta } = {}): Promise<ResultadoCierreMeta[]> {
  const hoy = hoyBogota();
  let query = supabaseAdmin
    .from("metas")
    .select("id, user_id, tipo, cantidad_objetivo, fecha_inicio, fecha_fin, valor_inicial")
    .eq("estado", "activa")
    .lt("fecha_fin", hoy);
  if (filtro.userId) query = query.eq("user_id", filtro.userId);
  if (filtro.tipo) query = query.eq("tipo", filtro.tipo);
  const { data: vencidas } = await query;

  const resultados: ResultadoCierreMeta[] = [];
  for (const meta of vencidas ?? []) {
    let conversiones = 0;
    try {
      const avance = await calcularAvanceMeta(meta);
      conversiones = avance.conversiones;
    } catch (err) {
      // Nunca se deja la meta "activa" por un error de cálculo (eso sí
      // bloquearía el índice único indefinidamente) -- se cierra como
      // vencida de todas formas, conservador, con conversiones en 0.
      console.error(`cerrarMetasVencidas: no se pudo calcular el avance de ${meta.id}:`, err);
    }

    const estadoNuevo: "vencida" | "cumplida" = conversiones >= meta.cantidad_objetivo ? "cumplida" : "vencida";

    await supabaseAdmin
      .from("metas")
      .update({ estado: estadoNuevo, actualizado_en: new Date().toISOString() })
      .eq("id", meta.id);

    await supabaseAdmin.from("bitacora").insert({
      user_id: meta.user_id,
      meta_id: meta.id,
      propuesta_id: null,
      tipo_evento: estadoNuevo === "cumplida" ? "meta_cumplida" : "meta_vencida",
      detalle: { conversiones, cantidad_objetivo: meta.cantidad_objetivo },
    });

    await supabaseAdmin.from("notificaciones").insert({
      user_id: meta.user_id,
      campana_id: null,
      tipo: "meta_terminada",
      titulo: estadoNuevo === "cumplida" ? "¡Meta cumplida!" : "Tu meta terminó",
      mensaje:
        estadoNuevo === "cumplida"
          ? `Tu meta terminó: conseguimos ${conversiones} de ${meta.cantidad_objetivo}. ¡Buen trabajo!`
          : `Tu meta terminó: conseguimos ${conversiones} de ${meta.cantidad_objetivo}.`,
      estado: "pendiente",
    });

    resultados.push({ metaId: meta.id, userId: meta.user_id, estadoNuevo, conversiones, cantidadObjetivo: meta.cantidad_objetivo });
  }

  return resultados;
}

// Mismo cálculo que calcularAvanceMeta.roas, pero standalone -- para
// cuando solo hace falta el retorno (ej. mostrarlo en /metas sin pedir
// todo el avance de vuelta).
export async function calcularRoas(params: { userId: string; desde: string; hasta: string }): Promise<number | null> {
  const { spend, ingreso } = await sumarResultados({ tipo: "ventas_web", userId: params.userId, desde: params.desde, hasta: params.hasta });
  return calcularRoasDeTotales(ingreso, spend);
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
