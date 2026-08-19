import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarAccesoMusica } from "@/lib/accesoMusica";
import { MOODS_MUSICA } from "@/app/lib/moodsMusica";
import { v2 as cloudinary } from "cloudinary";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const acceso = await verificarAccesoMusica(session.user.email);
  if (!acceso.permitido) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  let query = supabaseAdmin
    .from("pistas_musicales")
    .select("*")
    .order("mood", { ascending: true })
    .order("creado_en", { ascending: false });

  // Un colaborador (no admin) solo ve sus propias pistas -- identificadas
  // por cloudinary_name, el único campo disponible para eso (ver
  // lib/accesoMusica.ts).
  if (!acceso.esAdmin) {
    query = query.eq("cloudinary_name", acceso.cloudinaryName || "__ninguno__");
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pistas: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const acceso = await verificarAccesoMusica(session.user.email);
  if (!acceso.permitido) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const emailBusqueda = session.user.email.trim().toLowerCase();

  const formData = await req.formData();
  const archivo = formData.get("archivo") as File | null;
  const mood = formData.get("mood") as string | null;
  const nombre = (formData.get("nombre") as string | null)?.trim() || null;

  if (!archivo) {
    return NextResponse.json({ error: "Falta el archivo de audio" }, { status: 400 });
  }
  if (!mood || !(MOODS_MUSICA as readonly string[]).includes(mood)) {
    return NextResponse.json({ error: "Mood inválido" }, { status: 400 });
  }
  if (!archivo.type.startsWith("audio/")) {
    return NextResponse.json({ error: "El archivo debe ser un audio (mp3)" }, { status: 400 });
  }

  // Subida con las credenciales de Cloudinary del usuario LOGUEADO (admin o
  // colaborador) -- mismo patrón BYOK que /api/album/subir, sin cuenta fija.
  const { data: usuario, error: errorUsuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, cloudinary_name, cloudinary_key, cloudinary_secret")
    .eq("email", emailBusqueda)
    .single();

  if (errorUsuario || !usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (!usuario.cloudinary_name || !usuario.cloudinary_key || !usuario.cloudinary_secret) {
    return NextResponse.json(
      { error: "Configura tus credenciales de Cloudinary en Integraciones antes de subir música." },
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

  cloudinary.config({
    cloud_name: usuario.cloudinary_name,
    api_key: cloudinaryKeyDescifrada,
    api_secret: cloudinarySecretDescifrado,
  });

  try {
    const bytes = await archivo.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${archivo.type};base64,${base64}`;

    // El audio en Cloudinary se sube como resource_type "video" -- no
    // existe un tipo "audio" separado en su API.
    const upload = await cloudinary.uploader.upload(dataUri, { resource_type: "video" });

    const { data: pista, error: errorInsert } = await supabaseAdmin
      .from("pistas_musicales")
      .insert({
        mood,
        public_id: upload.public_id,
        nombre,
        cloudinary_name: usuario.cloudinary_name,
        activo: true,
      })
      .select()
      .single();

    if (errorInsert) return NextResponse.json({ error: errorInsert.message }, { status: 500 });

    return NextResponse.json({ pista });
  } catch (err: any) {
    console.error("Error al subir pista musical:", err);
    return NextResponse.json({ error: err?.message || "No se pudo subir el archivo a Cloudinary." }, { status: 500 });
  }
}
