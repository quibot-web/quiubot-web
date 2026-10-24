import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tieneAutopiloto } from "@/app/lib/planesConfig";
import { calcularAvanceMeta } from "@/app/lib/metas";

// Trae UNA meta puntual por id -- hace falta desde que puede haber
// varias activas a la vez (una por tipo): /estrategia la usa para
// precargar objetivo/presupuesto cuando llega con ?meta_id=... desde
// una propuesta aprobada, en vez de adivinar "la" meta activa.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { data: meta } = await supabaseAdmin
    .from("metas")
    .select("*")
    .eq("id", id)
    .eq("user_id", usuario.id)
    .single();

  if (!meta) return NextResponse.json({ error: "Meta no encontrada." }, { status: 404 });

  try {
    const avance = await calcularAvanceMeta({
      id: meta.id,
      tipo: meta.tipo,
      user_id: meta.user_id,
      fecha_inicio: meta.fecha_inicio,
      fecha_fin: meta.fecha_fin,
    });
    return NextResponse.json({ meta, avance });
  } catch (err) {
    console.error(`Error calculando el avance de la meta ${meta.id}:`, err);
    return NextResponse.json({ meta, avance: null, error: "No se pudo calcular el avance en este momento." });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, plan, en_trial, trial_termina_en, fecha_vencimiento, beta_autopiloto")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (!tieneAutopiloto(usuario)) {
    return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
  }

  const body = await req.json();
  const actualizacion: Record<string, unknown> = { actualizado_en: new Date().toISOString() };
  let tipoEvento: string;

  if (typeof body.pausado_autopiloto === "boolean") {
    actualizacion.pausado_autopiloto = body.pausado_autopiloto;
    tipoEvento = body.pausado_autopiloto ? "autopiloto_pausado" : "autopiloto_reanudado";
  } else if (body.estado === "cancelada") {
    // Cancelar es definitivo (a diferencia de pausar, no hay "reanudar"
    // de vuelta desde acá) -- libera el tipo de inmediato para que el
    // cliente pueda crear otra meta del mismo tipo sin esperar a que
    // venza por fecha.
    actualizacion.estado = "cancelada";
    tipoEvento = "meta_cancelada";
  } else {
    return NextResponse.json(
      { error: "Mandá pausado_autopiloto (true/false) o estado: \"cancelada\"." },
      { status: 400 }
    );
  }

  const { data: meta, error } = await supabaseAdmin
    .from("metas")
    .update(actualizacion)
    .eq("id", id)
    .eq("user_id", usuario.id)
    .eq("estado", "activa")
    .select()
    .single();

  if (error || !meta) {
    return NextResponse.json({ error: "Meta no encontrada, o ya no está activa." }, { status: 404 });
  }

  await supabaseAdmin.from("bitacora").insert({
    user_id: usuario.id,
    meta_id: meta.id,
    propuesta_id: null,
    tipo_evento: tipoEvento,
    detalle: {},
  });

  return NextResponse.json({ meta });
}
