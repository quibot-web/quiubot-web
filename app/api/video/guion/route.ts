import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarLimite } from "@/lib/rateLimit";
import { registrarError } from "@/lib/registrarError";
import { urlPistaMusical } from "@/app/lib/cloudinaryUrl";
import { GuionSchema, OBJETIVOS_VIDEO, type Guion, type ObjetivoVideo } from "@/video/guion.schema";
import { construirTemaDesdeAdn } from "@/video/tema";
import { RECETAS, validarContraReceta } from "@/video/recetas";
import { construirPromptGuion, type PiezaDisponible } from "@/video/promptGuion";
import { detectarFrasesDescargo, recopilarTextosEscenas } from "@/video/reglasCopy";

// Mismo modelo que ya usan los flujos de n8n (generar_estrategia,
// crear_creativos) -- en una constante para poder cambiarlo en un solo
// lugar si hace falta.
const MODELO_GUION_VIDEO = "gpt-5.6-sol";
const TIMEOUT_OPENAI_MS = 60_000;
const MAX_REINTENTOS = 1;

type MediosResueltos = Record<string, { url: string; tipo: "imagen" | "video" }>;

interface CuerpoPeticion {
  objetivo_id?: string;
  producto_servicio?: string;
  datos_producto?: string;
  duracion_s?: number;
  media_ids?: string[];
  pista_id?: string | null;
  usuario_cta?: string;
}

async function llamarOpenAI(apiKey: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_OPENAI_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODELO_GUION_VIDEO,
        messages: [{ role: "system", content: prompt }],
        temperature: 0.7,
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

// ids de media_id que la IA realmente usó (gancho opcional + producto_hero
// obligatorio) -- "la IA nunca escribe URLs", solo puede reusar un id de
// los que se le mandaron como disponibles.
function idsDeMediaUsados(escenas: Guion["escenas"]): string[] {
  const ids: string[] = [];
  for (const e of escenas) {
    if (e.tipo === "producto_hero") ids.push(e.params.media_id);
    if (e.tipo === "gancho_texto" && e.params.media_id) ids.push(e.params.media_id);
  }
  return ids;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const permitido = verificarLimite(`video-guion:${emailBusqueda}`, 10, 5 * 60 * 1000);
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

  // Video con código es admin-only en la Fase 1 (sección "Alcance" del
  // plan) -- mismo mensaje y mismo respaldo del lado del servidor que ya
  // usa /api/generar-video (el flujo de Kling que este reemplaza).
  if (usuario.rol !== "admin") {
    return NextResponse.json(
      { error: "La generación de video con código todavía no está disponible — muy pronto la abrimos para todos." },
      { status: 403 }
    );
  }

  if (!usuario.openai_key) {
    return NextResponse.json(
      { error: "Conecta tu cuenta de OpenAI en Integraciones antes de generar un guion de video.", requiereApiKey: true },
      { status: 400 }
    );
  }

  let apiKeyUsuario: string;
  try {
    apiKeyUsuario = desencriptarSiHaceFalta(usuario.openai_key);
  } catch (err) {
    console.error("Error al descifrar openai_key (video/guion):", err);
    return NextResponse.json(
      { error: "No se pudo leer tu llave de OpenAI guardada. Vuelve a conectarla en Integraciones." },
      { status: 500 }
    );
  }

  const cuerpo = (await req.json().catch(() => null)) as CuerpoPeticion | null;
  if (!cuerpo) {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 });
  }

  const { objetivo_id, producto_servicio, datos_producto, duracion_s, media_ids, pista_id, usuario_cta } = cuerpo;

  if (!objetivo_id || !(OBJETIVOS_VIDEO as readonly string[]).includes(objetivo_id)) {
    return NextResponse.json({ error: "Falta un objetivo de campaña válido." }, { status: 400 });
  }
  if (!producto_servicio?.trim()) {
    return NextResponse.json({ error: "Falta describir el producto o servicio." }, { status: 400 });
  }
  if (typeof duracion_s !== "number" || !Number.isFinite(duracion_s)) {
    return NextResponse.json({ error: "Falta la duración del video." }, { status: 400 });
  }

  const objetivoId = objetivo_id as ObjetivoVideo;
  const receta = RECETAS[objetivoId];

  if (duracion_s < receta.duracionMinS || duracion_s > receta.duracionMaxS) {
    return NextResponse.json(
      { error: `Para este objetivo la duración debe estar entre ${receta.duracionMinS}s y ${receta.duracionMaxS}s.` },
      { status: 400 }
    );
  }

  let usuarioCtaNormalizado: string | null = null;
  if (receta.requiereUsuarioEnCta) {
    const valor = usuario_cta?.trim();
    if (!valor) {
      return NextResponse.json({ error: "Falta el @usuario de la cuenta para este objetivo." }, { status: 400 });
    }
    usuarioCtaNormalizado = valor.startsWith("@") ? valor : `@${valor}`;
  }

  const idsPiezas = Array.isArray(media_ids) ? media_ids.filter((id): id is string => typeof id === "string") : [];
  const medios: MediosResueltos = {};
  const piezasDisponibles: PiezaDisponible[] = [];

  if (idsPiezas.length > 0) {
    const { data: piezas } = await supabaseAdmin
      .from("album_creativos")
      .select("id, url_imagen, tipo")
      .eq("user_id", usuario.id)
      .in("id", idsPiezas);

    if (!piezas || piezas.length !== idsPiezas.length) {
      return NextResponse.json({ error: "Alguna de las piezas elegidas del álbum no existe o no es tuya." }, { status: 400 });
    }

    for (const pieza of piezas) {
      const tipo: "imagen" | "video" = pieza.tipo === "video" ? "video" : "imagen";
      medios[pieza.id] = { url: pieza.url_imagen, tipo };
      piezasDisponibles.push({ id: pieza.id, tipo });
    }
  }

  let pistaUrl: string | null = null;
  if (pista_id) {
    const { data: pista } = await supabaseAdmin
      .from("pistas_musicales")
      .select("id, public_id, cloudinary_name")
      .eq("id", pista_id)
      .eq("activo", true)
      .maybeSingle();

    if (!pista) {
      return NextResponse.json({ error: "La pista de música elegida ya no está disponible." }, { status: 400 });
    }
    pistaUrl = urlPistaMusical(pista.cloudinary_name, pista.public_id);
  }

  const { data: marca } = await supabaseAdmin
    .from("marcas")
    .select("adn_marca, nombre_marca, logo_url")
    .eq("email", emailBusqueda)
    .maybeSingle();

  if (!marca?.adn_marca) {
    return NextResponse.json({ error: "Genera primero el ADN de tu marca en Mi marca antes de crear un video." }, { status: 400 });
  }

  const tema = construirTemaDesdeAdn({
    ...(marca.adn_marca as Record<string, unknown>),
    logo_url: marca.logo_url ?? null,
    nombre_marca: marca.nombre_marca ?? null,
  });

  const adnMarca = marca.adn_marca as { titular?: string | null; frase_corta?: string | null };

  const entrada = {
    objetivoId,
    receta,
    productoServicio: producto_servicio.trim().slice(0, 300),
    datosProducto: datos_producto?.trim().slice(0, 500) || null,
    duracionS: duracion_s,
    piezas: piezasDisponibles,
    usuarioCta: usuarioCtaNormalizado,
    adnTitular: adnMarca?.titular?.trim() || null,
    adnFraseCorta: adnMarca?.frase_corta?.trim() || null,
  };

  // Un intento por llamada a la IA: guarda el JSON crudo que devolvió y
  // los motivos del rechazo (si los hubo), aunque el guion termine
  // aceptado -- es admin-only y la Fase 1a prueba la IA por primera vez
  // en /video, así que el panel de debug necesita ver TODOS los
  // intentos, no solo el que falló, para poder ajustar el prompt sin
  // abrir logs.
  interface Intento {
    errores: string[];
    crudo: unknown;
  }
  const intentosRegistrados: Intento[] = [];

  async function intentar(erroresPrevios?: string[]): Promise<{ ok: true; guion: Guion } | { ok: false; errores: string[] }> {
    const prompt = construirPromptGuion(entrada, erroresPrevios);
    const contenido = await llamarOpenAI(apiKeyUsuario, prompt);

    let crudo: unknown;
    try {
      crudo = JSON.parse(contenido);
    } catch {
      const errores = ["La respuesta no fue un JSON válido."];
      intentosRegistrados.push({ errores, crudo: contenido });
      return { ok: false, errores };
    }

    const candidato = {
      version: 1 as const,
      formato: "9x16" as const,
      fps: 30 as const,
      objetivo: objetivoId,
      duracion_objetivo_s: duracion_s,
      bucle: (crudo as Record<string, unknown>)?.bucle,
      tema,
      musica: { pista_id: pista_id || null, volumen: 0.35 },
      escenas: (crudo as Record<string, unknown>)?.escenas,
    };

    const resultado = GuionSchema.safeParse(candidato);
    if (!resultado.success) {
      const errores = resultado.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      intentosRegistrados.push({ errores, crudo });
      return { ok: false, errores };
    }

    const erroresReceta = validarContraReceta(resultado.data, receta, piezasDisponibles.length > 0);

    const idsUsados = idsDeMediaUsados(resultado.data.escenas);
    const idsValidos = new Set(piezasDisponibles.map((p) => p.id));
    const erroresMedia = idsUsados.filter((id) => !idsValidos.has(id)).map((id) => `media_id "${id}" no está entre las piezas disponibles.`);

    const erroresCopy = detectarFrasesDescargo(recopilarTextosEscenas(resultado.data.escenas)).map((m) => `copy tímido: ${m}`);

    const erroresTotales = [...erroresReceta, ...erroresMedia, ...erroresCopy];
    intentosRegistrados.push({ errores: erroresTotales, crudo });
    if (erroresTotales.length > 0) {
      return { ok: false, errores: erroresTotales };
    }

    return { ok: true, guion: resultado.data };
  }

  const inicio = Date.now();
  try {
    let resultado = await intentar();
    let intentos = 1;

    while (!resultado.ok && intentos <= MAX_REINTENTOS) {
      resultado = await intentar(resultado.errores);
      intentos += 1;
    }

    const duracionMs = Date.now() - inicio;

    if (!resultado.ok) {
      registrarError({
        origen: "video_guion",
        userId: usuario.id,
        email: emailBusqueda,
        paso: "validacion_guion",
        errorMensaje: `El guion no pasó la validación después de ${intentos} intento(s).`,
        detalleTecnico: resultado.errores.join(" | "),
        objetivoId,
      });
      return NextResponse.json(
        {
          error: "No se pudo generar un guion válido para este objetivo. Revisa los intentos o ajusta el brief.",
          intentos: intentosRegistrados,
          duracion_ms: duracionMs,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      guion: resultado.guion,
      medios,
      pista_url: pistaUrl,
      intentos: intentosRegistrados,
      duracion_ms: duracionMs,
    });
  } catch (err) {
    // Un fallo de red/tiempo de espera con OpenAI no es "el guion no
    // pasó la validación" -- intentar() lo deja propagarse en vez de
    // reintentar con el mismo prompt, porque el modelo ni respondió.
    const duracionMs = Date.now() - inicio;
    console.error("Error generando guion de video:", err);
    registrarError({
      origen: "video_guion",
      userId: usuario.id,
      email: emailBusqueda,
      paso: "llamada_openai",
      errorMensaje: "No se pudo generar el guion con IA.",
      detalleTecnico: String(err),
      objetivoId,
    });
    return NextResponse.json(
      {
        error: "No se pudo generar el guion en este momento. Intenta de nuevo.",
        intentos: intentosRegistrados,
        duracion_ms: duracionMs,
      },
      { status: 503 }
    );
  }
}
