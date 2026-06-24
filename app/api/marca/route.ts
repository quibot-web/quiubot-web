import { auth } from "@/auth"
import { supabaseAdmin } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { data } = await supabaseAdmin
    .from("marcas")
    .select("*")
    .eq("email", session.user.email)
    .single()

  return NextResponse.json(data ?? {})
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()

  const { error } = await supabaseAdmin
    .from("marcas")
    .upsert({
      email: session.user.email,
      ...body,
      actualizado_en: new Date().toISOString(),
    }, { onConflict: "email" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}