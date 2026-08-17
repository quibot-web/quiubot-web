import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";

const MENSAJES_POR_ESTADO: Record<string, string> = {
  generando_fragmentos: "Todavía se están generando los fragmentos de este video.",
  regenerando_fragmento: "Espera a que termine de regenerar un fragmento antes de unir el video.",
  uniendo: "La unión de este video ya se está procesando.",
  listo: "Este video ya está listo.",
  error: "Este video tuvo un error y no se puede unir.",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { job_id, texto_cta } = await req.json();

  if (!job_id) {
    return NextResponse.json({ error: "Falta el job_id" }, { status: 400 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const { data: job } = await supabaseAdmin
    .from("video_jobs")
    .select("id, user_id, estado")
    .eq("id", job_id)
    .single();

  if (!job || job.user_id !== usuario.id) {
    return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
  }

  if (job.estado !== "revision_pendiente") {
    return NextResponse.json(
      { error: MENSAJES_POR_ESTADO[job.estado] || "Este video no está listo para unirse." },
      { status: 409 }
    );
  }

  // El texto del CTA es editable en la pantalla de revisión -- a diferencia
  // de regenerar un fragmento, no cuesta nada (es solo el overlay de
  // Cloudinary en el paso de unión), así que si el usuario lo cambió acá,
  // se guarda antes de disparar la unión. Si no viene, se queda el que ya
  // tenía guardado desde la generación inicial.
  const actualizacion: Record<string, unknown> = { estado: "uniendo" };
  if (typeof texto_cta === "string") {
    actualizacion.texto_cta = texto_cta;
  }

  const { error: errorUpdate } = await supabaseAdmin
    .from("video_jobs")
    .update(actualizacion)
    .eq("id", job_id);

  if (errorUpdate) {
    return NextResponse.json({ error: errorUpdate.message }, { status: 500 });
  }

  const n8nUrl = process.env.N8N_WEBHOOK_CONFIRMAR_UNION_VIDEO;
  if (!n8nUrl) {
    return NextResponse.json({ error: "Falta configurar N8N_WEBHOOK_CONFIRMAR_UNION_VIDEO en el servidor." }, { status: 500 });
  }

  try {
    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id }),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      const mensajeError = data.error || "No se pudo iniciar la unión del video";

      registrarError({
        origen: "confirmar_union_video",
        userId: usuario.id,
        email: emailBusqueda,
        paso: "webhook_confirmar_union",
        errorMensaje: mensajeError,
        detalleTecnico: JSON.stringify(data),
      });

      return NextResponse.json({ error: mensajeError }, { status: n8nRes.status || 502 });
    }

    return NextResponse.json({ ok: true, job_id });
  } catch (err) {
    console.error("Error al conectar con n8n (confirmar_union_video):", err);

    registrarError({
      origen: "confirmar_union_video",
      userId: usuario.id,
      email: emailBusqueda,
      paso: "conexion_con_n8n",
      errorMensaje: "No se pudo conectar con el servidor de video",
      detalleTecnico: String(err),
    });

    return NextResponse.json({ error: "No se pudo conectar con el servidor" }, { status: 503 });
  }
}
