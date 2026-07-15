import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { estrategia, descripcion_visual_producto, imagen_producto_base64 } = await req.json();

  if (!estrategia || !descripcion_visual_producto || !imagen_producto_base64) {
    return NextResponse.json({ error: "Falta la estrategia, la descripción o la foto del producto" }, { status: 400 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("openai_key")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (!usuario.openai_key) {
    return NextResponse.json(
      { error: "Necesitas conectar tu API key de OpenAI en Integraciones antes de generar creativos." },
      { status: 400 }
    );
  }

  let openaiKeyDescifrada: string;
  try {
    openaiKeyDescifrada = desencriptarSiHaceFalta(usuario.openai_key);
  } catch (err) {
    console.error("Error al descifrar openai_key:", err);
    return NextResponse.json(
      { error: "No se pudo leer tu API key guardada. Vuelve a conectarla en Integraciones." },
      { status: 500 }
    );
  }

  try {
    const n8nRes = await fetch("https://n8n.quibot.juanshow.cloud/webhook/crear_creativos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailBusqueda,
        estrategia,
        descripcion_visual_producto,
        imagen_producto_base64,
        openai_key: openaiKeyDescifrada,
      }),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      return NextResponse.json(
        { error: data.error || "No se pudo iniciar la generación de creativos" },
        { status: n8nRes.status || 502 }
      );
    }

    if (!data.job_id) {
      return NextResponse.json({ error: "n8n no devolvió un job_id" }, { status: 502 });
    }

    return NextResponse.json({ job_id: data.job_id, estado: data.estado || "procesando" });
  } catch (err) {
    console.error("Error al conectar con n8n (crear_creativos):", err);
    return NextResponse.json({ error: "No se pudo conectar con el servidor" }, { status: 503 });
  }
}