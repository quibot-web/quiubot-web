import { after, NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { revisarGeneracionCreativos, procesarCreacionCreativos } from "@/app/lib/propuestas";

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
    .eq("resultado->>etapa", "generando");

  let revisadas = 0;
  for (const propuesta of generando ?? []) {
    // Solo lee creativos_jobs y escribe en Supabase -- rápido, sin
    // llamadas externas lentas, así que esperarlo acá no corre el
    // riesgo de que el proxy corte la conexión.
    await revisarGeneracionCreativos(propuesta.id);
    revisadas++;
  }

  // Respaldo de procesarCreacionCreativos: si el after() de /subir-fotos
  // nunca llegó a correr (ej. el proceso se reinició a mitad de camino),
  // o un intento anterior murió sin avisar, esta corrida las retoma. El
  // candado adentro de procesarCreacionCreativos decide si de verdad hay
  // algo que hacer -- llamarla de más acá no causa doble procesamiento.
  // Nunca se espera synchronamente (sí tarda 1.5-2 min la llamada a
  // generar_estrategia), por eso va con after(), igual que en /subir-fotos.
  const { data: generandoConceptos } = await supabaseAdmin
    .from("propuestas")
    .select("id")
    .eq("estado", "aprobada")
    .eq("accion", "crear_creativos")
    .eq("resultado->>etapa", "generando_conceptos");

  const idsAReintentar = (generandoConceptos ?? []).map((p) => p.id);
  if (idsAReintentar.length > 0) {
    after(async () => {
      await Promise.allSettled(idsAReintentar.map((propuestaId) => procesarCreacionCreativos(propuestaId)));
    });
  }

  return NextResponse.json({
    ok: true,
    vencidas: vencidasPendiente?.length ?? 0,
    vencidas_esperando_fotos: vencidasEsperandoFotos?.length ?? 0,
    generando_revisadas: revisadas,
    generando_conceptos_reintentadas: idsAReintentar.length,
  });
}
