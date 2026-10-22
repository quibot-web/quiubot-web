import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { calcularAvanceMeta, type TipoMeta } from "@/app/lib/metas";
import { hoyBogota } from "@/app/lib/fechaBogota";

const TIPOS_VALIDOS: TipoMeta[] = ["conversaciones_whatsapp", "leads"];
const DIAS_MINIMOS = 14;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // Autopiloto es admin-only por ahora -- mismo patrón que Video.
  if (usuario.rol !== "admin") {
    return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
  }

  const { data: meta } = await supabaseAdmin
    .from("metas")
    .select("*")
    .eq("user_id", usuario.id)
    .eq("estado", "activa")
    .maybeSingle();

  if (!meta) return NextResponse.json({ meta: null, avance: null });

  const avance = await calcularAvanceMeta({
    tipo: meta.tipo,
    user_id: meta.user_id,
    fecha_inicio: meta.fecha_inicio,
    fecha_fin: meta.fecha_fin,
  });

  return NextResponse.json({ meta, avance });
}

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
    return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
  }

  const { tipo, cantidad_objetivo, fecha_fin, presupuesto_maximo_cop } = await req.json();

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de meta inválido." }, { status: 400 });
  }
  const cantidad = Number(cantidad_objetivo);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return NextResponse.json({ error: "La cantidad objetivo debe ser mayor a cero." }, { status: 400 });
  }
  const presupuesto = Number(presupuesto_maximo_cop);
  if (!Number.isFinite(presupuesto) || presupuesto <= 0) {
    return NextResponse.json({ error: "El presupuesto máximo debe ser mayor a cero." }, { status: 400 });
  }

  const hoy = hoyBogota();
  if (typeof fecha_fin !== "string" || fecha_fin <= hoy) {
    return NextResponse.json({ error: "La fecha de fin debe ser futura." }, { status: 400 });
  }
  const diasDuracion = Math.round((new Date(fecha_fin).getTime() - new Date(hoy).getTime()) / 86400000);
  if (diasDuracion < DIAS_MINIMOS) {
    return NextResponse.json({ error: `La meta debe durar al menos ${DIAS_MINIMOS} días.` }, { status: 400 });
  }

  const { data: metaActiva } = await supabaseAdmin
    .from("metas")
    .select("id")
    .eq("user_id", usuario.id)
    .eq("estado", "activa")
    .maybeSingle();

  if (metaActiva) {
    return NextResponse.json({ error: "Ya tienes una meta activa. Pausa o cancélala antes de crear otra." }, { status: 409 });
  }

  const { data: metaCreada, error } = await supabaseAdmin
    .from("metas")
    .insert({
      user_id: usuario.id,
      tipo,
      cantidad_objetivo: cantidad,
      fecha_inicio: hoy,
      fecha_fin,
      presupuesto_maximo_cop: presupuesto,
      costo_objetivo_cop: presupuesto / cantidad,
      nivel_autonomia: "copiloto",
      estado: "activa",
      pausado_autopiloto: false,
    })
    .select()
    .single();

  if (error || !metaCreada) {
    return NextResponse.json({ error: error?.message || "No se pudo crear la meta." }, { status: 500 });
  }

  await supabaseAdmin.from("bitacora").insert({
    user_id: usuario.id,
    meta_id: metaCreada.id,
    propuesta_id: null,
    tipo_evento: "meta_creada",
    detalle: { tipo, cantidad_objetivo: cantidad, fecha_fin, presupuesto_maximo_cop: presupuesto },
  });

  return NextResponse.json({ meta: metaCreada });
}
