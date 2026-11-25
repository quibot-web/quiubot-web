import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarLimite } from "@/lib/rateLimit";
import { registrarError } from "@/lib/registrarError";
import { accesoContenido } from "@/app/lib/accesoContenido";
import { errorDeOpenAI, respuestaErrorOpenAI } from "@/app/lib/openaiErrores";
import { GuionSchema, idsDeMediaUsados, type Guion } from "@/video/guion.schema";
import { construirTemaDesdeAdn } from "@/video/tema";
import { RECETAS_ORGANICAS, validarContraRecetaOrganica } from "@/video/recetas/organico";
import {
  construirPromptGuionOrganico,
  recetaParaPromptConAudio,
  hayContextoDeNegocioSuficiente,
  AVISO_SIN_CONTEXTO_NEGOCIO,
  type EntradaGuionOrganico,
  type ProductoResumenNegocio,
} from "@/video/promptGuionOrganico";
import type { PiezaDisponible } from "@/video/promptGuion";
import { detectarFrasesDescargo, detectarFrasesVacias, detectarVerdadTibia, recopilarTextosEscenas } from "@/video/reglasCopy";
import { AnalisisPiezaSchema, type AnalisisPieza } from "@/app/lib/analisisPieza";
import { analizarPiezaConOpenAI } from "@/app/lib/analizarPiezaImagen";
import { ajustarDuracionesProporcional, limpiarHashtags, limpiarNumeracionItemsLista } from "@/video/arreglosAutomaticosGuion";
import { elegirGanchoTipoMenosUsado, elegirPistaMusicalOrganica } from "@/app/lib/contenido";
import type { RecetaOrganicaId } from "@/video/guion.schema";
import { obtenerSaludInstagram } from "@/app/lib/metaInstagramSalud";
import { generarGuionConVoz } from "@/app/lib/videoOrganico/generarGuionConVoz";
import { generarHistoriaNarrada } from "@/app/lib/videoOrganico/generarHistoriaNarrada";
import { reelIlustradoActivo } from "@/app/lib/reelIlustrado";
import { clasificarIdea, proponerSerie, serieDesdeIdea, type ContextoSerie } from "@/app/lib/ideaUsuario";
import { erroresDatosDelGuion } from "@/app/lib/videoOrganico/datosReales";
import { VENTANA_ROTACION } from "@/video/estilos/estilos";
import { huellasDePiezas } from "@/video/ilustrado/kit/variedad";

// Receta que ya pasó al pipeline nuevo (narración + voz real, ver
// app/lib/videoOrganico/generarGuionConVoz.ts -- el mismo código que
// ya probó 12 rondas reales en el arnés admin). Las otras 5 recetas se
// quedan en construirPromptGuionOrganico de siempre, sin voz, "versión
// anterior" (ver app/contenido/page.tsx) hasta la Fase B v2.1.
const RECETAS_CON_VOZ = new Set<RecetaOrganicaId>(["consejos_numerados", "historia_narrada"]);
const VOZ_POR_DEFECTO = "cedar";

// Genera (o regenera) el guion de una pieza orgánica -- commit 4b,
// pantalla de revisión. Mismo modelo y mismo patrón de un reintento
// que /api/video/guion. Commit 4b.2: ya resuelve las fotos/videos del
// álbum elegidos en "Agregar reel" (pieza.media_ids), igual que esa
// ruta, para que producto_en_uso pueda usar producto_hero.
const MODELO_GUION = "gpt-5.6-sol";
const TIMEOUT_OPENAI_MS = 60_000;
const MAX_REINTENTOS = 1;
// Causa real del fallo del 14 nov 2026 ("Consejos numerados" nunca
// pasaba la validación): estos números se habían elegido sin revisar
// si son alcanzables de verdad. El gancho mide máximo 2.5s y cualquier
// otra escena máximo 5s (EscenaBase en guion.schema.ts), y el número de
// escenas está fijo por receta.bloques (un bloque que no se repite ahí
// solo puede tener UNA escena) -- así que la suma máxima posible es
// 2.5 + 5*(bloques.length-1). Con 4 bloques eso da 17.5s, nunca 18s o
// más. consejos_numerados/serie_partes/detras_de_marca pedían 20s
// (imposible, por eso fallaban), pregunta_comunidad (solo 3 bloques,
// máximo 12.5s) pedía 15s (también imposible). mito_verdad y
// producto_en_uso pedían 18s, alcanzable pero con casi cero margen
// (17.5s de tope) -- la IA tenía que acertar casi exacto. 16s/10s dejan
// un margen real (14-17.5s y 8-12.5s respectivamente) para que la IA
// elija duraciones naturales sin que el guion caiga fuera de rango.
const DURACION_POR_DEFECTO_S: Record<RecetaOrganicaId, number> = {
  consejos_numerados: 16,
  mito_verdad: 16,
  producto_en_uso: 16,
  serie_partes: 16,
  pregunta_comunidad: 10,
  detras_de_marca: 16,
  // Una escena por frase (hasta 7): la duración real sale de la voz.
  historia_narrada: 24,
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

// Parte de una serie: "Parte k de N" al comienzo de su idea, y las ideas
// de la parte anterior y la siguiente (para el repaso y el adelanto).
async function contextoDeSerie(pieza: { id: string; tema: string | null; continua_de_id?: string | null }, userId: string): Promise<ContextoSerie | null> {
  const serie = serieDesdeIdea(pieza.tema);
  if (!serie) return null;
  const [anterior, siguiente] = await Promise.all([
    pieza.continua_de_id ? supabaseAdmin.from("publicaciones_organicas").select("tema").eq("id", pieza.continua_de_id).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
    supabaseAdmin.from("publicaciones_organicas").select("tema").eq("continua_de_id", pieza.id).eq("user_id", userId).neq("estado", "cancelada").maybeSingle(),
  ]);
  return { ...serie, ideaAnterior: (anterior.data?.tema as string | null) ?? null, ideaSiguiente: (siguiente.data?.tema as string | null) ?? null };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cuerpoGuion = (await req.json().catch(() => null)) as { unSoloReel?: unknown } | null;

  // Dueño de la pieza con suscripción activa (ver app/lib/accesoContenido.ts).
  const acceso = await accesoContenido<{ openai_key: string | null; cloudinary_name: string | null; cloudinary_key: string | null; cloudinary_secret: string | null; meta_page_id: string | null; meta_access_token: string | null }>(
    "openai_key, cloudinary_name, cloudinary_key, cloudinary_secret, meta_page_id, meta_access_token"
  );
  if (acceso.error) return acceso.error;
  const { usuario, email: emailBusqueda } = acceso;

  const permitido = verificarLimite(`contenido-guion:${emailBusqueda}`, 10, 5 * 60 * 1000);
  if (!permitido) {
    return NextResponse.json({ error: "Estás generando guiones muy rápido. Espera un momento e intenta de nuevo." }, { status: 429 });
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
    .select("id, receta_organica, estado, media_ids, semana, tema, gancho_tipo, producto_id, continua_de_id")
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
    .select("adn_marca, nombre_marca, logo_url, info_adicional, voz_tts")
    .eq("email", emailBusqueda)
    .maybeSingle();

  if (!marca?.adn_marca) {
    return NextResponse.json({ error: "Genera primero el ADN de tu marca en Mi marca." }, { status: 400 });
  }

  // @usuario real de Instagram, misma fuente que ya usa el Director
  // (app/lib/director/flujoCrearMeta.ts) y el arnés de prueba del reel
  // con voz -- nunca se le pregunta a la IA, nunca se inventa. Se
  // resuelve para cualquier receta (es un campo más del tema, las 5
  // recetas sin voz simplemente no lo leen -- ver video/escenas/Cta.tsx
  // vs. video/visuales/index.tsx) para no tener 2 caminos de armar
  // `tema` según la receta.
  let saludInstagram: { conectado: boolean; username: string | null };
  try {
    saludInstagram = await obtenerSaludInstagram({ meta_page_id: usuario.meta_page_id, meta_access_token: usuario.meta_access_token });
  } catch (err) {
    console.error("Error consultando salud de Instagram para el guion orgánico:", err);
    saludInstagram = { conectado: false, username: null };
  }

  const tema = construirTemaDesdeAdn(
    {
      ...(marca.adn_marca as Record<string, unknown>),
      logo_url: marca.logo_url ?? null,
      nombre_marca: marca.nombre_marca ?? null,
    },
    saludInstagram.conectado ? saludInstagram.username : null
  );
  const adnMarca = marca.adn_marca as { titular?: string | null; frase_corta?: string | null };
  const infoAdicionalMarca = (marca.info_adicional as string | null)?.trim().slice(0, 800) || null;

  // Catálogo real del negocio -- junto con infoAdicionalMarca, es la
  // ÚNICA fuente de "qué vende y a quién" (ver promptGuionOrganico.ts).
  // Caso real que motivó esto: sin este dato, la IA le adivinó el rubro
  // a "Quiubot" por el nombre (creyó que era un chatbot).
  const { data: productosDb } = await supabaseAdmin
    .from("productos")
    .select("nombre, tipo, destacar, precio_cop")
    .eq("user_id", usuario.id)
    .eq("activo", true)
    .order("ultimo_uso_en", { ascending: false })
    .limit(15);
  const productos: ProductoResumenNegocio[] = (productosDb ?? []).map((p) => ({
    nombre: p.nombre,
    tipo: p.tipo === "servicio" ? "servicio" : "producto",
    destacar: p.destacar ?? null,
    precio_cop: p.precio_cop ?? null,
  }));

  if (!hayContextoDeNegocioSuficiente(infoAdicionalMarca, productos)) {
    return NextResponse.json({ error: AVISO_SIN_CONTEXTO_NEGOCIO }, { status: 400 });
  }

  const recetaId = pieza.receta_organica as RecetaOrganicaId;
  const receta = RECETAS_ORGANICAS[recetaId];
  const duracionS = DURACION_POR_DEFECTO_S[recetaId];

  // Tipo de gancho -- lo asigna el código al CREAR la pieza (ver
  // POST /api/contenido), nunca lo elige la IA acá: dejado a su
  // criterio, el modelo repetía el mismo tipo varias veces en la misma
  // semana. Respaldo por si la pieza es de antes de este cambio (sin
  // gancho_tipo todavía): se asigna ahora, con el mismo criterio de
  // rotación, y se guarda para que quede fijo de aquí en adelante.
  let ganchoTipoAsignado = pieza.gancho_tipo as string | null;
  if (!ganchoTipoAsignado) {
    const { data: piezasSemana } = await supabaseAdmin
      .from("publicaciones_organicas")
      .select("gancho_tipo")
      .eq("user_id", usuario.id)
      .eq("semana", pieza.semana)
      .neq("id", id);
    ganchoTipoAsignado = elegirGanchoTipoMenosUsado((piezasSemana ?? []).map((p) => p.gancho_tipo as string | null));
    await supabaseAdmin.from("publicaciones_organicas").update({ gancho_tipo: ganchoTipoAsignado }).eq("id", id).eq("user_id", usuario.id);
  }

  // Música real -- causa real del reel publicado en silencio total
  // (ver elegirPistaMusicalOrganica en app/lib/contenido.ts): a
  // diferencia de /video, acá no hay ningún paso donde un humano elija
  // la pista, así que el código tiene que hacerlo. Si no hay ninguna
  // pista activa, queda en null (Musica.tsx ya maneja "sin pista" sin
  // romperse) -- es un problema de biblioteca vacía, no de código.
  const { data: pistasDb } = await supabaseAdmin.from("pistas_musicales").select("id, mood, licencia_url").eq("activo", true);
  const pistaIdElegida = elegirPistaMusicalOrganica(pistasDb ?? []);

  // Producto elegido para ESTA pieza (si hay) -- eje del reel junto con
  // el tema (ver seccionEjeDelReel). Solo del propio usuario; si ya no
  // existe, el reel se genera sin él (no bloquea).
  let productoPieza: ProductoResumenNegocio | null = null;
  if (pieza.producto_id) {
    const { data: productoDb } = await supabaseAdmin
      .from("productos")
      .select("nombre, tipo, destacar, precio_cop")
      .eq("id", pieza.producto_id)
      .eq("user_id", usuario.id)
      .maybeSingle();
    if (productoDb) {
      productoPieza = {
        nombre: productoDb.nombre,
        tipo: productoDb.tipo === "servicio" ? "servicio" : "producto",
        destacar: productoDb.destacar ?? null,
        precio_cop: productoDb.precio_cop ?? null,
      };
    }
  }

  const entrada: EntradaGuionOrganico = {
    recetaId,
    receta,
    duracionS,
    infoAdicionalMarca,
    adnTitular: adnMarca?.titular?.trim() || null,
    adnFraseCorta: adnMarca?.frase_corta?.trim() || null,
    productos,
    tema: (pieza.tema as string | null) ?? null,
    productoPieza,
    ganchoTipoAsignado: ganchoTipoAsignado as EntradaGuionOrganico["ganchoTipoAsignado"],
    piezas: piezasDisponibles,
    analisisPiezas,
    serie: await contextoDeSerie(pieza as { id: string; tema: string | null; continua_de_id?: string | null }, usuario.id),
    // "Hazlo en un solo reel (resumido)", elegido en la propuesta de serie.
    unSoloReel: cuerpoGuion?.unSoloReel === true,
  };

  // Pipeline con voz (narración + TTS + subtítulos sincronizados),
  // reusando el MISMO código que el arnés admin ya probó en 12 rondas
  // reales de staging (app/lib/videoOrganico/generarGuionConVoz.ts) --
  // ver RECETAS_CON_VOZ arriba. Las demás recetas caen al código de
  // siempre más abajo, sin ningún cambio de comportamiento.
  if (RECETAS_CON_VOZ.has(recetaId)) {
    if (!usuario.cloudinary_name || !usuario.cloudinary_key || !usuario.cloudinary_secret) {
      return NextResponse.json({ error: "Conecta tu cuenta de Cloudinary en Integraciones antes de generar la voz." }, { status: 400 });
    }
    let cloudinaryKey: string;
    let cloudinarySecret: string;
    try {
      cloudinaryKey = desencriptarSiHaceFalta(usuario.cloudinary_key);
      cloudinarySecret = desencriptarSiHaceFalta(usuario.cloudinary_secret);
    } catch {
      return NextResponse.json({ error: "No se pudo leer tus llaves de Cloudinary guardadas." }, { status: 500 });
    }

    const voz = (marca.voz_tts as string | null) || VOZ_POR_DEFECTO;

    // Rotación de estilos (paso 3): estilos de las últimas piezas de la
    // cuenta (sin esta misma, sin canceladas), la más reciente primero.
    // Si la consulta falla, se genera igual (sin historial).
    const { data: piezasAnteriores } = await supabaseAdmin
      .from("publicaciones_organicas")
      .select("estilo:guion->estilo->>id, ilustrado:guion->ilustrado")
      .eq("user_id", usuario.id)
      .neq("id", id)
      .neq("estado", "cancelada")
      .order("creado_en", { ascending: false })
      .limit(VENTANA_ROTACION);
    const historialEstilos = (piezasAnteriores ?? []).map((p) => ((p as { estilo?: string | null }).estilo ?? null));
    // Variedad entre reels ilustrados (visuales-v2): la huella de cada plan
    // guardado en el guion (sin columnas nuevas).
    const historialVisual = huellasDePiezas(piezasAnteriores ?? []);
    const recetaConAudio = recetaParaPromptConAudio(entrada);

    // Historia narrada (visuales-v2): solo cuentas del reel ilustrado; sigue
    // el texto del usuario frase por frase (sin propuesta de serie).
    const esHistoria = recetaId === "historia_narrada";
    if (esHistoria && !reelIlustradoActivo(emailBusqueda)) {
      return NextResponse.json({ error: "El formato Historia narrada todavía no está disponible para tu cuenta." }, { status: 403 });
    }

    try {
      // "Tu idea para el video": más de 3 puntos marcados no caben en un
      // reel de ~30 s -- se propone la serie sin gastar IA ni voz.
      const serie = esHistoria ? "cabe" : clasificarIdea(entrada.tema) === "idea" && !entrada.serie && !entrada.unSoloReel ? proponerSerie(entrada.tema ?? "") : "cabe";
      if (serie === null) {
        return NextResponse.json({ error: "Tu idea tiene demasiados puntos incluso para una serie de 3 reels. Acórtala o divídela tú en varias ideas." }, { status: 422 });
      }
      if (serie !== "cabe") {
        return NextResponse.json({ error: "Tu idea no cabe en un reel de ~30 segundos.", propuestaSerie: serie }, { status: 422 });
      }

      const resultado = await (esHistoria ? generarHistoriaNarrada : generarGuionConVoz)({
        apiKeyUsuario,
        cloudinary: { cloudName: usuario.cloudinary_name, apiKey: cloudinaryKey, apiSecret: cloudinarySecret },
        voz,
        tema,
        entrada,
        recetaConAudio,
        tienePiezas: piezasDisponibles.length > 0,
        pistaIdElegida,
        duracionObjetivoS: duracionS,
        recetaId,
        maxReintentos: MAX_REINTENTOS,
        historialEstilos,
        conPlanIlustrado: reelIlustradoActivo(emailBusqueda),
        historialVisual,
      });

      if (!resultado.ok) {
        registrarError({
          origen: "contenido_guion",
          userId: usuario.id,
          email: emailBusqueda,
          paso: "validacion_guion_con_voz",
          errorMensaje: resultado.error,
          detalleTecnico: (resultado.resumenErrores ?? []).join(" || "),
        });
        return NextResponse.json({ error: resultado.error, resumenErrores: resultado.resumenErrores, propuestaSerie: resultado.propuestaSerie }, { status: resultado.status });
      }

      // Plan ilustrado que no salió válido: la pieza sigue con su estilo,
      // pero queda registrado para revisar por qué.
      if (resultado.planIlustrado.estado === "respaldo") {
        registrarError({
          origen: "contenido_guion",
          userId: usuario.id,
          email: emailBusqueda,
          paso: "plan_ilustrado_respaldo",
          errorMensaje: "El plan ilustrado no salió válido; el reel usa su estilo de siempre.",
          // Los problemas de CADA intento, no solo del último.
          detalleTecnico: resultado.planIlustrado.historial.map((h, i) => `intento ${i + 1}: ${h.join(" | ")}`).join(" || "),
        });
      }

      const { error: errorUpdate } = await supabaseAdmin
        .from("publicaciones_organicas")
        .update({
          guion: resultado.guion,
          caption: resultado.guion.publicacion?.caption ?? null,
          hashtags: resultado.guion.publicacion?.hashtags ?? null,
          voz_url: resultado.guion.vozUrl ?? null,
          // "crudo" (palabras de Whisper + silencios reales ANTES de
          // compactar) se guarda acá para que paso 3 (ColaDeRender)
          // pueda recompactar la MISMA voz si el control de calidad
          // encuentra solo un problema de pausas -- nunca se
          // interpreta acá, es el mismo dato que el arnés admin ya
          // usa en memoria (ver generarGuionConVoz.ts).
          control_calidad: resultado.crudo ? { crudo: resultado.crudo } : null,
          actualizado_en: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", usuario.id);

      if (errorUpdate) {
        throw new Error(`No se pudo guardar el guion: ${errorUpdate.message}`);
      }

      return NextResponse.json({ guion: resultado.guion });
    } catch (err) {
      console.error("Error generando guion orgánico con voz:", err);
      const detalle = String(err);
      registrarError({
        origen: "contenido_guion",
        userId: usuario.id,
        email: emailBusqueda,
        paso: "pipeline_con_voz",
        errorMensaje: "No se pudo generar el guion con voz.",
        detalleTecnico: detalle,
      });
      const errorOpenAI = errorDeOpenAI(detalle);
      if (errorOpenAI) {
        const r = respuestaErrorOpenAI(errorOpenAI);
        return NextResponse.json(r.cuerpo, { status: r.status });
      }
      return NextResponse.json({ error: "No se pudo generar el guion en este momento. Intenta de nuevo." }, { status: 503 });
    }
  }

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
    // Arreglos triviales antes de validar (pedido explícito): no
    // cambian el contenido que escribió la IA, solo corrigen números/
    // duplicados que el código puede resolver con certeza. Si después
    // de esto el guion sigue sin cuadrar, el reintento con la IA ya
    // lleva el motivo real (no uno de estos detalles mecánicos).
    const escenasSinNumeracionDoble = limpiarNumeracionItemsLista(crudoObj?.escenas);
    const escenasAjustadas = ajustarDuracionesProporcional(escenasSinNumeracionDoble, duracionS);
    const hashtagsLimpios = limpiarHashtags(crudoObj?.hashtags);
    const candidato = {
      version: 1 as const,
      formato: "9x16" as const,
      fps: 30 as const,
      uso: "organico" as const,
      receta_organica: recetaId,
      // Nunca de crudoObj -- el tipo lo decide el código (ver arriba),
      // la IA solo escribe el gancho en ese estilo.
      gancho_tipo: ganchoTipoAsignado,
      duracion_objetivo_s: duracionS,
      bucle: crudoObj?.bucle,
      tema,
      musica: { pista_id: pistaIdElegida, volumen: 0.35 },
      escenas: escenasAjustadas,
      publicacion: { caption: crudoObj?.caption, hashtags: hashtagsLimpios ?? crudoObj?.hashtags },
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
    const erroresVacios = detectarFrasesVacias(textosEscenas).map((m) => `copy abstracto: ${m}`);
    // Solo mito_verdad -- no es una regla general de COPY QUE VENDE.
    const erroresVerdadTibia = recetaId === "mito_verdad" ? detectarVerdadTibia(textosEscenas).map((m) => `verdad tibia: ${m}`) : [];

    // Datos reales en todas las recetas: solo lo que escribió el usuario o está en la marca/producto.
    const erroresDatos = erroresDatosDelGuion(resultado.data, entrada);
    const erroresTotales = [...erroresReceta, ...erroresMedia, ...erroresCopy, ...erroresVacios, ...erroresVerdadTibia, ...erroresDatos];
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
        detalleTecnico: intentosRegistrados.map((i, idx) => `intento ${idx + 1}: ${i.errores.join(" | ") || "(sin errores -- no debería pasar)"}`).join(" || "),
      });
      // resumenErrores: motivos reales del último intento, para que el
      // admin los vea resumidos en pantalla (pedido explícito) en vez
      // de tener que ir a buscarlos en el registro de errores -- el
      // cliente (cuando se abra a clientes) seguiría viendo solo
      // "error", ya genérico.
      return NextResponse.json(
        { error: "No se pudo generar un guion válido para esta pieza.", resumenErrores: resultado.errores },
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
    const detalle = String(err);
    registrarError({
      origen: "contenido_guion",
      userId: usuario.id,
      email: emailBusqueda,
      paso: "llamada_openai",
      errorMensaje: "No se pudo generar el guion con IA.",
      detalleTecnico: detalle,
    });

    // Caso real (14 nov 2026): el mensaje genérico de abajo no decía
    // nada de la causa real (créditos de OpenAI agotados), así que
    // revisar el error se volvió "ir a buscar en registrarError" en
    // vez de verlo directo en la pantalla.
    const errorOpenAI = errorDeOpenAI(detalle);
    if (errorOpenAI) {
      const r = respuestaErrorOpenAI(errorOpenAI);
      return NextResponse.json(r.cuerpo, { status: r.status });
    }

    return NextResponse.json({ error: "No se pudo generar el guion en este momento. Intenta de nuevo." }, { status: 503 });
  }
}
