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
  const { estrategia, creativos_album } = await req.json();

  if (!estrategia) {
    return NextResponse.json({ error: "Falta la estrategia a evaluar" }, { status: 400 });
  }
  if (!Array.isArray(creativos_album) || creativos_album.length === 0) {
    return NextResponse.json({ error: "No hay creativos para analizar" }, { status: 400 });
  }

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
      { error: "Necesitas conectar tu API key de OpenAI en Integraciones antes de analizar tus creativos." },
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
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/analizar_creativos_album", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailBusqueda,
        openai_key: openaiKeyDescifrada,
        estrategia,
        creativos_album,
      }),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      return NextResponse.json(
        { error: data.error || "No se pudieron analizar los creativos" },
        { status: n8nRes.status || 502 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error al conectar con n8n (analizar_creativos_album):", err);
    return NextResponse.json({ error: "No se pudo conectar con el servidor de IA" }, { status: 503 });
  }
}