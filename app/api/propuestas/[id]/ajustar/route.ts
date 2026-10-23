import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ejecutarPropuesta } from "@/app/lib/propuestas";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

// "Ajustar" = editar los parámetros (ej. el % de ajuste de presupuesto)
// y aprobar en un solo paso -- reusa exactamente la misma ejecución que
// /aprobar, solo que con los parámetros ya corregidos por el cliente.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id, email, rol, meta_access_token, plan, en_trial, trial_termina_en, fecha_vencimiento, beta_autopiloto")
      .eq("email", session.user.email.trim().toLowerCase())
      .single();

    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!tieneAutopiloto(usuario)) {
      return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
    }

    const { parametros } = await req.json();
    if (!parametros || typeof parametros !== "object") {
      return NextResponse.json({ error: "Faltan los parámetros ajustados." }, { status: 400 });
    }

    const { data: propuestaActual } = await supabaseAdmin
      .from("propuestas")
      .select("*")
      .eq("id", id)
      .eq("user_id", usuario.id)
      .single();

    if (!propuestaActual) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
    if (propuestaActual.estado !== "pendiente") {
      return NextResponse.json({ error: `Esta propuesta ya está en estado "${propuestaActual.estado}".` }, { status: 409 });
    }
    if (propuestaActual.vence_en && propuestaActual.vence_en < new Date().toISOString()) {
      await supabaseAdmin.from("propuestas").update({ estado: "vencida" }).eq("id", id);
      return NextResponse.json({ error: "Esta propuesta venció." }, { status: 409 });
    }

    const { data: propuestaAjustada } = await supabaseAdmin
      .from("propuestas")
      .update({ parametros: { ...(propuestaActual.parametros as object), ...parametros } })
      .eq("id", id)
      .select()
      .single();

    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: propuestaActual.meta_id,
      propuesta_id: id,
      tipo_evento: "propuesta_ajustada",
      detalle: { parametros },
    });

    const resultado = await ejecutarPropuesta(propuestaAjustada ?? propuestaActual, usuario);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error, motivo: resultado.motivo, paso: resultado.paso }, { status: resultado.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error inesperado en /api/propuestas/[id]/ajustar:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
