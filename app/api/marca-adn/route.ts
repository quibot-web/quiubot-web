import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";

const MIN_IMAGENES = 3;
const MAX_IMAGENES = 5;

// Consulta si el usuario ya tiene un ADN de marca generado.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data } = await supabaseAdmin
    .from("marcas")
    .select("adn_marca, adn_resumen, adn_generado_en")
    .eq("email", emailBusqueda)
    .maybeSingle();

  return NextResponse.json({
    tieneAdn: !!data?.adn_marca,
    adn_marca: data?.adn_marca ?? null,
    adn_resumen: data?.adn_resumen ?? null,
    adn_generado_en: data?.adn_generado_en ?? null,
  });
}

// Dispara el análisis de ADN de marca con 3 a 5 imágenes de creativos ya existentes.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { imagenes_base64 } = await req.json();

  if (!Array.isArray(imagenes_base64) || imagenes_base64.length < MIN_IMAGENES) {
    return NextResponse.json(
      { error: `Necesitas subir al menos ${MIN_IMAGENES} creativos para analizar tu ADN de marca.` },
      { status: 400 }
    );
  }

  const imagenesFinal = imagenes_base64.slice(0, MAX_IMAGENES);

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, openai_key")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (!usuario.openai_key) {
    return NextResponse.json(
      { error: "Necesitas conectar tu API key de OpenAI en Integraciones antes de analizar tu ADN de marca." },
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
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/analizar_adn_marca", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailBusqueda,
        openai_key: openaiKeyDescifrada,
        imagenes_base64: imagenesFinal,
      }),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      return NextResponse.json(
        { error: data.error || "No se pudo analizar el ADN de marca" },
        { status: n8nRes.status || 502 }
      );
    }

    return NextResponse.json({ ok: true, adn_marca: data.adn_marca, adn_resumen: data.adn_resumen });
  } catch (err) {
    console.error("Error al conectar con n8n (analizar_adn_marca):", err);
    return NextResponse.json({ error: "No se pudo conectar con el servidor de IA" }, { status: 503 });
  }
}