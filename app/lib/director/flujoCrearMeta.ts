// Chat único con el Director -- antes /api/metas/conversacion tenía su
// propia tabla de mensajes (conversaciones_meta.mensajes, un array
// jsonb aparte). Ahora los turnos de este flujo son filas normales de
// director_conversaciones (el mismo hilo que el resto del chat del
// Director), usando conversacion_meta_id para saber cuáles pertenecen
// a este borrador y contenido (jsonb) para llevar lo que no es texto
// plano: opciones, el botón de requisito faltante, y el resumen final.
// conversaciones_meta sigue siendo la única fuente de verdad del
// borrador y del estado (activa/completada/abandonada) -- esto no
// cambia esa parte de la lógica vieja, solo DÓNDE queda el transcript.
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";
import { llamarDirector } from "@/app/lib/director/llamarDirector";
import { hoyBogota } from "@/app/lib/fechaBogota";
import {
  calcularCostoReferencia,
  calcularRangoResultados,
  verificarRequisitosMeta,
  TASA_CIERRE_POR_CATEGORIA,
  type RequisitoFaltante,
  type RangoResultados,
  type UsuarioParaRequisitos,
} from "@/app/lib/metas";
import { BorradorMetaSchema, BorradorMetaListoSchema, PLAZO_DIAS_DEFECTO, type BorradorMeta, type BorradorMetaListo } from "@/app/lib/director/borradorMeta.schema";
import { construirPromptMetaConversacion, type ContextoNegocioDirector } from "@/app/lib/director/promptMetaConversacion";

const MODELO_DIRECTOR_META = "gpt-4o";

// ADN + cobertura + meta anterior -- lo que ya sabemos del negocio para
// no preguntarlo de nuevo (ver promptMetaConversacion.ts). Movido tal
// cual desde /api/metas/conversacion.
export async function construirContextoNegocio(usuario: { id: string; email: string }): Promise<ContextoNegocioDirector> {
  const [{ data: marca }, { data: metaAnterior }] = await Promise.all([
    supabaseAdmin.from("marcas").select("adn_marca, nombre_marca, ciudades_cobertura, pais_cobertura").eq("email", usuario.email).maybeSingle(),
    supabaseAdmin
      .from("metas")
      .select("tipo, cantidad_objetivo, presupuesto_maximo_cop")
      .eq("user_id", usuario.id)
      .neq("estado", "activa")
      .order("actualizado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const adn = (marca?.adn_marca as { titular?: string | null; frase_corta?: string | null } | null) ?? null;

  return {
    nombreNegocio: marca?.nombre_marca ?? null,
    adnTitular: adn?.titular ?? null,
    adnFraseCorta: adn?.frase_corta ?? null,
    paisCobertura: marca?.pais_cobertura || "CO",
    ciudadesCobertura: Array.isArray(marca?.ciudades_cobertura) ? marca.ciudades_cobertura : [],
    metaAnteriorResumen: metaAnterior
      ? `${metaAnterior.cantidad_objetivo} de tipo "${metaAnterior.tipo}" con presupuesto de ${metaAnterior.presupuesto_maximo_cop} COP`
      : null,
  };
}

export type ResumenMetaListo = {
  borrador: BorradorMetaListo;
  fechaFin: string;
  rango: RangoResultados;
};

// Lo que lleva la fila de director_conversaciones cuando es parte de
// este flujo -- null/undefined en cualquier otro mensaje del chat.
export type ContenidoMeta = {
  opciones?: string[];
  accionMeta?: { label: string; href: string };
  resumen?: ResumenMetaListo;
  // "meta_creada" lo pone crear_meta_completa(); "meta_evento" lo pone
  // cambiar_estado_meta() (pausar/reanudar/cancelar/vencer/cumplir/
  // editar presupuesto) -- ver docs/sql/metas_atomicas.sql. Ambos traen
  // metaId: la tarjeta viva del chat (TarjetaMetaViva) se dispara con
  // cualquiera de los dos, nunca con texto/números fijos.
  tipoEvento?: "meta_creada" | "meta_evento";
  metaId?: string;
  // Progreso aproximado para la barra de pasos -- igual que antes, por
  // campos llenos, no una máquina de estados (el Director puede saltar
  // según lo que el cliente ya contó).
  pasos?: boolean[];
};

export type FilaHiloMeta = {
  id: string;
  rol: "user" | "assistant";
  mensaje: string;
  contenido: ContenidoMeta | null;
  creado_en: string;
};

const RespuestaDirectorSchema = z.object({
  respuesta: z.string().min(1),
  opciones: z.array(z.string().min(1)).max(6).optional(),
  borrador_parcial: z.record(z.string(), z.unknown()).optional(),
  fuera_de_tema: z.boolean().optional(),
  listo_para_resumen: z.boolean().optional(),
});

const NOMBRE_CAMPO: Record<string, string> = {
  tipo: "qué quieres lograr",
  producto: "el producto o servicio",
  presupuesto_cop: "el presupuesto",
  plazo_dias: "el plazo",
  tasa_cierre_categoria: "cuántos de los que te escriben compran",
  precio_cop: "el precio",
  usuario_cta: "tu usuario de Instagram",
};

function calcularFechaFin(plazoDias: number): string {
  const hoy = hoyBogota();
  const fecha = new Date(`${hoy}T00:00:00-05:00`);
  fecha.setDate(fecha.getDate() + plazoDias);
  return fecha.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

type MensajeViejo = { rol: "director" | "usuario"; texto: string; opciones?: string[]; accion?: { label: string; href: string }; creado_en: string };

// Una sola vez: si la conversación activa todavía tiene mensajes en el
// array viejo (de antes de este cambio) y nunca se copiaron, los pasa a
// director_conversaciones -- así nadie pierde una conversación de meta
// que haya quedado a mitad de camino en el momento del deploy.
export async function migrarMensajesViejosSiHaceFalta(conversacionId: string, userId: string): Promise<void> {
  const { data: conversacion } = await supabaseAdmin
    .from("conversaciones_meta")
    .select("mensajes")
    .eq("id", conversacionId)
    .maybeSingle();

  const mensajesViejos = (conversacion?.mensajes as MensajeViejo[] | null) ?? [];
  if (mensajesViejos.length === 0) return;

  const { count } = await supabaseAdmin
    .from("director_conversaciones")
    .select("id", { count: "exact", head: true })
    .eq("conversacion_meta_id", conversacionId);
  if ((count ?? 0) > 0) return; // ya se copiaron antes

  const filas = mensajesViejos.map((m) => ({
    user_id: userId,
    rol: m.rol === "director" ? ("assistant" as const) : ("user" as const),
    mensaje: m.texto,
    contenido: m.opciones || m.accion ? { opciones: m.opciones, accionMeta: m.accion } : null,
    conversacion_meta_id: conversacionId,
    creado_en: m.creado_en,
  }));

  await supabaseAdmin.from("director_conversaciones").insert(filas);
  // Vacía el array viejo para no volver a copiarlo si este chequeo
  // corre de nuevo antes de que el insert anterior alcance a verse.
  await supabaseAdmin.from("conversaciones_meta").update({ mensajes: [] }).eq("id", conversacionId);
}

// Trae (o crea) la conversación de meta activa del usuario, migrando
// sus mensajes viejos si hace falta.
export async function obtenerBorradorActivo(userId: string): Promise<{ id: string; borrador: BorradorMeta }> {
  const { data: existente } = await supabaseAdmin
    .from("conversaciones_meta")
    .select("id, borrador")
    .eq("user_id", userId)
    .eq("estado", "activa")
    .maybeSingle();

  if (existente) {
    await migrarMensajesViejosSiHaceFalta(existente.id, userId);
    return { id: existente.id, borrador: (existente.borrador as BorradorMeta) ?? {} };
  }

  const { data: nueva, error } = await supabaseAdmin
    .from("conversaciones_meta")
    .insert({ user_id: userId, estado: "activa", borrador: {}, mensajes: [] })
    .select("id, borrador")
    .single();
  if (error || !nueva) throw new Error("No se pudo iniciar la conversación de meta.");
  return { id: nueva.id, borrador: (nueva.borrador as BorradorMeta) ?? {} };
}

export async function obtenerHiloMeta(conversacionId: string): Promise<FilaHiloMeta[]> {
  const { data } = await supabaseAdmin
    .from("director_conversaciones")
    .select("id, rol, mensaje, contenido, creado_en")
    .eq("conversacion_meta_id", conversacionId)
    .order("creado_en", { ascending: true });

  return (data ?? []).map((f) => ({ id: f.id, rol: f.rol, mensaje: f.mensaje, contenido: (f.contenido as ContenidoMeta | null) ?? null, creado_en: f.creado_en }));
}

type ResultadoTurnoMeta = { ok: true; fila: FilaHiloMeta; borrador: BorradorMeta } | { ok: false; error: string; borrador: BorradorMeta };

// Un turno completo del flujo "crear meta", ahora escribiendo en
// director_conversaciones (conversacion_meta_id = esta conversación) en
// vez del array mensajes de conversaciones_meta -- misma lógica de
// validación/simulación que tenía /api/metas/conversacion.
export async function ejecutarTurnoMeta(params: {
  usuario: UsuarioParaRequisitos;
  apiKey: string;
  conversacionId: string;
  contextoNegocio: ContextoNegocioDirector;
  mensajeUsuario: string | null;
}): Promise<ResultadoTurnoMeta> {
  const { usuario, apiKey, conversacionId, contextoNegocio, mensajeUsuario } = params;

  const { data: conversacionActual } = await supabaseAdmin.from("conversaciones_meta").select("borrador").eq("id", conversacionId).single();
  const borradorActual = (conversacionActual?.borrador as BorradorMeta) ?? {};

  const hiloActual = await obtenerHiloMeta(conversacionId);
  const systemPrompt = construirPromptMetaConversacion(contextoNegocio, borradorActual);
  const historialOpenAI: { role: "user" | "assistant"; content: string }[] = hiloActual.map((m) => ({ role: m.rol, content: m.mensaje }));
  if (mensajeUsuario) historialOpenAI.push({ role: "user", content: mensajeUsuario });

  let crudo: unknown;
  try {
    crudo = await llamarDirector(apiKey, MODELO_DIRECTOR_META, systemPrompt, historialOpenAI);
  } catch (err) {
    console.error("Error llamando al Director (metas):", err);
    return { ok: false, error: "No se pudo conversar con el Director en este momento.", borrador: borradorActual };
  }

  const parseado = RespuestaDirectorSchema.safeParse(crudo);
  if (!parseado.success) {
    console.error("Respuesta del Director con forma inesperada:", crudo);
    return { ok: false, error: "El Director respondió algo inesperado, intenta de nuevo.", borrador: borradorActual };
  }

  const parcial = parseado.data.borrador_parcial ? BorradorMetaSchema.safeParse(parseado.data.borrador_parcial) : null;
  const borradorNuevo: BorradorMeta = { ...borradorActual, ...(parcial?.success ? parcial.data : {}) };

  let textoDirector = parseado.data.respuesta;
  let opcionesDirector = parseado.data.opciones;
  let accionDirector: { label: string; href: string } | undefined;
  let resumen: ResumenMetaListo | undefined;

  if (parseado.data.listo_para_resumen) {
    const borradorConPlazo: BorradorMeta = { ...borradorNuevo, plazo_dias: borradorNuevo.plazo_dias ?? PLAZO_DIAS_DEFECTO };
    const listo = BorradorMetaListoSchema.safeParse(borradorConPlazo);

    if (!listo.success) {
      const camposFaltantes = [...new Set(listo.error.issues.map((i) => NOMBRE_CAMPO[String(i.path[0])] || String(i.path[0])))];
      textoDirector = `Me falta ${camposFaltantes.join(", ")} antes de poder armar el resumen -- ¿me cuentas?`;
      opcionesDirector = undefined;
    } else {
      const fechaFin = calcularFechaFin(listo.data.plazo_dias);
      const resultadoRequisitos = await verificarRequisitosMeta({ tipo: listo.data.tipo, usuario, fechaFin });

      if (!resultadoRequisitos.ok) {
        textoDirector = resultadoRequisitos.faltantes.map((f: RequisitoFaltante) => f.mensaje).join(" ");
        opcionesDirector = undefined;
        accionDirector = resultadoRequisitos.faltantes.find((f) => f.accion)?.accion;
      } else {
        const costoReferencia = await calcularCostoReferencia(listo.data.tipo, usuario.id);
        const tasaCierre =
          listo.data.tipo === "conversaciones_whatsapp" || listo.data.tipo === "leads" ? TASA_CIERRE_POR_CATEGORIA[listo.data.tasa_cierre_categoria] : undefined;
        const rango = calcularRangoResultados(listo.data.presupuesto_cop, costoReferencia, tasaCierre);

        textoDirector = "¡Listo! Mira cómo quedaría. Si algo no te cuadra, dímelo y lo cambio.";
        opcionesDirector = undefined;
        resumen = { borrador: listo.data, fechaFin, rango };
      }
    }
  }

  const ahora = new Date().toISOString();
  if (mensajeUsuario) {
    await supabaseAdmin.from("director_conversaciones").insert({ user_id: usuario.id, rol: "user", mensaje: mensajeUsuario, conversacion_meta_id: conversacionId, creado_en: ahora });
  }

  const pasos = [!!borradorNuevo.tipo, !!borradorNuevo.producto, !!borradorNuevo.presupuesto_cop, !!resumen];
  const contenido: ContenidoMeta = { opciones: opcionesDirector, accionMeta: accionDirector, resumen, pasos };

  const { data: filaGuardada } = await supabaseAdmin
    .from("director_conversaciones")
    .insert({ user_id: usuario.id, rol: "assistant", mensaje: textoDirector, contenido, conversacion_meta_id: conversacionId })
    .select("id, creado_en")
    .single();

  await supabaseAdmin.from("conversaciones_meta").update({ borrador: borradorNuevo, actualizado_en: ahora }).eq("id", conversacionId);

  return {
    ok: true,
    borrador: borradorNuevo,
    fila: { id: filaGuardada?.id ?? "", rol: "assistant", mensaje: textoDirector, contenido, creado_en: filaGuardada?.creado_en ?? ahora },
  };
}
