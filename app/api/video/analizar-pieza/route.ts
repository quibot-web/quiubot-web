import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarLimite } from "@/lib/rateLimit";
import { registrarError } from "@/lib/registrarError";
import { AnalisisPiezaSchema, VERSION_ANALISIS_PIEZA, type AnalisisPieza } from "@/app/lib/analisisPieza";
import { PROMPT_ANALISIS_PIEZA } from "@/video/promptAnalisisPieza";

// Aparte de MODELO_GUION_VIDEO (gpt-5.6-sol): el análisis de piezas usa
// el mismo modelo que ya prueba con imágenes el flujo de n8n
// analizar_creativos_album v4, no el modelo del guion.
const MODELO_ANALISIS_IMAGEN = "gpt-4o";
const TIMEOUT_OPENAI_MS = 60_000;

async function analizarConOpenAI(apiKey: string, urlImagen: string): Promise<AnalisisPieza> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_OPENAI_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODELO_ANALISIS_IMAGEN,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT_ANALISIS_PIEZA },
              { type: "image_url", image_url: { url: urlImagen } },
            ],
          },
        ],
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detalle = await res.text();
      throw new Error(`Error de OpenAI (${res.status}): ${detalle}`);
    }
    const data = await res.json();
    const contenido = data?.choices?.[0]?.message?.content;
    if (typeof contenido !== "string") throw new Error("OpenAI no devolvió contenido de texto.");

    const crudo = JSON.parse(contenido);
    const resultado = AnalisisPiezaSchema.safeParse({ ...crudo, version: VERSION_ANALISIS_PIEZA });
    if (!resultado.success) {
      throw new Error(`Respuesta de análisis inválida: ${resultado.error.issues.map((i) => i.message).join(" | ")}`);
    }
    return resultado.data;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const permitido = verificarLimite(`video-analizar-pieza:${emailBusqueda}`, 20, 5 * 60 * 1000);
  if (!permitido) {
    return NextResponse.json({ error: "Estás analizando piezas muy rápido. Espera un momento e intenta de nuevo." }, { status: 429 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, openai_key")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  if (usuario.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (!usuario.openai_key) {
    return NextResponse.json({ error: "Conecta tu cuenta de OpenAI en Integraciones." }, { status: 400 });
  }

  const cuerpo = (await req.json().catch(() => null)) as { media_id?: string } | null;
  const mediaId = cuerpo?.media_id;
  if (!mediaId) {
    return NextResponse.json({ error: "Falta media_id." }, { status: 400 });
  }

  const { data: pieza } = await supabaseAdmin
    .from("album_creativos")
    .select("id, url_imagen, tipo, analisis, analisis_en")
    .eq("id", mediaId)
    .eq("user_id", usuario.id)
    .maybeSingle();

  if (!pieza) {
    return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
  }

  // Caché: una pieza se analiza una sola vez en toda su vida, sin
  // importar en cuántos guiones de video se use después -- la pide
  // /video al elegir la pieza (para el badge) y de nuevo al generar el
  // guion (para copiarlo dentro), y en ningún caso se vuelve a pagar.
  const existente = AnalisisPiezaSchema.safeParse(pieza.analisis);
  if (existente.success) {
    return NextResponse.json({ analisis: existente.data, en_cache: true });
  }

  // Las piezas de video se pueden analizar; las de imagen fija también
  // (ambas sirven como producto_hero/gancho con producto) -- un frame
  // de video como imagen fija para el análisis sería un paso extra que
  // el plan no pidió, así que por ahora solo se analiza si es imagen.
  if (pieza.tipo === "video") {
    return NextResponse.json({ error: "Por ahora solo se analizan piezas de imagen, no de video." }, { status: 400 });
  }

  let apiKeyUsuario: string;
  try {
    apiKeyUsuario = desencriptarSiHaceFalta(usuario.openai_key);
  } catch {
    return NextResponse.json({ error: "No se pudo leer tu llave de OpenAI guardada." }, { status: 500 });
  }

  try {
    const analisis = await analizarConOpenAI(apiKeyUsuario, pieza.url_imagen);

    await supabaseAdmin
      .from("album_creativos")
      .update({ analisis, analisis_en: new Date().toISOString() })
      .eq("id", mediaId);

    return NextResponse.json({ analisis, en_cache: false });
  } catch (err) {
    console.error("Error analizando pieza de video:", err);
    registrarError({
      origen: "video_analizar_pieza",
      userId: usuario.id,
      email: emailBusqueda,
      paso: "llamada_openai",
      errorMensaje: "No se pudo analizar la pieza con IA.",
      detalleTecnico: String(err),
    });
    return NextResponse.json({ error: "No se pudo analizar esta pieza en este momento." }, { status: 503 });
  }
}
