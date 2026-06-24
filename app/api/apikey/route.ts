import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { apiKey } = await req.json()
  if (!apiKey || !apiKey.startsWith("sk-"))
    return NextResponse.json({ error: "API key inválida" }, { status: 400 })

  const { error } = await supabaseAdmin
    .from("usuarios")
    .upsert({ email: session.user.email, openai_key: apiKey }, { onConflict: "email" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ hasKey: false, preview: null })

  const { data } = await supabaseAdmin
    .from("usuarios")
    .select("openai_key")
    .eq("email", session.user.email)
    .single()

  const key = data?.openai_key
  return NextResponse.json({
    hasKey: !!key,
    preview: key ? `sk-...${key.slice(-6)}` : null,
  })
}