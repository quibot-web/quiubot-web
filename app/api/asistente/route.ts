import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generarEmbedding } from "@/app/lib/embeddings";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarLimite } from "@/lib/rateLimit";

// Modelos usados por el asistente. Ambos son de los más económicos de OpenAI.
const MODELO_CHAT = "gpt-4o-mini";
const CANTIDAD_FRAGMENTOS_CONTEXTO = 5;
const CANTIDAD_MENSAJES_HISTORIAL = 10;

const PROMPT_BASE = `Eres el asistente de soporte de Quiubot, una plataforma que genera estrategia publicitaria, creativos y campañas con IA para Meta Ads.

Reglas:
- Si el mensaje es un saludo, agradecimiento o charla trivial (ej. "hola", "gracias", "cómo estás"), respóndelo con cordialidad breve sin necesidad del "CONOCIMIENTO" y sin marcar "escalar". Las reglas siguientes sobre CONOCIMIENTO aplican solo a preguntas reales sobre Quiubot.
- Para preguntas reales, responde SOLO con información que aparezca en el "CONOCIMIENTO" que se te entrega a continuación. No inventes funciones, precios ni comportamientos que no estén ahí.
- Si el CONOCIMIENTO dice literalmente "(No se encontró conocimiento relevante para esta pregunta.)", significa que no tienes información para responder esa pregunta puntual: dilo con honestidad (sin inventar nada) y marca "escalar" en true.
- Sé breve, claro y amable. Usa un tono cercano, como un compañero de equipo, no como un manual.
- Si detectas alguno de estos casos, marca "escalar" en true sin importar si tienes o no una respuesta parcial: solicitudes de reembolso, pagos que el usuario dice haber hecho pero no reflejados, solicitudes de borrado de cuenta o datos personales, el usuario pide explícitamente hablar con una persona, o el usuario muestra frustración repetida.
- Tú no tienes acceso a los datos de la cuenta de este usuario (sus conexiones, sus metas, sus campañas, sus propuestas pendientes) -- solo sabes cómo funciona Quiubot en general. Si la pregunta es sobre SU cuenta puntual (ej. "¿tengo el píxel conectado?", "¿cuántas metas tengo activas?", "¿por qué mi campaña no...?"), no la respondas con un supuesto: marca "redirigir_a_director" en true y dilo brevemente, sin marcar "escalar" (esto no es un humano, es el Director, que sí ve su cuenta).
- Responde ÚNICAMENTE con un objeto JSON con esta forma exacta, sin texto adicional ni backticks:
{"respuesta": "tu respuesta aquí", "escalar": true o false, "redirigir_a_director": true o false}`;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ mostrar: false });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, plan, openai_key")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario || usuario.plan === "arranque") {
    return NextResponse.json({ mostrar: false });
  }

  if (!usuario.openai_key) {
    return NextResponse.json({ mostrar: true, activo: false, historial: [] });
  }

  const { data: historial } = await supabaseAdmin
    .from("asistente_conversaciones")
    .select("rol, mensaje, creado_en")
    .eq("user_id", usuario.id)
    .order("creado_en", { ascending: true })
    .limit(CANTIDAD_MENSAJES_HISTORIAL);

  return NextResponse.json({ mostrar: true, activo: true, historial: historial || [] });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const permitido = verificarLimite(`asistente:${session.user.email}`, 15, 2 * 60 * 1000);
  if (!permitido) {
    return NextResponse.json(
      { error: "Estás enviando mensajes muy rápido. Espera un momento e intenta de nuevo." },
      { status: 429 }
    );
  }

  const { mensaje } = await req.json();
  if (!mensaje?.trim()) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío" }, { status: 400 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, plan, openai_key")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
  }

  if (usuario.plan === "arranque") {
    return NextResponse.json(
      {
        error: "El asistente de IA está disponible desde el plan Crecimiento.",
        requierePlan: true,
      },
      { status: 403 }
    );
  }

  if (!usuario.openai_key) {
    return NextResponse.json(
      {
        error: "Para activar el asistente, conecta tu cuenta de OpenAI en Integraciones.",
        requiereApiKey: true,
      },
      { status: 400 }
    );
  }

  const apiKeyUsuario = desencriptarSiHaceFalta(usuario.openai_key);

  // 1. Busca los fragmentos de conocimiento más relevantes para la pregunta.
  let fragmentos: { seccion: string; contenido: string }[] = [];
  try {
    const embeddingPregunta = await generarEmbedding(mensaje, apiKeyUsuario);
    const { data, error } = await supabaseAdmin.rpc("buscar_conocimiento", {
      query_embedding: embeddingPregunta,
      cantidad: CANTIDAD_FRAGMENTOS_CONTEXTO,
    });
    if (error) throw new Error(error.message);
    fragmentos = data || [];
  } catch (err: any) {
    return NextResponse.json(
      { error: `No se pudo buscar el conocimiento: ${err.message}` },
      { status: 500 }
    );
  }

  const contexto = fragmentos.length > 0
    ? fragmentos.map((f) => `### ${f.seccion}\n${f.contenido}`).join("\n\n")
    : "(No se encontró conocimiento relevante para esta pregunta.)";

  // 2. Recupera el historial reciente de esta conversación.
  const { data: historialPrevio } = await supabaseAdmin
    .from("asistente_conversaciones")
    .select("rol, mensaje")
    .eq("user_id", usuario.id)
    .order("creado_en", { ascending: false })
    .limit(CANTIDAD_MENSAJES_HISTORIAL);

  const historialOrdenado = (historialPrevio || []).reverse();

  const mensajesOpenAI = [
    { role: "system", content: `${PROMPT_BASE}\n\nCONOCIMIENTO:\n${contexto}` },
    ...historialOrdenado.map((h) => ({
      role: h.rol === "assistant" ? "assistant" : "user",
      content: h.mensaje,
    })),
    { role: "user", content: mensaje },
  ];

  // 3. Genera la respuesta con IA.
  let respuestaTexto = "";
  let escalar = false;
  let redirigirADirector = false;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKeyUsuario}`,
      },
      body: JSON.stringify({
        model: MODELO_CHAT,
        messages: mensajesOpenAI,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const detalle = await res.text();
      throw new Error(`Error de OpenAI (${res.status}): ${detalle}`);
    }

    const data = await res.json();
    const contenido = data.choices[0].message.content;
    const parseado = JSON.parse(contenido);
    respuestaTexto = parseado.respuesta || "No pude generar una respuesta, intenta de nuevo.";
    escalar = !!parseado.escalar;
    redirigirADirector = !!parseado.redirigir_a_director;
  } catch (err: any) {
    return NextResponse.json(
      { error: `No se pudo generar la respuesta: ${err.message}` },
      { status: 500 }
    );
  }

  // 4. Guarda ambos mensajes en el historial de la conversación.
  await supabaseAdmin.from("asistente_conversaciones").insert([
    { user_id: usuario.id, rol: "user", mensaje },
    { user_id: usuario.id, rol: "assistant", mensaje: respuestaTexto },
  ]);

  return NextResponse.json({ respuesta: respuestaTexto, escalar, redirigirADirector });
}