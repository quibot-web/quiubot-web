import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";
import { hoyBogota, ayerBogota } from "@/app/lib/fechaBogota";

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// A qué "resultado" le apunta cada objetivo de la CAMPAÑA (objetivo_id,
// el id estable de nuestro catálogo -- ver OBJETIVOS en /estrategia y
// OBJETIVOS_CATALOGO en app/lib/metas.ts), no el objetivo crudo de
// Meta: visitas_web y trafico_mensajes/retargeting comparten
// OUTCOME_TRAFFIC, y seguidores_facebook comparte OUTCOME_ENGAGEMENT
// con venta_directa_whatsapp -- clasificar por el objetivo crudo ya no
// alcanza para distinguirlos. reconocimiento no tiene un "resultado"
// claro tipo conversión (es alcance/impresiones), se deja sin entrada
// a propósito (cae en 0).
//
// Cada lista es de PRIORIDAD, no un conjunto para sumar: purchase y
// omni_purchase (igual que lead y onsite_conversion.lead_grouped)
// pueden ser dos formas de medir la MISMA conversión real --
// omni_purchase es la métrica unificada de Meta que ya puede incluir
// adentro lo que purchase cuenta por su cuenta. Sumarlas arriesgaba
// contar una sola venta/lead dos veces. Se toma el primer action_type
// de la lista que de verdad venga en la respuesta, nunca más de uno.
// visitas_web sigue el mismo patrón para su propio respaldo: sin pixel
// no hay landing_page_view, así que cae a link_click.
const ACCIONES_POR_OBJETIVO_ID: Record<string, string[]> = {
  venta_directa_web: ["omni_purchase", "purchase"],
  venta_directa_whatsapp: ["onsite_conversion.messaging_conversation_started_7d"],
  leads: ["onsite_conversion.lead_grouped", "lead"],
  retargeting: ["link_click"],
  trafico_mensajes: ["link_click"],
  visitas_web: ["landing_page_view", "link_click"],
  seguidores_facebook: ["like"],
};

// Respaldo SOLO para campañas que no tienen objetivo_id guardado (de
// antes de que esa columna existiera) -- clasifica por el objetivo
// crudo de Meta, como se hacía antes de que existieran visitas_web y
// seguidores_facebook. Nunca se usa si hay objetivo_id, así que la
// ambigüedad entre tipos nuevos y viejos que comparten el mismo
// OUTCOME_* no aplica acá: estos tipos nuevos nacieron CON objetivo_id,
// ninguna campaña vieja puede ser legítimamente de ellos.
const ACCIONES_POR_OBJETIVO_RAW: Record<string, string[]> = {
  OUTCOME_SALES: ["omni_purchase", "purchase"],
  OUTCOME_LEADS: ["onsite_conversion.lead_grouped", "lead"],
  OUTCOME_ENGAGEMENT: ["onsite_conversion.messaging_conversation_started_7d"],
  OUTCOME_TRAFFIC: ["link_click"],
};

// Mismo criterio de prioridad para contar y para leer action_values (el
// valor en dinero de la conversión, no el conteo) -- para objetivos que
// no cargan valor (WhatsApp, leads, tráfico, visitas, seguidores) esto
// da 0 de forma natural, sin ningún caso especial por tipo.
function elegirValor(lista: any[] | undefined, objetivoId: string | null, objetivoMeta: string | null): number {
  if (!lista) return 0;
  const prioridad = (objetivoId && ACCIONES_POR_OBJETIVO_ID[objetivoId]) || (objetivoMeta && ACCIONES_POR_OBJETIVO_RAW[objetivoMeta]) || [];
  for (const tipo of prioridad) {
    const encontrada = lista.find((a) => a.action_type === tipo);
    if (encontrada) return parseFloat(encontrada.value) || 0;
  }
  return 0;
}

function contarConversiones(actions: any[] | undefined, objetivoId: string | null, objetivoMeta: string | null): number {
  return Math.round(elegirValor(actions, objetivoId, objetivoMeta));
}

function sumarValorConversion(actionValues: any[] | undefined, objetivoId: string | null, objetivoMeta: string | null): number {
  return elegirValor(actionValues, objetivoId, objetivoMeta);
}

// Traduce el estado real de Meta a los estados propios de Quiubot.
function mapearEstado(effectiveStatus: string | undefined): string | null {
  const mapa: Record<string, string> = {
    ACTIVE: "activa",
    PAUSED: "pausada",
    CAMPAIGN_PAUSED: "pausada",
    ADSET_PAUSED: "pausada",
    DELETED: "eliminada",
    ARCHIVED: "archivada",
    IN_PROCESS: "en_revision",
    PENDING_REVIEW: "en_revision",
    WITH_ISSUES: "con_problemas",
    PENDING_BILLING_INFO: "con_problemas",
    DISAPPROVED: "rechazada",
  };
  return effectiveStatus ? mapa[effectiveStatus] || null : null;
}

// Llamado periodicamente por un Schedule Trigger en n8n (mismo patron que
// recordatorio_vencimiento). Protegido con el mismo ADMIN_SECRET que ya
// usan los otros endpoints de cron.
//
// Dos modos, mismo endpoint (?modo=cierre en la URL, default "hoy"):
// - "hoy" (el de siempre): date_preset=today, actualiza la fila del dia
//   Bogota en curso -- los numeros de hoy son parciales hasta que cierre.
// - "cierre": date_preset=yesterday, pensado para correr temprano en la
//   mañana (ej. 5am Bogota via un segundo Schedule Trigger en n8n) y
//   sobreescribir la fila de AYER con el valor final de Meta, para no
//   perder resultados que llegaron entre la ultima corrida del dia y la
//   medianoche.
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

  const esCierre = req.nextUrl.searchParams.get("modo") === "cierre";
  const datePreset = esCierre ? "yesterday" : "today";
  const fechaBogotaFila = esCierre ? ayerBogota() : hoyBogota();

  const { data: usuarios } = await supabaseAdmin
    .from("usuarios")
    .select("id, email, meta_access_token, meta_ad_account_id")
    .not("meta_access_token", "is", null);

  let campanasActualizadas = 0;
  let campanasConError = 0;

  for (const usuario of usuarios || []) {
    const { data: campanas } = await supabaseAdmin
      .from("campanas_publicadas")
      .select("id, meta_campaign_id, objetivo, objetivo_id, estado, moneda")
      .eq("user_id", usuario.id)
      .not("meta_campaign_id", "is", null)
      .neq("estado", "eliminada");

    if (!campanas || campanas.length === 0) continue;

    // La moneda de la cuenta publicitaria no cambia -- solo se pide una
    // vez por usuario por corrida, y solo si hace falta (alguna de sus
    // campañas todavía no la tiene guardada). El ROAS no la necesita
    // (es valor ÷ gasto en la MISMA moneda), pero cualquier texto que
    // muestre el ingreso tiene que saber en qué moneda está.
    let monedaCuenta: string | null = null;
    if (usuario.meta_ad_account_id && campanas.some((c) => !c.moneda)) {
      try {
        const resCuenta = await fetch(
          `https://graph.facebook.com/v21.0/${usuario.meta_ad_account_id}?fields=currency&access_token=${usuario.meta_access_token}`
        );
        const dataCuenta = await resCuenta.json();
        monedaCuenta = typeof dataCuenta.currency === "string" ? dataCuenta.currency : null;
      } catch {
        // Sin moneda esta corrida no es crítico -- se reintenta en la
        // siguiente (queda null hasta entonces, nunca bloquea el resto).
      }
    }

    let tokenInvalido = false;

    for (const campana of campanas) {
      if (tokenInvalido) break;

      try {
        const [insightsRes, statusRes] = await Promise.all([
          fetch(
            `https://graph.facebook.com/v21.0/${campana.meta_campaign_id}/insights` +
              `?fields=spend,ctr,reach,frequency,impressions,actions,action_values&date_preset=${datePreset}` +
              `&access_token=${usuario.meta_access_token}`
          ),
          fetch(
            `https://graph.facebook.com/v21.0/${campana.meta_campaign_id}` +
              `?fields=effective_status&access_token=${usuario.meta_access_token}`
          ),
        ]);

        const insightsData = await insightsRes.json();
        const statusData = await statusRes.json();

        // Codigo 190 = token de Meta expirado o revocado -- afecta a
        // TODAS las campañas de este usuario por igual, asi que se
        // registra una sola vez y se deja de intentar el resto de sus
        // campañas en esta corrida (en vez de repetir el mismo error N
        // veces, una por campaña).
        if (insightsData.error?.code === 190 || statusData.error?.code === 190) {
          tokenInvalido = true;
          registrarError({
            origen: "sync_meta_insights",
            userId: usuario.id,
            email: usuario.email,
            paso: "token_meta_invalido",
            errorTitulo: "La conexión con Meta de este usuario expiró",
            errorMensaje: "El token de acceso a Meta ya no es válido — el usuario necesita reconectar su cuenta en Integraciones.",
            detalleTecnico: JSON.stringify(insightsData.error || statusData.error),
          });
          campanasConError++;
          continue;
        }

        const fila = insightsData.data?.[0] || {};

        const nuevoEstado = mapearEstado(statusData.effective_status);
        const actualizacionCampana: Record<string, string> = {};
        if (nuevoEstado && nuevoEstado !== campana.estado) actualizacionCampana.estado = nuevoEstado;
        if (!campana.moneda && monedaCuenta) actualizacionCampana.moneda = monedaCuenta;
        if (Object.keys(actualizacionCampana).length > 0) {
          await supabaseAdmin
            .from("campanas_publicadas")
            .update(actualizacionCampana)
            .eq("id", campana.id);
        }

        // Una sola fila por campaña por dia Bogota (fecha_bogota, no
        // corrida_en -- corrida_en solo dice cuando se sincronizo por
        // ultima vez, y la corrida de "cierre" la actualiza al dia
        // siguiente sin que la fila deje de representar el dia de ayer).
        // El indice unico (campana_id, fecha_bogota) hace de esto un
        // upsert real, sin el read-then-write de antes.
        const payload = {
          campana_id: campana.id,
          user_id: usuario.id,
          corrida_en: new Date().toISOString(),
          fecha_bogota: fechaBogotaFila,
          spend: parseFloat(fila.spend) || 0,
          ctr: fila.ctr ? parseFloat(fila.ctr) : null,
          reach: fila.reach ? parseInt(fila.reach, 10) : null,
          frequency: fila.frequency ? parseFloat(fila.frequency) : null,
          conversiones: contarConversiones(fila.actions, campana.objetivo_id, campana.objetivo),
          valor_conversion: sumarValorConversion(fila.action_values, campana.objetivo_id, campana.objetivo),
          impresiones: fila.impressions ? parseInt(fila.impressions, 10) : null,
          objetivo: campana.objetivo,
          raw: fila,
        };

        await supabaseAdmin
          .from("campanas_snapshots")
          .upsert(payload, { onConflict: "campana_id,fecha_bogota" });

        campanasActualizadas++;
      } catch (err) {
        console.error(`Error sincronizando campaña ${campana.id}:`, err);
        campanasConError++;
      }
    }
  }

  return NextResponse.json({ ok: true, campanasActualizadas, campanasConError });
}