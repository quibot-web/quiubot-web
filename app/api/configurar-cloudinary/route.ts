import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await req.json()
  const { error } = await supabaseAdmin
    .from("usuarios")
    .upsert({ email: session.user.email, ...body }, { onConflict: "email" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
