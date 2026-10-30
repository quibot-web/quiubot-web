import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { v2 as cloudinary } from "cloudinary";
import { urlPortadaVideo } from "@/app/lib/cloudinaryUrl";

const CARPETA_CLOUDINARY = "quiubot/estrategia/subidas";
const PESO_MAXIMO_VIDEO = 100 * 1024 * 1024; // 100MB
const TIPOS_PERMITIDOS = ["video/mp4", "video/quicktime"];

// "Subir el mío" en el paso de elegir estrategia, cuando el archivo es un
// video -- a diferencia de /api/estrategia/subir-imagen-anuncio (que sube
// base64 vía el helper firmado subirFotoACloudinary), esto reusa el
// patrón de /api/album/subir (SDK de Cloudinary + FormData): un video de
// hasta 100MB como base64 en el body de /subir-imagen-anuncio sería
// ~33% más pesado todavía y no tiene sentido. El cliente ya validó tipo/
// duración/tamaño (ver validarVideoPropio en app/lib/imagenes.ts), pero
// eso es evadible desde devtools, así que se repite acá.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("cloudinary_name, cloudinary_key, cloudinary_secret")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario?.cloudinary_name || !usuario?.cloudinary_key || !usuario?.cloudinary_secret) {
    return NextResponse.json(
      { error: "Necesitas conectar tus credenciales de Cloudinary en Integraciones antes de subir un video." },
      { status: 400 }
    );
  }

  const formData = await req.formData();
  const archivo = formData.get("archivo") as File | null;
  if (!archivo) {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return NextResponse.json({ error: "Solo se aceptan videos MP4 o MOV." }, { status: 400 });
  }
  if (archivo.size > PESO_MAXIMO_VIDEO) {
    return NextResponse.json({ error: "El video pesa demasiado (máximo 100MB)." }, { status: 400 });
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

  cloudinary.config({
    cloud_name: usuario.cloudinary_name,
    api_key: cloudinaryKeyDescifrada,
    api_secret: cloudinarySecretDescifrado,
  });

  try {
    const bytes = await archivo.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${archivo.type};base64,${base64}`;

    const upload = await cloudinary.uploader.upload(dataUri, {
      resource_type: "video",
      folder: CARPETA_CLOUDINARY,
    });

    return NextResponse.json({
      url_video: upload.secure_url,
      url_imagen: urlPortadaVideo(upload.secure_url),
      tipo: "video",
    });
  } catch (err: any) {
    console.error("Error subiendo video propio a Cloudinary:", err);
    return NextResponse.json({ error: err?.message || "No se pudo subir el video. Intenta de nuevo." }, { status: 500 });
  }
}
