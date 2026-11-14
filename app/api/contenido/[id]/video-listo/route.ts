import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { registrarError } from "@/lib/registrarError";

// El navegador de la marca ya renderizó el mp4 (@remotion/web-renderer,
// ver docs/diseno/plan_contenido_organico.md sección 5) -- esta ruta es
// el "servidor-proxy" decidido ahí: recibe el blob tal cual y lo sube a
// Cloudinary con las llaves BYOK del usuario, mismo patrón exacto que
// ya usa app/api/album/subir/route.ts. Nunca una subida firmada directa
// navegador->Cloudinary (no existe ese patrón en el repo).
//
// Solo admin, igual que el resto del plan hasta que se abra a clientes.
const ESTADOS_QUE_ACEPTAN_VIDEO = ["aprobada", "renderizando"];

// El navegador conserva el blob y ofrece "Reintentar subida" sin volver
// a renderizar -- esta ruta no pasa a "error" en el primer fallo de
// Cloudinary, para que ese reintento siga siendo posible (la pieza
// sigue en "aprobada"/"renderizando"). Solo al segundo fallo seguido
// se da por vencida.
const INTENTOS_SUBIDA_ANTES_DE_ERROR = 2;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, cloudinary_name, cloudinary_key, cloudinary_secret")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  if (usuario.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (!usuario.cloudinary_name || !usuario.cloudinary_key || !usuario.cloudinary_secret) {
    return NextResponse.json({ error: "Configura tus credenciales de Cloudinary en Integraciones" }, { status: 400 });
  }

  const { data: pieza } = await supabaseAdmin
    .from("publicaciones_organicas")
    .select("id, estado, intentos")
    .eq("id", id)
    .eq("user_id", usuario.id)
    .maybeSingle();

  if (!pieza) {
    return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
  }
  if (!ESTADOS_QUE_ACEPTAN_VIDEO.includes(pieza.estado)) {
    return NextResponse.json({ error: `Esta pieza está en estado "${pieza.estado}", no se puede subir un video ahora.` }, { status: 400 });
  }

  const formData = await req.formData().catch(() => null);
  const archivo = formData?.get("archivo") as File | null;
  if (!archivo) {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }

  const cloudinaryKeyDescifrada = desencriptarSiHaceFalta(usuario.cloudinary_key);
  const cloudinarySecretDescifrado = desencriptarSiHaceFalta(usuario.cloudinary_secret);
  cloudinary.config({
    cloud_name: usuario.cloudinary_name,
    api_key: cloudinaryKeyDescifrada,
    api_secret: cloudinarySecretDescifrado,
  });

  // 1) Subir a Cloudinary. Si falla, NO se marca "error" todavía -- se
  // cuenta el intento y se deja la pieza en el mismo estado para que el
  // navegador pueda reintentar la subida con el mismo blob, sin volver
  // a renderizar.
  let upload: { secure_url: string; public_id: string };
  try {
    const bytes = await archivo.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${archivo.type || "video/mp4"};base64,${base64}`;
    upload = await cloudinary.uploader.upload(dataUri, { resource_type: "video" });
  } catch (err) {
    const nuevosIntentos = (pieza.intentos ?? 0) + 1;
    const seAgotaronLosIntentos = nuevosIntentos >= INTENTOS_SUBIDA_ANTES_DE_ERROR;

    console.error("Error subiendo video a Cloudinary en /api/contenido/[id]/video-listo:", err);
    if (seAgotaronLosIntentos) {
      registrarError({
        origen: "contenido_video_listo",
        userId: usuario.id,
        email: emailBusqueda,
        paso: "subida_cloudinary",
        errorMensaje: "No se pudo subir el video renderizado.",
        detalleTecnico: String(err),
      });
    }

    await supabaseAdmin
      .from("publicaciones_organicas")
      .update({
        intentos: nuevosIntentos,
        ...(seAgotaronLosIntentos ? { estado: "error", tipo_error: "subida", error: "No se pudo subir el video renderizado." } : {}),
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", usuario.id);

    return NextResponse.json(
      { error: "No se pudo subir el video en este momento.", reintentable: !seAgotaronLosIntentos },
      { status: 503 }
    );
  }

  // 2) Claim atómico: solo si la pieza SIGUE en un estado que acepta
  // video en este mismo instante (nadie la canceló/retomó desde otra
  // pestaña mientras el archivo subía). Si el update no afecta ninguna
  // fila, perdimos la carrera -- no se crea la pieza del álbum, y se
  // borra de Cloudinary el archivo que se acaba de subir para no dejar
  // basura huérfana.
  const { data: filasReclamadas, error: errorClaim } = await supabaseAdmin
    .from("publicaciones_organicas")
    .update({ estado: "lista", url_video: upload.secure_url, cloudinary_public_id: upload.public_id, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", usuario.id)
    .in("estado", ESTADOS_QUE_ACEPTAN_VIDEO)
    .select("id");

  if (errorClaim) {
    console.error("Error reclamando la pieza en /api/contenido/[id]/video-listo:", errorClaim);
    registrarError({
      origen: "contenido_video_listo",
      userId: usuario.id,
      email: emailBusqueda,
      paso: "claim_pieza",
      errorMensaje: "No se pudo guardar el video subido.",
      detalleTecnico: errorClaim.message,
    });
    await cloudinary.uploader.destroy(upload.public_id, { resource_type: "video" }).catch(() => {});
    return NextResponse.json({ error: "No se pudo guardar el video en este momento." }, { status: 503 });
  }

  if (!filasReclamadas || filasReclamadas.length === 0) {
    await cloudinary.uploader.destroy(upload.public_id, { resource_type: "video" }).catch(() => {});
    return NextResponse.json({ error: "Esta pieza ya se actualizó desde otra pestaña." }, { status: 409 });
  }

  // 3) Guardar la pieza en el álbum, con el mismo contrato de video que
  // ya usa el resto (video-jobs/[id]/route.ts, album/subir/route.ts):
  // url_imagen con el mp4, tipo "video", public_id. La portada se arma
  // después con una transformación de URL sobre esta misma pieza
  // (urlPortadaVideo, app/lib/cloudinaryUrl.ts) -- no se sube ni se
  // guarda un .jpg aparte. El claim de arriba ya puso la pieza en
  // "lista"; si esto falla, queda sin album_id (gap menor, recuperable
  // a mano) en vez de deshacer el claim ya ganado.
  const { data: piezaAlbum, error: errorAlbum } = await supabaseAdmin
    .from("album_creativos")
    .insert({ user_id: usuario.id, url_imagen: upload.secure_url, public_id: upload.public_id, tipo: "video" })
    .select("id")
    .single();

  if (errorAlbum || !piezaAlbum) {
    console.error("Error guardando la pieza en el álbum:", errorAlbum);
    registrarError({
      origen: "contenido_video_listo",
      userId: usuario.id,
      email: emailBusqueda,
      paso: "guardar_album",
      errorMensaje: "El video se subió pero no se pudo guardar en el álbum.",
      detalleTecnico: errorAlbum?.message ?? "sin pieza devuelta",
    });
    return NextResponse.json({ ok: true, url_video: upload.secure_url, aviso: "Se subió, pero no quedó guardado en el álbum." });
  }

  await supabaseAdmin
    .from("publicaciones_organicas")
    .update({ album_id: piezaAlbum.id, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", usuario.id);

  return NextResponse.json({ ok: true, url_video: upload.secure_url });
}
