import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { v2 as cloudinary } from "cloudinary";

async function esAdmin(email: string) {
  const { data } = await supabaseAdmin.from("usuarios").select("rol").eq("email", email).single();
  return data?.rol === "admin";
}

// Única ruta que sube imágenes con la cuenta de Cloudinary PROPIA de
// Quiubot (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET), no con el BYOK del
// usuario -- a propósito distinta del patrón que usa /api/admin/musica
// (que sí sube con las credenciales del admin logueado): el contenido del
// Inicio (banners, novedades, capacitaciones) tiene que seguir existiendo
// aunque el admin cambie o desconecte su propio Cloudinary. Todo lo que
// suba esta ruta va a la carpeta quiubot-home/.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const emailBusqueda = session.user.email.trim().toLowerCase();
    if (!(await esAdmin(emailBusqueda))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Falta configurar Cloudinary de Quiubot." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const archivo = formData.get("archivo") as File | null;

    if (!archivo) {
      return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
    }
    if (!archivo.type.startsWith("image/")) {
      return NextResponse.json({ error: "El archivo debe ser una imagen" }, { status: 400 });
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

    const bytes = await archivo.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${archivo.type};base64,${base64}`;

    const upload = await cloudinary.uploader.upload(dataUri, { folder: "quiubot-home" });

    return NextResponse.json({ url: upload.secure_url });
  } catch (err: any) {
    console.error("Error en POST /api/admin/subir-imagen-home:", err);
    return NextResponse.json(
      { error: err?.message || "No se pudo subir la imagen a Cloudinary." },
      { status: 500 }
    );
  }
}
