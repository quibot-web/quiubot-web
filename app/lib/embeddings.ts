const MODELO_EMBEDDING = "text-embedding-3-small";

/**
 * Genera el embedding (vector de 1536 dimensiones) de un texto usando OpenAI.
 * Recibe la API key del propio usuario admin (la que ya configuró en Integraciones),
 * no una variable de entorno del servidor.
 */
export async function generarEmbedding(texto: string, apiKey: string): Promise<number[]> {
  if (!apiKey) {
    throw new Error(
      "No tienes una API key de OpenAI configurada. Ve a Integraciones y conéctala primero."
    );
  }

  const respuesta = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELO_EMBEDDING,
      input: texto,
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Error de OpenAI (${respuesta.status}): ${detalle}`);
  }

  const data = await respuesta.json();
  return data.data[0].embedding;
}