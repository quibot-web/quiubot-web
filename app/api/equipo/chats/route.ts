// Fase 2, Commit 5 -- lista de chats estilo WhatsApp
// (docs/diseno/director_lista_chats.html): Equipo, Director, cada
// asistente con chat propio, Soporte. GET trae la última vista previa
// y el contador de no leídos por chat (chats_equipo_leido). POST marca
// uno como leído (se llama al abrirlo).
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { CHATS_EQUIPO, type ChatEquipoId } from "@/app/lib/director/chatsEquipo";

const EPOCA = new Date(0).toISOString();

type Previa = { texto: string; creadoEn: string } | null;

async function cargarUsuarioId(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("usuarios").select("id").eq("email", email).single();
  return data?.id ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = await cargarUsuarioId(session.user.email.trim().toLowerCase());
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const [leidosRes, mensajesEquipoRes, propuestasRes, directorRes, soporteRes] = await Promise.all([
    supabaseAdmin.from("chats_equipo_leido").select("chat, ultimo_leido_en").eq("user_id", userId),
    supabaseAdmin.from("mensajes_equipo").select("asistente, tipo_evento, contenido, creado_en").eq("user_id", userId).order("creado_en", { ascending: false }).limit(200),
    // Vista previa/no-leídos de los 6 asistentes también salen de
    // propuestas -- es la única fuente real que tienen Marca/Estratega/
    // Publicador hoy (sus otras fuentes, estrategias_jobs/
    // campanas_publicadas/errores_publicacion, solo se leen en la
    // transcripción completa del chat, no en este resumen de la lista).
    supabaseAdmin.from("propuestas").select("asistente, titulo, estado, creado_en, decidido_en").eq("user_id", userId).order("creado_en", { ascending: false }).limit(200),
    supabaseAdmin.from("director_conversaciones").select("rol, mensaje, creado_en").eq("user_id", userId).order("creado_en", { ascending: false }).limit(50),
    supabaseAdmin.from("asistente_conversaciones").select("rol, mensaje, creado_en").eq("user_id", userId).order("creado_en", { ascending: false }).limit(50),
  ]);

  const leidoPorChat = new Map<ChatEquipoId, string>();
  for (const fila of leidosRes.data ?? []) leidoPorChat.set(fila.chat as ChatEquipoId, fila.ultimo_leido_en);

  const mensajesEquipo = mensajesEquipoRes.data ?? [];
  const propuestas = propuestasRes.data ?? [];

  function resumenAsistente(asistente: string, chat: ChatEquipoId): { previa: Previa; noLeidos: number } {
    const eventos = mensajesEquipo.filter((m) => m.asistente === asistente).map((m) => ({ texto: (m.contenido as { texto: string }).texto, creadoEn: m.creado_en, esDelUsuario: m.tipo_evento === "mensaje_usuario" }));
    const suyas = propuestas
      .filter((p) => p.asistente === asistente)
      .map((p) => ({ texto: p.titulo as string, creadoEn: (p.decidido_en as string | null) ?? (p.creado_en as string), esDelUsuario: false }));

    const todas = [...eventos, ...suyas].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
    const previa = todas[0] ? { texto: todas[0].texto, creadoEn: todas[0].creadoEn } : null;
    const leido = leidoPorChat.get(chat) ?? EPOCA;
    const noLeidos = todas.filter((t) => !t.esDelUsuario && t.creadoEn > leido).length;
    return { previa, noLeidos };
  }

  function resumenFilas(filas: { rol: string; mensaje: string; creado_en: string }[] | null, chat: ChatEquipoId): { previa: Previa; noLeidos: number } {
    const lista = filas ?? [];
    const previa = lista[0] ? { texto: lista[0].mensaje, creadoEn: lista[0].creado_en } : null;
    const leido = leidoPorChat.get(chat) ?? EPOCA;
    const noLeidos = lista.filter((f) => f.rol === "assistant" && f.creado_en > leido).length;
    return { previa, noLeidos };
  }

  function resumenEquipo(): { previa: Previa; noLeidos: number } {
    const previa = mensajesEquipo[0] ? { texto: (mensajesEquipo[0].contenido as { texto: string }).texto, creadoEn: mensajesEquipo[0].creado_en } : null;
    const leido = leidoPorChat.get("equipo") ?? EPOCA;
    const noLeidos = mensajesEquipo.filter((m) => m.tipo_evento !== "mensaje_usuario" && m.creado_en > leido).length;
    return { previa, noLeidos };
  }

  const resultado: Record<ChatEquipoId, { previa: Previa; noLeidos: number }> = {
    equipo: resumenEquipo(),
    director: resumenFilas(directorRes.data, "director"),
    marca: resumenAsistente("marca", "marca"),
    estratega: resumenAsistente("estratega", "estratega"),
    creativo: resumenAsistente("creativo", "creativo"),
    publicador: resumenAsistente("publicador", "publicador"),
    analista: resumenAsistente("analista", "analista"),
    optimizador: resumenAsistente("optimizador", "optimizador"),
    soporte: resumenFilas(soporteRes.data, "soporte"),
  };

  return NextResponse.json({ chats: resultado });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = await cargarUsuarioId(session.user.email.trim().toLowerCase());
  if (!userId) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { chat } = await req.json().catch(() => ({ chat: null }));
  if (!CHATS_EQUIPO.includes(chat)) return NextResponse.json({ error: "Chat inválido." }, { status: 400 });

  await supabaseAdmin.from("chats_equipo_leido").upsert({ user_id: userId, chat, ultimo_leido_en: new Date().toISOString() }, { onConflict: "user_id,chat" });

  return NextResponse.json({ ok: true });
}
