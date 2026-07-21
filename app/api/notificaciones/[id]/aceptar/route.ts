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

  const { data: notificacion, error: fetchError } = await supabaseAdmin
    .from("notificaciones")
    .select("*, campanas_publicadas(meta_campaign_id, meta_adset_id, presupuesto_diario)")
    .eq("id", id)
    .single();

  if (fetchError || !notificacion) {
    return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("meta_access_token")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario?.meta_access_token) {
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
      return NextResponse.json({ error: data.error || "No se pudo aplicar la sugerencia en Meta" }, { status: n8nRes.status || 502 });
    }

    await supabaseAdmin.from("notificaciones").update({ estado: "aplicada" }).eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al aplicar sugerencia:", err);
    return NextResponse.json({ error: "No se pudo conectar con n8n" }, { status: 503 });
  }
}