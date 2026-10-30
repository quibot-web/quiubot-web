import { after, NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { revisarGeneracionCreativos, procesarCreacionCreativos } from "@/app/lib/propuestas";
import { cerrarMetasVencidas } from "@/app/lib/metas";
import { TIMEOUT_PROCESANDO_MS } from "@/app/lib/estrategiasJobs";
import {
  TIPO_TRABAJO as TIPO_TRABAJO_PUBLICAR_ESTRATEGIA,
  TIMEOUT_PROCESANDO_MS as TIMEOUT_PUBLICAR_ESTRATEGIA_MS,
  MENSAJE_SIN_CONFIRMAR,
  ACCION_ADS_MANAGER,
} from "@/app/lib/publicarEstrategiaJobs";

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const VENCE_ESPERANDO_FOTOS_MS = 72 * 60 * 60 * 1000;

// Llamado cada hora por un Schedule Trigger en n8n (mismo patrón que
// sync-meta-insights). Todo esto es respaldo de algo que normalmente ya
// pasa solo: propuestas "pendiente" con vence_en cumplido (ver
// obtenerPropuestasPendientes), crear_creativos "aprobada" que lleva más
// de 72h esperando que el cliente suba las fotos (ver
// vencerPropuestasDelUsuario), crear_creativos en etapa "generando" --
// normalmente el polling de /decisiones (mientras el cliente sigue ahí)
// ya encadena la propuesta agregar_anuncios apenas el job termina, esto
// es solo para cuando cerró la pestaña a mitad de la generación -- y el
// timeout de 10 minutos de estrategias_jobs/trabajos_ia (agregar_anuncios,
// adn_marca), para cuando nadie quedó consultando el job.
// revisarGeneracionCreativos es idempotente, así que no importa si el
// polling y este cron la revisan casi al mismo tiempo.
export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error("ADMIN_SECRET no configurado.");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const authHeader = req.headers.get("authorization") || "";
  if (!compararSeguro(authHeader, `Bearer ${adminSecret}`)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Metas "activas" cuya fecha_fin ya pasó -- se cierran de verdad
  // (vencida, o cumplida si llegó a la cantidad) para que el índice
  // único (user_id, tipo) WHERE estado='activa' nunca quede bloqueado
  // por una meta que ya terminó. Nada que ver con propuestas, pero
  // vive en este mismo cron horario en vez de uno nuevo.
  const metasCerradas = await cerrarMetasVencidas();

  // Respaldo del timeout de 10 minutos de estrategias_jobs -- GET
  // /api/estrategias-jobs/[id] y /ultimo ya lo revisan en cada
  // consulta (ver app/lib/estrategiasJobs.ts), esto es solo para
  // cuando nadie está consultando (ej. un despliegue mató el proceso
  // y el cliente ni siquiera llegó a guardar el job_id). Nunca
  // reintenta solo -- marcarla "fallida" es lo único que hace.
  const { data: estrategiasVencidas } = await supabaseAdmin
    .from("estrategias_jobs")
    .update({ estado: "fallida", error: "Se interrumpió la generación, intenta de nuevo" })
    .in("estado", ["pendiente", "procesando"])
    .lt("intento_desde", new Date(Date.now() - TIMEOUT_PROCESANDO_MS).toISOString())
    .select("id");

  // Mismo respaldo, ahora para trabajos_ia (agregar_anuncios, adn_marca)
  // -- mismos 10 minutos que estrategias_jobs. agregar_anuncios está
  // ligado a una propuesta (resultado.job_id apunta a este trabajo), que
  // también tiene que reflejar el mismo fallo; adn_marca no está ligado
  // a ninguna otra fila, no hace falta nada más para esa.
  const { data: trabajosVencidos } = await supabaseAdmin
    .from("trabajos_ia")
    .update({ estado: "fallida", error: "Se interrumpió el proceso, intenta de nuevo" })
    .in("estado", ["pendiente", "procesando"])
    .in("tipo", ["agregar_anuncios", "adn_marca"])
    .lt("intento_desde", new Date(Date.now() - TIMEOUT_PROCESANDO_MS).toISOString())
    .select("id, tipo");

  // Respaldo propio para publicar_estrategia -- 30 minutos, no los 10 de
  // arriba (ver TIMEOUT_PROCESANDO_MS en app/lib/publicarEstrategiaJobs.ts):
  // un video puede tardar hasta ~4 min en Meta, y necesita mucho más
  // margen que cualquier otro webhook que esperamos hoy. Publicar crea
  // campañas reales, así que nunca reintenta solo -- un trabajo vencido
  // simplemente queda "fallida" con un mensaje que manda a revisar el
  // Administrador de anuncios antes de volver a intentar, nunca "intenta
  // de nuevo" a secas.
  const { data: publicarEstrategiaVencidos } = await supabaseAdmin
    .from("trabajos_ia")
    .update({
      estado: "fallida",
      error: MENSAJE_SIN_CONFIRMAR,
      resultado: { error_accion_texto: ACCION_ADS_MANAGER.texto, error_accion_url: ACCION_ADS_MANAGER.url },
    })
    .eq("tipo", TIPO_TRABAJO_PUBLICAR_ESTRATEGIA)
    .in("estado", ["pendiente", "procesando"])
    .lt("intento_desde", new Date(Date.now() - TIMEOUT_PUBLICAR_ESTRATEGIA_MS).toISOString())
    .select("id");

  const idsAgregarAnunciosVencidos = (trabajosVencidos ?? []).filter((t) => t.tipo === "agregar_anuncios").map((t) => t.id);
  if (idsAgregarAnunciosVencidos.length > 0) {
    await Promise.all(
      idsAgregarAnunciosVencidos.map((jobId) =>
        supabaseAdmin
          .from("propuestas")
          .update({ estado: "fallida", resultado: { error: "Se interrumpió el proceso, intenta de nuevo" } })
          .eq("resultado->>job_id", jobId)
          .eq("estado", "aprobada")
      )
    );
  }

  const { data: vencidasPendiente, error: errorPendiente } = await supabaseAdmin
    .from("propuestas")
    .update({ estado: "vencida" })
    .eq("estado", "pendiente")
    .lt("vence_en", new Date().toISOString())
    .select("id");

  if (errorPendiente) {
    return NextResponse.json({ error: errorPendiente.message }, { status: 500 });
  }

  const { data: vencidasEsperandoFotos, error: errorEsperandoFotos } = await supabaseAdmin
    .from("propuestas")
    .update({ estado: "vencida" })
    .eq("estado", "aprobada")
    .eq("accion", "crear_creativos")
    .eq("resultado->>etapa", "esperando_fotos")
    .lt("decidido_en", new Date(Date.now() - VENCE_ESPERANDO_FOTOS_MS).toISOString())
    .select("id");

  if (errorEsperandoFotos) {
    return NextResponse.json({ error: errorEsperandoFotos.message }, { status: 500 });
  }

  const { data: generando } = await supabaseAdmin
    .from("propuestas")
    .select("id")
    .eq("estado", "aprobada")
    .eq("accion", "crear_creativos")
    .in("resultado->>etapa", ["generando", "generando_conceptos"]);

  // revisarGeneracionCreativos aplica el timeout de 40 min a las dos
  // etapas (generando_conceptos y generando, mismo reloj desde que se
  // subieron las fotos) -- antes solo se llamaba para "generando", así
  // que una propuesta atascada en "generando_conceptos" nunca vencía
  // por tiempo, solo se reintentaba cada hora para siempre.
  let revisadas = 0;
  const idsAReintentar: string[] = [];
  for (const propuesta of generando ?? []) {
    // Solo lee creativos_jobs y escribe en Supabase -- rápido, sin
    // llamadas externas lentas, así que esperarlo acá no corre el
    // riesgo de que el proxy corte la conexión.
    const resultado = await revisarGeneracionCreativos(propuesta.id);
    revisadas++;
    if (resultado.etapa === "generando_conceptos") {
      idsAReintentar.push(propuesta.id);
    }
  }

  // Respaldo de procesarCreacionCreativos: si el after() de /subir-fotos
  // nunca llegó a correr (ej. el proceso se reinició a mitad de camino),
  // o un intento anterior murió sin avisar, esta corrida las retoma. El
  // candado adentro de procesarCreacionCreativos decide si de verdad hay
  // algo que hacer -- llamarla de más acá no causa doble procesamiento.
  // Nunca se espera synchronamente (sí tarda 1.5-2 min la llamada a
  // generar_estrategia), por eso va con after(), igual que en /subir-fotos.
  if (idsAReintentar.length > 0) {
    after(async () => {
      await Promise.allSettled(idsAReintentar.map((propuestaId) => procesarCreacionCreativos(propuestaId)));
    });
  }

  return NextResponse.json({
    ok: true,
    metas_cerradas: metasCerradas.length,
    estrategias_jobs_vencidos: estrategiasVencidas?.length ?? 0,
    trabajos_ia_vencidos: trabajosVencidos?.length ?? 0,
    publicar_estrategia_vencidos: publicarEstrategiaVencidos?.length ?? 0,
    vencidas: vencidasPendiente?.length ?? 0,
    vencidas_esperando_fotos: vencidasEsperandoFotos?.length ?? 0,
    generando_revisadas: revisadas,
    generando_conceptos_reintentadas: idsAReintentar.length,
  });
}
