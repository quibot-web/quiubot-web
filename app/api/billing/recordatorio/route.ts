import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { etapaRenovacion, calcularResultadosPeriodo } from "@/app/lib/renovacion";
import { nombrePlan } from "@/app/lib/directorChat";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

const CICLO_POR_DEFECTO = "mensual";

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
      .select("id, rol, plan, en_trial, trial_termina_en, fecha_pago, fecha_vencimiento, beta_autopiloto")
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

    // El plan y el ciclo para "Renovar ahora" salen de la última orden
    // pagada, NUNCA de usuarios.plan: el workflow de n8n baja ese campo
    // a "arranque" un día después de vencer, así que durante casi toda
    // la ventana de "vencido" usuarios.plan ya no es el plan que se
    // está renovando. ordenes_pago no tiene user_id, solo email, así
    // que se cruza por ahí.
    const { data: ordenReciente } = await supabaseAdmin
      .from("ordenes_pago")
      .select("plan_id, ciclo")
      .eq("email", emailBusqueda)
      .eq("estado", "pagado")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Sin ninguna orden (activación manual por /api/activar), se usa
    // usuarios.plan mientras no sea "arranque" -- si ya es "arranque" no
    // hay ningún plan pagado que ofrecer renovar, así que no se manda
    // ninguno: el cliente muestra el texto genérico sin nombre de plan
    // y el botón "Ver planes" en vez de "Renovar ahora".
    const planParaRenovar = ordenReciente?.plan_id || (usuario.plan && usuario.plan !== "arranque" ? usuario.plan : null);
    const cicloParaRenovar = ordenReciente?.ciclo || (planParaRenovar ? CICLO_POR_DEFECTO : null);

    return NextResponse.json({
      etapa,
      plan: planParaRenovar,
      nombrePlan: planParaRenovar ? nombrePlan(planParaRenovar) : null,
      fechaVencimiento: usuario.fecha_vencimiento,
      ciclo: cicloParaRenovar,
      resultados,
    });
  } catch (err) {
    console.error("Error inesperado en /api/billing/recordatorio:", err);
    return NextResponse.json({ etapa: null });
  }
}
