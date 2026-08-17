import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { registrarError } from "@/lib/registrarError";

const LIMITE_REGENERACIONES = 2;

const MENSAJES_POR_ESTADO: Record<string, string> = {
  generando_fragmentos: "Todavía se están generando los fragmentos de este video.",
  regenerando_fragmento: "Ya se está regenerando un fragmento de este video.",
  uniendo: "La unión de este video ya se está procesando.",
  listo: "Este video ya está listo.",
  error: "Este video tuvo un error y no se puede regenerar.",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { job_id, orden } = await req.json();

  if (!job_id || typeof orden !== "number") {
    return NextResponse.json({ error: "Falta job_id o el orden del fragmento" }, { status: 400 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, cloudinary_key, cloudinary_secret")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const { data: job } = await supabaseAdmin
    .from("video_jobs")
    .select("id, user_id, estado, segmentos, regeneraciones_usadas, argumentacion, cloudinary_name")
    .eq("id", job_id)
    .single();

  if (!job || job.user_id !== usuario.id) {
    return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
  }

  if (job.estado !== "revision_pendiente") {
    return NextResponse.json(
      { error: MENSAJES_POR_ESTADO[job.estado] || "Este video no está en revisión." },
      { status: 409 }
    );
  }

  if ((job.regeneraciones_usadas ?? 0) >= LIMITE_REGENERACIONES) {
    return NextResponse.json(
      {
        error: `Ya usaste tus ${LIMITE_REGENERACIONES} regeneraciones gratis para este video.`,
        limite_alcanzado: true,
      },
      { status: 403 }
    );
  }

  const segmentos: any[] = Array.isArray(job.segmentos) ? job.segmentos : [];
  const segmento = segmentos.find((s) => s.orden === orden);

  if (!segmento) {
    return NextResponse.json({ error: "No se encontró ese fragmento en el video" }, { status: 404 });
  }

  if (!usuario.cloudinary_key || !usuario.cloudinary_secret || !job.cloudinary_name) {
    return NextResponse.json(
      { error: "Necesitas conectar tus credenciales de Cloudinary en Integraciones antes de regenerar un fragmento." },
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

  // Lock: evita que se dispare otra regeneración o la unión final mientras
  // este fragmento se está regenerando.
  const { error: errorUpdate } = await supabaseAdmin
    .from("video_jobs")
    .update({ estado: "regenerando_fragmento" })
    .eq("id", job_id);

  if (errorUpdate) {
    return NextResponse.json({ error: errorUpdate.message }, { status: 500 });
  }

  const n8nUrl = process.env.N8N_WEBHOOK_REGENERAR_FRAGMENTO;
  if (!n8nUrl) {
    return NextResponse.json({ error: "Falta configurar N8N_WEBHOOK_REGENERAR_FRAGMENTO en el servidor." }, { status: 500 });
  }

  try {
    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id,
        orden,
        tipo_segmento: segmento.tipo_segmento,
        plantilla_id_actual: segmento.plantilla_id,
        imagen_url: segmento.imagen_url,
        argumentacion: job.argumentacion,
        email: emailBusqueda,
        cloudinary_name: job.cloudinary_name,
        cloudinary_key: cloudinaryKeyDescifrada,
        cloudinary_secret: cloudinarySecretDescifrado,
      }),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      // Revertimos el lock para no dejar el job trabado en
      // 'regenerando_fragmento' si n8n rechazó la llamada.
      await supabaseAdmin.from("video_jobs").update({ estado: "revision_pendiente" }).eq("id", job_id);

      const mensajeError = data.error || "No se pudo iniciar la regeneración del fragmento";

      registrarError({
        origen: "regenerar_fragmento",
        userId: usuario.id,
        email: emailBusqueda,
        paso: "webhook_regenerar_fragmento",
        errorMensaje: mensajeError,
        detalleTecnico: JSON.stringify(data),
      });

      return NextResponse.json({ error: mensajeError }, { status: n8nRes.status || 502 });
    }

    return NextResponse.json({ ok: true, job_id });
  } catch (err) {
    console.error("Error al conectar con n8n (regenerar_fragmento):", err);

    await supabaseAdmin.from("video_jobs").update({ estado: "revision_pendiente" }).eq("id", job_id);

    registrarError({
      origen: "regenerar_fragmento",
      userId: usuario.id,
      email: emailBusqueda,
      paso: "conexion_con_n8n",
      errorMensaje: "No se pudo conectar con el servidor de video",
      detalleTecnico: String(err),
    });

    return NextResponse.json({ error: "No se pudo conectar con el servidor" }, { status: 503 });
  }
}
