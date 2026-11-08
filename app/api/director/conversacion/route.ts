// Paso 4/6 de la burbuja del Director -- el cerebro general: charla
// libre en la pestaña "Director", usando CONTEXTO DE CUENTA real
// (app/lib/director/contextoCuenta.ts) para responder y sugerir
// acciones. Chat único (ver app/lib/director/flujoCrearMeta.ts): cuando
// la intención es "crear_meta", esta misma ruta delega ahí en vez de
// usar el prompt general -- los turnos de ambos flujos quedan en el
// MISMO hilo de director_conversaciones, nunca en pantallas distintas.
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarLimite } from "@/lib/rateLimit";
import { obtenerContextoCuenta, type UsuarioContextoCuenta } from "@/app/lib/director/contextoCuenta";
import { llamarDirector } from "@/app/lib/director/llamarDirector";
import {
  MODELO_DIRECTOR_GENERAL,
  RespuestaDirectorGeneralSchema,
  construirPromptDirectorGeneral,
  type AccionDirector,
} from "@/app/lib/director/promptDirectorGeneral";
import {
  obtenerBorradorActivo,
  ejecutarTurnoMeta,
  construirContextoNegocio,
  migrarMensajesViejosSiHaceFalta,
  type ContenidoMeta,
} from "@/app/lib/director/flujoCrearMeta";

const CANTIDAD_MENSAJES_HISTORIAL = 20;

type MensajeDirectorGeneral = {
  rol: "user" | "assistant";
  mensaje: string;
  acciones?: AccionDirector[];
  contenido?: ContenidoMeta | null;
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

// ascending+limit(20) dejaría siempre los 20 PRIMEROS mensajes del
// historial (nunca los recientes) apenas alguien pase de esa cantidad
// -- con el flujo de crear meta compartiendo ahora esta misma tabla,
// eso sí puede pasar en la práctica. Se pide descendente y se invierte
// acá para quedarnos con los últimos N en orden cronológico.
async function obtenerHistorial(userId: string): Promise<MensajeDirectorGeneral[]> {
  const { data } = await supabaseAdmin
    .from("director_conversaciones")
    .select("rol, mensaje, accion, contenido, creado_en")
    .eq("user_id", userId)
    .order("creado_en", { ascending: false })
    .limit(CANTIDAD_MENSAJES_HISTORIAL);

  return (data ?? [])
    .map((fila) => ({
      rol: fila.rol,
      mensaje: fila.mensaje,
      acciones: fila.accion ? [fila.accion as AccionDirector] : undefined,
      contenido: (fila.contenido as ContenidoMeta | null) ?? undefined,
      creado_en: fila.creado_en,
    }))
    .reverse();
}

async function obtenerIdBorradorActivo(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("conversaciones_meta").select("id").eq("user_id", userId).eq("estado", "activa").maybeSingle();
  if (data) await migrarMensajesViejosSiHaceFalta(data.id, userId);
  return data?.id ?? null;
}

type ResultadoTurno = { ok: true; mensajeDirector: MensajeDirectorGeneral } | { ok: false; error: string };

// Un turno del chat general: arma el contexto de cuenta real, llama a
// la IA, valida con zod (nunca confía en que el JSON crudo tenga la
// forma esperada), y guarda ambos mensajes (si hubo mensaje de usuario)
// en director_conversaciones antes de devolver el resultado.
async function ejecutarTurnoGeneral(params: {
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
    crudo = await llamarDirector(apiKey, MODELO_DIRECTOR_GENERAL, systemPrompt, historialOpenAI);
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

  const [historial, conversacionMetaId] = await Promise.all([obtenerHistorial(usuario.id), obtenerIdBorradorActivo(usuario.id)]);

  if (historial.length > 0) {
    return NextResponse.json({ activo: true, mensajes: historial, metaActiva: conversacionMetaId ? { conversacionId: conversacionMetaId } : null });
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

  const resultado = await ejecutarTurnoGeneral({ usuario, apiKey, historialActual: [], mensajeUsuario: null });

  if (!resultado.ok) {
    return NextResponse.json({ activo: true, mensajes: [], metaActiva: null, errorOpenAI: true, errorMensaje: resultado.error });
  }

  return NextResponse.json({ activo: true, mensajes: [resultado.mensajeDirector], metaActiva: conversacionMetaId ? { conversacionId: conversacionMetaId } : null });
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

  const { mensaje, intencion } = await req.json().catch(() => ({ mensaje: null, intencion: null }));
  const mensajeTexto = typeof mensaje === "string" && mensaje.trim() ? mensaje.trim() : null;

  if (intencion !== "crear_meta" && !mensajeTexto) {
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

  if (intencion === "crear_meta") {
    const { id: conversacionId } = await obtenerBorradorActivo(usuario.id);
    const contextoNegocio = await construirContextoNegocio(usuario);
    const resultado = await ejecutarTurnoMeta({ usuario, apiKey, conversacionId, contextoNegocio, mensajeUsuario: mensajeTexto });

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: 503 });
    }

    return NextResponse.json({
      mensajeDirector: { rol: resultado.fila.rol, mensaje: resultado.fila.mensaje, contenido: resultado.fila.contenido, creado_en: resultado.fila.creado_en },
    });
  }

  const historialActual = await obtenerHistorial(usuario.id);
  const resultado = await ejecutarTurnoGeneral({ usuario, apiKey, historialActual, mensajeUsuario: mensajeTexto });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 503 });
  }

  return NextResponse.json({ mensajeDirector: resultado.mensajeDirector });
}
