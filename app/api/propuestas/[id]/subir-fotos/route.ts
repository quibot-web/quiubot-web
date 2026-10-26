import { auth } from "@/auth";
import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { subirFotoACloudinary } from "@/app/lib/cloudinaryUpload";
import { aBase64, procesarCreacionCreativos } from "@/app/lib/propuestas";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

const MIN_IMAGENES = 1;
const MAX_IMAGENES = 3;
const CARPETA_CLOUDINARY = "quiubot/autopiloto/fotos";

type ImagenEntrada = { tipo: "base64" | "url"; valor: string };

// Paso intermedio de crear_creativos (Opción A del plan de fase 2) --
// esta ruta YA NO espera a generar_estrategia ni a crear_creativos (1.5
// a 2 min + 4 a 24 min): el proxy de Coolify corta cualquier conexión
// HTTP antes de que termine, y confirmado en vivo, eso mata también el
// trabajo del lado del servidor, no solo lo que ve el navegador. Esta
// ruta solo hace lo rápido -- validar, subir las fotos al Cloudinary
// del propio cliente (nunca se guardan en base64 en la propuesta) y
// marcar la etapa -- y dispara el trabajo largo con after(), que sigue
// corriendo en el mismo proceso de Node después de responder (Coolify
// corre esto como next start persistente, no funciones efímeras).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const emailBusqueda = session.user.email.trim().toLowerCase();

    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id, rol, cloudinary_name, cloudinary_key, cloudinary_secret, plan, en_trial, trial_termina_en, fecha_vencimiento, beta_autopiloto")
      .eq("email", emailBusqueda)
      .single();

    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!tieneAutopiloto(usuario)) {
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

    const { imagenes, texto_contexto } = await req.json();

    if (!Array.isArray(imagenes) || imagenes.length < MIN_IMAGENES || imagenes.length > MAX_IMAGENES) {
      return NextResponse.json({ error: `Elige entre ${MIN_IMAGENES} y ${MAX_IMAGENES} fotos.` }, { status: 400 });
    }

    const campanaId = (propuesta.parametros as any)?.campana_id;
    const { data: campana } = await supabaseAdmin
      .from("campanas_publicadas")
      .select("id, tipo_contenido, descripcion_servicio, datos_producto")
      .eq("id", campanaId)
      .eq("user_id", usuario.id)
      .maybeSingle();

    if (!campana) {
      return NextResponse.json({ error: "Esa campaña no pertenece a tu cuenta." }, { status: 403 });
    }

    // tipo_contenido viene SIEMPRE de la campaña real, nunca del
    // formulario (que ni lo manda) -- campañas viejas sin este campo se
    // tratan como "producto", igual que hoy.
    const tipoContenidoReal: "producto" | "servicio" = campana.tipo_contenido === "servicio" ? "servicio" : "producto";

    const textoContextoNormalizado: string | null =
      typeof texto_contexto === "string" ? texto_contexto.trim().slice(0, 500) || null : null;

    if (!usuario.cloudinary_name || !usuario.cloudinary_key || !usuario.cloudinary_secret) {
      return NextResponse.json({ error: "Necesitas conectar tus credenciales de Cloudinary en Integraciones antes de generar creativos." }, { status: 400 });
    }

    let cloudinaryKeyDescifrada: string;
    let cloudinarySecretDescifrado: string;
    try {
      cloudinaryKeyDescifrada = desencriptarSiHaceFalta(usuario.cloudinary_key);
      cloudinarySecretDescifrado = desencriptarSiHaceFalta(usuario.cloudinary_secret);
    } catch (err) {
      console.error("Error al descifrar credenciales de Cloudinary:", err);
      return NextResponse.json({ error: "No se pudieron leer tus credenciales guardadas. Vuelve a conectarlas en Integraciones." }, { status: 500 });
    }

    let fotosUrls: string[];
    try {
      fotosUrls = await Promise.all(
        (imagenes as ImagenEntrada[]).map(async (imagen) => {
          const base64 = await aBase64(imagen);
          return subirFotoACloudinary({
            cloudName: usuario.cloudinary_name!,
            apiKey: cloudinaryKeyDescifrada,
            apiSecret: cloudinarySecretDescifrado,
            base64,
            folder: CARPETA_CLOUDINARY,
          });
        })
      );
    } catch (err) {
      console.error("Error subiendo fotos a Cloudinary:", err);
      return NextResponse.json({ error: "No se pudo subir una de las fotos a Cloudinary." }, { status: 500 });
    }

    const ahora = new Date().toISOString();
    await supabaseAdmin
      .from("propuestas")
      .update({
        resultado: { etapa: "generando_conceptos", fotos_urls: fotosUrls, generando_desde: ahora, intentos: 0 },
        parametros: {
          ...(propuesta.parametros as object),
          tipo_contenido: tipoContenidoReal,
          descripcion_servicio: tipoContenidoReal === "servicio" ? textoContextoNormalizado : null,
          datos_producto: tipoContenidoReal === "producto" ? textoContextoNormalizado : null,
        },
      })
      .eq("id", id);

    // Si el cliente editó el texto para este refresco, se actualiza
    // también en la campaña -- así el próximo refresco ya prellena con
    // lo más reciente, en vez de quedarse con lo que se escribió al
    // publicar por primera vez.
    const campoCampana = tipoContenidoReal === "servicio" ? "descripcion_servicio" : "datos_producto";
    const valorActualCampana = tipoContenidoReal === "servicio" ? campana.descripcion_servicio : campana.datos_producto;
    if (textoContextoNormalizado !== (valorActualCampana ?? null)) {
      await supabaseAdmin
        .from("campanas_publicadas")
        .update({ [campoCampana]: textoContextoNormalizado })
        .eq("id", campana.id);
    }

    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: propuesta.meta_id,
      propuesta_id: id,
      tipo_evento: "propuesta_fotos_subidas",
      detalle: { cantidad_fotos: fotosUrls.length },
    });

    // El trabajo largo corre después de responder, en el mismo proceso
    // -- .catch() de respaldo para que un rechazo que se nos escape acá
    // (no dentro de procesarCreacionCreativos, que ya maneja sus propios
    // errores) nunca quede como una promesa sin atrapar.
    after(() =>
      procesarCreacionCreativos(id).catch(async (err) => {
        console.error("Error no manejado en procesarCreacionCreativos:", err);
        await supabaseAdmin
          .from("propuestas")
          .update({ estado: "fallida", resultado: { etapa: "fallida", error: "Error inesperado generando los creativos." } })
          .eq("id", id);
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error inesperado en /subir-fotos:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
