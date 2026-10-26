import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// Tercer tipo sobre trabajos_ia (los otros dos: "revision_imagen" y
// "agregar_anuncios"). Sin candado -- a diferencia de agregar_anuncios,
// un reintento acá no tiene ningún efecto real que pueda duplicarse,
// solo vuelve a gastar la llamada a OpenAI.
export const TIPO_TRABAJO = "adn_marca";
export const TIMEOUT_PROCESANDO_MS = 10 * 60 * 1000;
// Bien por debajo del tope de 10 minutos -- si n8n no respondió para
// entonces, mejor que falle acá con un mensaje claro que dejar que el
// cron horario sea lo único que lo note.
const TIMEOUT_N8N_MS = 8 * 60 * 1000;

export type TrabajoAdnMarca = {
  id: string;
  user_id: string;
  tipo: string;
  estado: "pendiente" | "procesando" | "lista" | "fallida";
  resultado: { adn_marca: Record<string, unknown>; adn_resumen: string } | null;
  error: string | null;
  intento_desde: string | null;
  creado_en: string;
  actualizado_en: string;
};

// Mismo criterio que revisarTimeoutTrabajo en revisionImagenJobs.ts,
// filtrando por este tipo -- red de seguridad del servidor; el cron
// horario (vencer-propuestas) queda de respaldo si nadie sigue
// consultando.
export async function revisarTimeoutTrabajo(job: TrabajoAdnMarca): Promise<TrabajoAdnMarca> {
  if (job.estado !== "procesando" && job.estado !== "pendiente") return job;
  if (!job.intento_desde) return job;
  if (Date.now() - new Date(job.intento_desde).getTime() <= TIMEOUT_PROCESANDO_MS) return job;

  const { data: actualizado } = await supabaseAdmin
    .from("trabajos_ia")
    .update({
      estado: "fallida",
      error: "Se interrumpió el análisis, intenta de nuevo",
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("tipo", TIPO_TRABAJO)
    .eq("estado", job.estado)
    .select()
    .single();

  return (actualizado as TrabajoAdnMarca) || job;
}

// El trabajo real, corriendo en after() (ver app/api/marca-adn/route.ts).
// Mismo webhook de siempre (analizar_adn_marca), solo que ahora fuera
// del ciclo de la petición -- si el cliente cierra la pestaña, el
// análisis sigue y queda guardado para cuando vuelva.
export async function procesarAdnMarca(
  jobId: string,
  datos: { emailBusqueda: string; openaiKey: string; imagenesBase64: string[] }
): Promise<void> {
  await supabaseAdmin
    .from("trabajos_ia")
    .update({ estado: "procesando", actualizado_en: new Date().toISOString() })
    .eq("id", jobId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_N8N_MS);

  try {
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/analizar_adn_marca", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: datos.emailBusqueda,
        openai_key: datos.openaiKey,
        imagenes_base64: datos.imagenesBase64,
      }),
      signal: controller.signal,
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      await supabaseAdmin
        .from("trabajos_ia")
        .update({
          estado: "fallida",
          error: data.error || "No se pudo analizar el ADN de marca",
          actualizado_en: new Date().toISOString(),
        })
        .eq("id", jobId);
      return;
    }

    await supabaseAdmin
      .from("trabajos_ia")
      .update({
        estado: "lista",
        resultado: { adn_marca: data.adn_marca, adn_resumen: data.adn_resumen },
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    const esAbort = err instanceof Error && err.name === "AbortError";
    console.error(`[procesarAdnMarca] ${jobId}:`, err);
    await supabaseAdmin
      .from("trabajos_ia")
      .update({
        estado: "fallida",
        error: esAbort ? "El análisis tardó más de lo esperado" : "No se pudo conectar con el servidor de IA",
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", jobId);
  } finally {
    clearTimeout(timeoutId);
  }
}
