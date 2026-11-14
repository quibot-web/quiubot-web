import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarLimite } from "@/lib/rateLimit";
import { registrarError } from "@/lib/registrarError";
import { GuionSchema, idsDeMediaUsados, type Guion } from "@/video/guion.schema";
import { construirTemaDesdeAdn } from "@/video/tema";
import { RECETAS_ORGANICAS, validarContraRecetaOrganica } from "@/video/recetas/organico";
import { construirPromptGuionOrganico, type EntradaGuionOrganico } from "@/video/promptGuionOrganico";
import type { PiezaDisponible } from "@/video/promptGuion";
import { detectarFrasesDescargo, recopilarTextosEscenas } from "@/video/reglasCopy";
import { AnalisisPiezaSchema, type AnalisisPieza } from "@/app/lib/analisisPieza";
import { analizarPiezaConOpenAI } from "@/app/lib/analizarPiezaImagen";
import type { RecetaOrganicaId } from "@/video/guion.schema";

// Genera (o regenera) el guion de una pieza orgánica -- commit 4b,
// pantalla de revisión. Mismo modelo y mismo patrón de un reintento
// que /api/video/guion. Commit 4b.2: ya resuelve las fotos/videos del
// álbum elegidos en "Agregar reel" (pieza.media_ids), igual que esa
// ruta, para que producto_en_uso pueda usar producto_hero.
const MODELO_GUION = "gpt-5.6-sol";
const TIMEOUT_OPENAI_MS = 60_000;
const MAX_REINTENTOS = 1;
const DURACION_POR_DEFECTO_S: Record<RecetaOrganicaId, number> = {
  consejos_numerados: 20,
  mito_verdad: 18,
  producto_en_uso: 18,
  serie_partes: 20,
  pregunta_comunidad: 15,
  detras_de_marca: 20,
};

async function llamarOpenAI(apiKey: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_OPENAI_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODELO_GUION,
        messages: [{ role: "system", content: prompt }],
        max_completion_tokens: 6000,
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
    return contenido;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const permitido = verificarLimite(`contenido-guion:${emailBusqueda}`, 10, 5 * 60 * 1000);
  if (!permitido) {
    return NextResponse.json({ error: "Estás generando guiones muy rápido. Espera un momento e intenta de nuevo." }, { status: 429 });
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
    return NextResponse.json({ error: "Conecta tu cuenta de OpenAI en Integraciones antes de generar el guion." }, { status: 400 });
  }

  let apiKeyUsuario: string;
  try {
    apiKeyUsuario = desencriptarSiHaceFalta(usuario.openai_key);
  } catch {
    return NextResponse.json({ error: "No se pudo leer tu llave de OpenAI guardada." }, { status: 500 });
  }

  const { data: pieza } = await supabaseAdmin
    .from("publicaciones_organicas")
    .select("id, receta_organica, estado, media_ids")
    .eq("id", id)
    .eq("user_id", usuario.id)
    .maybeSingle();

  if (!pieza) {
    return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
  }
  if (pieza.estado !== "borrador") {
    return NextResponse.json({ error: `Esta pieza está en estado "${pieza.estado}", no se le puede generar guion ahora.` }, { status: 400 });
  }

  // Resuelve las piezas del álbum elegidas (si las hay) -- mismo
  // patrón exacto que /api/video/guion: analiza las que todavía no
  // tengan análisis en caché, para que el prompt sepa si cada una
  // tiene texto impreso (tratamiento permitido) antes de pedir el guion.
  const idsPiezas: string[] = Array.isArray(pieza.media_ids) ? pieza.media_ids : [];
  const piezasDisponibles: PiezaDisponible[] = [];
  const analisisPiezas: Record<string, AnalisisPieza> = {};

  if (idsPiezas.length > 0) {
    const { data: piezasAlbum, error: errorPiezas } = await supabaseAdmin
      .from("album_creativos")
      .select("id, url_imagen, tipo, analisis")
      .eq("user_id", usuario.id)
      .in("id", idsPiezas);

    if (errorPiezas || !piezasAlbum || piezasAlbum.length !== idsPiezas.length) {
      return NextResponse.json({ error: "Alguna de las piezas elegidas del álbum ya no existe." }, { status: 400 });
    }

    for (const piezaAlbum of piezasAlbum) {
      const tipo: "imagen" | "video" = piezaAlbum.tipo === "video" ? "video" : "imagen";
      piezasDisponibles.push({ id: piezaAlbum.id, tipo });

      const analisisCache = AnalisisPiezaSchema.safeParse(piezaAlbum.analisis);
      if (analisisCache.success) {
        analisisPiezas[piezaAlbum.id] = analisisCache.data;
        continue;
      }
      if (tipo === "imagen") {
        try {
          const analisisNuevo = await analizarPiezaConOpenAI(apiKeyUsuario, piezaAlbum.url_imagen);
          analisisPiezas[piezaAlbum.id] = analisisNuevo;
          await supabaseAdmin.from("album_creativos").update({ analisis: analisisNuevo, analisis_en: new Date().toISOString() }).eq("id", piezaAlbum.id);
        } catch {
          // Si el análisis falla, el prompt simplemente la trata como
          // "podría tener texto" (ver seccionPiezas) -- no bloquea la
          // generación del guion por esto.
        }
      }
    }
  }

  const { data: marca } = await supabaseAdmin
    .from("marcas")
    .select("adn_marca, nombre_marca, logo_url, info_adicional")
    .eq("email", emailBusqueda)
    .maybeSingle();

  if (!marca?.adn_marca) {
    return NextResponse.json({ error: "Genera primero el ADN de tu marca en Mi marca." }, { status: 400 });
  }

  const tema = construirTemaDesdeAdn({
    ...(marca.adn_marca as Record<string, unknown>),
    logo_url: marca.logo_url ?? null,
    nombre_marca: marca.nombre_marca ?? null,
  });
  const adnMarca = marca.adn_marca as { titular?: string | null; frase_corta?: string | null };
  const infoAdicionalMarca = (marca.info_adicional as string | null)?.trim().slice(0, 800) || null;

  const recetaId = pieza.receta_organica as RecetaOrganicaId;
  const receta = RECETAS_ORGANICAS[recetaId];
  const duracionS = DURACION_POR_DEFECTO_S[recetaId];

  const entrada: EntradaGuionOrganico = {
    recetaId,
    receta,
    duracionS,
    infoAdicionalMarca,
    adnTitular: adnMarca?.titular?.trim() || null,
    adnFraseCorta: adnMarca?.frase_corta?.trim() || null,
    piezas: piezasDisponibles,
    analisisPiezas,
  };

  interface Intento {
    errores: string[];
    crudo: unknown;
  }
  const intentosRegistrados: Intento[] = [];

  async function intentar(erroresPrevios?: string[]): Promise<{ ok: true; guion: Guion } | { ok: false; errores: string[] }> {
    const prompt = construirPromptGuionOrganico(entrada, erroresPrevios);

    let contenido: string;
    try {
      contenido = await llamarOpenAI(apiKeyUsuario, prompt);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      intentosRegistrados.push({ errores: [`Error llamando a OpenAI: ${mensaje}`], crudo: null });
      throw err;
    }

    let crudo: unknown;
    try {
      crudo = JSON.parse(contenido);
    } catch {
      const errores = ["La respuesta no fue un JSON válido."];
      intentosRegistrados.push({ errores, crudo: contenido });
      return { ok: false, errores };
    }

    const crudoObj = crudo as Record<string, unknown>;
    const candidato = {
      version: 1 as const,
      formato: "9x16" as const,
      fps: 30 as const,
      uso: "organico" as const,
      receta_organica: recetaId,
      duracion_objetivo_s: duracionS,
      bucle: crudoObj?.bucle,
      tema,
      musica: { pista_id: null, volumen: 0.35 },
      escenas: crudoObj?.escenas,
      publicacion: { caption: crudoObj?.caption, hashtags: crudoObj?.hashtags },
      analisisPiezas: Object.keys(analisisPiezas).length > 0 ? analisisPiezas : undefined,
    };

    const resultado = GuionSchema.safeParse(candidato);
    if (!resultado.success) {
      const errores = resultado.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      intentosRegistrados.push({ errores, crudo });
      return { ok: false, errores };
    }

    const erroresReceta = validarContraRecetaOrganica(resultado.data, receta, piezasDisponibles.length > 0);

    const idsUsados = idsDeMediaUsados(resultado.data.escenas);
    const idsValidos = new Set(piezasDisponibles.map((p) => p.id));
    const erroresMedia = idsUsados.filter((idUsado) => !idsValidos.has(idUsado)).map((idUsado) => `media_id "${idUsado}" no está entre las piezas disponibles.`);

    const textosEscenas = recopilarTextosEscenas(resultado.data.escenas);
    const erroresCopy = detectarFrasesDescargo(textosEscenas).map((m) => `copy tímido: ${m}`);

    const erroresTotales = [...erroresReceta, ...erroresMedia, ...erroresCopy];
    intentosRegistrados.push({ errores: erroresTotales, crudo });
    if (erroresTotales.length > 0) {
      return { ok: false, errores: erroresTotales };
    }

    return { ok: true, guion: resultado.data };
  }

  try {
    let resultado = await intentar();
    let intentos = 1;
    while (!resultado.ok && intentos <= MAX_REINTENTOS) {
      resultado = await intentar(resultado.errores);
      intentos += 1;
    }

    if (!resultado.ok) {
      registrarError({
        origen: "contenido_guion",
        userId: usuario.id,
        email: emailBusqueda,
        paso: "validacion_guion",
        errorMensaje: `El guion orgánico no pasó la validación después de ${intentos} intento(s).`,
        detalleTecnico: resultado.errores.join(" | "),
      });
      return NextResponse.json(
        { error: "No se pudo generar un guion válido para esta pieza.", intentos: intentosRegistrados },
        { status: 502 }
      );
    }

    const { error: errorUpdate } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({
        guion: resultado.guion,
        caption: resultado.guion.publicacion?.caption ?? null,
        hashtags: resultado.guion.publicacion?.hashtags ?? null,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", usuario.id);

    if (errorUpdate) {
      throw new Error(`No se pudo guardar el guion: ${errorUpdate.message}`);
    }

    return NextResponse.json({ guion: resultado.guion });
  } catch (err) {
    console.error("Error generando guion orgánico:", err);
    registrarError({
      origen: "contenido_guion",
      userId: usuario.id,
      email: emailBusqueda,
      paso: "llamada_openai",
      errorMensaje: "No se pudo generar el guion con IA.",
      detalleTecnico: String(err),
    });
    return NextResponse.json({ error: "No se pudo generar el guion en este momento. Intenta de nuevo." }, { status: 503 });
  }
}
