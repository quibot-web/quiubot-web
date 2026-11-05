// Paso 4/6 de la burbuja del Director -- el cerebro general: charla
// libre en la pestaña "Director", usando CONTEXTO DE CUENTA real
// (app/lib/director/contextoCuenta.ts) para responder y sugerir
// acciones. Distinto de /api/metas/conversacion (acotado a llenar el
// borrador de una meta nueva -- ese sigue intacto, esta ruta solo
// ofrece un botón para entrar a él). Mismo modelo/prompt que la Fase 2
// reutilizará para las @menciones del grupo "Equipo".
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarLimite } from "@/lib/rateLimit";
import { obtenerContextoCuenta, type UsuarioContextoCuenta } from "@/app/lib/director/contextoCuenta";
import {
  MODELO_DIRECTOR_GENERAL,
  RespuestaDirectorGeneralSchema,
  construirPromptDirectorGeneral,
  type AccionDirector,
} from "@/app/lib/director/promptDirectorGeneral";

const TIMEOUT_OPENAI_MS = 45_000;
const CANTIDAD_MENSAJES_HISTORIAL = 20;

type MensajeDirectorGeneral = {
  rol: "user" | "assistant";
  mensaje: string;
  acciones?: AccionDirector[];
  creado_en: string;
};

type UsuarioConversacionGeneral = UsuarioContextoCuenta & { email: string };

async function cargarUsuario(email: string): Promise<UsuarioConversacionGeneral | null> {
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select(
      "id, openai_key, cloudinary_name, cloudinary_key, cloudinary_secret, meta_ad_account_id, meta_ad_account_nombre, meta_user_name, meta_token_expira, meta_page_id, meta_page_name, meta_pixel_id, meta_pixel_nombre, meta_access_token"
    )
    .eq("email", email)
    .single();

  if (!usuario) return null;
  return { ...usuario, email };
}

async function obtenerHistorial(userId: string): Promise<MensajeDirectorGeneral[]> {
  const { data } = await supabaseAdmin
    .from("director_conversaciones")
    .select("rol, mensaje, accion, creado_en")
    .eq("user_id", userId)
    .order("creado_en", { ascending: true })
    .limit(CANTIDAD_MENSAJES_HISTORIAL);

  return (data ?? []).map((fila) => ({
    rol: fila.rol,
    mensaje: fila.mensaje,
    acciones: fila.accion ? [fila.accion as AccionDirector] : undefined,
    creado_en: fila.creado_en,
  }));
}

async function llamarDirector(apiKey: string, systemPrompt: string, historial: { role: "user" | "assistant"; content: string }[]): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_OPENAI_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODELO_DIRECTOR_GENERAL,
        messages: [{ role: "system", content: systemPrompt }, ...historial],
        temperature: 0.4,
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
    return JSON.parse(contenido);
  } finally {
    clearTimeout(timeoutId);
  }
}

type ResultadoTurno =
  | { ok: true; mensajeDirector: MensajeDirectorGeneral }
  | { ok: false; error: string };

// Un turno: arma el contexto de cuenta real, llama a la IA, valida con
// zod (nunca confía en que el JSON crudo tenga la forma esperada), y
// guarda ambos mensajes (si hubo mensaje de usuario) en
// director_conversaciones antes de devolver el resultado.
async function ejecutarTurno(params: {
  usuario: UsuarioConversacionGeneral;
  apiKey: string;
  historialActual: MensajeDirectorGeneral[];
  mensajeUsuario: string | null;
}): Promise<ResultadoTurno> {
  const { usuario, apiKey, historialActual, mensajeUsuario } = params;

  const contexto = await obtenerContextoCuenta(usuario);
  const systemPrompt = construirPromptDirectorGeneral(contexto);
  const historialOpenAI: { role: "user" | "assistant"; content: string }[] = historialActual.map((m) => ({
    role: m.rol,
    content: m.mensaje,
  }));
  if (mensajeUsuario) historialOpenAI.push({ role: "user", content: mensajeUsuario });

  let crudo: unknown;
  try {
    crudo = await llamarDirector(apiKey, systemPrompt, historialOpenAI);
  } catch (err) {
    console.error("Error llamando al Director (general):", err);
    return { ok: false, error: "No se pudo conversar con el Director en este momento." };
  }

  const parseado = RespuestaDirectorGeneralSchema.safeParse(crudo);
  if (!parseado.success) {
    console.error("Respuesta del Director (general) con forma inesperada:", crudo);
    return { ok: false, error: "El Director respondió algo inesperado, intenta de nuevo." };
  }

  const ahora = new Date().toISOString();

  if (mensajeUsuario) {
    await supabaseAdmin.from("director_conversaciones").insert({ user_id: usuario.id, rol: "user", mensaje: mensajeUsuario, creado_en: ahora });
  }

  // Solo se guarda la primera acción -- la columna es una sola fila
  // jsonb, no un arreglo; en la práctica el prompt ya pide máximo 3 pero
  // la UI de esta primera versión solo necesita la principal.
  const accionPrincipal = parseado.data.acciones?.[0] ?? null;
  const { data: filaGuardada } = await supabaseAdmin
    .from("director_conversaciones")
    .insert({ user_id: usuario.id, rol: "assistant", mensaje: parseado.data.respuesta, accion: accionPrincipal })
    .select("creado_en")
    .single();

  return {
    ok: true,
    mensajeDirector: {
      rol: "assistant",
      mensaje: parseado.data.respuesta,
      acciones: parseado.data.acciones,
      creado_en: filaGuardada?.creado_en ?? ahora,
    },
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await cargarUsuario(session.user.email.trim().toLowerCase());
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (!usuario.openai_key) {
    return NextResponse.json({ activo: false, requiereApiKey: true });
  }

  const historial = await obtenerHistorial(usuario.id);

  if (historial.length > 0) {
    return NextResponse.json({ activo: true, mensajes: historial });
  }

  // Primera vez que se abre esta conversación -- se genera el saludo
  // inicial ya mismo, para que la pestaña Director nunca se vea vacía.
  let apiKey: string;
  try {
    apiKey = desencriptarSiHaceFalta(usuario.openai_key);
  } catch (err) {
    console.error("Error al descifrar openai_key (director/conversacion):", err);
    return NextResponse.json({ activo: false, requiereApiKey: true });
  }

  const resultado = await ejecutarTurno({ usuario, apiKey, historialActual: [], mensajeUsuario: null });

  if (!resultado.ok) {
    return NextResponse.json({ activo: true, mensajes: [], errorOpenAI: true, errorMensaje: resultado.error });
  }

  return NextResponse.json({ activo: true, mensajes: [resultado.mensajeDirector] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const emailBusqueda = session.user.email.trim().toLowerCase();

  const permitido = verificarLimite(`director-conversacion:${emailBusqueda}`, 20, 5 * 60 * 1000);
  if (!permitido) {
    return NextResponse.json({ error: "Estás escribiendo muy rápido. Espera un momento e intenta de nuevo." }, { status: 429 });
  }

  const usuario = await cargarUsuario(emailBusqueda);
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (!usuario.openai_key) {
    return NextResponse.json(
      { error: "Conecta tu cuenta de OpenAI en Integraciones para hablar con el Director.", requiereApiKey: true },
      { status: 400 }
    );
  }

  const { mensaje } = await req.json().catch(() => ({ mensaje: null }));
  if (typeof mensaje !== "string" || !mensaje.trim()) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío." }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = desencriptarSiHaceFalta(usuario.openai_key);
  } catch (err) {
    console.error("Error al descifrar openai_key (director/conversacion):", err);
    return NextResponse.json(
      { error: "No se pudo leer tu llave de OpenAI guardada. Vuelve a conectarla en Integraciones.", requiereApiKey: true },
      { status: 500 }
    );
  }

  const historialActual = await obtenerHistorial(usuario.id);
  const resultado = await ejecutarTurno({ usuario, apiKey, historialActual, mensajeUsuario: mensaje.trim() });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 503 });
  }

  return NextResponse.json({ mensajeDirector: resultado.mensajeDirector });
}
