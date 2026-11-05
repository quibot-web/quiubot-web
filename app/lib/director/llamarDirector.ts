// Llamada a OpenAI compartida por todo lo que use "el cerebro del
// Director" (gpt-4o, BYO key, JSON) -- extraída de
// app/api/director/conversacion/route.ts (Paso 4 de la Fase 1) para
// que app/api/equipo/mensajes/route.ts (Fase 2, Commit 4) la reuse tal
// cual, sin duplicar el fetch/timeout/parseo. Cada ruta sigue
// manejando su propia persistencia -- esto solo llama al modelo.
const TIMEOUT_OPENAI_MS = 45_000;

export async function llamarDirector(
  apiKey: string,
  modelo: string,
  systemPrompt: string,
  historial: { role: "user" | "assistant"; content: string }[]
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_OPENAI_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelo,
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
