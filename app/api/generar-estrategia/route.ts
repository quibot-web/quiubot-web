import { auth } from "@/auth";
import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { PLANES, nombreVisiblePlan, type PlanId } from "@/app/lib/planesConfig";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { procesarGeneracionEstrategia, revisarTimeoutJob, type EstrategiaJob } from "@/app/lib/estrategiasJobs";

const ORDEN_PLANES = ["arranque", "crecimiento", "escala"];
const MIN_IMAGENES = 1;
const MAX_IMAGENES = 3;

// Esta ruta solo hace lo rápido -- validar (sesión, límite del plan,
// llave de OpenAI), crear el job, y responder. El trabajo largo
// (generar_estrategia en n8n, 1.5 a 2.5 min) corre en after(), fuera
// del ciclo de esta petición -- ver app/lib/estrategiasJobs.ts para el
// por qué. El cliente (app/estrategia/page.tsx) hace polling de
// GET /api/estrategias-jobs/[id] hasta que quede "lista" o "fallida".
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const {
    imagenes_base64,       // array de 1 a 3 imagenes -- antes era imagen_base64 (singular)
    objetivo,
    presupuesto_diario_cop,
    tipo_contenido,       // "producto" | "servicio"
    descripcion_servicio, // opcional, solo aplica si tipo_contenido === "servicio"
    modo_estructura,      // "advantage" | "prueba_conceptos" (estructura Andromeda)
    angulos_a_evitar,      // opcional -- viene de la regla "abrir otro frente" del Director
  } = await req.json();

  if (!Array.isArray(imagenes_base64) || imagenes_base64.length < MIN_IMAGENES || imagenes_base64.length > MAX_IMAGENES) {
    return NextResponse.json({ error: `Sube entre ${MIN_IMAGENES} y ${MAX_IMAGENES} imágenes` }, { status: 400 });
  }
  if (!objetivo?.id) {
    return NextResponse.json({ error: "Falta el objetivo publicitario" }, { status: 400 });
  }

  if (!presupuesto_diario_cop || presupuesto_diario_cop < 20000) {
    return NextResponse.json({ error: "El presupuesto diario mínimo es $20.000 COP" }, { status: 400 });
  }

  // Normalizamos el tipo de contenido: si no llega o llega con un valor
  // inesperado, caemos de vuelta al comportamiento actual ("producto"),
  // para no romper llamadas viejas ni el flujo existente.
  const tipoContenidoFinal: "producto" | "servicio" =
    tipo_contenido === "servicio" ? "servicio" : "producto";

  const descripcionServicioFinal: string | null =
    tipoContenidoFinal === "servicio" && typeof descripcion_servicio === "string"
      ? descripcion_servicio.trim().slice(0, 500) || null
      : null;

  // Mismo patrón que tipo_contenido: si no llega o llega con un valor
  // inesperado, caemos al default "advantage" en vez de rechazar la
  // llamada -- n8n ya hace lo mismo si no le llega este campo.
  const modoEstructuraFinal: "advantage" | "prueba_conceptos" =
    modo_estructura === "prueba_conceptos" ? "prueba_conceptos" : "advantage";

  const angulosAEvitarFinal: string[] = Array.isArray(angulos_a_evitar) ? angulos_a_evitar : [];

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, plan, openai_key")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const plan = (usuario.plan as PlanId) || "arranque";
  const esAdmin = usuario.rol === "admin";

  // Validacion real del objetivo contra el plan — esta es la unica fuente
  // de verdad. El panel ya oculta las opciones que no le tocan a cada plan,
  // pero eso es solo una ayuda visual: sin esto, alguien podria llamar esta
  // API directo (saltandose el panel) y pedir un objetivo que no le corresponde.
  if (!esAdmin) {
    const { data: configObjetivo } = await supabaseAdmin
      .from("objetivos_config")
      .select("activo, plan_minimo")
      .eq("id", objetivo.id)
      .maybeSingle();

    const activo = configObjetivo?.activo ?? false;
    const planMinimo = configObjetivo?.plan_minimo || "arranque";
    const planAlcanza = ORDEN_PLANES.indexOf(plan) >= ORDEN_PLANES.indexOf(planMinimo);

    if (!activo || !planAlcanza) {
      return NextResponse.json(
        {
          error: !activo
            ? "Ese objetivo no está disponible todavía."
            : `El objetivo "${objetivo.label || objetivo.id}" requiere el plan ${nombreVisiblePlan(planMinimo as PlanId)}. Mejora tu plan para usarlo.`,
          plan_insuficiente: true,
        },
        { status: 403 }
      );
    }
  }

  if (!usuario.openai_key) {
    return NextResponse.json(
      { error: "Necesitas conectar tu API key de OpenAI en Integraciones antes de generar una estrategia." },
      { status: 400 }
    );
  }

  let openaiKeyDescifrada: string;
  try {
    openaiKeyDescifrada = desencriptarSiHaceFalta(usuario.openai_key);
  } catch (err) {
    console.error("Error al descifrar openai_key:", err);
    return NextResponse.json(
      { error: "No se pudo leer tu API key guardada. Vuelve a conectarla en Integraciones." },
      { status: 500 }
    );
  }

  const limite = PLANES[plan].estrategiasPorMes;

  if (limite !== null) {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from("estrategias_generadas")
      .select("*", { count: "exact", head: true })
      .eq("user_id", usuario.id)
      .gte("creado_en", inicioMes.toISOString());

    if ((count ?? 0) >= limite) {
      return NextResponse.json(
        {
          error: `Ya usaste tus ${limite} estrategia${limite > 1 ? "s" : ""} de este mes en el plan ${PLANES[plan].nombre}. Mejora tu plan para seguir generando, o espera al próximo mes.`,
          limite_alcanzado: true,
        },
        { status: 403 }
      );
    }
  }

  // Sin trabajos duplicados: si ya hay uno pendiente/procesando de
  // menos de 10 minutos, se devuelve ESE job_id -- nunca se crea otro
  // ni se vuelve a llamar a n8n (eso cobraría dos veces en OpenAI). Si
  // revisarTimeoutJob lo marca "fallida" por pasarse de los 10 minutos,
  // se sigue de largo y se crea uno nuevo.
  const { data: jobExistente } = await supabaseAdmin
    .from("estrategias_jobs")
    .select("*")
    .eq("user_id", usuario.id)
    .in("estado", ["pendiente", "procesando"])
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (jobExistente) {
    const actualizado = await revisarTimeoutJob(jobExistente as EstrategiaJob);
    if (actualizado.estado === "pendiente" || actualizado.estado === "procesando") {
      return NextResponse.json({ job_id: actualizado.id, estado: actualizado.estado });
    }
  }

  const ahora = new Date().toISOString();
  const { data: job, error: errorCrearJob } = await supabaseAdmin
    .from("estrategias_jobs")
    .insert({ user_id: usuario.id, estado: "pendiente", intento_desde: ahora })
    .select()
    .single();

  if (errorCrearJob || !job) {
    console.error("Error creando estrategias_jobs:", errorCrearJob);
    return NextResponse.json({ error: "No se pudo iniciar la generación. Intenta de nuevo." }, { status: 500 });
  }

  after(() =>
    procesarGeneracionEstrategia(job.id, {
      emailBusqueda,
      userId: usuario.id,
      imagenesBase64: imagenes_base64,
      objetivo,
      presupuestoDiarioCop: presupuesto_diario_cop,
      openaiKey: openaiKeyDescifrada,
      tipoContenido: tipoContenidoFinal,
      descripcionServicio: descripcionServicioFinal,
      modoEstructura: modoEstructuraFinal,
      angulosAEvitar: angulosAEvitarFinal,
    }).catch(async (err) => {
      console.error("Error no manejado en procesarGeneracionEstrategia:", err);
      await supabaseAdmin
        .from("estrategias_jobs")
        .update({ estado: "fallida", error: "Error inesperado generando la estrategia." })
        .eq("id", job.id);
    })
  );

  return NextResponse.json({ job_id: job.id, estado: "pendiente" });
}
