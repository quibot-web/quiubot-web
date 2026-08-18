import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { v2 as cloudinary } from "cloudinary";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const emailBusqueda = session.user.email.trim().toLowerCase();

    const { data: usuario, error: errorUsuario } = await supabaseAdmin
      .from("usuarios")
      .select("id, cloudinary_name, cloudinary_key, cloudinary_secret")
      .eq("email", emailBusqueda)
      .single();

    if (errorUsuario || !usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (!usuario.cloudinary_name || !usuario.cloudinary_key || !usuario.cloudinary_secret) {
      return NextResponse.json({ error: "Configura tus credenciales de Cloudinary en Integraciones" }, { status: 400 });
    }

    const formData = await req.formData();
    const archivo = formData.get("archivo") as File | null;

    if (!archivo) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }

    const esVideo = archivo.type.startsWith("video/");
    const bytes = await archivo.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${archivo.type};base64,${base64}`;

    // cloudinary_key y cloudinary_secret se guardan cifradas (ver
    // configurar-cloudinary/route.ts) -- este handler nunca las
    // desencriptaba, así que Cloudinary siempre recibía el valor cifrado
    // tal cual y lo rechazaba con "Invalid api_key". Mismo patrón que ya
    // usan crear-creativos y generar-video.
    const cloudinaryKeyDescifrada = desencriptarSiHaceFalta(usuario.cloudinary_key);
    const cloudinarySecretDescifrado = desencriptarSiHaceFalta(usuario.cloudinary_secret);

    cloudinary.config({
      cloud_name: usuario.cloudinary_name,
      api_key: cloudinaryKeyDescifrada,
      api_secret: cloudinarySecretDescifrado,
    });

    const upload = await cloudinary.uploader.upload(dataUri, {
      resource_type: esVideo ? "video" : "image",
    });

    const { error: insertError } = await supabaseAdmin.from("album_creativos").insert({
      user_id: usuario.id,
      url_imagen: upload.secure_url,
      public_id: upload.public_id,
      tipo: esVideo ? "video" : "imagen",
    });

    if (insertError) {
      console.error("Error al insertar en álbum:", insertError);
      return NextResponse.json({ error: "Error al guardar en el álbum" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: upload.secure_url, tipo: esVideo ? "video" : "imagen" });
  } catch (err: any) {
    // Antes, todo lo que estaba fuera del try original (parseo de
    // formData, archivo.arrayBuffer(), etc.) no tenia manejo de errores --
    // cualquier excepcion ahi se perdia como un 500 generico de Next.js
    // sin mensaje, sin pasar por este catch. Ahora TODO el handler queda
    // cubierto, y el mensaje real de la excepcion viaja en la respuesta
    // para poder diagnosticar sin depender de los logs del servidor.
    console.error("Error en /api/album/subir:", err);
    return NextResponse.json(
      { error: err?.message || "Error interno del servidor al subir el archivo." },
      { status: 500 }
    );
  }
}
