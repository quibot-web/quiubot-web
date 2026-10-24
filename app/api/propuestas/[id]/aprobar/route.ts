import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ejecutarPropuesta } from "@/app/lib/propuestas";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

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

    const { data: propuesta } = await supabaseAdmin
      .from("propuestas")
      .select("*")
      .eq("id", id)
      .eq("user_id", usuario.id)
      .single();

    if (!propuesta) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });

    if (propuesta.estado !== "pendiente") {
      return NextResponse.json({ error: `Esta propuesta ya está en estado "${propuesta.estado}".` }, { status: 409 });
    }
    if (propuesta.vence_en && propuesta.vence_en < new Date().toISOString()) {
      await supabaseAdmin.from("propuestas").update({ estado: "vencida" }).eq("id", id);
      return NextResponse.json({ error: "Esta propuesta venció." }, { status: 409 });
    }

    const resultado = await ejecutarPropuesta(propuesta, usuario);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error, motivo: resultado.motivo, paso: resultado.paso }, { status: resultado.status });
    }
    // Se devuelve la propuesta completa (ya se seleccionó "*" arriba,
    // sin costo extra) -- /decisiones la necesita para pasarle a
    // /estrategia el presupuesto sugerido y los ángulos a evitar de una
    // propuesta "abrir otro frente", sin otro viaje al servidor.
    return NextResponse.json({ ok: true, propuesta });
  } catch (err) {
    console.error("Error inesperado en /api/propuestas/[id]/aprobar:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
