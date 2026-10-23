import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { obtenerPropuestasPendientes } from "@/app/lib/propuestas";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

export async function GET() {
  try {
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

    const propuestas = await obtenerPropuestasPendientes(usuario.id);
    return NextResponse.json({ propuestas });
  } catch (err) {
    console.error("Error inesperado en /api/propuestas:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
