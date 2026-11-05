// Fase 2, Commit 4 -- backend del grupo "Equipo" (reemplaza /decisiones).
// GET junta lo que antes traían /api/propuestas + /api/propuestas/historial
// (mismas queries, sin reescribir esa lógica) más los mensajes_equipo
// (eventos automáticos + conversación). POST maneja el texto libre del
// usuario -- reusa el MISMO cerebro del Director (Paso 4 de la Fase 1:
// mismo modelo, mismo contrato JSON, mismo CONTEXTO DE CUENTA). Voz
// corregida: los asistentes nunca le hablan al usuario -- si hay
// @mención, el Director responde citando a ese asistente
// ("Le pregunté al Analista y me dice..."), nunca deja que hable él.
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarLimite } from "@/lib/rateLimit";
import { tieneAutopiloto } from "@/app/lib/planesConfig";
import { obtenerPropuestasPendientes } from "@/app/lib/propuestas";
import { obtenerContextoCuenta, type UsuarioContextoCuenta } from "@/app/lib/director/contextoCuenta";
import { llamarDirector } from "@/app/lib/director/llamarDirector";
import { MODELO_DIRECTOR_GENERAL, RespuestaDirectorGeneralSchema, construirPromptDirectorGeneral, construirPromptDirectorCitando } from "@/app/lib/director/promptDirectorGeneral";
import { ASISTENTE_EVENTO_EQUIPO, type MensajeEquipo } from "@/app/lib/director/mensajeEquipo.schema";
import { obtenerTranscripcionAsistente } from "@/app/lib/director/transcripcionAsistente";

const CANTIDAD_MENSAJES_HISTORIAL = 60;
const CANTIDAD_CONVERSACION_PARA_IA = 20;

type UsuarioEquipo = UsuarioContextoCuenta & { id: string; email: string; rol: string; plan: string; en_trial: boolean; trial_termina_en: string | null; fecha_vencimiento: string | null; beta_autopiloto: boolean };

async function cargarUsuario(email: string): Promise<UsuarioEquipo | null> {
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select(
      "id, rol, plan, en_trial, trial_termina_en, fecha_vencimiento, beta_autopiloto, openai_key, cloudinary_name, cloudinary_key, cloudinary_secret, meta_ad_account_id, meta_ad_account_nombre, meta_user_name, meta_token_expira, meta_page_id, meta_page_name, meta_pixel_id, meta_pixel_nombre, meta_access_token"
    )
    .eq("email", email)
    .single();

  if (!usuario) return null;
  return { ...usuario, email };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await cargarUsuario(session.user.email.trim().toLowerCase());
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (!tieneAutopiloto(usuario)) {
    return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
  }

  // Chat individual de un asistente (Commit 2/5) -- transcripción de
  // SOLO LECTURA asistente→Director, nunca una conversación con el
  // usuario: cada evento real (mensajes_equipo) y cada propuesta suya
  // se parte en dos burbujas, "asistente" (textoInterno / justificación,
  // dirigida al Director) y "director" (su respuesta corta, citando al
  // cliente en tercera persona).
  const parseadoFiltro = ASISTENTE_EVENTO_EQUIPO.safeParse(new URL(req.url).searchParams.get("asistente"));
  if (parseadoFiltro.success) {
    const nombreUsuario = session.user.name?.trim().split(/\s+/)[0] || "tu cliente";
    const transcripcion = await obtenerTranscripcionAsistente(parseadoFiltro.data, usuario.id, nombreUsuario);
    return NextResponse.json({ transcripcion, requiereApiKey: !usuario.openai_key });
  }

  const [pendientes, historialRes, mensajesRes] = await Promise.all([
    obtenerPropuestasPendientes(usuario.id),
    Promise.all([
      supabaseAdmin.from("propuestas").select("*").eq("user_id", usuario.id).neq("estado", "pendiente").order("creado_en", { ascending: false }).limit(50),
      supabaseAdmin.from("bitacora").select("*").eq("user_id", usuario.id).order("creado_en", { ascending: false }).limit(50),
    ]),
    supabaseAdmin.from("mensajes_equipo").select("*").eq("user_id", usuario.id).order("creado_en", { ascending: false }).limit(CANTIDAD_MENSAJES_HISTORIAL),
  ]);

  const [propuestasHistorialRes, bitacoraRes] = historialRes;

  return NextResponse.json({
    pendientes,
    historialPropuestas: propuestasHistorialRes.data ?? [],
    bitacora: bitacoraRes.data ?? [],
    mensajesEquipo: ((mensajesRes.data ?? []) as MensajeEquipo[]).reverse(),
    requiereApiKey: !usuario.openai_key,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const permitido = verificarLimite(`equipo-mensajes:${emailBusqueda}`, 20, 5 * 60 * 1000);
  if (!permitido) {
    return NextResponse.json({ error: "Estás escribiendo muy rápido. Espera un momento e intenta de nuevo." }, { status: 429 });
  }

  const usuario = await cargarUsuario(emailBusqueda);
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (!tieneAutopiloto(usuario)) {
    return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
  }
  if (!usuario.openai_key) {
    return NextResponse.json({ error: "Conecta tu cuenta de OpenAI en Integraciones para escribirle al equipo.", requiereApiKey: true }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const mensaje = typeof body.mensaje === "string" ? body.mensaje.trim() : "";
  if (!mensaje) return NextResponse.json({ error: "El mensaje no puede estar vacío." }, { status: 400 });

  // asistenteCitado: quién mencionó el usuario con @ (si alguien) -- el
  // Director SIEMPRE es quien responde, esto solo decide si lo cita.
  const parseadoCitado = ASISTENTE_EVENTO_EQUIPO.safeParse(body.asistente);
  const asistenteCitado = parseadoCitado.success ? parseadoCitado.data : undefined;

  let apiKey: string;
  try {
    apiKey = desencriptarSiHaceFalta(usuario.openai_key);
  } catch (err) {
    console.error("Error al descifrar openai_key (equipo/mensajes):", err);
    return NextResponse.json({ error: "No se pudo leer tu llave de OpenAI guardada. Vuelve a conectarla en Integraciones.", requiereApiKey: true }, { status: 500 });
  }

  const [contexto, historialPrevio] = await Promise.all([
    obtenerContextoCuenta(usuario),
    supabaseAdmin
      .from("mensajes_equipo")
      .select("tipo_evento, contenido")
      .eq("user_id", usuario.id)
      .in("tipo_evento", ["mensaje_usuario", "respuesta"])
      .order("creado_en", { ascending: false })
      .limit(CANTIDAD_CONVERSACION_PARA_IA),
  ]);

  const systemPrompt = asistenteCitado ? construirPromptDirectorCitando(asistenteCitado, contexto) : construirPromptDirectorGeneral(contexto);

  const historialOpenAI = (historialPrevio.data ?? [])
    .reverse()
    .map((fila) => ({ role: (fila.tipo_evento === "mensaje_usuario" ? "user" : "assistant") as "user" | "assistant", content: (fila.contenido as { texto: string }).texto }));
  historialOpenAI.push({ role: "user", content: mensaje });

  let crudo: unknown;
  try {
    crudo = await llamarDirector(apiKey, MODELO_DIRECTOR_GENERAL, systemPrompt, historialOpenAI);
  } catch (err) {
    console.error("Error llamando al Director (equipo):", err);
    return NextResponse.json({ error: "No se pudo conversar con el equipo en este momento." }, { status: 503 });
  }

  const parseado = RespuestaDirectorGeneralSchema.safeParse(crudo);
  if (!parseado.success) {
    console.error("Respuesta del Director (equipo) con forma inesperada:", crudo);
    return NextResponse.json({ error: "El equipo respondió algo inesperado, intenta de nuevo." }, { status: 503 });
  }

  await supabaseAdmin.from("mensajes_equipo").insert({ user_id: usuario.id, asistente: "director", tipo_evento: "mensaje_usuario", contenido: { texto: mensaje, asistenteCitado } });

  const { data: filaRespuesta } = await supabaseAdmin
    .from("mensajes_equipo")
    .insert({ user_id: usuario.id, asistente: "director", tipo_evento: "respuesta", contenido: { texto: parseado.data.respuesta, acciones: parseado.data.acciones, asistenteCitado } })
    .select("*")
    .single();

  return NextResponse.json({ mensaje: filaRespuesta as MensajeEquipo });
}
