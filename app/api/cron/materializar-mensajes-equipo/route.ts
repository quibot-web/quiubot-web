// Materializa en mensajes_equipo los eventos reales que no tenían
// dónde vivir: el reporte diario del Analista (desde
// campanas_snapshots, que ya llena sync-meta-insights), los
// creativos/videos listos del Creativo (creativos_jobs/video_jobs), y
// el ADN de marca listo (trabajos_ia tipo "adn_marca" -- corrección de
// voz, Fase 2 4/4). Estratega y Publicador NO se materializan acá --
// su trabajo real (estrategias_jobs, campanas_publicadas,
// errores_publicacion) se lee en vivo desde
// transcripcionAsistente.ts, igual que las propuestas y las
// campañas-con-problema (obtenerPropuestasPendientes()), para no tener
// dos fuentes de verdad. Sin IA: todo el texto sale de
// textosEquipo.ts con números reales. Llamado una vez al día por un
// Schedule Trigger en n8n, después de sync-meta-insights?modo=cierre
// (necesita el snapshot de ayer ya cerrado).
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { ayerBogota } from "@/app/lib/fechaBogota";
import { calcularAvanceMeta, type TipoMeta } from "@/app/lib/metas";
import { textoReporteDiario, textoCreativosListos, textoVideoListo, textoAdnMarcaListo } from "@/app/lib/director/textosEquipo";

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

  const { data: usuariosInfo } = await supabaseAdmin.from("usuarios").select("id, nombre, email").in("id", usuariosConCampana);
  const nombrePorUsuario = new Map((usuariosInfo ?? []).map((u) => [u.id as string, ((u.nombre as string | null) || (u.email as string)).trim().split(/\s+/)[0]]));

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
      nombreUsuario: nombrePorUsuario.get(userId) || "tu cliente",
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

// ADN de marca listo (Marca) -- trabajos_ia tipo "adn_marca", mismo
// shape que lee app/marca/page.tsx: resultado.adn_marca.frase_corta y
// .paleta_color.{color_primario_hex,color_secundario_hex,colores_acento_hex}.
async function materializarAdnMarca(): Promise<number> {
  const desde = new Date(Date.now() - VENTANA_CREATIVOS_HORAS * 60 * 60 * 1000).toISOString();
  let creados = 0;

  const { data: jobs } = await supabaseAdmin.from("trabajos_ia").select("id, user_id, resultado").eq("tipo", "adn_marca").eq("estado", "lista").gte("creado_en", desde);
  if (!jobs || jobs.length === 0) return 0;

  const { data: usuariosInfo } = await supabaseAdmin
    .from("usuarios")
    .select("id, nombre, email")
    .in("id", [...new Set(jobs.map((j) => j.user_id as string))]);
  const nombrePorUsuario = new Map((usuariosInfo ?? []).map((u) => [u.id as string, ((u.nombre as string | null) || (u.email as string)).trim().split(/\s+/)[0]]));

  for (const job of jobs) {
    const adn = (job.resultado as { adn_marca?: Record<string, unknown> } | null)?.adn_marca;
    if (!adn) continue;

    const paleta = (adn.paleta_color as Record<string, unknown>) || {};
    const colores = [paleta.color_primario_hex, paleta.color_secundario_hex, ...(Array.isArray(paleta.colores_acento_hex) ? paleta.colores_acento_hex : [])].filter(
      (c): c is string => typeof c === "string"
    );

    const contenido = textoAdnMarcaListo({
      nombreUsuario: nombrePorUsuario.get(job.user_id as string) || "tu cliente",
      fraseCorta: typeof adn.frase_corta === "string" ? adn.frase_corta : null,
      colores,
    });

    const { error } = await supabaseAdmin.from("mensajes_equipo").insert({
      user_id: job.user_id,
      asistente: "marca",
      tipo_evento: "adn_marca_listo",
      contenido,
      origen_id: `am:${job.id}`,
    });
    if (!error) creados++;
    else if (error.code !== "23505") console.error("Error insertando adn_marca_listo:", error);
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

  const [reportesDiarios, creativosListos, adnMarcaListo] = await Promise.all([materializarReportesDiarios(), materializarCreativosListos(), materializarAdnMarca()]);

  return NextResponse.json({ ok: true, reportesDiarios, creativosListos, adnMarcaListo });
}
