import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { registrarError } from "@/lib/registrarError";
import { PLANES, type PlanId } from "@/app/lib/planesConfig";

const MIN_IMAGENES_PRODUCTO = 1;
const MAX_IMAGENES_PRODUCTO = 3;
const LIMITE_VIDEOS_TRIAL = 2;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { imagenes_producto_urls, argumentacion, texto_cta } = await req.json();

  if (
    !Array.isArray(imagenes_producto_urls) ||
    imagenes_producto_urls.length < MIN_IMAGENES_PRODUCTO ||
    imagenes_producto_urls.length > MAX_IMAGENES_PRODUCTO
  ) {
    return NextResponse.json(
      { error: `Faltan las imágenes del producto (entre ${MIN_IMAGENES_PRODUCTO} y ${MAX_IMAGENES_PRODUCTO})` },
      { status: 400 }
    );
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, plan, en_trial, trial_termina_en, cloudinary_name, cloudinary_key, cloudinary_secret")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Limite de videos por mes/prueba -- a diferencia de estrategiasPorMes y
  // creativosJobsPorMes (que siempre cuentan por mes calendario, sin
  // importar si el usuario esta en trial), el trial tiene un limite TOTAL
  // para todo el periodo de 7 dias, que no se reinicia cada mes. Como no
  // hay una columna con la fecha de inicio del trial (solo
  // trial_termina_en, el final), el inicio de la ventana se calcula
  // restandole 7 dias a esa fecha.
  if (usuario.en_trial) {
    const inicioTrial = usuario.trial_termina_en
      ? new Date(new Date(usuario.trial_termina_en).getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(0);

    const { count } = await supabaseAdmin
      .from("video_jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", usuario.id)
      .gte("creado_en", inicioTrial.toISOString());

    if ((count ?? 0) >= LIMITE_VIDEOS_TRIAL) {
      return NextResponse.json(
        {
          error: `Ya usaste tus ${LIMITE_VIDEOS_TRIAL} videos de tu prueba gratuita. Mejora tu plan para seguir generando.`,
          limite_alcanzado: true,
        },
        { status: 403 }
      );
    }
  } else {
    const plan = (usuario.plan as PlanId) || "arranque";
    const limiteVideos = PLANES[plan].videosPorMes;

    if (limiteVideos === 0) {
      return NextResponse.json(
        {
          error: `Generar video no está disponible en el plan ${PLANES[plan].nombre}. Mejora tu plan para acceder a esta función.`,
          limite_alcanzado: true,
        },
        { status: 403 }
      );
    }

    if (limiteVideos !== null) {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const { count } = await supabaseAdmin
        .from("video_jobs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", usuario.id)
        .gte("creado_en", inicioMes.toISOString());

      if ((count ?? 0) >= limiteVideos) {
        return NextResponse.json(
          {
            error: `Ya usaste tus ${limiteVideos} video${limiteVideos > 1 ? "s" : ""} de este mes en el plan ${PLANES[plan].nombre}. Mejora tu plan para seguir generando, o espera al próximo mes.`,
            limite_alcanzado: true,
          },
          { status: 403 }
        );
      }
    }
  }

  if (!usuario.cloudinary_name || !usuario.cloudinary_key || !usuario.cloudinary_secret) {
    return NextResponse.json(
      { error: "Necesitas conectar tus credenciales de Cloudinary en Integraciones antes de generar un video." },
      { status: 400 }
    );
  }

  let cloudinaryKeyDescifrada: string;
  let cloudinarySecretDescifrado: string;
  try {
    cloudinaryKeyDescifrada = desencriptarSiHaceFalta(usuario.cloudinary_key);
    cloudinarySecretDescifrado = desencriptarSiHaceFalta(usuario.cloudinary_secret);
  } catch (err) {
    console.error("Error al descifrar credenciales de Cloudinary:", err);
    return NextResponse.json(
      { error: "No se pudieron leer tus credenciales guardadas. Vuelve a conectarlas en Integraciones." },
      { status: 500 }
    );
  }

  const n8nUrl = process.env.N8N_WEBHOOK_GENERAR_VIDEO;
  if (!n8nUrl) {
    return NextResponse.json({ error: "Falta configurar N8N_WEBHOOK_GENERAR_VIDEO en el servidor." }, { status: 500 });
  }

  try {
    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailBusqueda,
        imagenes_producto_urls,
        argumentacion,
        texto_cta,
        cloudinary_name: usuario.cloudinary_name,
        cloudinary_key: cloudinaryKeyDescifrada,
        cloudinary_secret: cloudinarySecretDescifrado,
      }),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      const mensajeError = data.error || "No se pudo iniciar la generación de video";

      registrarError({
        origen: "generar_video",
        userId: usuario.id,
        email: emailBusqueda,
        paso: "webhook_generar_video",
        errorMensaje: mensajeError,
        detalleTecnico: JSON.stringify(data),
      });

      return NextResponse.json(
        { error: mensajeError },
        { status: n8nRes.status || 502 }
      );
    }

    if (!data.job_id) {
      registrarError({
        origen: "generar_video",
        userId: usuario.id,
        email: emailBusqueda,
        paso: "webhook_generar_video",
        errorMensaje: "n8n no devolvió un job_id",
        detalleTecnico: JSON.stringify(data),
      });

      return NextResponse.json({ error: "No se pudo iniciar la generación de video" }, { status: 502 });
    }

    return NextResponse.json({ job_id: data.job_id });
  } catch (err) {
    console.error("Error al conectar con n8n (generar_video):", err);

    registrarError({
      origen: "generar_video",
      userId: usuario.id,
      email: emailBusqueda,
      paso: "conexion_con_n8n",
      errorMensaje: "No se pudo conectar con el servidor de video",
      detalleTecnico: String(err),
    });

    return NextResponse.json({ error: "No se pudo conectar con el servidor" }, { status: 503 });
  }
}
