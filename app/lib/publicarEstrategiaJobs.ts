import "server-only";
import { randomUUID } from "crypto";
import { Agent } from "undici";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";

// Tercer tipo que usa trabajos_ia (los otros dos son "revision_imagen" y
// "agregar_anuncios"/"adn_marca", ver app/lib/revisionImagenJobs.ts y
// app/lib/agregarAnunciosJobs.ts) -- igual que agregar_anuncios, publicar
// una estrategia tiene un efecto real en Meta (crea campaña/conjunto/
// anuncios), así que hace falta el mismo candado (lock_id + relectura).
export const TIPO_TRABAJO = "publicar_estrategia";

// 30 minutos, no los 10 de agregar_anuncios/adn_marca: publicar_estrategia
// v10 en n8n sube cada video a advideos y espera a que Meta termine de
// procesarlo (hasta ~4 min por video) antes de crear el anuncio -- una
// estrategia con varios videos puede tardar mucho más que cualquier otro
// webhook que esperamos hoy.
export const TIMEOUT_PROCESANDO_MS = 30 * 60 * 1000;
// Por debajo del timeout del job, para que sea NUESTRO AbortController
// quien se rinda primero con un motivo claro, y no el cron (que solo
// puede decir "se interrumpió, no sabemos qué pasó").
const TIMEOUT_N8N_MS = 28 * 60 * 1000;

// fetch() en Node corre sobre undici, cuyo Agent por defecto corta la
// conexión a los 5 minutos (headersTimeout/bodyTimeout) -- muy por debajo
// de los ~28 minutos que este webhook puede necesitar de verdad. Un Agent
// propio con esos dos límites en 0 (sin límite) deja que SOLO nuestro
// propio AbortController (TIMEOUT_N8N_MS) decida cuándo rendirse.
const dispatcherSinTimeout = new Agent({ headersTimeout: 0, bodyTimeout: 0 });

// Publicar crea campañas reales en Meta -- si algo se corta a mitad de
// camino (timeout, conexión perdida, excepción inesperada) NUNCA se debe
// invitar a reintentar sin más: podría crear una campaña duplicada. Este
// mensaje manda a revisar el Administrador de anuncios primero, siempre
// con un enlace a mano.
export const MENSAJE_SIN_CONFIRMAR =
  "No pudimos confirmar la publicación en Meta. Revisa el Administrador de anuncios para ver si la campaña se creó antes de volver a intentar.";
export const ACCION_ADS_MANAGER = { texto: "Ver Administrador de anuncios", url: "https://adsmanager.facebook.com/adsmanager" };

export type TrabajoPublicarEstrategia = {
  id: string;
  user_id: string;
  tipo: string;
  estado: "pendiente" | "procesando" | "lista" | "fallida";
  resultado: any;
  error: string | null;
  intento_desde: string | null;
  creado_en: string;
  actualizado_en: string;
};

// Mismo criterio que revisarTimeoutTrabajo en revisionImagenJobs.ts/
// adnMarcaJobs.ts, con el timeout propio de 30 minutos de este tipo.
export async function revisarTimeoutTrabajo(job: TrabajoPublicarEstrategia): Promise<TrabajoPublicarEstrategia> {
  if (job.estado !== "procesando" && job.estado !== "pendiente") return job;
  if (!job.intento_desde) return job;
  if (Date.now() - new Date(job.intento_desde).getTime() <= TIMEOUT_PROCESANDO_MS) return job;

  const { data: actualizado } = await supabaseAdmin
    .from("trabajos_ia")
    .update({
      estado: "fallida",
      error: MENSAJE_SIN_CONFIRMAR,
      resultado: { error_accion_texto: ACCION_ADS_MANAGER.texto, error_accion_url: ACCION_ADS_MANAGER.url },
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("tipo", TIPO_TRABAJO)
    .eq("estado", job.estado)
    .select()
    .single();

  return (actualizado as TrabajoPublicarEstrategia) || job;
}

// Errores conocidos de Meta que ya hemos visto en producción y que no se
// resuelven con código -- son pasos que el usuario (o el admin de su
// Página de Facebook) tiene que hacer directamente en Meta. Movido tal
// cual desde app/api/publicar-estrategia/route.ts al pasar esa lógica a
// correr en segundo plano.
const MENSAJES_AMIGABLES: Record<number, { titulo: string; mensaje: string; accionTexto?: string; accionUrl?: string }> = {
  1815089: {
    titulo: "Falta aceptar los Términos de Generación de Leads",
    mensaje: "Tu página de Facebook todavía no ha aceptado los Términos de Servicio de Meta para generación de clientes potenciales. Es un paso único y rápido (menos de 1 minuto) que debe hacer un administrador de esa página.",
    accionTexto: "Aceptar términos en Meta",
    accionUrl: "https://facebook.com/ads/leadgen/tos",
  },
  2923003: {
    titulo: "Tu número de WhatsApp Business está suspendido",
    mensaje: "Meta suspendió el número de WhatsApp Business conectado a esta cuenta. Tienes que resolverlo directamente con el soporte de WhatsApp antes de poder publicar campañas de venta por WhatsApp — esto no depende de Quiubot.",
  },
};

// Los errores de n8n llegan como un string con varios niveles de JSON
// anidados y escapados -- en vez de intentar parsear esa estructura
// exacta (fragil, cambia segun cuantas capas de escapado tenga), se
// buscan directamente los campos que interesan con una expresion
// regular, que tolera cualquier nivel de escapado.
function extraerDetalleMeta(textoCrudo: string): { paso: string | null; subcode: number | null; mensajeMeta: string | null } {
  let paso: string | null = null;
  try {
    const externo = JSON.parse(textoCrudo);
    paso = externo?.paso ?? null;
  } catch {
    // el texto externo no siempre es JSON valido -- no pasa nada, sigue sin "paso".
  }

  const subcodeMatch = textoCrudo.match(/error_subcode\\*"?\s*:\s*(\d+)/);
  const mensajeMatch = textoCrudo.match(/error_user_msg\\*"?\s*:\s*\\*"([^"\\]*(?:\\.[^"\\]*)*)/);
  let mensajeMeta: string | null = null;
  if (mensajeMatch) {
    mensajeMeta = mensajeMatch[1]
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\\/g, "\\");
  }
  return {
    paso,
    subcode: subcodeMatch ? parseInt(subcodeMatch[1], 10) : null,
    mensajeMeta,
  };
}

// El trabajo real, corriendo en after() (ver app/api/publicar-estrategia/
// route.ts). Mismo contrato que publicar_estrategia ya usaba de forma
// síncrona -- lo único que cambia es que ahora corre fuera del ciclo de
// la petición (el proxy de Coolify cortaba la conexión antes de que n8n
// terminara con varios videos, mismo problema ya resuelto para
// crear_creativos/generar_estrategia/agregar_anuncios).
export async function procesarPublicarEstrategia(
  jobId: string,
  datos: {
    emailBusqueda: string;
    userId: string;
    estrategia: any;
    creativos: any;
    fuenteCreativos: unknown;
    efectividadFinal: unknown;
    instagram: { id: string; username: string } | null;
    metaId: string | null;
    tipoContenido: unknown;
    descripcionServicio: string | null;
    datosProducto: string | null;
  }
): Promise<void> {
  const { data: job } = await supabaseAdmin.from("trabajos_ia").select("*").eq("id", jobId).eq("tipo", TIPO_TRABAJO).single();
  if (!job || job.estado !== "pendiente") {
    console.log(`[procesarPublicarEstrategia] ${jobId}: no existe o no está pendiente, no hace nada`);
    return;
  }

  // Mismo candado que procesarAgregarAnuncios: no confiamos en lo que
  // devuelva update().select() -- se escribe un lock_id propio y se
  // relee la fila para confirmar que quedó el nuestro. Se mezcla con
  // job.resultado (no se reemplaza) porque ahí vive estrategia_id, que
  // el POST usa para el chequeo de duplicados mientras el trabajo siga
  // pendiente/procesando.
  const loQueIntentoTomar = randomUUID();
  const ahoraClaim = new Date().toISOString();
  await supabaseAdmin
    .from("trabajos_ia")
    .update({ estado: "procesando", intento_desde: ahoraClaim, resultado: { ...(job.resultado || {}), lock_id: loQueIntentoTomar } })
    .eq("id", jobId)
    .eq("estado", "pendiente");

  const { data: trasClaim } = await supabaseAdmin.from("trabajos_ia").select("resultado").eq("id", jobId).single();
  const lockActual = (trasClaim?.resultado as any)?.lock_id;
  if (lockActual !== loQueIntentoTomar) {
    console.log(`[procesarPublicarEstrategia] ${jobId}: no se tomó el candado (lock actual="${lockActual ?? "null"}")`);
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_N8N_MS);

  try {
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/publicar_estrategia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: datos.emailBusqueda,
        estrategia: datos.estrategia,
        creativos: datos.creativos,
        fuente_creativos: datos.fuenteCreativos,
        efectividad_final: datos.efectividadFinal,
        ...(datos.instagram ? { instagram: datos.instagram } : {}),
      }),
      signal: controller.signal,
      // @ts-expect-error -- "dispatcher" es una extensión de undici que
      // Node acepta en fetch() para esto mismo, pero el tipo global de
      // lib.dom.d.ts no la declara.
      dispatcher: dispatcherSinTimeout,
    });

    if (!n8nRes.ok) {
      const text = await n8nRes.text();
      console.error("Error al publicar estrategia (n8n respondió no-ok):", text);

      let paso: string | null = null;
      let subcode: number | null = null;
      let tituloAmigable: string | null = null;
      let accionTexto: string | null = null;
      let accionUrl: string | null = null;
      let mensajeFinal: string;
      let metaCampaignId: string | null = null;
      let anunciosFallidos: unknown = null;

      // Formato nuevo de publicar_estrategia (ej. paso "crear_anuncios"):
      // JSON con ok:false y un error ya legible -- se usa tal cual. Para
      // cualquier otra cosa se conserva la lógica de siempre (errores de
      // Meta anidados en texto, vía extraerDetalleMeta).
      let parseado: any = null;
      try {
        parseado = JSON.parse(text);
      } catch {
        parseado = null;
      }

      if (parseado && parseado.ok === false && typeof parseado.error === "string") {
        paso = typeof parseado.paso === "string" ? parseado.paso : null;
        metaCampaignId = typeof parseado.meta_campaign_id === "string" ? parseado.meta_campaign_id : null;
        anunciosFallidos = Array.isArray(parseado.anuncios_fallidos) ? parseado.anuncios_fallidos : null;
        mensajeFinal = parseado.error;
        if (paso === "crear_anuncios") {
          const primerFallido = Array.isArray(anunciosFallidos) && anunciosFallidos.length > 0 ? (anunciosFallidos[0] as any) : null;
          mensajeFinal = primerFallido?.error
            ? primerFallido.titulo
              ? `"${primerFallido.titulo}": ${primerFallido.error}`
              : primerFallido.error
            : "No se envió ningún anuncio a Meta (revisa los creativos).";
          mensajeFinal +=
            " La campaña quedó creada en tu cuenta de Meta pero sin anuncios, así que no está gastando dinero — puedes eliminarla desde el Administrador de anuncios antes de volver a intentar.";
        }
      } else {
        const detalle = extraerDetalleMeta(text);
        paso = detalle.paso;
        subcode = detalle.subcode;
        const amigable = subcode ? MENSAJES_AMIGABLES[subcode] : null;
        tituloAmigable = amigable?.titulo ?? null;
        accionTexto = amigable?.accionTexto ?? null;
        accionUrl = amigable?.accionUrl ?? null;
        // Nunca se manda el texto/JSON crudo al usuario -- si no hay un
        // mensaje amigable conocido ni uno extraído de Meta, el mensaje
        // genérico ya manda a revisar el Administrador de anuncios en vez
        // de invitar a reintentar sin más (ver comentario de
        // MENSAJE_SIN_CONFIRMAR). El texto crudo queda en detalleTecnico.
        mensajeFinal = amigable?.mensaje || detalle.mensajeMeta || MENSAJE_SIN_CONFIRMAR;
      }

      const accionTextoFinal = accionTexto ?? ACCION_ADS_MANAGER.texto;
      const accionUrlFinal = accionUrl ?? ACCION_ADS_MANAGER.url;

      registrarError({
        origen: "publicar_estrategia",
        userId: datos.userId,
        email: datos.emailBusqueda,
        paso,
        errorSubcode: subcode,
        errorTitulo: tituloAmigable,
        errorMensaje: mensajeFinal,
        detalleTecnico: JSON.stringify({ meta_campaign_id: metaCampaignId, anuncios_fallidos: anunciosFallidos, raw: text }),
        campanaNombre: datos.estrategia?.campana?.nombre ?? null,
        objetivoId: datos.estrategia?.campana?.objetivo_id ?? null,
      });

      await supabaseAdmin
        .from("trabajos_ia")
        .update({
          estado: "fallida",
          error: mensajeFinal,
          resultado: { error_titulo: tituloAmigable, error_accion_texto: accionTextoFinal, error_accion_url: accionUrlFinal },
        })
        .eq("id", jobId);
      return;
    }

    const data = await n8nRes.json().catch(() => ({}));

    // meta_id llega del cliente -- se valida que de verdad sea una meta
    // de este mismo usuario antes de confiar en ella, para que nadie
    // pueda ligar su campaña nueva a la meta de otra cuenta.
    let metaIdValidado: string | null = null;
    if (typeof datos.metaId === "string" && datos.metaId) {
      const { data: metaDelUsuario } = await supabaseAdmin
        .from("metas")
        .select("id")
        .eq("id", datos.metaId)
        .eq("user_id", datos.userId)
        .maybeSingle();
      metaIdValidado = metaDelUsuario?.id ?? null;
    }

    // Para que el refresco de Autopiloto (intentarGenerarYCrearCreativos)
    // pueda reenviar el mismo contexto más adelante -- ver app/lib/propuestas.ts.
    const tipoContenidoFinal: string = datos.tipoContenido === "servicio" ? "servicio" : "producto";
    const descripcionServicioFinal: string | null =
      tipoContenidoFinal === "servicio" && typeof datos.descripcionServicio === "string"
        ? datos.descripcionServicio.trim().slice(0, 500) || null
        : null;
    const datosProductoFinal: string | null =
      tipoContenidoFinal === "producto" && typeof datos.datosProducto === "string"
        ? datos.datosProducto.trim().slice(0, 500) || null
        : null;

    const { data: campana, error: insertError } = await supabaseAdmin
      .from("campanas_publicadas")
      .insert({
        user_id: datos.userId,
        nombre: datos.estrategia?.campana?.nombre ?? "Campaña sin nombre",
        objetivo: datos.estrategia?.campana?.objetivo_meta ?? null,
        objetivo_id: datos.estrategia?.campana?.objetivo_id ?? null,
        presupuesto_diario: datos.estrategia?.campana?.presupuesto_diario_cop ?? null,
        efectividad_estimada: datos.efectividadFinal ?? datos.estrategia?.efectividad ?? null,
        estado: "activa",
        meta_campaign_id: data?.meta_campaign_id ?? null,
        meta_adset_id: data?.meta_adset_id ?? null,
        meta_id: metaIdValidado,
        tipo_contenido: tipoContenidoFinal,
        descripcion_servicio: descripcionServicioFinal,
        datos_producto: datosProductoFinal,
      })
      .select()
      .single();

    if (!insertError && campana) {
      await supabaseAdmin.from("notificaciones").insert({
        user_id: datos.userId,
        campana_id: campana.id,
        tipo: "campana_publicada",
        titulo: "Campaña publicada",
        mensaje: `Tu campaña "${campana.nombre}" fue publicada correctamente en Meta.`,
        estado: "pendiente",
      });
    }

    await supabaseAdmin.from("trabajos_ia").update({ estado: "lista", resultado: data }).eq("id", jobId);
  } catch (err) {
    const esAbort = err instanceof Error && err.name === "AbortError";
    console.error(`[procesarPublicarEstrategia] ${jobId}:`, err);

    registrarError({
      origen: "publicar_estrategia",
      userId: datos.userId,
      email: datos.emailBusqueda,
      paso: esAbort ? "timeout_n8n" : "conexion_con_n8n",
      errorMensaje: MENSAJE_SIN_CONFIRMAR,
      detalleTecnico: String(err),
      campanaNombre: datos.estrategia?.campana?.nombre ?? null,
      objetivoId: datos.estrategia?.campana?.objetivo_id ?? null,
    });

    await supabaseAdmin
      .from("trabajos_ia")
      .update({
        estado: "fallida",
        error: MENSAJE_SIN_CONFIRMAR,
        resultado: { error_accion_texto: ACCION_ADS_MANAGER.texto, error_accion_url: ACCION_ADS_MANAGER.url },
      })
      .eq("id", jobId);
  } finally {
    clearTimeout(timeoutId);
  }
}
