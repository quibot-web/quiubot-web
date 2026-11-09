import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { calcularAvanceMeta, verificarRequisitosMeta, MetaContextoSchema, type TipoMeta, type MetaContexto } from "@/app/lib/metas";
import { obtenerSaludInstagram } from "@/app/lib/metaInstagramSalud";
import { hoyBogota } from "@/app/lib/fechaBogota";
import { tieneAutopiloto } from "@/app/lib/planesConfig";
import { MENSAJE_META_TOKEN_VENCIDO } from "@/app/lib/metaErrors";

const TIPOS_VALIDOS: TipoMeta[] = ["conversaciones_whatsapp", "leads", "ventas_web", "visitas_web", "seguidores_facebook", "seguidores_instagram"];

// Solo para el mensaje de "meta_creada" en el hilo del Director -- ver
// ETIQUETA_TIPO en PanelDirectorGeneral.tsx para la etiqueta completa
// que ya usa la tarjeta de resumen (esta es más corta, para una frase).
const ETIQUETA_TIPO_META: Record<TipoMeta, string> = {
  conversaciones_whatsapp: "conversaciones por WhatsApp",
  leads: "leads",
  ventas_web: "ventas en tu sitio web",
  visitas_web: "visitas a tu sitio web",
  seguidores_facebook: "seguidores de Facebook",
  seguidores_instagram: "seguidores de Instagram",
};

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
          valor_inicial: meta.valor_inicial,
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
    .select(
      "id, rol, plan, en_trial, trial_termina_en, fecha_vencimiento, beta_autopiloto, meta_page_id, meta_access_token, meta_pixel_id, meta_ad_account_id"
    )
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (!tieneAutopiloto(usuario)) {
    return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { tipo, cantidad_objetivo, fecha_fin, presupuesto_maximo_cop, roas_minimo, contexto, conversacion_id } = await req.json();

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

  // Contexto conversacional (metas.contexto, opcional -- solo lo manda
  // el Director; el formulario rápido nunca lo manda y queda null). Si
  // viene, se valida de verdad: un contexto a medias o con forma
  // inesperada nunca llega a guardarse.
  let contextoValidado: MetaContexto | null = null;
  if (contexto !== undefined && contexto !== null) {
    const resultadoContexto = MetaContextoSchema.safeParse(contexto);
    if (!resultadoContexto.success) {
      return NextResponse.json({ error: "El contexto de la meta no tiene un formato válido." }, { status: 400 });
    }
    contextoValidado = resultadoContexto.data;
  }

  const hoy = hoyBogota();
  if (typeof fecha_fin !== "string") {
    return NextResponse.json({ error: "Falta la fecha de fin." }, { status: 400 });
  }

  // Centraliza acá todos los requisitos por tipo (pixel+compras para
  // ventas_web, sitio_web para visitas_web, Instagram vinculado y
  // autorizado para seguidores_instagram, meta activa del mismo tipo,
  // duración mínima) -- ver app/lib/metas.ts. Antes el chequeo de pixel
  // solo existía del lado del cliente (app/metas/crear/page.tsx), nunca
  // en el POST real.
  const resultadoRequisitos = await verificarRequisitosMeta({ tipo, usuario: { ...usuario, email: emailBusqueda }, fechaFin: fecha_fin });
  if (!resultadoRequisitos.ok) {
    const primeraAccion = resultadoRequisitos.faltantes.find((f) => f.accion)?.accion;
    return NextResponse.json(
      {
        error: resultadoRequisitos.faltantes.map((f) => f.mensaje).join(" "),
        faltantes: resultadoRequisitos.faltantes,
        redirigir_a: primeraAccion?.href,
      },
      { status: 400 }
    );
  }

  // seguidores_instagram se mide por foto diaria de followers_count
  // (ver calcularAvanceSeguidoresInstagram en app/lib/metas.ts) -- la
  // foto inicial se toma en caliente, en este mismo momento, para no
  // esperar a la próxima corrida del cron. verificarRequisitosMeta() ya
  // confirmó que la cuenta está vinculada y autorizada; esta segunda
  // consulta es solo para capturar el número real de seguidores de hoy
  // (la primera no lo necesitaba, solo el sí/no).
  let valorInicialSeguidoresInstagram: number | null = null;
  if (tipo === "seguidores_instagram") {
    const salud = await obtenerSaludInstagram(usuario);
    if (salud.tokenVencido) {
      return NextResponse.json({ error: MENSAJE_META_TOKEN_VENCIDO }, { status: 400 });
    }
    if (typeof salud.followers_count !== "number") {
      return NextResponse.json({ error: "No se pudo verificar tu cuenta de Instagram en este momento." }, { status: 500 });
    }
    valorInicialSeguidoresInstagram = salud.followers_count;
  }

  const etiquetaTipo = ETIQUETA_TIPO_META[tipo as TipoMeta];
  const presupuestoFormateado = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(presupuesto);
  const conversacionIdFinal = typeof conversacion_id === "string" && conversacion_id ? conversacion_id : null;

  // Atómico (ver docs/sql/metas_atomicas.sql): inserta la meta, cierra
  // el borrador que la originó (y cualquier OTRO borrador activo del
  // mismo tipo que haya quedado obsoleto por crearse por otro camino),
  // y deja los eventos en director_conversaciones y bitacora -- todo
  // en una sola transacción de Postgres. Idempotente por
  // conversacion_id: un reintento o una carrera entre dos pestañas
  // nunca crea una segunda meta, siempre devuelve la misma fila.
  const { data: metaCreada, error } = await supabaseAdmin.rpc("crear_meta_completa", {
    p_user_id: usuario.id,
    p_tipo: tipo,
    p_cantidad_objetivo: cantidad,
    p_fecha_inicio: hoy,
    p_fecha_fin: fecha_fin,
    p_presupuesto_maximo_cop: presupuesto,
    p_costo_objetivo_cop: presupuesto / cantidad,
    p_roas_minimo: roasMinimo,
    p_valor_inicial: valorInicialSeguidoresInstagram,
    p_contexto: contextoValidado,
    p_nivel_autonomia: "copiloto",
    p_conversacion_id: conversacionIdFinal,
    p_mensaje_meta_creada: `¡Listo! Ya creé tu meta de ${etiquetaTipo}: ${cantidad} en ${presupuestoFormateado}.`,
    p_mensaje_meta_creada_otro_borrador: `Vi que creaste tu meta de ${etiquetaTipo} por otro camino, así que dejé esta conversación como terminada.`,
  });

  if (error || !metaCreada) {
    // 23514 = check_violation (tipo no aceptado por el constraint --
    // ver el comentario viejo de este archivo, sigue pudiendo pasar si
    // TIPOS_VALIDOS y metas_tipo_check se desincronizan). 23505 = choque
    // con el índice único de meta activa por tipo -- la única forma en
    // que puede pasar hoy es una carrera real entre dos pestañas que
    // intentan crear el MISMO tipo con conversaciones distintas (si
    // fuera la misma conversación, crear_meta_completa ya lo resuelve
    // sola, sin error). Nunca se debe mostrar el texto crudo de
    // Postgres en ninguno de los dos casos.
    const mensaje =
      error?.code === "23514" ? "Ese tipo de meta no está disponible todavía." :
      error?.code === "23505" ? "Ya tienes una meta activa de este tipo." :
      error?.message || "No se pudo crear la meta.";
    return NextResponse.json({ error: mensaje }, { status: error?.code === "23505" ? 409 : 500 });
  }

  return NextResponse.json({ meta: metaCreada });
}
