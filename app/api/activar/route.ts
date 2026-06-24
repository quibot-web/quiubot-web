import { supabaseAdmin } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { email, dias } = await req.json()
  if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 })

  const fechaPago = new Date()
  const fechaVencimiento = new Date()
  fechaVencimiento.setDate(fechaVencimiento.getDate() + (dias ?? 30))

  const { error } = await supabaseAdmin
    .from("usuarios")
    .upsert({
      email,
      activo: true,
      fecha_pago: fechaPago.toISOString(),
      fecha_vencimiento: fechaVencimiento.toISOString(),
    }, { onConflict: "email" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, vence: fechaVencimiento })
}