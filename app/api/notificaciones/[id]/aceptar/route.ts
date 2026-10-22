import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, meta_access_token")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
  }

  const { data: notificacion, error: fetchError } = await supabaseAdmin
    .from("notificaciones")
    .select("*, campanas_publicadas(meta_campaign_id, meta_adset_id, presupuesto_diario)")
    .eq("id", id)
    .eq("user_id", usuario.id)
    .single();

  if (fetchError || !notificacion) {
    return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 });
  }

  if (!notificacion.accion_sugerida) {
    return NextResponse.json({ error: "Esta notificación no tiene una acción para aplicar." }, { status: 400 });
  }

  if (!usuario.meta_access_token) {
    return NextResponse.json({ error: "Tu cuenta de Meta no está conectada" }, { status: 400 });
  }

  try {
    // Esta llamada es la que ejecuta el cambio real en el Administrador de Anuncios de Meta
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/aplicar_sugerencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailBusqueda,
        meta_access_token: usuario.meta_access_token,
        campana_id: notificacion.campana_id,
        meta_campaign_id: notificacion.campanas_publicadas?.meta_campaign_id ?? null,
        meta_adset_id: notificacion.campanas_publicadas?.meta_adset_id ?? null,
        presupuesto_actual: notificacion.campanas_publicadas?.presupuesto_diario ?? null,
        accion: notificacion.accion_sugerida,
      }),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      // El Director (fase 2) lee este evento para su enfriamiento de 72h
      // por campaña -- un intento fallido no cuenta como cambio real, así
      // que no bloquea nada, pero igual queda en bitacora para auditar.
      await supabaseAdmin.from("bitacora").insert({
        user_id: usuario.id,
        meta_id: null,
        propuesta_id: null,
        tipo_evento: "notificacion_aceptada_fallo",
        detalle: { notificacion_id: id, campana_id: notificacion.campana_id, error: data.error || null },
      });
      return NextResponse.json({ error: data.error || "No se pudo aplicar la sugerencia en Meta" }, { status: n8nRes.status || 502 });
    }

    await supabaseAdmin.from("notificaciones").update({ estado: "aplicada" }).eq("id", id);

    // Mismo evento que ejecutarPropuesta usa para pausar/ajustar_presupuesto
    // -- el Director (fase 2) necesita ver este cambio para su enfriamiento
    // de 72h, aunque haya venido del monitoreo viejo y no de una propuesta.
    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: null,
      propuesta_id: null,
      tipo_evento: "propuesta_aprobada_ejecutada",
      detalle: { origen: "notificacion", notificacion_id: id, campana_id: notificacion.campana_id, accion: notificacion.accion_sugerida },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al aplicar sugerencia:", err);
    return NextResponse.json({ error: "No se pudo conectar con n8n" }, { status: 503 });
  }
}