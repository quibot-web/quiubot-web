// En qué etapa de renovación está un usuario, y qué resultados
// mostrarle -- todo calculado EN VIVO a partir de usuarios.fecha_pago/
// fecha_vencimiento/en_trial, nunca persistido. Por eso nunca se
// duplica ni queda "atascado" de una corrida anterior: la misma
// pregunta siempre da la misma respuesta mientras el estado real no
// cambie, igual que las campañas con problema en /decisiones. Ver
// app/lib/directorChat.ts para las plantillas que narran cada etapa.
import { supabaseAdmin } from "@/lib/supabase";
import { obtenerCampanasDeMeta, obtenerSnapshotsDiarios, type TipoMeta } from "@/app/lib/metas";
import { fechaBogota } from "@/app/lib/fechaBogota";

export type EtapaRenovacion = "recien_pagado" | "3_dias_antes" | "hoy_vence" | "vencido";

const VENTANA_RECIEN_PAGADO_MS = 48 * 60 * 60 * 1000;
const DIAS_ANTES_DE_AVISAR = 3; // misma ventana que ya usa /api/cron/recordatorio-vencimiento
const DIAS_VENCIDO_SE_SIGUE_AVISANDO = 30;

export type UsuarioParaRenovacion = {
  plan: string | null;
  en_trial: boolean;
  fecha_pago: string | null;
  fecha_vencimiento: string | null;
};

// NOTA para cuando exista la prueba automática de 14 días: la etapa
// "fin_prueba" entra ACÁ, antes del chequeo de en_trial de abajo --
// hoy no se construye, solo se deja el lugar listo (ver conversación:
// "la prueba gratis queda para después").
export function etapaRenovacion(usuario: UsuarioParaRenovacion, ahora: Date = new Date()): EtapaRenovacion | null {
  // en_trial solo bloquea si el usuario NUNCA pagó de verdad. Ni el
  // webhook de Bold ni /api/activar limpian en_trial al activar un
  // plan pago (confirmado leyendo ambos) -- si ya hay fecha_pago, se
  // evalúa su ciclo pago real sin importar que en_trial haya quedado
  // mal encendido.
  if (usuario.en_trial && !usuario.fecha_pago) return null;
  if (!usuario.fecha_vencimiento) return null;

  if (usuario.fecha_pago && ahora.getTime() - new Date(usuario.fecha_pago).getTime() < VENTANA_RECIEN_PAGADO_MS) {
    return "recien_pagado";
  }

  const msHastaVencer = new Date(usuario.fecha_vencimiento).getTime() - ahora.getTime();
  const diasHastaVencer = Math.ceil(msHastaVencer / (24 * 60 * 60 * 1000));

  // Vencido hace más de 30 días -- ya no se avisa más (el cliente ya
  // asumió que no sigue, insistir no ayuda).
  if (diasHastaVencer < -DIAS_VENCIDO_SE_SIGUE_AVISANDO) return null;
  if (diasHastaVencer < 0) return "vencido";
  if (diasHastaVencer === 0) return "hoy_vence";
  if (diasHastaVencer <= DIAS_ANTES_DE_AVISAR) return "3_dias_antes";
  return null;
}

export type ResultadosPeriodo = { cantidad: number; tipoLabel: string; costoPromedio: number } | null;

const TIPO_LABEL: Record<TipoMeta, string> = {
  conversaciones_whatsapp: "conversaciones de WhatsApp",
  leads: "leads",
  ventas_web: "ventas en tu sitio web",
};

// Deduplica snapshots por (campana_id, fecha_bogota) quedándose con el
// de corrida_en más reciente -- misma defensa que obtenerSnapshotsDiarios/
// sumarResultados en metas.ts, necesaria acá porque el respaldo sin
// meta no pasa por ninguna de esas dos funciones (que sí filtran por
// tipo, y acá no hay un tipo que filtrar).
function sumarSinDuplicar(filas: { campana_id: string; fecha_bogota: string; spend: unknown; conversiones: unknown; corrida_en: string }[]) {
  const porDia = new Map<string, { spend: number; conversiones: number; corrida_en: string }>();
  for (const f of filas) {
    const clave = `${f.campana_id}|${f.fecha_bogota}`;
    const existente = porDia.get(clave);
    if (!existente || f.corrida_en > existente.corrida_en) {
      porDia.set(clave, { spend: Number(f.spend) || 0, conversiones: Number(f.conversiones) || 0, corrida_en: f.corrida_en });
    }
  }
  let spend = 0;
  let conversiones = 0;
  for (const v of porDia.values()) {
    spend += v.spend;
    conversiones += v.conversiones;
  }
  return { spend, conversiones };
}

// Avance real de la meta de Autopiloto si hay una activa (con su tipo,
// para el label "conversaciones de WhatsApp"/"leads"); si no hay meta,
// respaldo genérico sumando TODAS las campañas del usuario, sin
// filtrar por tipo (label genérico "resultados"). Ventana: desde
// fecha_pago (inicio del ciclo vigente) hasta ahora -- nunca "este
// mes": en un ciclo anual serían 12 meses, no 1. Si da 0 conversiones
// en cualquiera de los dos casos, null -- la plantilla omite la frase.
export async function calcularResultadosPeriodo(
  userId: string,
  fechaPago: string | null,
  ahora: Date = new Date()
): Promise<ResultadosPeriodo> {
  const desde = fechaPago ? fechaBogota(new Date(fechaPago)) : fechaBogota(new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000));
  const hasta = fechaBogota(ahora);

  const { data: metaActiva } = await supabaseAdmin
    .from("metas")
    .select("tipo")
    .eq("user_id", userId)
    .eq("estado", "activa")
    .maybeSingle();

  if (metaActiva?.tipo) {
    const campanas = await obtenerCampanasDeMeta(metaActiva.tipo as TipoMeta, userId);
    let spend = 0;
    let conversiones = 0;
    for (const c of campanas) {
      const snaps = await obtenerSnapshotsDiarios(c.id, desde, hasta);
      for (const s of snaps) {
        spend += s.spend;
        conversiones += s.conversiones;
      }
    }
    if (conversiones === 0) return null;
    return { cantidad: conversiones, tipoLabel: TIPO_LABEL[metaActiva.tipo as TipoMeta], costoPromedio: Math.round(spend / conversiones) };
  }

  const { data: campanasTodas } = await supabaseAdmin.from("campanas_publicadas").select("id").eq("user_id", userId);
  const ids = (campanasTodas ?? []).map((c) => c.id);
  if (ids.length === 0) return null;

  const { data: snapshots, error } = await supabaseAdmin
    .from("campanas_snapshots")
    .select("campana_id, fecha_bogota, spend, conversiones, corrida_en")
    .in("campana_id", ids)
    .gte("fecha_bogota", desde)
    .lte("fecha_bogota", hasta);
  if (error) throw new Error(`calcularResultadosPeriodo: ${error.message}`);

  const { spend, conversiones } = sumarSinDuplicar(snapshots ?? []);
  if (conversiones === 0) return null;
  return { cantidad: conversiones, tipoLabel: "resultados", costoPromedio: Math.round(spend / conversiones) };
}
