import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarLimite } from "@/lib/rateLimit";
import { PLANES, type PlanId } from "@/app/lib/planesConfig";

const MIN_IMAGENES = 1;
const MAX_IMAGENES = 3;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const permitido = verificarLimite(`crear-creativos:${session.user.email}`, 3, 5 * 60 * 1000);
  if (!permitido) {
    return NextResponse.json(
      { error: "Estás generando creativos muy rápido. Espera unos minutos e intenta de nuevo." },
      { status: 429 }
    );
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const {
    estrategia,
    descripcion_visual_producto,
    imagenes_producto_base64, // array de 1 a 3 imagenes -- antes era imagen_producto_base64 (singular)
    tipo_contenido,       // "producto" | "servicio" — nuevo
    descripcion_servicio, // opcional, solo aplica si tipo_contenido === "servicio"
  } = await req.json();

  if (!estrategia || !descripcion_visual_producto) {
    return NextResponse.json({ error: "Falta la estrategia o la descripción" }, { status: 400 });
  }
  if (!Array.isArray(imagenes_producto_base64) || imagenes_producto_base64.length < MIN_IMAGENES || imagenes_producto_base64.length > MAX_IMAGENES) {
    return NextResponse.json({ error: `Faltan las fotos del producto/servicio (entre ${MIN_IMAGENES} y ${MAX_IMAGENES})` }, { status: 400 });
  }

  // Igual que en generar-estrategia: normalizamos con fallback a "producto"
  // para no romper llamadas viejas ni el comportamiento actual.
  const tipoContenidoFinal: "producto" | "servicio" =
    tipo_contenido === "servicio" ? "servicio" : "producto";

  const descripcionServicioFinal: string | null =
    tipoContenidoFinal === "servicio" && typeof descripcion_servicio === "string"
      ? descripcion_servicio.trim().slice(0, 500) || null
      : null;

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, plan, openai_key, cloudinary_name, cloudinary_key, cloudinary_secret")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Limite real por plan -- antes solo existia el rate-limit anti-spam de
  // arriba (3 cada 5 min), que no distingue plan ni pone techo mensual.
  // Cada llamada aqui (lote completo, "regenerar todos", o "regenerar un
  // anuncio") crea una fila en creativos_jobs, y eso es lo que se cuenta.
  const plan = (usuario.plan as PlanId) || "arranque";
  const limiteJobs = PLANES[plan].creativosJobsPorMes;

  if (limiteJobs !== null) {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from("creativos_jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", usuario.id)
      .gte("creado_en", inicioMes.toISOString());

    if ((count ?? 0) >= limiteJobs) {
      return NextResponse.json(
        {
          error: `Ya usaste tus ${limiteJobs} generaciones de creativos de este mes en el plan ${PLANES[plan].nombre}. Mejora tu plan para seguir generando, o espera al próximo mes.`,
          limite_alcanzado: true,
        },
        { status: 403 }
      );
    }
  }

  if (!usuario.openai_key) {
    return NextResponse.json(
      { error: "Necesitas conectar tu API key de OpenAI en Integraciones antes de generar creativos." },
      { status: 400 }
    );
  }

  if (!usuario.cloudinary_name || !usuario.cloudinary_key || !usuario.cloudinary_secret) {
    return NextResponse.json(
      { error: "Necesitas conectar tus credenciales de Cloudinary en Integraciones antes de generar creativos." },
      { status: 400 }
    );
  }

  let openaiKeyDescifrada: string;
  let cloudinaryKeyDescifrada: string;
  let cloudinarySecretDescifrado: string;
  try {
    openaiKeyDescifrada = desencriptarSiHaceFalta(usuario.openai_key);
    cloudinaryKeyDescifrada = desencriptarSiHaceFalta(usuario.cloudinary_key);
    cloudinarySecretDescifrado = desencriptarSiHaceFalta(usuario.cloudinary_secret);
  } catch (err) {
    console.error("Error al descifrar credenciales:", err);
    return NextResponse.json(
      { error: "No se pudieron leer tus credenciales guardadas. Vuelve a conectarlas en Integraciones." },
      { status: 500 }
    );
  }

  try {
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/crear_creativos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailBusqueda,
        estrategia,
        descripcion_visual_producto,
        imagenes_producto_base64,
        openai_key: openaiKeyDescifrada,
        cloudinary_name: usuario.cloudinary_name,
        cloudinary_key: cloudinaryKeyDescifrada,
        cloudinary_secret: cloudinarySecretDescifrado,
        tipo_contenido: tipoContenidoFinal,
        descripcion_servicio: descripcionServicioFinal,
      }),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      return NextResponse.json(
        { error: data.error || "No se pudo iniciar la generación de creativos" },
        { status: n8nRes.status || 502 }
      );
    }

    if (!data.job_id) {
      return NextResponse.json({ error: "n8n no devolvió un job_id" }, { status: 502 });
    }

    return NextResponse.json({ job_id: data.job_id, estado: data.estado || "procesando" });
  } catch (err) {
    console.error("Error al conectar con n8n (crear_creativos):", err);
    return NextResponse.json({ error: "No se pudo conectar con el servidor" }, { status: 503 });
  }
}