import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { v2 as cloudinary } from "cloudinary"

export async function POST(req: NextRequest) {
  // 1. Verificar sesión
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 })

  // 2. Verificar suscripción activa (Agregamos campos de Cloudinary al select)
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("activo, fecha_vencimiento, openai_key, cloudinary_cloud, cloudinary_api_key, cloudinary_api_secret")
    .eq("email", session.user.email)
    .single()

  if (!usuario?.activo)
    return NextResponse.json({ error: "Tu suscripción no está activa." }, { status: 403 })

  const ahora = new Date()
  const vencimiento = new Date(usuario.fecha_vencimiento)
  if (ahora > vencimiento)
    return NextResponse.json({ error: "Tu suscripción venció. Renueva tu plan." }, { status: 403 })

  // 3. Obtener API key de Supabase
  const openaiKey = usuario?.openai_key
  if (!openaiKey)
    return NextResponse.json({ error: "Configura tu API key de OpenAI en Integraciones" }, { status: 400 })

  // 4. Leer FormData
  const formData = await req.formData()
  const imagenFile = formData.get("imagen") as File | null
  const promptTexto = formData.get("prompt_texto") as string | null
  const cantidad = formData.get("cantidad") as string | null
  const incluirTexto = formData.get("incluir_texto") as string | null

  if (!imagenFile || !promptTexto)
    return NextResponse.json({ error: "Falta la imagen o el prompt" }, { status: 400 })

  // 5. Obtener identidad de marca
  const { data: marca } = await supabaseAdmin
    .from("marcas")
    .select("*")
    .eq("email", session.user.email)
    .single()

  // 6. Convertir imagen a base64
  const bytes = await imagenFile.arrayBuffer()
  const base64 = Buffer.from(bytes).toString("base64")
  const imagenUrl = `data:${imagenFile.type};base64,${base64}`

  // 7. Llamar a n8n
  try {
    const n8nRes = await fetch(
      "https://n8n.quibot.juanshow.cloud/webhook/crear_imagenAI",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagen_url: imagenUrl,
          prompt_texto: promptTexto,
          cantidad: parseInt(cantidad || "1"),
          incluir_texto: incluirTexto === "true",
          openai_api_key: openaiKey,
          marca: marca ?? null,
          email: session.user.email,        // ✅ email del usuario
          colores: marca?.colores ?? null,    // ✅ colores de la marca
          logo_url: marca?.logo_url ?? null,  // ✅ logo de la marca
        }),
      }
    )

    if (!n8nRes.ok) {
      const text = await n8nRes.text()
      return NextResponse.json({ error: `Error de n8n: ${text}` }, { status: 502 })
    }

    // Procesar respuesta como binario
    const imageBuffer = await n8nRes.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString("base64")

    // --- INTEGRACIÓN CLOUDINARY ---
    if (usuario.cloudinary_cloud && usuario.cloudinary_api_key && usuario.cloudinary_api_secret) {
      cloudinary.config({
        cloud_name: usuario.cloudinary_cloud,
        api_key: usuario.cloudinary_api_key,
        api_secret: usuario.cloudinary_api_secret,
      });
      
      const upload = await cloudinary.uploader.upload(`data:image/png;base64,${base64Image}`);
      
      // Guardar en tu tabla 'album_creativos' usando tus nombres de columna
      await supabaseAdmin.from("album_creativos").insert({ 
        user_id: usuario.id, // Asumiendo que 'usuario' tiene el campo 'id'
        url_imagen: upload.secure_url,
        public_id: upload.public_id // Aprovechando que tienes esta columna
      });
    }
    // ------------------------------
    return NextResponse.json({ imagen_base64: base64Image })

  } catch (err) {
    console.error("Error al conectar con n8n:", err)
    return NextResponse.json({ error: "No se pudo conectar con n8n. Verifica que el flujo esté escuchando." }, { status: 503 })
  }
}