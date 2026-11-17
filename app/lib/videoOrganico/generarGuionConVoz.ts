import "server-only";
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

async function llamarOpenAI(apiKey: string, prompt: string): Promise<string> {
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
};

export type ResultadoGenerarGuionConVoz =
  | {
      ok: true;
      guion: Guion;
      puntajeAlineacion: number;
      intentosGuion: number;
      crudo: { palabrasPorEscenaCrudo: unknown; silencios: unknown };
    }
  | { ok: false; status: number; error: string; resumenErrores?: string[] };

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

  const textoCompleto = escenas.map((e) => e.narracion ?? "").join(" ");
  const { audioUrl, palabras, silencios } = await generarVoz(textoCompleto, {
    openaiKey: params.openaiKey,
    voz: params.voz,
    cloudinary: params.cloudinary,
  });
  const { palabrasPorEscena: palabrasPorEscenaCrudo, puntaje } = alinearPalabras(
    escenas.map((e) => ({ id: e.id, narracion: e.narracion ?? "" })),
    palabras
  );
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
    campos: { tiemposRender, palabrasPorEscena, segmentosAudio, narracionHash: calcularHashNarracion(escenas), vozUrl: audioUrl },
    puntajeAlineacion: puntaje,
    crudo: { palabrasPorEscenaCrudo, silencios },
  };
}

export async function generarGuionConVoz(params: ParametrosGenerarGuionConVoz): Promise<ResultadoGenerarGuionConVoz> {
  const maxReintentos = params.maxReintentos ?? 2;
  const intentosRegistrados: { errores: string[] }[] = [];

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
    const textosEscenas = recopilarTextosEscenas(resultado.data.escenas);
    const erroresCopy = detectarFrasesDescargo(textosEscenas).map((m) => `copy tímido: ${m}`);
    const erroresVacios = detectarFrasesVacias(textosEscenas).map((m) => `copy abstracto: ${m}`);
    const hallazgosAudio = validarEdicionDesdeAudio(resultado.data.escenas).map((h) => `${h.escenaId}: ${h.mensaje}`);
    const hallazgosEstructura = validarEstructuraConsejosNumeradosAudio(resultado.data.escenas).map((h) => `${h.escenaId}: ${h.mensaje}`);

    const erroresTotales = [...erroresReceta, ...erroresMedia, ...erroresCopy, ...erroresVacios, ...hallazgosAudio, ...hallazgosEstructura];
    intentosRegistrados.push({ errores: erroresTotales });
    if (erroresTotales.length > 0) return { ok: false, errores: erroresTotales };

    return { ok: true, guion: resultado.data };
  }

  let resultado = await intentar(params.erroresPrevios);
  let intentosGuion = 1;
  while (!resultado.ok && intentosGuion <= maxReintentos) {
    resultado = await intentar(resultado.errores);
    intentosGuion += 1;
  }

  if (!resultado.ok) {
    return { ok: false, status: 502, error: "No se pudo generar un guion válido (narración/visual) después de varios intentos.", resumenErrores: resultado.errores };
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

  const guionFinal: Guion = { ...resultado.guion, ...resultadoVoz.campos };

  return { ok: true, guion: guionFinal, puntajeAlineacion: resultadoVoz.puntajeAlineacion, intentosGuion, crudo: resultadoVoz.crudo };
}
