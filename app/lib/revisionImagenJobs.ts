import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// Primer tipo que usa la tabla general trabajos_ia (ver también
// app/estrategia/page.tsx -- "Subir el mío"). Pensada para reutilizarse
// en los próximos trabajos largos de IA (agregar anuncios, ADN de
// marca), por eso cada fila lleva "tipo" y las consultas de este
// archivo siempre filtran por él.
const TIPO_TRABAJO = "revision_imagen";

// Red de seguridad del lado del servidor -- el cliente ya se rinde a
// los 40s y muestra "No pude revisarla" (ver ElegirEstrategia.tsx), así
// que esto es solo para que una fila no quede "procesando" para
// siempre si after() nunca llegó a terminar (ej. un despliegue).
export const TIMEOUT_PROCESANDO_MS = 2 * 60 * 1000;
// Bien por debajo del tope de 40s del cliente -- si n8n no respondió
// para entonces, no tiene sentido seguir esperando: el cliente ya dejó
// de mirar.
const TIMEOUT_N8N_MS = 35 * 1000;

export type ResultadoRevisionImagen = {
  cumple: boolean;
  cumple_score?: number | null;
  // Nuevo campo que n8n todavía no devuelve (el workflow se está
  // ajustando) -- hasta entonces, el cliente cae a "comentario" como un
  // solo punto. Ver el comentario en analizar_creativos_album.
  puntos?: string[];
  comentario?: string;
};

export type TrabajoRevisionImagen = {
  id: string;
  user_id: string;
  tipo: string;
  estado: "pendiente" | "procesando" | "lista" | "fallida";
  resultado: ResultadoRevisionImagen | null;
  error: string | null;
  intento_desde: string | null;
  creado_en: string;
  actualizado_en: string;
};

// Mismo criterio que revisarTimeoutJob en estrategiasJobs.ts, pero
// sobre trabajos_ia filtrando por tipo.
export async function revisarTimeoutTrabajo(job: TrabajoRevisionImagen): Promise<TrabajoRevisionImagen> {
  if (job.estado !== "procesando" && job.estado !== "pendiente") return job;
  if (!job.intento_desde) return job;
  if (Date.now() - new Date(job.intento_desde).getTime() <= TIMEOUT_PROCESANDO_MS) return job;

  const { data: actualizado } = await supabaseAdmin
    .from("trabajos_ia")
    .update({
      estado: "fallida",
      error: "Se interrumpió la revisión, intenta de nuevo",
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("tipo", TIPO_TRABAJO)
    .eq("estado", job.estado)
    .select()
    .single();

  return (actualizado as TrabajoRevisionImagen) || job;
}

// El trabajo real, corriendo en after() (ver app/api/estrategia/
// revisar-imagen-subida/route.ts). Reusa el webhook analizar_creativos_album
// (el mismo que ya usa el análisis de álbum) con un solo creativo.
export async function procesarRevisionImagen(
  jobId: string,
  datos: {
    emailBusqueda: string;
    openaiKey: string;
    estrategiaMini: any;
    creativoAlbum: any;
  }
): Promise<void> {
  await supabaseAdmin
    .from("trabajos_ia")
    .update({ estado: "procesando", actualizado_en: new Date().toISOString() })
    .eq("id", jobId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_N8N_MS);

  try {
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/analizar_creativos_album", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: datos.emailBusqueda,
        openai_key: datos.openaiKey,
        estrategia: datos.estrategiaMini,
        creativos_album: [datos.creativoAlbum],
      }),
      signal: controller.signal,
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      await supabaseAdmin
        .from("trabajos_ia")
        .update({
          estado: "fallida",
          error: data.error || "No se pudo revisar la imagen",
          actualizado_en: new Date().toISOString(),
        })
        .eq("id", jobId);
      return;
    }

    // creativos_album llevaba un solo item -- detalle[0] es su resultado.
    const detalle = Array.isArray(data.detalle) ? data.detalle[0] : null;

    await supabaseAdmin
      .from("trabajos_ia")
      .update({
        estado: "lista",
        resultado: detalle || { cumple: true, comentario: "" },
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    const esAbort = err instanceof Error && err.name === "AbortError";
    console.error(`[procesarRevisionImagen] ${jobId}:`, err);

    await supabaseAdmin
      .from("trabajos_ia")
      .update({
        estado: "fallida",
        error: esAbort ? "La revisión tardó más de lo esperado" : "No se pudo conectar con el servidor de IA",
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", jobId);
  } finally {
    clearTimeout(timeoutId);
  }
}

export { TIPO_TRABAJO };
