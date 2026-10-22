import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";

const MIN_IMAGENES = 1;
const MAX_IMAGENES = 3;

type ImagenEntrada = { tipo: "base64" | "url"; valor: string };

// Convierte una imagen del álbum (URL de Cloudinary) a base64 del lado
// del servidor -- evita CORS al intentar leerla desde el navegador, y
// mantiene el cliente simple (solo manda URLs tal cual las tiene).
async function aBase64(imagen: ImagenEntrada): Promise<string> {
  if (imagen.tipo === "base64") return imagen.valor;
  const res = await fetch(imagen.valor);
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
}

// Paso intermedio de crear_creativos (Opción A del plan de fase 2): no
// hay fotos de producto guardadas por campaña en ningún lado (ver
// investigación), así que al aprobar esa propuesta queda en
// resultado.etapa="esperando_fotos" y este endpoint es el que de verdad
// dispara la generación, una vez el cliente eligió o subió las fotos.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, openai_key, cloudinary_name, cloudinary_key, cloudinary_secret")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (usuario.rol !== "admin") {
    return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
  }

  const { data: propuesta } = await supabaseAdmin
    .from("propuestas")
    .select("*")
    .eq("id", id)
    .eq("user_id", usuario.id)
    .single();

  if (!propuesta) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
  if (propuesta.accion !== "crear_creativos") {
    return NextResponse.json({ error: "Esta propuesta no es de crear creativos." }, { status: 400 });
  }
  const etapaActual = (propuesta.resultado as any)?.etapa;
  if (propuesta.estado !== "aprobada" || etapaActual !== "esperando_fotos") {
    return NextResponse.json({ error: "Esta propuesta no está esperando fotos." }, { status: 409 });
  }

  const { imagenes, descripcion_visual_producto, tipo_contenido, descripcion_servicio } = await req.json();

  if (!Array.isArray(imagenes) || imagenes.length < MIN_IMAGENES || imagenes.length > MAX_IMAGENES) {
    return NextResponse.json({ error: `Elige entre ${MIN_IMAGENES} y ${MAX_IMAGENES} fotos.` }, { status: 400 });
  }
  if (typeof descripcion_visual_producto !== "string" || !descripcion_visual_producto.trim()) {
    return NextResponse.json({ error: "Falta describir lo que se ve en las fotos." }, { status: 400 });
  }

  const campanaId = (propuesta.parametros as any)?.campana_id;
  const { data: campana } = await supabaseAdmin
    .from("campanas_publicadas")
    .select("id, nombre, objetivo, objetivo_id, presupuesto_diario")
    .eq("id", campanaId)
    .eq("user_id", usuario.id)
    .maybeSingle();

  if (!campana) {
    return NextResponse.json({ error: "Esa campaña no pertenece a tu cuenta." }, { status: 403 });
  }

  if (!usuario.openai_key) {
    return NextResponse.json({ error: "Necesitas conectar tu API key de OpenAI en Integraciones antes de generar creativos." }, { status: 400 });
  }
  if (!usuario.cloudinary_name || !usuario.cloudinary_key || !usuario.cloudinary_secret) {
    return NextResponse.json({ error: "Necesitas conectar tus credenciales de Cloudinary en Integraciones antes de generar creativos." }, { status: 400 });
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
    return NextResponse.json({ error: "No se pudieron leer tus credenciales guardadas. Vuelve a conectarlas en Integraciones." }, { status: 500 });
  }

  let imagenesBase64: string[];
  try {
    imagenesBase64 = await Promise.all((imagenes as ImagenEntrada[]).map(aBase64));
  } catch (err) {
    console.error("Error leyendo imágenes para crear_creativos:", err);
    return NextResponse.json({ error: "No se pudo leer una de las fotos elegidas." }, { status: 500 });
  }

  // No hay un "estrategia" completo guardado para esta campaña (ver
  // investigación de fase 2) -- se arma el mínimo que crear_creativos
  // necesita a partir de lo que sí tenemos guardado.
  const estrategiaMinima = {
    campana: {
      nombre: campana.nombre,
      objetivo_meta: campana.objetivo,
      objetivo_id: campana.objetivo_id,
      presupuesto_diario_cop: campana.presupuesto_diario,
    },
  };

  const tipoContenidoFinal: "producto" | "servicio" = tipo_contenido === "servicio" ? "servicio" : "producto";

  try {
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/crear_creativos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailBusqueda,
        estrategia: estrategiaMinima,
        descripcion_visual_producto,
        imagenes_producto_base64: imagenesBase64,
        openai_key: openaiKeyDescifrada,
        cloudinary_name: usuario.cloudinary_name,
        cloudinary_key: cloudinaryKeyDescifrada,
        cloudinary_secret: cloudinarySecretDescifrado,
        tipo_contenido: tipoContenidoFinal,
        descripcion_servicio: tipoContenidoFinal === "servicio" ? (descripcion_servicio ?? null) : null,
        mostrar_precio: false,
        precio: null,
      }),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false || !data.job_id) {
      const mensajeError = data.error || "No se pudo iniciar la generación de creativos.";
      await supabaseAdmin
        .from("propuestas")
        .update({ estado: "fallida", resultado: { etapa: "fallida", error: mensajeError } })
        .eq("id", id);
      await supabaseAdmin.from("bitacora").insert({
        user_id: usuario.id,
        meta_id: propuesta.meta_id,
        propuesta_id: id,
        tipo_evento: "propuesta_aprobada_fallo",
        detalle: { accion: "crear_creativos", error: mensajeError },
      });
      return NextResponse.json({ error: mensajeError }, { status: n8nRes.status || 502 });
    }

    await supabaseAdmin
      .from("propuestas")
      .update({ resultado: { etapa: "generando", job_id: data.job_id } })
      .eq("id", id);

    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: propuesta.meta_id,
      propuesta_id: id,
      tipo_evento: "propuesta_crear_creativos_iniciada",
      detalle: { job_id: data.job_id, campana_id: campana.id },
    });

    return NextResponse.json({ ok: true, job_id: data.job_id });
  } catch (err) {
    console.error("Error al conectar con n8n (crear_creativos, desde propuesta):", err);
    const mensajeError = "No se pudo conectar con el servidor.";
    await supabaseAdmin
      .from("propuestas")
      .update({ estado: "fallida", resultado: { etapa: "fallida", error: mensajeError } })
      .eq("id", id);
    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: propuesta.meta_id,
      propuesta_id: id,
      tipo_evento: "propuesta_aprobada_fallo",
      detalle: { accion: "crear_creativos", error: mensajeError },
    });
    return NextResponse.json({ error: mensajeError }, { status: 503 });
  }
}
