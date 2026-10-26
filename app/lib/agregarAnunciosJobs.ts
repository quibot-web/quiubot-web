import "server-only";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

// Segundo tipo que usa la tabla general trabajos_ia (el primero fue
// "revision_imagen", ver app/lib/revisionImagenJobs.ts). A diferencia de
// ese, acá SÍ hace falta el candado (lock_id + relectura, mismo patrón
// que procesarCreacionCreativos en app/lib/propuestas.ts): agregar_anuncios
// tiene un efecto real en Meta, así que dos intentos concurrentes no
// pueden terminar llamando al webhook dos veces.
export const TIPO_TRABAJO = "agregar_anuncios";
export const TIMEOUT_PROCESANDO_MS = 10 * 60 * 1000;

export type ResultadoAgregarAnuncios = {
  meta_adset_id: string | null;
  anuncios_creados: unknown[];
  anuncios_fallidos: unknown[];
  anuncios_reutilizados: unknown[];
  omitidos: unknown[];
};

// El trabajo real, corriendo en after() (ver dispararAgregarAnunciosEnSegundoPlano
// en app/lib/propuestas.ts). Mismo contrato que agregar_anuncios ya
// usaba de forma síncrona -- lo único que cambia es que ahora corre
// fuera del ciclo de la petición, y que un reintento (cron, o el botón
// "Reintentar" tras una fallida) es seguro: agregar_anuncios v2 en n8n
// es idempotente por propuesta_id (ya viaja en el payload), salta los
// anuncios que ya existen en Meta y devuelve anuncios_reutilizados.
export async function procesarAgregarAnuncios(
  jobId: string,
  propuestaId: string,
  datos: {
    userId: string;
    metaId: string | null;
    payloadN8n: Record<string, unknown>;
  }
): Promise<void> {
  const { data: job } = await supabaseAdmin.from("trabajos_ia").select("*").eq("id", jobId).eq("tipo", TIPO_TRABAJO).single();
  if (!job || job.estado !== "pendiente") {
    console.log(`[procesarAgregarAnuncios] ${jobId}: no existe o no está pendiente, no hace nada`);
    return;
  }

  // Mismo candado que procesarCreacionCreativos: no confiamos en lo que
  // devuelva update().select() -- se escribe un lock_id propio (dentro
  // de resultado, como ya hace propuestas.resultado.lock_id) y se
  // relee la fila para confirmar que quedó el nuestro.
  const loQueIntentoTomar = randomUUID();
  const ahoraClaim = new Date().toISOString();
  await supabaseAdmin
    .from("trabajos_ia")
    .update({ estado: "procesando", intento_desde: ahoraClaim, resultado: { lock_id: loQueIntentoTomar } })
    .eq("id", jobId)
    .eq("estado", "pendiente");

  const { data: trasClaim } = await supabaseAdmin.from("trabajos_ia").select("resultado").eq("id", jobId).single();
  const lockActual = (trasClaim?.resultado as any)?.lock_id;
  if (lockActual !== loQueIntentoTomar) {
    console.log(`[procesarAgregarAnuncios] ${jobId}: no se tomó el candado (lock actual="${lockActual ?? "null"}")`);
    return;
  }

  try {
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/agregar_anuncios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos.payloadN8n),
    });
    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      const motivo = data.motivo as string | undefined;
      const paso = data.paso as string | undefined;
      const mensajeError = data.error || "No se pudo agregar los anuncios en Meta";

      await supabaseAdmin.from("trabajos_ia").update({ estado: "fallida", error: mensajeError }).eq("id", jobId);
      await supabaseAdmin
        .from("propuestas")
        .update({ estado: "fallida", resultado: { error: mensajeError, motivo, paso } })
        .eq("id", propuestaId);
      await supabaseAdmin.from("bitacora").insert({
        user_id: datos.userId,
        meta_id: datos.metaId,
        propuesta_id: propuestaId,
        tipo_evento: "propuesta_aprobada_fallo",
        detalle: { accion: "agregar_anuncios", error: mensajeError, motivo, paso },
      });
      return;
    }

    const resultadoFinal: ResultadoAgregarAnuncios = {
      meta_adset_id: data.meta_adset_id ?? null,
      anuncios_creados: data.anuncios_creados ?? [],
      anuncios_fallidos: data.anuncios_fallidos ?? [],
      anuncios_reutilizados: data.anuncios_reutilizados ?? [],
      omitidos: data.omitidos ?? [],
    };

    await supabaseAdmin.from("trabajos_ia").update({ estado: "lista", resultado: resultadoFinal }).eq("id", jobId);
    await supabaseAdmin.from("propuestas").update({ estado: "ejecutada", resultado: resultadoFinal }).eq("id", propuestaId);
    await supabaseAdmin.from("bitacora").insert({
      user_id: datos.userId,
      meta_id: datos.metaId,
      propuesta_id: propuestaId,
      tipo_evento: "propuesta_aprobada_ejecutada",
      detalle: {
        accion: "agregar_anuncios",
        anuncios_creados: resultadoFinal.anuncios_creados.length,
        anuncios_reutilizados: resultadoFinal.anuncios_reutilizados.length,
      },
    });
  } catch (err) {
    const mensajeError = "No se pudo conectar con n8n";
    console.error(`[procesarAgregarAnuncios] ${jobId}:`, err);
    await supabaseAdmin.from("trabajos_ia").update({ estado: "fallida", error: mensajeError }).eq("id", jobId);
    await supabaseAdmin.from("propuestas").update({ estado: "fallida", resultado: { error: mensajeError } }).eq("id", propuestaId);
    await supabaseAdmin.from("bitacora").insert({
      user_id: datos.userId,
      meta_id: datos.metaId,
      propuesta_id: propuestaId,
      tipo_evento: "propuesta_aprobada_fallo",
      detalle: { accion: "agregar_anuncios", error: mensajeError },
    });
  }
}
