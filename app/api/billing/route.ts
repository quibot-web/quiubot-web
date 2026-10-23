import { auth } from "@/auth"
import { supabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { AUTOPILOTO_PUBLICO } from "@/app/lib/planesConfig"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({
      plan: "arranque",
      activo: false,
      en_trial: false,
      trial_termina_en: null,
      fecha_vencimiento: null,
      fecha_pago: null,
      esFundadorVigente: false,
      fundadorHasta: null,
    })

  const { data } = await supabaseAdmin
    .from("usuarios")
    .select("plan, en_trial, trial_termina_en, fecha_vencimiento, fecha_pago")
    .eq("email", session.user.email)
    .single()

  const plan = data?.plan ?? "arranque"

  // fundador_hasta se consulta por separado, SOLO con el interruptor
  // encendido -- apagado, esta ruta no toca esa columna para nada.
  let esFundadorVigente = false
  let fundadorHasta: string | null = null
  if (AUTOPILOTO_PUBLICO) {
    const { data: fundador } = await supabaseAdmin
      .from("usuarios")
      .select("fundador_hasta")
      .eq("email", session.user.email)
      .maybeSingle()
    fundadorHasta = fundador?.fundador_hasta ?? null
    esFundadorVigente = !!fundadorHasta && new Date(fundadorHasta) >= new Date()
  }

  return NextResponse.json({
    plan,
    activo: plan !== "arranque", // se conserva por compatibilidad con código que aún lo lea
    en_trial: data?.en_trial ?? false,
    trial_termina_en: data?.trial_termina_en ?? null,
    fecha_vencimiento: data?.fecha_vencimiento ?? null,
    fecha_pago: data?.fecha_pago ?? null,
    esFundadorVigente,
    fundadorHasta,
  })
}