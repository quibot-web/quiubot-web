import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { calcularAvanceMeta, cerrarMetasVencidas, type TipoMeta } from "@/app/lib/metas";
import { hoyBogota } from "@/app/lib/fechaBogota";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

const TIPOS_VALIDOS: TipoMeta[] = ["conversaciones_whatsapp", "leads", "ventas_web", "visitas_web", "seguidores_facebook"];
const DIAS_MINIMOS = 14;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, plan, en_trial, trial_termina_en, fecha_vencimiento, beta_autopiloto")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (!tieneAutopiloto(usuario)) {
    return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
  }

  const { data: metas } = await supabaseAdmin
    .from("metas")
    .select("*")
    .eq("user_id", usuario.id)
    .eq("estado", "activa");

  const items = await Promise.all(
    (metas ?? []).map(async (meta) => {
      try {
        const avance = await calcularAvanceMeta({
          id: meta.id,
          tipo: meta.tipo,
          user_id: meta.user_id,
          fecha_inicio: meta.fecha_inicio,
          fecha_fin: meta.fecha_fin,
        });
        return { meta, avance };
      } catch (err) {
        console.error(`Error calculando el avance de la meta ${meta.id}:`, err);
        return { meta, avance: null, error: "No se pudo calcular el avance en este momento." };
      }
    })
  );

  return NextResponse.json({ metas: items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, plan, en_trial, trial_termina_en, fecha_vencimiento, beta_autopiloto")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (!tieneAutopiloto(usuario)) {
    return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
  }

  const { tipo, cantidad_objetivo, fecha_fin, presupuesto_maximo_cop, roas_minimo } = await req.json();

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
  // Solo aplica (y solo se pregunta en el asistente) para ventas_web --
  // en los demás tipos siempre queda null. Si viene, tiene que ser un
  // número positivo real, no cualquier cosa que el cliente mande.
  let roasMinimo: number | null = null;
  if (tipo === "ventas_web" && roas_minimo !== undefined && roas_minimo !== null) {
    const valor = Number(roas_minimo);
    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ error: "El retorno mínimo debe ser un número mayor a cero." }, { status: 400 });
    }
    roasMinimo = valor;
  }

  const hoy = hoyBogota();
  if (typeof fecha_fin !== "string" || fecha_fin <= hoy) {
    return NextResponse.json({ error: "La fecha de fin debe ser futura." }, { status: 400 });
  }
  const diasDuracion = Math.round((new Date(fecha_fin).getTime() - new Date(hoy).getTime()) / 86400000);
  if (diasDuracion < DIAS_MINIMOS) {
    return NextResponse.json({ error: `La meta debe durar al menos ${DIAS_MINIMOS} días.` }, { status: 400 });
  }

  // visitas_web necesita un sitio web real al que mandar la campaña --
  // sin esto, generar_estrategia/publicar_estrategia no tienen a dónde
  // apuntar el anuncio. redirigir_a lo usa el cliente para mandar
  // directo a Integraciones en vez de solo mostrar el error.
  if (tipo === "visitas_web") {
    const { data: marca } = await supabaseAdmin
      .from("marcas")
      .select("sitio_web")
      .eq("email", session.user.email.trim().toLowerCase())
      .maybeSingle();
    if (!marca?.sitio_web) {
      return NextResponse.json(
        { error: "Necesitas conectar el sitio web de tu negocio en Integraciones antes de crear esta meta.", redirigir_a: "/?tab=integraciones" },
        { status: 400 }
      );
    }
  }

  // Por seguridad: si quedó una meta de este mismo tipo con la
  // fecha_fin ya vencida pero todavía marcada "activa" (ej. el cron
  // horario no ha pasado desde que venció), se cierra antes de
  // chequear -- así una vencida vieja nunca bloquea crear la nueva por
  // el índice único (user_id, tipo) WHERE estado='activa'.
  await cerrarMetasVencidas({ userId: usuario.id, tipo });

  const { data: metaActiva } = await supabaseAdmin
    .from("metas")
    .select("id")
    .eq("user_id", usuario.id)
    .eq("tipo", tipo)
    .eq("estado", "activa")
    .maybeSingle();

  if (metaActiva) {
    return NextResponse.json({ error: "Ya tienes una meta activa de este tipo. Pausa o cancélala antes de crear otra." }, { status: 409 });
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
      roas_minimo: roasMinimo,
      nivel_autonomia: "copiloto",
      estado: "activa",
      pausado_autopiloto: false,
    })
    .select()
    .single();

  if (error || !metaCreada) {
    // 23514 = check_violation -- pasó de verdad en producción con
    // "ventas_web" antes de que metas_tipo_check lo aceptara: el
    // mensaje crudo de Postgres ("new row ... violates check
    // constraint ...") llegaba tal cual al cliente, sin que nada lo
    // escondiera (ver app/metas/crear/page.tsx, que solo hace
    // setError(data.error)) -- solo que era un mensaje incomprensible
    // en vez de uno claro. Con TIPOS_VALIDOS y el constraint ya
    // alineados esto no debería volver a pasar, pero si algún día se
    // desincronizan de nuevo, que al menos se vea un mensaje legible.
    const mensaje = error?.code === "23514" ? "Ese tipo de meta no está disponible todavía." : error?.message || "No se pudo crear la meta.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
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
