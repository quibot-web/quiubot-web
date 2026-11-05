// Fase 2, Commit 3 -- agrega el "trabajo real" de Estratega y
// Publicador a la transcripción de solo lectura de su chat individual
// (Commit 2 ya cubre Analista/Creativo/Optimizador vía mensajes_equipo
// + propuestas, que siguen sirviendo acá sin cambios). Mismo criterio:
// plantillas sobre datos reales, sin IA, asistente→Director→(cita al
// cliente). Marca queda fuera por ahora -- su evento se materializa en
// un commit aparte.
import { supabaseAdmin } from "@/lib/supabase";
import { OBJETIVOS_INFO } from "@/app/lib/objetivosInfo";
import { textoAsistenteReportaPropuesta, textoDirectorResponde } from "@/app/lib/directorChat";
import type { MensajeEquipo, AsistenteEventoEquipo } from "@/app/lib/director/mensajeEquipo.schema";

export type ItemTranscripcion = {
  id: string;
  rol: "asistente" | "director";
  texto: string;
  datos?: { etiqueta: string; valor: string }[];
  miniaturas?: string[];
  enlaceCampanaId?: string;
  creadoEn: string;
};

const LABEL_OBJETIVO: Record<string, string> = Object.fromEntries(OBJETIVOS_INFO.map((o) => [o.id, o.label]));
const LIMITE = 20;

async function itemsEventos(asistente: AsistenteEventoEquipo, userId: string): Promise<ItemTranscripcion[]> {
  const { data } = await supabaseAdmin.from("mensajes_equipo").select("*").eq("user_id", userId).eq("asistente", asistente).order("creado_en", { ascending: false }).limit(60);

  return ((data ?? []) as MensajeEquipo[]).flatMap((m): ItemTranscripcion[] => [
    { id: `${m.id}-a`, rol: "asistente", texto: m.contenido.textoInterno ?? m.contenido.texto, datos: m.contenido.datos, miniaturas: m.contenido.miniaturas, creadoEn: m.creado_en },
    ...(m.contenido.respuestaDirector ? [{ id: `${m.id}-d`, rol: "director" as const, texto: m.contenido.respuestaDirector, creadoEn: m.creado_en }] : []),
  ]);
}

async function itemsPropuestas(asistente: AsistenteEventoEquipo, userId: string, nombreUsuario: string): Promise<ItemTranscripcion[]> {
  const { data } = await supabaseAdmin.from("propuestas").select("*").eq("user_id", userId).eq("asistente", asistente).order("creado_en", { ascending: false }).limit(LIMITE);

  return (data ?? []).flatMap((p): ItemTranscripcion[] => [
    { id: `${p.id}-a`, rol: "asistente", texto: textoAsistenteReportaPropuesta(p.justificacion), creadoEn: p.creado_en },
    { id: `${p.id}-d`, rol: "director", texto: textoDirectorResponde(p.estado, nombreUsuario, (p.resultado as { error?: string } | null)?.error ?? null), creadoEn: p.decidido_en ?? p.creado_en },
  ]);
}

// Estrategias generadas (estrategias_jobs.resultado.campanas[].campana,
// {nombre, objetivo_meta} -- confirmado en publicarEstrategiaJobs.ts,
// que lee esos mismos campos para publicar la campaña real). No tiene
// un "estado decidido" como las propuestas -- el Director solo acusa
// recibo, nunca cita al cliente aprobando/rechazando algo que no pasó
// por esa conversación.
async function itemsEstratega(userId: string): Promise<ItemTranscripcion[]> {
  const { data } = await supabaseAdmin.from("estrategias_jobs").select("id, resultado, creado_en").eq("user_id", userId).eq("estado", "lista").order("creado_en", { ascending: false }).limit(LIMITE);

  return (data ?? []).flatMap((job): ItemTranscripcion[] => {
    const campanas = ((job.resultado as { campanas?: { campana?: { nombre?: string; objetivo_meta?: string } }[] } | null)?.campanas ?? []).map((c) => c.campana).filter((c): c is { nombre?: string; objetivo_meta?: string } => !!c);
    if (campanas.length === 0) return [];

    const nombres = campanas.map((c) => c.nombre).filter(Boolean).join(", ");
    const objetivos = [...new Set(campanas.map((c) => (c.objetivo_meta ? LABEL_OBJETIVO[c.objetivo_meta] ?? c.objetivo_meta : null)).filter(Boolean))].join(", ");
    const cantidad = campanas.length === 1 ? "una estrategia nueva" : `${campanas.length} estrategias nuevas`;
    const texto = `Director, armé ${cantidad}: ${nombres}${objetivos ? ` (objetivo: ${objetivos})` : ""}.`;

    return [
      { id: `ej-${job.id}-a`, rol: "asistente", texto, creadoEn: job.creado_en },
      { id: `ej-${job.id}-d`, rol: "director", texto: "Perfecto, quedan listas para revisar.", creadoEn: job.creado_en },
    ];
  });
}

// Campañas publicadas (con enlace real a /campanas) y errores reales
// de publicación (errores_publicacion, tabla general de errores --
// lib/registrarError.ts -- filtrada a origen:"publicar_estrategia").
async function itemsPublicador(userId: string): Promise<ItemTranscripcion[]> {
  const [campanasRes, erroresRes] = await Promise.all([
    supabaseAdmin.from("campanas_publicadas").select("id, nombre, creado_en").eq("user_id", userId).order("creado_en", { ascending: false }).limit(LIMITE),
    supabaseAdmin.from("errores_publicacion").select("id, error_mensaje, campana_nombre, creado_en").eq("user_id", userId).eq("origen", "publicar_estrategia").order("creado_en", { ascending: false }).limit(LIMITE),
  ]);

  const publicadas = (campanasRes.data ?? []).flatMap((c): ItemTranscripcion[] => [
    { id: `cp-${c.id}-a`, rol: "asistente", texto: `Director, ya publiqué la campaña "${c.nombre}".`, creadoEn: c.creado_en },
    { id: `cp-${c.id}-d`, rol: "director", texto: "Perfecto, gracias.", enlaceCampanaId: c.id, creadoEn: c.creado_en },
  ]);

  const errores = (erroresRes.data ?? []).flatMap((e): ItemTranscripcion[] => [
    { id: `ep-${e.id}-a`, rol: "asistente", texto: `Director, tuve un problema publicando${e.campana_nombre ? ` "${e.campana_nombre}"` : ""}: ${e.error_mensaje}`, creadoEn: e.creado_en },
    { id: `ep-${e.id}-d`, rol: "director", texto: "Gracias por avisar, lo reviso.", creadoEn: e.creado_en },
  ]);

  return [...publicadas, ...errores];
}

export async function obtenerTranscripcionAsistente(asistente: AsistenteEventoEquipo, userId: string, nombreUsuario: string): Promise<ItemTranscripcion[]> {
  const extra = asistente === "estratega" ? await itemsEstratega(userId) : asistente === "publicador" ? await itemsPublicador(userId) : [];

  const [eventos, propuestas] = await Promise.all([itemsEventos(asistente, userId), itemsPropuestas(asistente, userId, nombreUsuario)]);

  return [...eventos, ...propuestas, ...extra].sort((a, b) => (a.creadoEn < b.creadoEn ? -1 : 1));
}
