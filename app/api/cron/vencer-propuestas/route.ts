import { after, NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { revisarGeneracionCreativos, procesarCreacionCreativos } from "@/app/lib/propuestas";
import { cerrarMetasVencidas } from "@/app/lib/metas";

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const VENCE_ESPERANDO_FOTOS_MS = 72 * 60 * 60 * 1000;

// Llamado cada hora por un Schedule Trigger en n8n (mismo patrón que
// sync-meta-insights). Tres cosas, todas respaldo de algo que normalmente
// ya pasa solo: propuestas "pendiente" con vence_en cumplido (ver
// obtenerPropuestasPendientes), crear_creativos "aprobada" que lleva más
// de 72h esperando que el cliente suba las fotos (ver
// vencerPropuestasDelUsuario), y crear_creativos en etapa "generando" --
// normalmente el polling de /decisiones (mientras el cliente sigue ahí)
// ya encadena la propuesta agregar_anuncios apenas el job termina, esto
// es solo para cuando cerró la pestaña a mitad de la generación.
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
    vencidas: vencidasPendiente?.length ?? 0,
    vencidas_esperando_fotos: vencidasEsperandoFotos?.length ?? 0,
    generando_revisadas: revisadas,
    generando_conceptos_reintentadas: idsAReintentar.length,
  });
}
