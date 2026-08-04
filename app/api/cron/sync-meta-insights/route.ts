import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// A que "resultado" le apunta cada objetivo de Meta -- distinto tipo de
// accion segun que estabamos optimizando. OUTCOME_AWARENESS no tiene un
// "resultado" claro tipo conversion (es alcance/impresiones), asi que se
// deja en 0 a proposito.
const ACCIONES_POR_OBJETIVO: Record<string, string[]> = {
  OUTCOME_SALES: ["purchase", "omni_purchase"],
  OUTCOME_LEADS: ["lead", "onsite_conversion.lead_grouped"],
  OUTCOME_ENGAGEMENT: ["onsite_conversion.messaging_conversation_started_7d"],
  OUTCOME_TRAFFIC: ["link_click"],
};

function contarConversiones(actions: any[] | undefined, objetivoMeta: string | null): number {
  if (!actions || !objetivoMeta) return 0;
  const tiposBuscados = ACCIONES_POR_OBJETIVO[objetivoMeta] || [];
  if (tiposBuscados.length === 0) return 0;
  return actions
    .filter((a) => tiposBuscados.includes(a.action_type))
    .reduce((sum, a) => sum + (parseInt(a.value, 10) || 0), 0);
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

  const { data: usuarios } = await supabaseAdmin
    .from("usuarios")
    .select("id, email, meta_access_token")
    .not("meta_access_token", "is", null);

  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);

  let campanasActualizadas = 0;
  let campanasConError = 0;

  for (const usuario of usuarios || []) {
    const { data: campanas } = await supabaseAdmin
      .from("campanas_publicadas")
      .select("id, meta_campaign_id, objetivo, estado")
      .eq("user_id", usuario.id)
      .not("meta_campaign_id", "is", null)
      .neq("estado", "eliminada");

    if (!campanas || campanas.length === 0) continue;

    let tokenInvalido = false;

    for (const campana of campanas) {
      if (tokenInvalido) break;

      try {
        const [insightsRes, statusRes] = await Promise.all([
          fetch(
            `https://graph.facebook.com/v21.0/${campana.meta_campaign_id}/insights` +
              `?fields=spend,ctr,reach,frequency,impressions,actions&date_preset=today` +
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
        if (nuevoEstado && nuevoEstado !== campana.estado) {
          await supabaseAdmin
            .from("campanas_publicadas")
            .update({ estado: nuevoEstado })
            .eq("id", campana.id);
        }

        // Una sola fila por campaña por dia -- si ya corrio hoy, se
        // actualiza; si no, se crea. Asi sumar los ultimos 7 dias en
        // home-resumen da el total real, sin duplicar el gasto de hoy
        // cada vez que este sync se ejecuta de nuevo.
        const { data: filaExistente } = await supabaseAdmin
          .from("campanas_snapshots")
          .select("id")
          .eq("campana_id", campana.id)
          .gte("corrida_en", hoyInicio.toISOString())
          .maybeSingle();

        const payload = {
          campana_id: campana.id,
          user_id: usuario.id,
          corrida_en: new Date().toISOString(),
          spend: parseFloat(fila.spend) || 0,
          ctr: fila.ctr ? parseFloat(fila.ctr) : null,
          reach: fila.reach ? parseInt(fila.reach, 10) : null,
          frequency: fila.frequency ? parseFloat(fila.frequency) : null,
          conversiones: contarConversiones(fila.actions, campana.objetivo),
          impresiones: fila.impressions ? parseInt(fila.impressions, 10) : null,
          objetivo: campana.objetivo,
          raw: fila,
        };

        if (filaExistente) {
          await supabaseAdmin.from("campanas_snapshots").update(payload).eq("id", filaExistente.id);
        } else {
          await supabaseAdmin.from("campanas_snapshots").insert(payload);
        }

        campanasActualizadas++;
      } catch (err) {
        console.error(`Error sincronizando campaña ${campana.id}:`, err);
        campanasConError++;
      }
    }
  }

  return NextResponse.json({ ok: true, campanasActualizadas, campanasConError });
}