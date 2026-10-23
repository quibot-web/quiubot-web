import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { etapaRenovacion, calcularResultadosPeriodo } from "@/app/lib/renovacion";
import { nombrePlan } from "@/app/lib/directorChat";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

// Qué le dice el Director sobre su plan, si algo -- calculado en vivo
// (ver app/lib/renovacion.ts), nunca persistido. Mismo criterio que el
// resto del Autopiloto (ver tieneAutopiloto en planesConfig.ts).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ etapa: null });

    const emailBusqueda = session.user.email.trim().toLowerCase();
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id, rol, plan, en_trial, fecha_pago, fecha_vencimiento, beta_autopiloto")
      .eq("email", emailBusqueda)
      .single();

    if (!usuario) return NextResponse.json({ etapa: null });

    if (!tieneAutopiloto(usuario)) {
      return NextResponse.json({ etapa: null });
    }

    const etapa = etapaRenovacion(usuario);
    if (!etapa) return NextResponse.json({ etapa: null });

    // Los resultados del periodo solo hacen falta para la plantilla de
    // "3 días antes" -- no vale la pena calcularlos para las otras 3.
    const resultados = etapa === "3_dias_antes" ? await calcularResultadosPeriodo(usuario.id, usuario.fecha_pago) : null;

    // Ciclo para el botón "Renovar ahora" -- ordenes_pago no tiene
    // user_id, solo email, así que se cruza por ahí.
    const { data: ordenReciente } = await supabaseAdmin
      .from("ordenes_pago")
      .select("ciclo")
      .eq("email", emailBusqueda)
      .eq("estado", "pagado")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      etapa,
      plan: usuario.plan,
      nombrePlan: nombrePlan(usuario.plan || ""),
      fechaVencimiento: usuario.fecha_vencimiento,
      ciclo: ordenReciente?.ciclo || "mensual",
      resultados,
    });
  } catch (err) {
    console.error("Error inesperado en /api/billing/recordatorio:", err);
    return NextResponse.json({ etapa: null });
  }
}
