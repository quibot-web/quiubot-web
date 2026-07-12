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

  // Normalizar sitio_web: si viene con contenido pero sin protocolo, se lo agregamos
  if (typeof body.sitio_web === "string" && body.sitio_web.trim() !== "") {
    let url = body.sitio_web.trim()
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url
    }
    body.sitio_web = url
  }

  // Normalizar whatsapp_numero: dejar solo dígitos (sin +, espacios, guiones)
  if (typeof body.whatsapp_numero === "string" && body.whatsapp_numero.trim() !== "") {
    body.whatsapp_numero = body.whatsapp_numero.replace(/\D/g, "")
  }

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