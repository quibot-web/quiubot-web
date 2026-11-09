import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tieneAutopiloto } from "@/app/lib/planesConfig";
import { calcularAvanceMeta, cambiarEstadoMeta, ETIQUETA_TIPO_META, type TipoMeta } from "@/app/lib/metas";

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
      valor_inicial: meta.valor_inicial,
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

  // Para armar un mensaje del Director que diga de qué meta se trata
  // ("Pausé tu meta de Leads") -- si no existe para este usuario, se
  // corta acá con el mismo 404 de siempre, sin llamar a la RPC.
  const { data: metaExistente } = await supabaseAdmin.from("metas").select("tipo").eq("id", id).eq("user_id", usuario.id).maybeSingle();
  if (!metaExistente) {
    return NextResponse.json({ error: "Meta no encontrada, o ya no está activa." }, { status: 404 });
  }
  const etiqueta = ETIQUETA_TIPO_META[metaExistente.tipo as TipoMeta];

  const body = await req.json();
  let tipoEvento: string;
  let pausadoAutopiloto: boolean | undefined;
  let estadoNuevo: "cancelada" | undefined;
  let mensajeDirector: string;

  if (typeof body.pausado_autopiloto === "boolean") {
    pausadoAutopiloto = body.pausado_autopiloto;
    tipoEvento = body.pausado_autopiloto ? "meta_pausada" : "meta_reanudada";
    mensajeDirector = body.pausado_autopiloto
      ? `Pausé tu meta de ${etiqueta} -- avisame cuando quieras que la retome.`
      : `Reanudé tu meta de ${etiqueta}.`;
  } else if (body.estado === "cancelada") {
    // Cancelar es definitivo (a diferencia de pausar, no hay "reanudar"
    // de vuelta desde acá) -- libera el tipo de inmediato para que el
    // cliente pueda crear otra meta del mismo tipo sin esperar a que
    // venza por fecha.
    estadoNuevo = "cancelada";
    tipoEvento = "meta_cancelada";
    mensajeDirector = `Cancelé tu meta de ${etiqueta}.`;
  } else {
    return NextResponse.json(
      { error: "Mandá pausado_autopiloto (true/false) o estado: \"cancelada\"." },
      { status: 400 }
    );
  }

  let meta;
  try {
    meta = await cambiarEstadoMeta({
      metaId: id,
      userId: usuario.id,
      tipoEvento,
      pausadoAutopiloto,
      estadoNuevo,
      mensajeDirector,
    });
  } catch (err) {
    console.error(`Error cambiando el estado de la meta ${id}:`, err);
    return NextResponse.json({ error: "No se pudo actualizar la meta en este momento." }, { status: 500 });
  }

  if (!meta) {
    return NextResponse.json({ error: "Meta no encontrada, o ya no está activa." }, { status: 404 });
  }

  return NextResponse.json({ meta });
}
