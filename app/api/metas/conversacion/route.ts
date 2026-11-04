import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarLimite } from "@/lib/rateLimit";
import {
  calcularCostoReferencia,
  calcularRangoResultados,
  verificarRequisitosMeta,
  TASA_CIERRE_POR_CATEGORIA,
  type RequisitoFaltante,
  type RangoResultados,
} from "@/app/lib/metas";
import { hoyBogota } from "@/app/lib/fechaBogota";
import { BorradorMetaSchema, BorradorMetaListoSchema, PLAZO_DIAS_DEFECTO, type BorradorMeta, type BorradorMetaListo } from "@/app/lib/director/borradorMeta.schema";
import { construirPromptMetaConversacion, type ContextoNegocioDirector } from "@/app/lib/director/promptMetaConversacion";

// Mismo modelo para todos los turnos de esta conversación (decisión del
// plan) -- gpt-4o, no el mini que usa el asistente de soporte: esta
// conversación necesita extraer datos estructurados de forma confiable
// turno a turno, no solo responder preguntas de un documento.
const MODELO_DIRECTOR_META = "gpt-4o";
const TIMEOUT_OPENAI_MS = 45_000;

type MensajeDirector = {
  rol: "director" | "usuario";
  texto: string;
  opciones?: string[];
  creado_en: string;
};

type UsuarioConversacion = {
  id: string;
  email: string;
  meta_page_id: string | null;
  meta_access_token: string | null;
  meta_pixel_id: string | null;
  meta_ad_account_id: string | null;
};

// Forma cruda que se le pide a la IA -- se valida con zod antes de
// confiar en nada (ver RespuestaDirectorSchema más abajo).
const RespuestaDirectorSchema = z.object({
  respuesta: z.string().min(1),
  opciones: z.array(z.string().min(1)).max(6).optional(),
  borrador_parcial: z.record(z.string(), z.unknown()).optional(),
  fuera_de_tema: z.boolean().optional(),
  listo_para_resumen: z.boolean().optional(),
});

// Nombres amigables para cuando la IA marca "listo_para_resumen" pero el
// borrador en realidad no pasa BorradorMetaListoSchema -- el servidor
// nunca confía a ciegas en que la IA de verdad terminó (sección 4 del
// plan).
const NOMBRE_CAMPO: Record<string, string> = {
  tipo: "qué quieres lograr",
  producto: "el producto o servicio",
  presupuesto_cop: "el presupuesto",
  plazo_dias: "el plazo",
  tasa_cierre_categoria: "cuántos de los que te escriben compran",
  precio_cop: "el precio",
  usuario_cta: "tu usuario de Instagram",
};

export type ResumenListo = {
  borrador: BorradorMetaListo;
  fechaFin: string;
  rango: RangoResultados;
};

function calcularFechaFin(plazoDias: number): string {
  const hoy = hoyBogota();
  const fecha = new Date(`${hoy}T00:00:00-05:00`);
  fecha.setDate(fecha.getDate() + plazoDias);
  return fecha.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

// ADN + cobertura + meta anterior -- lo que ya sabemos del negocio para
// no preguntarlo de nuevo (sección 5 del plan).
async function construirContextoNegocio(usuario: { id: string; email: string }): Promise<ContextoNegocioDirector> {
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

// gpt-4o sí acepta temperature distinto de 1 (a diferencia del modelo de
// razonamiento que usa /api/video/guion) -- 0.4 para respuestas
// consistentes sin que se sientan robóticas.
async function llamarDirector(apiKey: string, systemPrompt: string, historial: { role: "user" | "assistant"; content: string }[]): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_OPENAI_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODELO_DIRECTOR_META,
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
  | { ok: true; mensajes: MensajeDirector[]; borrador: BorradorMeta; resumen: ResumenListo | null }
  | { ok: false; error: string; mensajes: MensajeDirector[]; borrador: BorradorMeta };

// Un turno completo: llama a la IA, valida y fusiona el borrador_parcial,
// y -- si la IA marcó "listo_para_resumen" -- decide de verdad (nunca
// confiando en la IA) si ya se puede mostrar el resumen, calculando la
// simulación con calcularRangoResultados() y verificando los requisitos
// del tipo con verificarRequisitosMeta(). Guarda el resultado en
// conversaciones_meta antes de devolverlo.
async function ejecutarTurno(params: {
  usuario: UsuarioConversacion;
  apiKey: string;
  conversacionId: string;
  borradorActual: BorradorMeta;
  mensajesActuales: MensajeDirector[];
  mensajeUsuario: string | null;
}): Promise<ResultadoTurno> {
  const { usuario, apiKey, conversacionId, borradorActual, mensajesActuales, mensajeUsuario } = params;

  const contextoNegocio = await construirContextoNegocio(usuario);
  const systemPrompt = construirPromptMetaConversacion(contextoNegocio, borradorActual);
  const historialOpenAI: { role: "user" | "assistant"; content: string }[] = mensajesActuales.map((m) => ({
    role: m.rol === "director" ? "assistant" : "user",
    content: m.texto,
  }));
  if (mensajeUsuario) historialOpenAI.push({ role: "user", content: mensajeUsuario });

  let crudo: unknown;
  try {
    crudo = await llamarDirector(apiKey, systemPrompt, historialOpenAI);
  } catch (err) {
    console.error("Error llamando al Director (metas):", err);
    return { ok: false, error: "No se pudo conversar con el Director en este momento.", mensajes: mensajesActuales, borrador: borradorActual };
  }

  const parseado = RespuestaDirectorSchema.safeParse(crudo);
  if (!parseado.success) {
    console.error("Respuesta del Director con forma inesperada:", crudo);
    return { ok: false, error: "El Director respondió algo inesperado, intenta de nuevo.", mensajes: mensajesActuales, borrador: borradorActual };
  }

  // Solo se fusionan los campos que SÍ pasan el schema laxo -- un campo
  // inválido suelto nunca contamina el borrador guardado.
  const parcial = parseado.data.borrador_parcial ? BorradorMetaSchema.safeParse(parseado.data.borrador_parcial) : null;
  const borradorNuevo: BorradorMeta = { ...borradorActual, ...(parcial?.success ? parcial.data : {}) };

  const nuevosMensajes: MensajeDirector[] = [...mensajesActuales];
  if (mensajeUsuario) nuevosMensajes.push({ rol: "usuario", texto: mensajeUsuario, creado_en: new Date().toISOString() });

  let textoDirector = parseado.data.respuesta;
  let opcionesDirector = parseado.data.opciones;
  let resumen: ResumenListo | null = null;

  if (parseado.data.listo_para_resumen) {
    // Plazo por defecto (decisión del plan) si el cliente nunca lo dijo.
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
      } else {
        const costoReferencia = await calcularCostoReferencia(listo.data.tipo, usuario.id);
        const tasaCierre =
          listo.data.tipo === "conversaciones_whatsapp" || listo.data.tipo === "leads"
            ? TASA_CIERRE_POR_CATEGORIA[listo.data.tasa_cierre_categoria]
            : undefined;
        const rango = calcularRangoResultados(listo.data.presupuesto_cop, costoReferencia, tasaCierre);

        textoDirector = "¡Listo! Mira cómo quedaría. Si algo no te cuadra, dímelo y lo cambio.";
        opcionesDirector = undefined;
        resumen = { borrador: listo.data, fechaFin, rango };
      }
    }
  }

  nuevosMensajes.push({ rol: "director", texto: textoDirector, opciones: opcionesDirector, creado_en: new Date().toISOString() });

  await supabaseAdmin
    .from("conversaciones_meta")
    .update({ borrador: borradorNuevo, mensajes: nuevosMensajes, actualizado_en: new Date().toISOString() })
    .eq("id", conversacionId);

  return { ok: true, mensajes: nuevosMensajes, borrador: borradorNuevo, resumen };
}

async function cargarUsuarioConversacion(email: string): Promise<{
  usuario: UsuarioConversacion & { openai_key: string | null };
} | null> {
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, openai_key, meta_page_id, meta_access_token, meta_pixel_id, meta_ad_account_id")
    .eq("email", email)
    .single();

  if (!usuario) return null;
  return { usuario: { ...usuario, email } };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const cargado = await cargarUsuarioConversacion(emailBusqueda);
  if (!cargado) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  const { usuario } = cargado;

  // Decisión del plan: si no tiene openai_key conectada, /metas/crear
  // abre directo el formulario rápido con un aviso -- nunca se intenta
  // la conversación sin llave.
  if (!usuario.openai_key) {
    return NextResponse.json({ activa: false, requiereApiKey: true });
  }

  let { data: conversacion } = await supabaseAdmin
    .from("conversaciones_meta")
    .select("*")
    .eq("user_id", usuario.id)
    .eq("estado", "activa")
    .maybeSingle();

  if (!conversacion) {
    const { data: nueva, error } = await supabaseAdmin
      .from("conversaciones_meta")
      .insert({ user_id: usuario.id, estado: "activa", borrador: {}, mensajes: [] })
      .select()
      .single();
    if (error || !nueva) {
      console.error("Error creando conversacion_meta:", error);
      return NextResponse.json({ error: "No se pudo iniciar la conversación." }, { status: 500 });
    }
    conversacion = nueva;
  }

  const mensajesGuardados = (conversacion.mensajes as MensajeDirector[]) ?? [];
  const borradorGuardado = (conversacion.borrador as BorradorMeta) ?? {};

  // Primera vez que se abre esta conversación (sin mensajes todavía) --
  // se genera el saludo inicial del Director ya mismo, para que el
  // cliente nunca vea un chat vacío.
  if (mensajesGuardados.length === 0) {
    let apiKey: string;
    try {
      apiKey = desencriptarSiHaceFalta(usuario.openai_key);
    } catch (err) {
      console.error("Error al descifrar openai_key (metas/conversacion):", err);
      return NextResponse.json({ activa: false, requiereApiKey: true });
    }

    const resultado = await ejecutarTurno({
      usuario,
      apiKey,
      conversacionId: conversacion.id,
      borradorActual: borradorGuardado,
      mensajesActuales: [],
      mensajeUsuario: null,
    });

    if (!resultado.ok) {
      return NextResponse.json({
        activa: true,
        conversacion_id: conversacion.id,
        mensajes: [],
        borrador: {},
        resumen: null,
        errorOpenAI: true,
        errorMensaje: resultado.error,
      });
    }

    return NextResponse.json({
      activa: true,
      conversacion_id: conversacion.id,
      mensajes: resultado.mensajes,
      borrador: resultado.borrador,
      resumen: resultado.resumen,
    });
  }

  // Retomando una conversación ya empezada -- el resumen estructurado
  // (si llegó a mostrarse) no se reconstruye acá después de un refresh;
  // el último mensaje del Director en "mensajes" ya cuenta en texto qué
  // pasó, pero la tarjeta con los números no vuelve a aparecer sola.
  // Aceptable para esta primera versión -- si hace falta, se puede
  // guardar el resumen junto al borrador más adelante.
  return NextResponse.json({
    activa: true,
    conversacion_id: conversacion.id,
    mensajes: mensajesGuardados,
    borrador: borradorGuardado,
    resumen: null,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const emailBusqueda = session.user.email.trim().toLowerCase();

  const permitido = verificarLimite(`metas-conversacion:${emailBusqueda}`, 20, 5 * 60 * 1000);
  if (!permitido) {
    return NextResponse.json({ error: "Estás escribiendo muy rápido. Espera un momento e intenta de nuevo." }, { status: 429 });
  }

  const cargado = await cargarUsuarioConversacion(emailBusqueda);
  if (!cargado) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  const { usuario } = cargado;

  if (!usuario.openai_key) {
    return NextResponse.json(
      { error: "Conecta tu cuenta de OpenAI en Integraciones para que el Director te guíe.", requiereApiKey: true },
      { status: 400 }
    );
  }

  const { mensaje } = await req.json().catch(() => ({ mensaje: null }));
  if (typeof mensaje !== "string" || !mensaje.trim()) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío." }, { status: 400 });
  }

  const { data: conversacion } = await supabaseAdmin
    .from("conversaciones_meta")
    .select("*")
    .eq("user_id", usuario.id)
    .eq("estado", "activa")
    .maybeSingle();

  if (!conversacion) {
    return NextResponse.json({ error: "No hay una conversación activa. Recarga la página." }, { status: 404 });
  }

  let apiKey: string;
  try {
    apiKey = desencriptarSiHaceFalta(usuario.openai_key);
  } catch (err) {
    console.error("Error al descifrar openai_key (metas/conversacion):", err);
    return NextResponse.json(
      { error: "No se pudo leer tu llave de OpenAI guardada. Vuelve a conectarla en Integraciones.", requiereApiKey: true },
      { status: 500 }
    );
  }

  const borradorActual = (conversacion.borrador as BorradorMeta) ?? {};
  const mensajesActuales = (conversacion.mensajes as MensajeDirector[]) ?? [];

  const resultado = await ejecutarTurno({
    usuario,
    apiKey,
    conversacionId: conversacion.id,
    borradorActual,
    mensajesActuales,
    mensajeUsuario: mensaje.trim(),
  });

  if (!resultado.ok) {
    // Decisión del plan: si OpenAI falla a mitad de la conversación, el
    // cliente puede seguir en el formulario rápido con lo que ya se
    // alcanzó a llenar -- por eso siempre se devuelve el borrador actual,
    // incluso en el error.
    return NextResponse.json({ error: resultado.error, borrador: resultado.borrador, mensajes: resultado.mensajes, ofrecerFormulario: true }, { status: 503 });
  }

  return NextResponse.json({ conversacion_id: conversacion.id, mensajes: resultado.mensajes, borrador: resultado.borrador, resumen: resultado.resumen });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { accion } = await req.json().catch(() => ({ accion: null }));
  if (accion !== "abandonar") {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { data: usuario } = await supabaseAdmin.from("usuarios").select("id").eq("email", emailBusqueda).single();
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  await supabaseAdmin
    .from("conversaciones_meta")
    .update({ estado: "abandonada", actualizado_en: new Date().toISOString() })
    .eq("user_id", usuario.id)
    .eq("estado", "activa");

  return NextResponse.json({ ok: true });
}
