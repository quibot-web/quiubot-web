import "server-only";
import { LIMITE_IDEA, MAX_PARTES_SERIE, clasificarIdea, detectarDatosInventados, verificarIdeaRespetada, type PropuestaSerie } from "@/app/lib/ideaUsuario";
import type { ProductoResumenNegocio } from "@/video/promptGuionOrganico";
import { ajustarConVozReal, generarPlanIlustrado } from "./generarPlanIlustrado";
import type { PlanIlustrado } from "@/video/ilustrado/motor/plan";
import { asignarEstilo, elegirEstilo, estilosDisponibles, idsFotosSinTexto } from "@/video/estilos/estilos";
import { GuionSchema, idsDeMediaUsados, type Guion, type RecetaOrganicaId } from "@/video/guion.schema";
import type { TemaGuion } from "@/video/tema";
import { validarContraRecetaOrganica, type RecetaOrganica } from "@/video/recetas/organico";
import { construirPromptGuionOrganicoConAudio, type EntradaGuionOrganico } from "@/video/promptGuionOrganico";
import { detectarFrasesDescargo, detectarFrasesVacias, recopilarTextosEscenas } from "@/video/reglasCopy";
import { ajustarDuracionesProporcional, limpiarHashtags, limpiarNumeracionItemsLista } from "@/video/arreglosAutomaticosGuion";
import { validarEdicionDesdeAudio, validarEstructuraConsejosNumeradosAudio } from "@/video/visuales/validarEdicionDesdeAudio";
import { generarVoz, type CredencialesCloudinary } from "./generarVoz";
import { alinearPalabras } from "./alinearPalabras";
import { construirCamposDeTiempo } from "./compactarPausas";
import { verificarPalabrasCompletas } from "./verificarPalabrasCompletas";
import { calcularHashNarracion } from "./hashNarracion";

// Extraído de app/api/admin/reel-automatico-prueba/guion/route.ts
// (paso 1 de la integración a /contenido, plan en memoria
// plan_integracion_contenido_organico_fase_b_v2) -- ese arnés ya probó
// esta cadena completa en staging durante 12 rondas reales (voz,
// compactación de pausas, validadores de audio). Esta función es ese
// MISMO pipeline, sin cambios de comportamiento, para que tanto el
// arnés admin como la ruta real de /contenido (app/api/contenido/[id]/
// guion/route.ts, solo para receta "consejos_numerados") lo llamen una
// sola vez. Todo lo que es específico de cada ruta (fetch de
// usuario/marca, piezas del álbum, persistencia en la base, forma de
// la respuesta HTTP) se queda en cada route.ts -- acá solo vive la
// generación+validación+voz.
const TIMEOUT_OPENAI_MS = 60_000;

export async function llamarOpenAI(apiKey: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_OPENAI_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-5.6-sol",
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

export type ParametrosGenerarGuionConVoz = {
  apiKeyUsuario: string;
  cloudinary: CredencialesCloudinary;
  voz: string;
  tema: TemaGuion;
  entrada: EntradaGuionOrganico;
  recetaConAudio: RecetaOrganica;
  tienePiezas: boolean;
  pistaIdElegida: string | null;
  duracionObjetivoS: number;
  recetaId: RecetaOrganicaId;
  erroresPrevios?: string[];
  maxReintentos?: number;
  // Estilos de las piezas anteriores de la cuenta, la más reciente
  // primero (rotación de estilos, paso 3). Sin historial: el primero
  // disponible.
  historialEstilos?: (string | null)[];
  // Reel ilustrado (fase 2): solo cuentas de REELS_ILUSTRADOS_EMAILS.
  conPlanIlustrado?: boolean;
  // Inyectable para pruebas; por defecto la misma IA del guion.
  llamarIAPlan?: (prompt: string) => Promise<string>;
};

// Qué pasó con el plan ilustrado (para registrar y mostrar al admin).
export type EstadoPlanIlustrado =
  | { estado: "no_aplica" }
  | { estado: "generado"; intentos: number; ajustes: string[]; historial: string[][] }
  | { estado: "respaldo"; errores: string[]; historial: string[][] };

export type ResultadoGenerarGuionConVoz =
  | {
      ok: true;
      guion: Guion;
      puntajeAlineacion: number;
      intentosGuion: number;
      crudo: { palabrasPorEscenaCrudo: unknown; silencios: unknown };
      planIlustrado: EstadoPlanIlustrado;
    }
  | { ok: false; status: number; error: string; resumenErrores?: string[]; propuestaSerie?: PropuestaSerie };

export type ParametrosRegenerarVoz = { openaiKey: string; voz: string; cloudinary: CredencialesCloudinary };

export type ResultadoRegenerarVoz =
  | {
      ok: true;
      campos: Pick<Guion, "tiemposRender" | "palabrasPorEscena" | "segmentosAudio" | "narracionHash" | "vozUrl">;
      puntajeAlineacion: number;
      crudo: { palabrasPorEscenaCrudo: unknown; silencios: unknown };
    }
  | { ok: false; status: number; error: string; resumenErrores?: string[] };

// Segunda mitad de generarGuionConVoz(), sin el llamado a la IA --
// para cuando el admin edita una narración a mano en la revisión
// (app/contenido/[id]/page.tsx): el texto ya está escrito, no hace
// falta pedirle a la IA uno nuevo, solo volver a generar voz/tiempos
// para el texto editado. Igual se revalida contra los mismos
// validadores de audio (un evento con palabra fuera de rango por el
// nuevo conteo de palabras tiene que detectarse ACÁ, no solo en la
// generación inicial).
export async function regenerarVozParaGuion(escenas: Guion["escenas"], params: ParametrosRegenerarVoz): Promise<ResultadoRegenerarVoz> {
  const hallazgosAudio = validarEdicionDesdeAudio(escenas).map((h) => `${h.escenaId}: ${h.mensaje}`);
  const hallazgosEstructura = validarEstructuraConsejosNumeradosAudio(escenas).map((h) => `${h.escenaId}: ${h.mensaje}`);
  const erroresTotales = [...hallazgosAudio, ...hallazgosEstructura];
  if (erroresTotales.length > 0) {
    return { ok: false, status: 400, error: "La narración editada ya no es consistente con sus eventos/visuales.", resumenErrores: erroresTotales };
  }

  const voz = await generarVozYTiempos(
    escenas.map((e) => ({ id: e.id, narracion: e.narracion ?? "" })),
    params
  );
  if (!voz.ok) return voz;
  return {
    ok: true,
    campos: { ...voz.campos, narracionHash: calcularHashNarracion(escenas) },
    puntajeAlineacion: voz.puntajeAlineacion,
    crudo: voz.crudo,
  };
}

export type ResultadoVozYTiempos =
  | {
      ok: true;
      campos: Pick<Guion, "tiemposRender" | "palabrasPorEscena" | "segmentosAudio" | "vozUrl">;
      puntajeAlineacion: number;
      crudo: { palabrasPorEscenaCrudo: unknown; silencios: unknown };
    }
  | { ok: false; status: number; error: string; resumenErrores?: string[] };

// Voz + tiempos para narraciones ya escritas, sin validar ningún
// esquema de guion: TTS -> Whisper -> alineación -> compactación de
// pausas -> verificación de palabras completas. La usan
// regenerarVozParaGuion() y el arnés admin del reel ilustrado (fase 1),
// que trae su propia narración fija.
export async function generarVozYTiempos(narraciones: { id: string; narracion: string }[], params: ParametrosRegenerarVoz): Promise<ResultadoVozYTiempos> {
  const textoCompleto = narraciones.map((e) => e.narracion).join(" ");
  const { audioUrl, palabras, silencios } = await generarVoz(textoCompleto, {
    openaiKey: params.openaiKey,
    voz: params.voz,
    cloudinary: params.cloudinary,
  });
  const { palabrasPorEscena: palabrasPorEscenaCrudo, puntaje } = alinearPalabras(narraciones, palabras);
  const { tiemposRender, palabrasPorEscena, segmentosAudio, palabrasFlat, tramosPorEscena } = construirCamposDeTiempo(palabrasPorEscenaCrudo, silencios);

  const hallazgosPalabrasPerdidas = verificarPalabrasCompletas(palabrasFlat, tramosPorEscena);
  if (hallazgosPalabrasPerdidas.length > 0) {
    return {
      ok: false,
      status: 502,
      error: "La compactación de pausas se comió parte de una palabra real -- no se entrega un reel con audio mordido.",
      resumenErrores: hallazgosPalabrasPerdidas.map((h) => h.mensaje),
    };
  }

  return {
    ok: true,
    campos: { tiemposRender, palabrasPorEscena, segmentosAudio, vozUrl: audioUrl },
    puntajeAlineacion: puntaje,
    crudo: { palabrasPorEscenaCrudo, silencios },
  };
}

export async function generarGuionConVoz(params: ParametrosGenerarGuionConVoz): Promise<ResultadoGenerarGuionConVoz> {
  const maxReintentos = params.maxReintentos ?? 2;
  const intentosRegistrados: { errores: string[] }[] = [];

  // "Tu idea para el video": si el usuario escribió una idea desarrollada,
  // el guion la sigue (puntos y orden) y solo usa los datos que él
  // escribió o que tiene la marca.
  const idea = params.entrada.tema?.trim() ?? "";
  const esIdea = clasificarIdea(idea) === "idea";
  const fuentesReales = [idea, params.entrada.infoAdicionalMarca ?? "", ...params.entrada.productos.map(textoProducto), params.entrada.productoPieza ? textoProducto(params.entrada.productoPieza) : ""].join("\n");
  let propuestaSerie: PropuestaSerie | null = null;

  async function intentar(erroresPrevios?: string[]): Promise<{ ok: true; guion: Guion } | { ok: false; errores: string[] }> {
    const prompt = construirPromptGuionOrganicoConAudio(params.entrada, erroresPrevios);
    const contenido = await llamarOpenAI(params.apiKeyUsuario, prompt);

    let crudo: unknown;
    try {
      crudo = JSON.parse(contenido);
    } catch {
      const errores = ["La respuesta no fue un JSON válido."];
      intentosRegistrados.push({ errores });
      return { ok: false, errores };
    }

    const crudoObj = crudo as Record<string, unknown>;
    // La idea no cabe en un reel: la IA propone una serie (no se recorta en silencio).
    if (esIdea && crudoObj?.no_cabe === true) {
      const partes = Array.isArray(crudoObj.partes) ? (crudoObj.partes as { titulo?: unknown; idea?: unknown }[]) : [];
      const validas = partes
        .filter((p) => typeof p?.idea === "string" && p.idea.trim().length > 0)
        .map((p, i) => ({ titulo: typeof p.titulo === "string" && p.titulo.trim() ? p.titulo.trim().slice(0, 120) : `Parte ${i + 1}`, idea: (p.idea as string).trim().slice(0, LIMITE_IDEA) }));
      if (validas.length >= 2 && validas.length <= MAX_PARTES_SERIE) {
        propuestaSerie = { motivo: typeof crudoObj.motivo === "string" ? crudoObj.motivo.slice(0, 300) : "Tu idea no cabe en un reel de ~30 segundos.", partes: validas };
        return { ok: false, errores: [] };
      }
      const errores = [`"no_cabe" necesita entre 2 y ${MAX_PARTES_SERIE} partes, cada una con su "idea".`];
      intentosRegistrados.push({ errores });
      return { ok: false, errores };
    }
    const escenasSinNumeracionDoble = limpiarNumeracionItemsLista(crudoObj?.escenas);
    const escenasAjustadas = ajustarDuracionesProporcional(escenasSinNumeracionDoble, params.duracionObjetivoS);
    const hashtagsLimpios = limpiarHashtags(crudoObj?.hashtags);
    const candidato = {
      version: 1 as const,
      formato: "9x16" as const,
      fps: 30 as const,
      uso: "organico" as const,
      receta_organica: params.recetaId,
      gancho_tipo: params.entrada.ganchoTipoAsignado,
      duracion_objetivo_s: params.duracionObjetivoS,
      bucle: crudoObj?.bucle,
      tema: params.tema,
      musica: { pista_id: params.pistaIdElegida, volumen: 0.35 },
      escenas: escenasAjustadas,
      publicacion: { caption: crudoObj?.caption, hashtags: hashtagsLimpios ?? crudoObj?.hashtags },
    };

    const resultado = GuionSchema.safeParse(candidato);
    if (!resultado.success) {
      const errores = resultado.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      intentosRegistrados.push({ errores });
      return { ok: false, errores };
    }

    const erroresReceta = validarContraRecetaOrganica(resultado.data, params.recetaConAudio, params.tienePiezas);
    const idsUsados = idsDeMediaUsados(resultado.data.escenas);
    const idsValidos = new Set(params.entrada.piezas.map((p) => p.id));
    const erroresMedia = idsUsados.filter((idUsado) => !idsValidos.has(idUsado)).map((idUsado) => `media_id "${idUsado}" no está entre las piezas disponibles.`);
    // comparacion_foto difumina y aclara una FOTO -- un video no sirve ahí.
    const idsVideo = new Set(params.entrada.piezas.filter((p) => p.tipo === "video").map((p) => p.id));
    for (const escena of resultado.data.escenas) {
      if (escena.visual?.tipo === "comparacion_foto" && idsVideo.has(escena.visual.media_id)) {
        erroresMedia.push(`${escena.id}: comparacion_foto necesita una pieza de tipo imagen, "${escena.visual.media_id}" es un video.`);
      }
    }
    const textosEscenas = recopilarTextosEscenas(resultado.data.escenas);
    const erroresCopy = detectarFrasesDescargo(textosEscenas).map((m) => `copy tímido: ${m}`);
    const erroresVacios = detectarFrasesVacias(textosEscenas).map((m) => `copy abstracto: ${m}`);
    const hallazgosAudio = validarEdicionDesdeAudio(resultado.data.escenas).map((h) => `${h.escenaId}: ${h.mensaje}`);
    const hallazgosEstructura = validarEstructuraConsejosNumeradosAudio(resultado.data.escenas).map((h) => `${h.escenaId}: ${h.mensaje}`);

    const textosConVoz = [...resultado.data.escenas.map((e) => e.narracion ?? ""), ...textosEscenas, resultado.data.publicacion?.caption ?? ""];
    const erroresIdea = esIdea ? [...verificarIdeaRespetada(idea, textosConVoz), ...detectarDatosInventados(textosConVoz, fuentesReales)] : [];

    const erroresTotales = [...erroresReceta, ...erroresMedia, ...erroresCopy, ...erroresVacios, ...hallazgosAudio, ...hallazgosEstructura, ...erroresIdea];
    intentosRegistrados.push({ errores: erroresTotales });
    if (erroresTotales.length > 0) return { ok: false, errores: erroresTotales };

    return { ok: true, guion: resultado.data };
  }

  let resultado = await intentar(params.erroresPrevios);
  let intentosGuion = 1;
  while (!resultado.ok && !propuestaSerie && intentosGuion <= maxReintentos) {
    resultado = await intentar(resultado.errores);
    intentosGuion += 1;
  }

  if (propuestaSerie) {
    return { ok: false, status: 422, error: "Tu idea no cabe en un reel de ~30 segundos.", propuestaSerie };
  }
  if (!resultado.ok) {
    return { ok: false, status: 502, error: "No se pudo generar un guion válido (narración/visual) después de varios intentos.", resumenErrores: resultado.errores };
  }

  // Plan ilustrado (fase 2): sobre la narración ya validada y ANTES de
  // pagar la voz. Si no sale válido, el reel sigue con su estilo.
  let plan: PlanIlustrado | null = null;
  let estadoPlan: EstadoPlanIlustrado = { estado: "no_aplica" };
  if (params.conPlanIlustrado) {
    const narraciones = resultado.guion.escenas.map((e) => ({ id: e.id, narracion: e.narracion ?? "" }));
    const llamar = params.llamarIAPlan ?? ((prompt: string) => llamarOpenAI(params.apiKeyUsuario, prompt));
    const r = await generarPlanIlustrado(narraciones, llamar);
    if (r.ok) {
      plan = r.plan;
      estadoPlan = { estado: "generado", intentos: r.intentos, ajustes: r.ajustes, historial: r.historial };
    } else estadoPlan = { estado: "respaldo", errores: r.errores, historial: r.historial };
  }

  // Voz real -- única llamada de toda esta función que cuesta dinero de
  // verdad (TTS + Whisper). Solo se llega acá con un guion que YA pasó
  // validarEdicionDesdeAudio(), para no gastarla en un guion que de
  // todos modos se iba a descartar. Comparte la segunda mitad del
  // pipeline con regenerarVozParaGuion() (revisión en /contenido tras
  // editar una narración a mano) -- una sola implementación real.
  const resultadoVoz = await regenerarVozParaGuion(resultado.guion.escenas, { openaiKey: params.apiKeyUsuario, voz: params.voz, cloudinary: params.cloudinary });
  if (!resultadoVoz.ok) {
    return resultadoVoz;
  }

  // Estilo visual y layout por escena: los decide el código, nunca la IA,
  // y quedan en el guion para medirlos (O2). Rotación: el menos usado en
  // las últimas piezas, nunca igual al anterior; "foto" solo si la pieza
  // tiene una foto real sin texto. El análisis de las fotos de la pieza
  // queda en el guion para que el render sepa cuáles sirven de fondo.
  const analisisDeLaPieza = Object.fromEntries(Object.entries(params.entrada.analisisPiezas).filter(([id]) => params.entrada.piezas.some((p) => p.id === id)));
  const mediosDeLaPieza = Object.fromEntries(params.entrada.piezas.map((p) => [p.id, { tipo: p.tipo }]));
  const fotosSinTexto = idsFotosSinTexto(mediosDeLaPieza, analisisDeLaPieza);
  const estiloElegido = elegirEstilo(params.historialEstilos ?? [], estilosDisponibles(fotosSinTexto.length > 0));
  const guionFinal: Guion = {
    ...resultado.guion,
    ...resultadoVoz.campos,
    ...(Object.keys(analisisDeLaPieza).length > 0 ? { analisisPiezas: analisisDeLaPieza } : {}),
    estilo: asignarEstilo(resultado.guion.escenas, estiloElegido, { fotosSinTexto }),
  };
  if (plan && resultadoVoz.campos.palabrasPorEscena) {
    // Con la voz real: separa acciones de lugares distintos muy juntas y
    // rellena tramos de más de 2,5 s sin cambio (la regla final es por tiempo).
    const { plan: ajustado, ajustes } = ajustarConVozReal(plan, resultadoVoz.campos.palabrasPorEscena);
    guionFinal.ilustrado = ajustado;
    if (estadoPlan.estado === "generado") estadoPlan = { ...estadoPlan, ajustes: [...estadoPlan.ajustes, ...ajustes] };
  }

  return { ok: true, guion: guionFinal, puntajeAlineacion: resultadoVoz.puntajeAlineacion, intentosGuion, crudo: resultadoVoz.crudo, planIlustrado: estadoPlan };
}

// Un producto del catálogo como texto (fuente de datos reales: su precio y lo que destaca).
function textoProducto(p: Pick<ProductoResumenNegocio, "nombre" | "precio_cop" | "destacar">): string {
  const precio = p.precio_cop ? `$${p.precio_cop.toLocaleString("es-CO")} ${p.precio_cop}` : "";
  return `${p.nombre} ${precio} ${p.destacar ?? ""}`;
}
