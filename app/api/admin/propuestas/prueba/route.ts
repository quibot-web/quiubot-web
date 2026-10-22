import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { CATALOGO_ACCIONES } from "@/app/lib/propuestas";
import type { Asistente, AccionPropuesta } from "@/app/lib/metas";

const ASISTENTES_VALIDOS: Asistente[] = [
  "director",
  "marca",
  "estratega",
  "creativo",
  "publicador",
  "analista",
  "optimizador",
];

// Lista los creativos_jobs ya "listos" del admin, para elegir de cuál
// sacar los creativos al crear una propuesta de prueba de
// agregar_anuncios -- sin esto, probar esa acción requeriría pasar
// primero por crear_creativos de verdad (fotos + espera del job).
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (usuario.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: jobs } = await supabaseAdmin
    .from("creativos_jobs")
    .select("id, creado_en, total_creativos, creativos")
    .eq("user_id", usuario.id)
    .eq("estado", "listo")
    .order("creado_en", { ascending: false })
    .limit(20);

  const jobsConPreview = (jobs ?? [])
    .filter((j) => Array.isArray(j.creativos) && j.creativos.length > 0)
    .map((j) => ({
      id: j.id,
      creado_en: j.creado_en,
      total_creativos: j.total_creativos ?? j.creativos.length,
      preview_url: j.creativos[0]?.url_imagen ?? null,
    }));

  return NextResponse.json({ jobs: jobsConPreview });
}

// Solo para que el admin pueda ver y probar la bandeja de decisiones con
// datos reales de su propia cuenta -- crea una propuesta "pendiente"
// exactamente como la crearía el Director en fase 2, pero disparada a
// mano. Nunca ejecuta nada por sí sola, solo queda esperando aprobación
// como cualquier otra.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (usuario.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { asistente, accion, campana_id, creativos_job_id } = await req.json();

  if (!ASISTENTES_VALIDOS.includes(asistente)) {
    return NextResponse.json({ error: "Asistente inválido." }, { status: 400 });
  }
  const info = CATALOGO_ACCIONES[accion as AccionPropuesta];
  if (!info) {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }
  if (info.requiereCampana && !campana_id) {
    return NextResponse.json({ error: "Esta acción necesita elegir una campaña." }, { status: 400 });
  }
  if (accion === "agregar_anuncios" && !creativos_job_id) {
    return NextResponse.json({ error: "Elige de qué creativos_jobs sacar los creativos." }, { status: 400 });
  }

  if (campana_id) {
    const { data: campana } = await supabaseAdmin
      .from("campanas_publicadas")
      .select("id")
      .eq("id", campana_id)
      .eq("user_id", usuario.id)
      .maybeSingle();
    if (!campana) {
      return NextResponse.json({ error: "Esa campaña no pertenece a tu cuenta." }, { status: 403 });
    }
  }

  let creativosDelJob: unknown[] | null = null;
  if (accion === "agregar_anuncios") {
    const { data: job } = await supabaseAdmin
      .from("creativos_jobs")
      .select("id, estado, creativos, user_id")
      .eq("id", creativos_job_id)
      .eq("user_id", usuario.id)
      .maybeSingle();

    if (!job || job.estado !== "listo" || !Array.isArray(job.creativos) || job.creativos.length === 0) {
      return NextResponse.json({ error: "Ese creativos_jobs no está listo o no tiene creativos." }, { status: 400 });
    }
    creativosDelJob = job.creativos;
  }

  const { data: metaActiva } = await supabaseAdmin
    .from("metas")
    .select("id")
    .eq("user_id", usuario.id)
    .eq("estado", "activa")
    .maybeSingle();

  const venceEn = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const parametros: Record<string, unknown> = {};
  if (campana_id) parametros.campana_id = campana_id;
  if (accion === "ajustar_presupuesto") parametros.ajuste_porcentaje = 20;
  if (creativosDelJob) parametros.creativos = creativosDelJob;

  const { data: propuesta, error } = await supabaseAdmin
    .from("propuestas")
    .insert({
      meta_id: metaActiva?.id ?? null,
      user_id: usuario.id,
      asistente,
      accion,
      parametros,
      titulo: `[Prueba] ${info.titulo}`,
      justificacion: info.justificacion,
      impacto_esperado: info.impactoEsperado,
      costo_estimado_cop: null,
      estado: "pendiente",
      vence_en: venceEn,
    })
    .select()
    .single();

  if (error || !propuesta) {
    return NextResponse.json({ error: error?.message || "No se pudo crear la propuesta de prueba." }, { status: 500 });
  }

  await supabaseAdmin.from("bitacora").insert({
    user_id: usuario.id,
    meta_id: metaActiva?.id ?? null,
    propuesta_id: propuesta.id,
    tipo_evento: "propuesta_prueba_creada",
    detalle: { asistente, accion },
  });

  return NextResponse.json({ propuesta });
}
