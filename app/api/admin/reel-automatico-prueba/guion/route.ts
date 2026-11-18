import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { construirTemaDesdeAdn } from "@/video/tema";
import { obtenerSaludInstagram } from "@/app/lib/metaInstagramSalud";
import { RECETAS_ORGANICAS } from "@/video/recetas/organico";
import {
  recetaParaPromptConAudio,
  hayContextoDeNegocioSuficiente,
  AVISO_SIN_CONTEXTO_NEGOCIO,
  type EntradaGuionOrganico,
  type ProductoResumenNegocio,
} from "@/video/promptGuionOrganico";
import { elegirPistaMusicalOrganica } from "@/app/lib/contenido";
import { urlPistaMusical } from "@/app/lib/cloudinaryUrl";
import { validarGeometriaMinima } from "@/video/visuales/validarGeometriaMinima";
import { generarGuionConVoz } from "@/app/lib/videoOrganico/generarGuionConVoz";

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
const MAX_REINTENTOS = 2;
const RECETA_ID = "consejos_numerados" as const;
const DURACION_OBJETIVO_S = 16;
// Elegida por Juan José entre 3 muestras reales (cedar/nova/onyx)
// generadas con generarVoz() -- "cedar" quedó como default del código
// Y guardada en marcas.voz_tts para Quiubot (esta columna solo pisa el
// default si una marca puntual pide otra voz distinta).
const VOZ_POR_DEFECTO = "cedar";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();

  // Chequeo de tamaño mínimo (pedido explícito, revisión de staging
  // del 16 nov 2026: "contador" quedaba como una insignia de 130px en
  // fondo vacío, subtítulos a 38px) -- regla de CÓDIGO, no de visión:
  // corre antes de gastar un solo peso en la IA o en generarVoz(), y
  // antes de renderizar nada. Es un chequeo del MOLDE (constantes de
  // geometría, no del guion -- nunca cambia por intento), así que si
  // falla acá, ningún reintento lo va a arreglar -- es un bug de
  // código que hay que corregir, no algo que la IA pueda escribir
  // distinto.
  const hallazgosGeometria = validarGeometriaMinima();
  if (hallazgosGeometria.length > 0) {
    return NextResponse.json(
      { error: "El molde no cumple el tamaño mínimo -- esto es un bug de código, no de la IA.", resumenErrores: hallazgosGeometria.map((h) => `${h.elemento}: ${h.mensaje}`) },
      { status: 500 }
    );
  }

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

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, openai_key, cloudinary_name, cloudinary_key, cloudinary_secret, meta_page_id, meta_access_token")
    .eq("email", emailBusqueda)
    .single();
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

  // Ronda H: @usuario real de Instagram, misma fuente que ya usa el
  // Director (app/lib/director/flujoCrearMeta.ts) para esto mismo --
  // nunca se le pregunta a la IA, nunca se inventa. obtenerSaludInstagram
  // ya atrapa sus propios errores de red/Meta (responde "no conectado"
  // en vez de lanzar); este catch es la red de seguridad de todos
  // modos, igual que en el Director -- un fallo acá nunca debe tumbar
  // la generación del guion, solo degradar el CTA a "Seguir" genérico.
  let saludInstagram: { conectado: boolean; username: string | null };
  try {
    saludInstagram = await obtenerSaludInstagram({ meta_page_id: usuario.meta_page_id, meta_access_token: usuario.meta_access_token });
  } catch (err) {
    console.error("Error consultando salud de Instagram para el reel automático de prueba:", err);
    saludInstagram = { conectado: false, username: null };
  }
  const tema = construirTemaDesdeAdn(
    { ...(marca.adn_marca as Record<string, unknown>), logo_url: marca.logo_url ?? null, nombre_marca: marca.nombre_marca ?? null },
    saludInstagram.conectado ? saludInstagram.username : null
  );
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
    productoPieza: null,
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

  try {
    // Pipeline real (prompt con audio -> validación -> voz -> alineación
    // -> compactación de pausas por silencio real), extraído a
    // app/lib/videoOrganico/generarGuionConVoz.ts (paso 1 de la
    // integración a /contenido) para que esta ruta de prueba y la ruta
    // real (app/api/contenido/[id]/guion/route.ts, solo consejos_numerados)
    // compartan el MISMO código, probado en 12 rondas reales de staging.
    const resultado = await generarGuionConVoz({
      apiKeyUsuario,
      cloudinary: { cloudName: usuario.cloudinary_name, apiKey: cloudinaryKey, apiSecret: cloudinarySecret },
      voz,
      tema,
      entrada,
      recetaConAudio,
      tienePiezas: false,
      pistaIdElegida,
      duracionObjetivoS: DURACION_OBJETIVO_S,
      recetaId: RECETA_ID,
      erroresPrevios: erroresPreviosDelCliente,
      maxReintentos: MAX_REINTENTOS,
    });

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error, resumenErrores: resultado.resumenErrores }, { status: resultado.status });
    }

    // Ronda J, punto B: se devuelven los ingredientes crudos (ANTES de
    // compactar) junto con el guion final -- así, si el control de
    // calidad del arnés (render + visión + audio, en el cliente)
    // encuentra SOLO un problema de pausas, puede pedir una
    // recompactación sola (POST /recompactar, con límites más
    // estrictos) sobre esta MISMA voz ya generada, sin volver a gastar
    // en la IA ni en TTS -- ver AdminReelAutomaticoPruebaClient.tsx.
    return NextResponse.json({
      guion: resultado.guion,
      pistaMusicaUrl,
      voz,
      puntajeAlineacion: resultado.puntajeAlineacion,
      intentosGuion: resultado.intentosGuion,
      seRegeneroPorQC: !!erroresPreviosDelCliente,
      crudo: resultado.crudo,
    });
  } catch (err) {
    const detalle = String(err instanceof Error ? err.message : err);
    if (/insufficient_quota|credit_balance_exhausted|no tiene créditos/.test(detalle)) {
      return NextResponse.json({ error: "Tu cuenta de OpenAI no tiene créditos. Agrega saldo en platform.openai.com y vuelve a intentar." }, { status: 503 });
    }
    console.error("Error generando el reel automático de prueba:", err);
    return NextResponse.json({ error: "No se pudo generar el reel en este momento. Intenta de nuevo." }, { status: 503 });
  }
}
