import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { subirFotoACloudinary } from "@/app/lib/cloudinaryUpload";

const CARPETA_CLOUDINARY = "quiubot/estrategia/subidas";

// "Subir el mío" en el paso de elegir estrategia -- el cliente ya validó
// tipo/tamaño en el navegador (ver validarImagenPropia en
// app/lib/imagenes.ts), esto solo sube al Cloudinary de su propia cuenta
// (mismo patrón que /api/propuestas/[id]/subir-fotos) y devuelve la URL.
// Nunca pasa por /api/crear-creativos -- no genera nada con IA, no cuenta
// en el cupo mensual de creativos.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { imagen_base64 } = await req.json();
  if (typeof imagen_base64 !== "string" || !imagen_base64) {
    return NextResponse.json({ error: "Falta la imagen." }, { status: 400 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("cloudinary_name, cloudinary_key, cloudinary_secret")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario?.cloudinary_name || !usuario?.cloudinary_key || !usuario?.cloudinary_secret) {
    return NextResponse.json(
      { error: "Necesitas conectar tus credenciales de Cloudinary en Integraciones antes de subir una imagen." },
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

  try {
    const urlImagen = await subirFotoACloudinary({
      cloudName: usuario.cloudinary_name,
      apiKey: cloudinaryKeyDescifrada,
      apiSecret: cloudinarySecretDescifrado,
      base64: imagen_base64,
      folder: CARPETA_CLOUDINARY,
    });
    return NextResponse.json({ url_imagen: urlImagen });
  } catch (err) {
    console.error("Error subiendo imagen propia a Cloudinary:", err);
    return NextResponse.json({ error: "No se pudo subir la imagen. Intenta de nuevo." }, { status: 500 });
  }
}
