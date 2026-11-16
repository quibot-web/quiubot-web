import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { GuionSchema, idsDeMediaUsados, type Guion } from "@/video/guion.schema";
import { construirTemaDesdeAdn } from "@/video/tema";
import { RECETAS_ORGANICAS, validarContraRecetaOrganica } from "@/video/recetas/organico";
import {
  construirPromptGuionOrganicoConAudio,
  recetaParaPromptConAudio,
  hayContextoDeNegocioSuficiente,
  AVISO_SIN_CONTEXTO_NEGOCIO,
  type EntradaGuionOrganico,
  type ProductoResumenNegocio,
} from "@/video/promptGuionOrganico";
import { detectarFrasesDescargo, detectarFrasesVacias, recopilarTextosEscenas } from "@/video/reglasCopy";
import { ajustarDuracionesProporcional, limpiarHashtags, limpiarNumeracionItemsLista } from "@/video/arreglosAutomaticosGuion";
import { elegirPistaMusicalOrganica } from "@/app/lib/contenido";
import { urlPistaMusical } from "@/app/lib/cloudinaryUrl";
import { validarEdicionDesdeAudio, validarEstructuraConsejosNumeradosAudio } from "@/video/visuales/validarEdicionDesdeAudio";
import { generarVoz } from "@/app/lib/videoOrganico/generarVoz";
import { alinearPalabras } from "@/app/lib/videoOrganico/alinearPalabras";
import { calcularHashNarracion } from "@/app/lib/videoOrganico/hashNarracion";

// Fase B v2.0, paso 8 del plan (docs/diseno/plan_contenido_organico_fase_b_v2.md)
// -- arnés de prueba del ÚNICO reel automático (consejos_numerados,
// marca del admin que lo corre). A propósito NO escribe en
// publicaciones_organicas (esto no es una pieza real, no entra al
// calendario) -- reusa la MISMA mecánica de intentos/validación que
// POST /api/contenido/[id]/guion (construirPromptGuionOrganicoConAudio
// en vez de construirPromptGuionOrganico, que es el único cambio real:
// ese prompt sí pide "narracion"+"visual" por escena), más 2 pasos que
// esa ruta no tiene todavía: validarEdicionDesdeAudio() (la narración/
// eventos que escribió la IA tienen que ser consistentes ANTES de
// gastar en generarVoz()) y, si pasa, la llamada real a generarVoz()+
// alinearPalabras() para dejar tiemposRender/palabrasPorEscena/vozUrl
// ya resueltos en el guion que se devuelve.
const MODELO_GUION = "gpt-5.6-sol";
const TIMEOUT_OPENAI_MS = 60_000;
const MAX_REINTENTOS = 2;
const RECETA_ID = "consejos_numerados" as const;
const DURACION_OBJETIVO_S = 16;
// Elegida por Juan José entre 3 muestras reales (cedar/nova/onyx)
// generadas con generarVoz() -- "cedar" quedó como default del código
// Y guardada en marcas.voz_tts para Quiubot (esta columna solo pisa el
// default si una marca puntual pide otra voz distinta).
const VOZ_POR_DEFECTO = "cedar";

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();

  // Reintento dirigido (pedido explícito, plan punto 8): si el cliente
  // ya renderizó un intento anterior y el control de calidad (visión
  // en el navegador + audio) encontró problemas, manda esos hallazgos
  // acá como "erroresPrevios" -- se re-arma el guion desde cero (misma
  // IA, mismos datos de negocio) pero AHORA con esos problemas
  // explícitos en el prompt, igual que ya hace el reintento por fallo
  // de validación estructural (ver intentar() más abajo). No es
  // "regenerar solo la escena que falló" al pie de la letra (eso pedía
  // reenviarle a la IA el guion completo anterior y confiar en que
  // toque solo lo indicado, mucho más frágil) -- pedirle de nuevo el
  // guion completo con la causa real del fallo ya es la misma mecánica
  // probada que corrige fallos de validación, y acota igual el gasto
  // real (nunca más de MAX_REINTENTOS intentos por corrida).
  const cuerpo = await req.json().catch(() => null);
  const erroresPreviosDelCliente = Array.isArray(cuerpo?.erroresPrevios) ? cuerpo.erroresPrevios.filter((e: unknown): e is string => typeof e === "string") : undefined;

  const { data: usuario } = await supabaseAdmin.from("usuarios").select("id, rol, openai_key, cloudinary_name, cloudinary_key, cloudinary_secret").eq("email", emailBusqueda).single();
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!usuario.openai_key) return NextResponse.json({ error: "Conecta tu cuenta de OpenAI en Integraciones antes de generar el guion." }, { status: 400 });
  if (!usuario.cloudinary_name || !usuario.cloudinary_key || !usuario.cloudinary_secret) {
    return NextResponse.json({ error: "Conecta tu cuenta de Cloudinary en Integraciones antes de generar la voz." }, { status: 400 });
  }

  let apiKeyUsuario: string;
  let cloudinaryKey: string;
  let cloudinarySecret: string;
  try {
    apiKeyUsuario = desencriptarSiHaceFalta(usuario.openai_key);
    cloudinaryKey = desencriptarSiHaceFalta(usuario.cloudinary_key);
    cloudinarySecret = desencriptarSiHaceFalta(usuario.cloudinary_secret);
  } catch {
    return NextResponse.json({ error: "No se pudo leer alguna de tus llaves guardadas." }, { status: 500 });
  }

  const { data: marca } = await supabaseAdmin.from("marcas").select("adn_marca, nombre_marca, logo_url, info_adicional, voz_tts").eq("email", emailBusqueda).maybeSingle();
  if (!marca?.adn_marca) return NextResponse.json({ error: "Genera primero el ADN de tu marca en Mi marca." }, { status: 400 });

  const tema = construirTemaDesdeAdn({ ...(marca.adn_marca as Record<string, unknown>), logo_url: marca.logo_url ?? null, nombre_marca: marca.nombre_marca ?? null });
  const adnMarca = marca.adn_marca as { titular?: string | null; frase_corta?: string | null };
  const infoAdicionalMarca = (marca.info_adicional as string | null)?.trim().slice(0, 800) || null;
  const voz = (marca.voz_tts as string | null) || VOZ_POR_DEFECTO;

  const { data: productosDb } = await supabaseAdmin.from("productos").select("nombre, tipo, destacar, precio_cop").eq("user_id", usuario.id).eq("activo", true).order("ultimo_uso_en", { ascending: false }).limit(15);
  const productos: ProductoResumenNegocio[] = (productosDb ?? []).map((p) => ({ nombre: p.nombre, tipo: p.tipo === "servicio" ? "servicio" : "producto", destacar: p.destacar ?? null, precio_cop: p.precio_cop ?? null }));

  if (!hayContextoDeNegocioSuficiente(infoAdicionalMarca, productos)) {
    return NextResponse.json({ error: AVISO_SIN_CONTEXTO_NEGOCIO }, { status: 400 });
  }

  const receta = RECETAS_ORGANICAS[RECETA_ID];
  const { data: pistasDb } = await supabaseAdmin.from("pistas_musicales").select("id, mood, licencia_url, public_id, cloudinary_name").eq("activo", true);
  const pistaIdElegida = elegirPistaMusicalOrganica((pistasDb ?? []).map((p) => ({ id: p.id, mood: p.mood, licencia_url: p.licencia_url })));
  const pistaElegida = (pistasDb ?? []).find((p) => p.id === pistaIdElegida) ?? null;
  const pistaMusicaUrl = pistaElegida ? urlPistaMusical(pistaElegida.cloudinary_name, pistaElegida.public_id) : null;

  const entrada: EntradaGuionOrganico = {
    recetaId: RECETA_ID,
    receta,
    duracionS: DURACION_OBJETIVO_S,
    infoAdicionalMarca,
    adnTitular: adnMarca?.titular?.trim() || null,
    adnFraseCorta: adnMarca?.frase_corta?.trim() || null,
    productos,
    tema: null,
    ganchoTipoAsignado: "pregunta",
    piezas: [],
    analisisPiezas: {},
  };

  // Expandida a 6 bloques (gancho + 3×valor + marca + cta) -- la misma
  // que arma el prompt (recetaParaPromptConAudio(), promptGuionOrganico.ts)
  // -- para que validarContraRecetaOrganica() no rechace por "fuera de
  // orden" los 3 "valor" repetidos que esta estructura sí exige. El
  // mensaje claro de por qué (una escena por consejo, nunca 3 juntas)
  // viene de validarEstructuraConsejosNumeradosAudio() más abajo, no
  // de este chequeo genérico.
  const recetaConAudio = recetaParaPromptConAudio(entrada);

  const intentosRegistrados: { errores: string[] }[] = [];

  async function intentar(erroresPrevios?: string[]): Promise<{ ok: true; guion: Guion } | { ok: false; errores: string[] }> {
    const prompt = construirPromptGuionOrganicoConAudio(entrada, erroresPrevios);
    const contenido = await llamarOpenAI(apiKeyUsuario, prompt);

    let crudo: unknown;
    try {
      crudo = JSON.parse(contenido);
    } catch {
      const errores = ["La respuesta no fue un JSON válido."];
      intentosRegistrados.push({ errores });
      return { ok: false, errores };
    }

    const crudoObj = crudo as Record<string, unknown>;
    const escenasSinNumeracionDoble = limpiarNumeracionItemsLista(crudoObj?.escenas);
    const escenasAjustadas = ajustarDuracionesProporcional(escenasSinNumeracionDoble, DURACION_OBJETIVO_S);
    const hashtagsLimpios = limpiarHashtags(crudoObj?.hashtags);
    const candidato = {
      version: 1 as const,
      formato: "9x16" as const,
      fps: 30 as const,
      uso: "organico" as const,
      receta_organica: RECETA_ID,
      gancho_tipo: entrada.ganchoTipoAsignado,
      duracion_objetivo_s: DURACION_OBJETIVO_S,
      bucle: crudoObj?.bucle,
      tema,
      musica: { pista_id: pistaIdElegida, volumen: 0.35 },
      escenas: escenasAjustadas,
      publicacion: { caption: crudoObj?.caption, hashtags: hashtagsLimpios ?? crudoObj?.hashtags },
    };

    const resultado = GuionSchema.safeParse(candidato);
    if (!resultado.success) {
      const errores = resultado.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      intentosRegistrados.push({ errores });
      return { ok: false, errores };
    }

    const erroresReceta = validarContraRecetaOrganica(resultado.data, recetaConAudio, false);
    const idsUsados = idsDeMediaUsados(resultado.data.escenas);
    const erroresMedia = idsUsados.map((idUsado) => `media_id "${idUsado}" no está permitido en este guion de prueba (sin piezas del álbum).`);
    const textosEscenas = recopilarTextosEscenas(resultado.data.escenas);
    const erroresCopy = detectarFrasesDescargo(textosEscenas).map((m) => `copy tímido: ${m}`);
    const erroresVacios = detectarFrasesVacias(textosEscenas).map((m) => `copy abstracto: ${m}`);
    // Específico de esta Fase: narracion/visual/eventos consistentes
    // (ver video/visuales/validarEdicionDesdeAudio.ts) -- la ruta de
    // siempre no corre esto porque esas 6 recetas no llevan voz.
    const hallazgosAudio = validarEdicionDesdeAudio(resultado.data.escenas).map((h) => `${h.escenaId}: ${h.mensaje}`);
    // Caso real de staging (16 nov 2026): los 3 consejos metidos en
    // una sola escena con un "contador" -- decir, no mostrar. Esta
    // SÍ es específica de consejos_numerados (por eso vive aparte de
    // validarEdicionDesdeAudio, que es genérica).
    const hallazgosEstructura = validarEstructuraConsejosNumeradosAudio(resultado.data.escenas).map((h) => `${h.escenaId}: ${h.mensaje}`);

    const erroresTotales = [...erroresReceta, ...erroresMedia, ...erroresCopy, ...erroresVacios, ...hallazgosAudio, ...hallazgosEstructura];
    intentosRegistrados.push({ errores: erroresTotales });
    if (erroresTotales.length > 0) return { ok: false, errores: erroresTotales };

    return { ok: true, guion: resultado.data };
  }

  try {
    // Si el cliente mandó errores de un intento anterior (control de
    // calidad por visión/audio sobre un render previo, ver el
    // comentario de erroresPreviosDelCliente más arriba), la PRIMERA
    // llamada ya arranca con esos errores en el prompt -- no hace
    // falta gastar una llamada "a ciegas" primero.
    let resultado = await intentar(erroresPreviosDelCliente);
    let intentosGuion = 1;
    while (!resultado.ok && intentosGuion <= MAX_REINTENTOS) {
      resultado = await intentar(resultado.errores);
      intentosGuion += 1;
    }

    if (!resultado.ok) {
      return NextResponse.json({ error: "No se pudo generar un guion válido (narración/visual) después de varios intentos.", resumenErrores: resultado.errores }, { status: 502 });
    }

    // Voz real -- única llamada de todo este endpoint que cuesta dinero
    // de verdad (TTS + Whisper, unos centavos). Solo se llega acá con
    // un guion que YA pasó validarEdicionDesdeAudio(), para no gastarla
    // en un guion que de todos modos se iba a descartar.
    const textoCompleto = resultado.guion.escenas.map((e) => e.narracion ?? "").join(" ");
    const { audioUrl, palabras } = await generarVoz(textoCompleto, {
      openaiKey: apiKeyUsuario,
      voz,
      cloudinary: { cloudName: usuario.cloudinary_name, apiKey: cloudinaryKey, apiSecret: cloudinarySecret },
    });
    const { tiemposRender, palabrasPorEscena, puntaje } = alinearPalabras(
      resultado.guion.escenas.map((e) => ({ id: e.id, narracion: e.narracion ?? "" })),
      palabras
    );

    const guionFinal: Guion = {
      ...resultado.guion,
      tiemposRender,
      palabrasPorEscena,
      narracionHash: calcularHashNarracion(resultado.guion.escenas),
      vozUrl: audioUrl,
    };

    return NextResponse.json({ guion: guionFinal, pistaMusicaUrl, voz, puntajeAlineacion: puntaje, intentosGuion, seRegeneroPorQC: !!erroresPreviosDelCliente });
  } catch (err) {
    const detalle = String(err instanceof Error ? err.message : err);
    if (/insufficient_quota|credit_balance_exhausted|no tiene créditos/.test(detalle)) {
      return NextResponse.json({ error: "Tu cuenta de OpenAI no tiene créditos. Agrega saldo en platform.openai.com y vuelve a intentar." }, { status: 503 });
    }
    console.error("Error generando el reel automático de prueba:", err);
    return NextResponse.json({ error: "No se pudo generar el reel en este momento. Intenta de nuevo." }, { status: 503 });
  }
}
