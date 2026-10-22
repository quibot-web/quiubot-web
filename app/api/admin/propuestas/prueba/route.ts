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

  const { asistente, accion, campana_id } = await req.json();

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
