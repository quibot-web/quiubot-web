import { AnalisisPiezaSchema, VERSION_ANALISIS_PIEZA, type AnalisisPieza } from "@/app/lib/analisisPieza";
import { PROMPT_ANALISIS_PIEZA } from "@/video/promptAnalisisPieza";

// Compartido entre /api/video/analizar-pieza (al elegir la pieza, para
// el badge) y /api/video/guion (reintento si la pieza llegó sin
// análisis en caché) -- la llamada a OpenAI vive en un solo lugar.
// Aparte de MODELO_GUION_VIDEO (gpt-5.6-sol): el análisis de piezas usa
// el mismo modelo que ya prueba con imágenes el flujo de n8n
// analizar_creativos_album v4, no el modelo del guion.
export const MODELO_ANALISIS_IMAGEN = "gpt-4o";
const TIMEOUT_OPENAI_MS = 60_000;

export async function analizarPiezaConOpenAI(apiKey: string, urlImagen: string): Promise<AnalisisPieza> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_OPENAI_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODELO_ANALISIS_IMAGEN,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT_ANALISIS_PIEZA },
              { type: "image_url", image_url: { url: urlImagen } },
            ],
          },
        ],
        max_tokens: 500,
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

    const crudo = JSON.parse(contenido);
    const resultado = AnalisisPiezaSchema.safeParse({ ...crudo, version: VERSION_ANALISIS_PIEZA });
    if (!resultado.success) {
      throw new Error(`Respuesta de análisis inválida: ${resultado.error.issues.map((i) => i.message).join(" | ")}`);
    }
    return resultado.data;
  } finally {
    clearTimeout(timeoutId);
  }
}
