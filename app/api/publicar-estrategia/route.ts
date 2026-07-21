import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { estrategia, creativos, fuente_creativos, efectividad_final } = await req.json();

  if (!estrategia) {
    return NextResponse.json({ error: "Falta la estrategia a publicar" }, { status: 400 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", emailBusqueda)
    .single();

  try {
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/publicar_estrategia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailBusqueda,
        estrategia,
        creativos,
        fuente_creativos,
        efectividad_final,
      }),
    });

    if (!n8nRes.ok) {
      const text = await n8nRes.text();
      return NextResponse.json({ error: `Error de n8n: ${text}` }, { status: 502 });
    }

    const data = await n8nRes.json().catch(() => ({}));

    // Registrar la campaña en nuestra BD para poder monitorearla luego
    if (usuario) {
      const { data: campana, error: insertError } = await supabaseAdmin
        .from("campanas_publicadas")
        .insert({
          user_id: usuario.id,
          nombre: estrategia?.campana?.nombre ?? "Campaña sin nombre",
          objetivo: estrategia?.campana?.objetivo_meta ?? null,
          presupuesto_diario: estrategia?.campana?.presupuesto_diario_cop ?? null,
          efectividad_estimada: efectividad_final ?? estrategia?.efectividad ?? null,
          estado: "activa",
          meta_campaign_id: data?.meta_campaign_id ?? null,
          meta_adset_id: data?.meta_adset_id ?? null,
        })
        .select()
        .single();

      if (!insertError && campana) {
        await supabaseAdmin.from("notificaciones").insert({
          user_id: usuario.id,
          campana_id: campana.id,
          tipo: "info",
          titulo: "Campaña publicada",
          mensaje: `Tu campaña "${campana.nombre}" fue publicada correctamente en Meta.`,
          estado: "pendiente",
        });
      }
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error("Error al publicar estrategia:", err);
    return NextResponse.json({ error: "No se pudo conectar con n8n" }, { status: 503 });
  }
}