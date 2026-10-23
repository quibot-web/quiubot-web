import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { recuperarCreativosFallidos } from "@/app/lib/propuestas";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

// Botón "Revisar de nuevo" (solo admin) para una crear_creativos que
// quedó "fallida" pero tiene job_id -- por si el timeout la marcó
// fallida antes de que se viera que creativos_jobs ya había terminado
// bien. Nunca crea nada si el job no está "listo"; ver
// recuperarCreativosFallidos para el resto de las reglas.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    const { data: propuesta } = await supabaseAdmin
      .from("propuestas")
      .select("id")
      .eq("id", id)
      .eq("user_id", usuario.id)
      .maybeSingle();

    if (!propuesta) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });

    const resultado = await recuperarCreativosFallidos(id);
    return NextResponse.json(resultado);
  } catch (err) {
    console.error("Error inesperado en /api/propuestas/[id]/recuperar-creativos:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
