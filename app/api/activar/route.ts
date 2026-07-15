import { supabaseAdmin } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"

// Límite simple de intentos por IP: máximo 5 intentos fallidos cada 10 minutos.
// Suficiente para un solo servidor (tu caso, un VPS con Coolify). Si algún día
// escalas a varios servidores en paralelo, esto habría que moverlo a Redis o similar.
const intentosFallidos = new Map<string, { conteo: number; primerIntento: number }>()
const VENTANA_MS = 10 * 60 * 1000
const MAX_INTENTOS = 5

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconocida"

  const registro = intentosFallidos.get(ip)
  const ahora = Date.now()
  if (registro && ahora - registro.primerIntento < VENTANA_MS && registro.conteo >= MAX_INTENTOS) {
    return NextResponse.json({ error: "Demasiados intentos. Intenta más tarde." }, { status: 429 })
  }

  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    // Sin secreto configurado, la ruta debe negarse por completo — nunca "abierta por defecto".
    console.error("ADMIN_SECRET no está configurado en este ambiente.")
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const authHeader = req.headers.get("authorization") || ""
  const esperado = `Bearer ${adminSecret}`

  if (!compararSeguro(authHeader, esperado)) {
    const actual = intentosFallidos.get(ip)
    if (actual && ahora - actual.primerIntento < VENTANA_MS) {
      actual.conteo += 1
    } else {
      intentosFallidos.set(ip, { conteo: 1, primerIntento: ahora })
    }
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  intentosFallidos.delete(ip)

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