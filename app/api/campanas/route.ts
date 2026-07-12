import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ campanas: [] });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ campanas: [] });

  const { data: campanas, error } = await supabaseAdmin
    .from("campanas_publicadas")
    .select("*")
    .eq("user_id", usuario.id)
    .order("creado_en", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const campanaIds = (campanas ?? []).map((c) => c.id);

  // Trae la notificación pendiente más reciente por campaña, generada por
  // el Flujo 4 (análisis real contra Meta Insights) — ya no es un mock.
  const { data: notificaciones } = await supabaseAdmin
  .from("notificaciones")
  .select("*")
  .in("campana_id", campanaIds.length > 0 ? campanaIds : ["00000000-0000-0000-0000-000000000000"])
  .eq("estado", "pendiente")
  .in("tipo", ["alerta", "sugerencia"])
  .not("accion_sugerida", "is", null)
  .order("creado_en", { ascending: false });

  const notifPorCampana: Record<string, any> = {};
  for (const n of notificaciones ?? []) {
    if (!notifPorCampana[n.campana_id]) notifPorCampana[n.campana_id] = n;
  }

  const campanasConSugerencia = (campanas ?? []).map((c) => ({
    ...c,
    sugerencia_preview: notifPorCampana[c.id]
      ? {
          notificacion_id: notifPorCampana[c.id].id,
          tipo: notifPorCampana[c.id].tipo,
          titulo: notifPorCampana[c.id].titulo,
          mensaje: notifPorCampana[c.id].mensaje,
          accion_sugerida: notifPorCampana[c.id].accion_sugerida,
        }
      : null,
  }));

  return NextResponse.json({ campanas: campanasConSugerencia });
}