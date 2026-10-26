import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ejecutarPropuesta } from "@/app/lib/propuestas";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

// Reintentar solo existe para agregar_anuncios -- desde que n8n es
// idempotente por propuesta_id (agregar_anuncios v2: lee los anuncios
// que ya existen en Meta y salta los que corresponden a esta misma
// propuesta antes de crear nada), un reintento completo es seguro: no
// vuelve a duplicar lo que ya se creó. Reusa ejecutarPropuesta tal
// cual -- vuelve a validar la campaña y dispara un trabajos_ia nuevo
// con el mismo propuesta.id de siempre.
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
    if (propuesta.accion !== "agregar_anuncios") {
      return NextResponse.json({ error: "Esta propuesta no se puede reintentar." }, { status: 400 });
    }
    if (propuesta.estado !== "fallida") {
      return NextResponse.json({ error: `Esta propuesta ya está en estado "${propuesta.estado}".` }, { status: 409 });
    }

    const resultado = await ejecutarPropuesta(propuesta, usuario);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error, motivo: resultado.motivo, paso: resultado.paso }, { status: resultado.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error inesperado en /api/propuestas/[id]/reintentar:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
