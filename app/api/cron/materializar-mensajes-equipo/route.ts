// Fase 2, Commit 2 -- materializa en mensajes_equipo los eventos
// reales que todavía no tenían dónde vivir: el reporte diario del
// Analista (desde campanas_snapshots, que ya llena sync-meta-insights)
// y los creativos/videos listos del Creativo (desde creativos_jobs y
// video_jobs). Las propuestas y campañas-con-problema NO se
// materializan acá -- siguen leyéndose en vivo de
// obtenerPropuestasPendientes(), para no tener dos fuentes de verdad
// del estado "pendiente". Sin IA: todo el texto sale de
// textosEquipo.ts con números reales. Llamado una vez al día por un
// Schedule Trigger en n8n, después de sync-meta-insights?modo=cierre
// (necesita el snapshot de ayer ya cerrado).
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { ayerBogota } from "@/app/lib/fechaBogota";
import { calcularAvanceMeta, type TipoMeta } from "@/app/lib/metas";
import { textoReporteDiario, textoCreativosListos, textoVideoListo } from "@/app/lib/director/textosEquipo";

const VENTANA_CREATIVOS_HORAS = 48;

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function materializarReportesDiarios(): Promise<number> {
  const ayer = ayerBogota();

  const { data: campanasActivas } = await supabaseAdmin
    .from("campanas_publicadas")
    .select("user_id")
    .eq("estado", "activa");

  const usuariosConCampana = [...new Set((campanasActivas ?? []).map((c) => c.user_id as string))];
  let creados = 0;

  for (const userId of usuariosConCampana) {
    const { data: snapshotsAyer } = await supabaseAdmin
      .from("campanas_snapshots")
      .select("spend, conversiones")
      .eq("user_id", userId)
      .eq("fecha_bogota", ayer);

    const conversiones = (snapshotsAyer ?? []).reduce((acc, s) => acc + (s.conversiones || 0), 0);
    const spend = (snapshotsAyer ?? []).reduce((acc, s) => acc + (s.spend || 0), 0);
    if (conversiones === 0) continue;

    const { data: metasActivas } = await supabaseAdmin
      .from("metas")
      .select("id, tipo, cantidad_objetivo, fecha_inicio, fecha_fin, valor_inicial")
      .eq("user_id", userId)
      .eq("estado", "activa");

    let vsMetaPorcentaje: number | null = null;
    let tipoMeta: TipoMeta | null = null;
    if (metasActivas && metasActivas.length === 1) {
      const meta = metasActivas[0];
      tipoMeta = meta.tipo;
      try {
        const avance = await calcularAvanceMeta({ id: meta.id, tipo: meta.tipo, user_id: userId, fecha_inicio: meta.fecha_inicio, fecha_fin: meta.fecha_fin, valor_inicial: meta.valor_inicial });
        if (avance.proyeccion !== null && meta.cantidad_objetivo > 0) {
          vsMetaPorcentaje = ((avance.proyeccion - meta.cantidad_objetivo) / meta.cantidad_objetivo) * 100;
        }
      } catch (err) {
        console.error("Error calculando avance de meta para reporte diario:", err);
      }
    }

    const contenido = textoReporteDiario({
      tipoMeta,
      conversiones,
      costoPorResultado: conversiones > 0 ? spend / conversiones : 0,
      vsMetaPorcentaje,
    });

    const { error } = await supabaseAdmin.from("mensajes_equipo").insert({
      user_id: userId,
      asistente: "analista",
      tipo_evento: "reporte_diario",
      contenido,
      origen_id: ayer,
    });
    // code 23505 = unique_violation -- ya existía el reporte de hoy para
    // este usuario, no es un error real.
    if (!error) creados++;
    else if (error.code !== "23505") console.error("Error insertando reporte_diario:", error);
  }

  return creados;
}

async function materializarCreativosListos(): Promise<number> {
  const desde = new Date(Date.now() - VENTANA_CREATIVOS_HORAS * 60 * 60 * 1000).toISOString();
  let creados = 0;

  const { data: jobsCreativos } = await supabaseAdmin
    .from("creativos_jobs")
    .select("id, user_id, creativos, total_creativos")
    .eq("estado", "listo")
    .gte("creado_en", desde);

  for (const job of jobsCreativos ?? []) {
    const miniaturas = (Array.isArray(job.creativos) ? job.creativos : [])
      .map((c: { url_imagen?: string }) => c.url_imagen)
      .filter((u): u is string => typeof u === "string");

    const contenido = textoCreativosListos({ cantidad: job.total_creativos ?? miniaturas.length, miniaturas });

    const { error } = await supabaseAdmin.from("mensajes_equipo").insert({
      user_id: job.user_id,
      asistente: "creativo",
      tipo_evento: "creativos_listos",
      contenido,
      origen_id: `cj:${job.id}`,
    });
    if (!error) creados++;
    else if (error.code !== "23505") console.error("Error insertando creativos_listos (creativos_jobs):", error);
  }

  const { data: jobsVideo } = await supabaseAdmin
    .from("video_jobs")
    .select("id, user_id, video_final_url")
    .eq("estado", "listo")
    .not("video_final_url", "is", null)
    .gte("creado_en", desde);

  for (const job of jobsVideo ?? []) {
    const contenido = textoVideoListo({ urlVideo: job.video_final_url as string });

    const { error } = await supabaseAdmin.from("mensajes_equipo").insert({
      user_id: job.user_id,
      asistente: "creativo",
      tipo_evento: "creativos_listos",
      contenido,
      origen_id: `vj:${job.id}`,
    });
    if (!error) creados++;
    else if (error.code !== "23505") console.error("Error insertando creativos_listos (video_jobs):", error);
  }

  return creados;
}

export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error("ADMIN_SECRET no configurado.");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const authHeader = req.headers.get("authorization") || "";
  const esperado = `Bearer ${adminSecret}`;
  if (!compararSeguro(authHeader, esperado)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [reportesDiarios, creativosListos] = await Promise.all([materializarReportesDiarios(), materializarCreativosListos()]);

  return NextResponse.json({ ok: true, reportesDiarios, creativosListos });
}
