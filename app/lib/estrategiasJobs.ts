import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";
import { aBase64 } from "@/app/lib/propuestas";
import { urlReducidaParaIA } from "@/app/lib/cloudinaryUrl";

// Mismo problema que ya resolvimos para crear_creativos (ver el
// comentario en app/api/propuestas/[id]/subir-fotos/route.ts): el proxy
// de Coolify corta la conexión HTTP del cliente antes de que n8n
// termine, y eso mata también el trabajo del lado del servidor. A
// diferencia de crear_creativos (donde n8n responde rápido con un
// job_id y hace la generación aparte), generar_estrategia no tiene ese
// diseño -- aquí es nuestro propio servidor el que espera a n8n, solo
// que ahora lo hace en after(), fuera del ciclo de la petición.
export const TIMEOUT_PROCESANDO_MS = 10 * 60 * 1000;
const TIMEOUT_N8N_MS = 6 * 60 * 1000;

export type EstrategiaJob = {
  id: string;
  user_id: string;
  estado: "pendiente" | "procesando" | "lista" | "fallida";
  resultado: any;
  error: string | null;
  tipo_error: string | null;
  entregado: boolean;
  intento_desde: string | null;
  creado_en: string;
  actualizado_en: string;
};

// Si un job sigue "pendiente" (after() nunca llegó a arrancar, ej. un
// despliegue que mató el proceso justo ahí) o "procesando" pero ya
// pasaron más de 10 minutos desde que arrancó, se marca "fallida" acá
// mismo -- no hace falta esperar a que pase alguien a consultarlo ni al
// cron horario (que queda como respaldo para cuando nadie está
// consultando, ej. la pestaña cerrada). El .eq("estado", job.estado) es
// una defensa barata contra una carrera con otra consulta concurrente
// que ya lo haya actualizado un instante antes.
export async function revisarTimeoutJob(job: EstrategiaJob): Promise<EstrategiaJob> {
  if (job.estado !== "procesando" && job.estado !== "pendiente") return job;
  if (!job.intento_desde) return job;
  if (Date.now() - new Date(job.intento_desde).getTime() <= TIMEOUT_PROCESANDO_MS) return job;

  const { data: actualizado } = await supabaseAdmin
    .from("estrategias_jobs")
    .update({
      estado: "fallida",
      error: "Se interrumpió la generación, intenta de nuevo",
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("estado", job.estado)
    .select()
    .single();

  return (actualizado as EstrategiaJob) || job;
}

// El trabajo real, corriendo en after() (ver app/api/generar-estrategia/
// route.ts) -- nunca dentro del ciclo de la petición HTTP original.
export async function procesarGeneracionEstrategia(
  jobId: string,
  datos: {
    emailBusqueda: string;
    userId: string;
    imagenesBase64: string[];
    objetivo: any;
    presupuestoDiarioCop: number;
    openaiKey: string;
    tipoContenido: "producto" | "servicio";
    descripcionServicio: string | null;
    datosProducto: string | null;
    modoEstructura: "advantage" | "prueba_conceptos";
    angulosAEvitar: string[];
  }
): Promise<void> {
  await supabaseAdmin
    .from("estrategias_jobs")
    .update({ estado: "procesando", actualizado_en: new Date().toISOString() })
    .eq("id", jobId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_N8N_MS);

  try {
    // Las fotos elegidas del catálogo/álbum llegan como URL de
    // Cloudinary (nunca base64) -- se convierten acá, antes de llamar
    // a n8n, para que el webhook siga recibiendo exactamente lo mismo
    // de siempre (un array de strings base64, nunca URLs). Se le pide a
    // Cloudinary la versión ya reducida (ver urlReducidaParaIA) para no
    // mandar el archivo original de varios MB -- una foto subida
    // directo ya sale liviana del navegador (comprimirSiHaceFalta), así
    // que esto solo iguala ese mismo tope para las que vienen de acá.
    const imagenesParaN8n = await Promise.all(
      datos.imagenesBase64.map((img) => (img.startsWith("data:") ? img : aBase64({ tipo: "url", valor: urlReducidaParaIA(img) })))
    );
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/generar_estrategia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: datos.emailBusqueda,
        imagenes_base64: imagenesParaN8n,
        objetivo: datos.objetivo,
        presupuesto_diario_cop: datos.presupuestoDiarioCop,
        openai_key: datos.openaiKey,
        tipo_contenido: datos.tipoContenido,
        descripcion_servicio: datos.descripcionServicio,
        datos_producto: datos.datosProducto,
        modo_estructura: datos.modoEstructura,
        angulos_a_evitar: datos.angulosAEvitar,
      }),
      signal: controller.signal,
    });

    const data = await n8nRes.json().catch(() => ({}));

    // n8n siempre responde HTTP 200 en su nodo "Respond to Webhook" de
    // éxito, incluso para data.ok === false (ej. diversidad_conceptos) --
    // mismo criterio que ya usaba la ruta síncrona.
    if (!n8nRes.ok || data.ok === false) {
      const mensajeError = data.error || "No se pudo generar la estrategia";
      const tipoError = data.tipo_error ?? null;
      const paso = tipoError === "diversidad_conceptos" ? "diversidad_conceptos" : "webhook_generar_estrategia";

      registrarError({
        origen: "generar_estrategia",
        userId: datos.userId,
        email: datos.emailBusqueda,
        paso,
        errorMensaje: mensajeError,
        detalleTecnico: JSON.stringify(data),
        objetivoId: datos.objetivo?.id ?? null,
      });

      await supabaseAdmin
        .from("estrategias_jobs")
        .update({ estado: "fallida", error: mensajeError, tipo_error: tipoError, actualizado_en: new Date().toISOString() })
        .eq("id", jobId);
      return;
    }

    // El uso del plan se cuenta SOLO aquí, con el resultado ya confirmado
    // -- una falla nunca le gasta al cliente una estrategia de su plan.
    await supabaseAdmin.from("estrategias_generadas").insert({
      user_id: datos.userId,
      tipo_contenido: datos.tipoContenido,
    });

    await supabaseAdmin
      .from("estrategias_jobs")
      .update({ estado: "lista", resultado: data, actualizado_en: new Date().toISOString() })
      .eq("id", jobId);
  } catch (err) {
    const esAbort = err instanceof Error && err.name === "AbortError";
    const mensajeError = esAbort
      ? "La generación tardó más de lo esperado -- intenta de nuevo."
      : "No se pudo conectar con el servidor de IA";

    console.error(`[procesarGeneracionEstrategia] ${jobId}:`, err);
    registrarError({
      origen: "generar_estrategia",
      userId: datos.userId,
      email: datos.emailBusqueda,
      paso: esAbort ? "timeout_n8n" : "conexion_con_n8n",
      errorMensaje: mensajeError,
      detalleTecnico: String(err),
      objetivoId: datos.objetivo?.id ?? null,
    });

    await supabaseAdmin
      .from("estrategias_jobs")
      .update({ estado: "fallida", error: mensajeError, actualizado_en: new Date().toISOString() })
      .eq("id", jobId);
  } finally {
    clearTimeout(timeoutId);
  }
}
