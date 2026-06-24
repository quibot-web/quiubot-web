import { auth } from "@/auth"
import { supabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ activo: false, fecha_vencimiento: null, fecha_pago: null })

  const { data } = await supabaseAdmin
    .from("usuarios")
    .select("activo, fecha_vencimiento, fecha_pago")
    .eq("email", session.user.email)
    .single()

  return NextResponse.json({
    activo: data?.activo ?? false,
    fecha_vencimiento: data?.fecha_vencimiento ?? null,
    fecha_pago: data?.fecha_pago ?? null,
  })
}