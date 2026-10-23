import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { revisarGeneracionCreativos } from "@/app/lib/propuestas";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

// Llamado por polling desde /decisiones mientras el cliente sigue ahí
// viendo una crear_creativos en etapa "generando" -- así no tiene que
// esperar a la corrida horaria del cron para ver la propuesta
// agregar_anuncios aparecer. revisarGeneracionCreativos es idempotente,
// así que no importa si el cron también la revisa mientras tanto.
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

    const resultado = await revisarGeneracionCreativos(id);
    return NextResponse.json(resultado);
  } catch (err) {
    console.error("Error inesperado en /api/propuestas/[id]/revisar-generacion:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
