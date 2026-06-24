import { auth } from "@/auth"
import { supabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ activo: false })

  const { data } = await supabaseAdmin
    .from("usuarios")
    .select("activo, fecha_vencimiento")
    .eq("email", session.user.email)
    .single()

  if (!data?.activo) return NextResponse.json({ activo: false })

  const vencido = new Date() > new Date(data.fecha_vencimiento)
  return NextResponse.json({ activo: !vencido })
}