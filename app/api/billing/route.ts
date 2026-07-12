import { auth } from "@/auth"
import { supabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

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
    })

  const { data } = await supabaseAdmin
    .from("usuarios")
    .select("plan, en_trial, trial_termina_en, fecha_vencimiento, fecha_pago")
    .eq("email", session.user.email)
    .single()

  const plan = data?.plan ?? "arranque"

  return NextResponse.json({
    plan,
    activo: plan !== "arranque", // se conserva por compatibilidad con código que aún lo lea
    en_trial: data?.en_trial ?? false,
    trial_termina_en: data?.trial_termina_en ?? null,
    fecha_vencimiento: data?.fecha_vencimiento ?? null,
    fecha_pago: data?.fecha_pago ?? null,
  })
}