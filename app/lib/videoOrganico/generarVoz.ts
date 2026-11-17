import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { detectarSilenciosReales, type SilencioReal } from "./detectarSilenciosReales";

// Fase B v2.0 (docs/diseno/plan_contenido_organico_fase_b_v2.md,
// punto 2). ÚNICA función pública de este archivo -- el resto de el
// sistema (render, control de calidad, prompt) nunca llama a OpenAI
// TTS/Whisper directo, siempre a generarVoz(). Motivo real: tts-1/
// tts-1-hd/gpt-4o-mini-tts se apagan el 6-ene-2027 y whisper-1 (el
// único modelo de transcripción con timestamps por palabra) está en
// el mismo camino de deprecación que el resto de modelos de
// transcripción más viejos -- cuando haya que migrar, es tocar este
// archivo solo, nunca perseguir cada lugar del código que hoy asume
// OpenAI.
const TIMEOUT_OPENAI_MS = 60_000;
const MODELO_TTS = "gpt-4o-mini-tts";
const MODELO_TRANSCRIPCION = "whisper-1";

// Tono de marca pedido explícito por Juan José (18 nov 2026) -- gpt-4o-mini-tts
// es el único modelo de TTS de OpenAI que admite control de tono por
// instrucciones (confirmado por la investigación externa del plan;
// tts-1/tts-1-hd no lo soportan).
// Ronda I (escuchó el reel completo): "enérgico" sonaba robótico y con
// el tono alto. El tope de pausas tampoco va acá -- compactarPausas.ts
// ya no decide los cortes a partir de esta instrucción ni de los
// tiempos de Whisper, sino del silencio real medido en la onda de
// audio (ver detectarSilenciosReales.ts); esta instrucción solo pide
// el TONO, nunca el ritmo exacto de pausas.
const INSTRUCCIONES_TONO =
  "Español latino neutro con calidez colombiana, conversacional y cálido, como explicándole a un amigo; tono medio, sin exagerar la emoción.";

export type PalabraConTiempo = { texto: string; inicio_s: number; fin_s: number };

export type ResultadoGenerarVoz = {
  audioUrl: string;
  palabras: PalabraConTiempo[];
  silencios: SilencioReal[];
};

export type CredencialesCloudinary = { cloudName: string; apiKey: string; apiSecret: string };

function esErrorInsuficienteCredito(detalle: string): boolean {
  return /insufficient_quota|credit_balance_exhausted/.test(detalle);
}

const MENSAJE_SIN_CREDITOS = "Tu cuenta de OpenAI no tiene créditos. Agrega saldo en platform.openai.com y vuelve a intentar.";

// Privado -- llama a /v1/audio/speech. Devuelve el audio crudo (bytes),
// nunca una URL todavía (eso lo decide generarVoz() al subirlo).
async function llamarTTS(openaiKey: string, texto: string, voz: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_OPENAI_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: MODELO_TTS,
        voice: voz,
        input: texto,
        instructions: INSTRUCCIONES_TONO,
        response_format: "mp3",
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detalle = await res.text();
      if (esErrorInsuficienteCredito(detalle)) throw new Error(MENSAJE_SIN_CREDITOS);
      throw new Error(`Error de OpenAI (${res.status}): ${detalle}`);
    }
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Privado -- llama a /v1/audio/transcriptions con whisper-1 para los
// timestamps por palabra del audio que generó TTS (nunca del texto
// original: whisper transcribe lo que de verdad se escucha).
async function llamarTranscripcion(openaiKey: string, audio: ArrayBuffer): Promise<PalabraConTiempo[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_OPENAI_MS);
  try {
    const formData = new FormData();
    formData.append("file", new Blob([audio], { type: "audio/mp3" }), "narracion.mp3");
    formData.append("model", MODELO_TRANSCRIPCION);
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detalle = await res.text();
      if (esErrorInsuficienteCredito(detalle)) throw new Error(MENSAJE_SIN_CREDITOS);
      throw new Error(`Error de OpenAI (${res.status}): ${detalle}`);
    }
    const data = await res.json();
    const palabras = data?.words as { word?: string; start?: number; end?: number }[] | undefined;
    if (!Array.isArray(palabras)) {
      throw new Error("La transcripción no devolvió los timestamps por palabra esperados.");
    }
    return palabras
      .filter((p) => typeof p.word === "string" && typeof p.start === "number" && typeof p.end === "number")
      .map((p) => ({ texto: p.word as string, inicio_s: p.start as number, fin_s: p.end as number }));
  } finally {
    clearTimeout(timeoutId);
  }
}

// Privado -- sube el audio final a Cloudinary, mismo patrón que
// app/api/admin/musica/route.ts (resource_type "video", Cloudinary no
// tiene un tipo "audio" separado).
async function subirAudioACloudinary(audio: ArrayBuffer, credenciales: CredencialesCloudinary): Promise<string> {
  cloudinary.config({
    cloud_name: credenciales.cloudName,
    api_key: credenciales.apiKey,
    api_secret: credenciales.apiSecret,
  });
  const base64 = Buffer.from(audio).toString("base64");
  const dataUri = `data:audio/mp3;base64,${base64}`;
  const resultado = await cloudinary.uploader.upload(dataUri, { resource_type: "video" });
  return resultado.secure_url;
}

// Genera la narración completa de un reel: texto -> voz (TTS) -> sube
// a Cloudinary -> transcribe esa misma voz (Whisper) para los tiempos
// reales por palabra. "voz" es el nombre real de la voz de OpenAI
// (ej. "alloy"/"nova") -- resuelto por quien llama (marcas.voz_tts o
// un valor por defecto), generarVoz() nunca elige ni inventa una.
export async function generarVoz(
  textoCompleto: string,
  opciones: { openaiKey: string; voz: string; cloudinary: CredencialesCloudinary }
): Promise<ResultadoGenerarVoz> {
  const audio = await llamarTTS(opciones.openaiKey, textoCompleto, opciones.voz);
  const [audioUrl, palabras, silencios] = await Promise.all([
    subirAudioACloudinary(audio, opciones.cloudinary),
    llamarTranscripcion(opciones.openaiKey, audio),
    detectarSilenciosReales(audio),
  ]);
  return { audioUrl, palabras, silencios };
}
