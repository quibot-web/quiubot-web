import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ hasConfig: false, verificado: false });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("cloudinary_name, cloudinary_key, cloudinary_secret")
    .eq("email", session.user.email.toLowerCase())
    .single();

  // Primero, lo que ya teníamos: ¿existen los 3 campos guardados?
  const hasConfig = !!(
    usuario?.cloudinary_name &&
    usuario?.cloudinary_key &&
    usuario?.cloudinary_secret
  );

  if (!hasConfig) {
    return NextResponse.json({ hasConfig: false, verificado: false });
  }

  // Ahora sí, lo nuevo: confirmamos con la API real de Cloudinary que esas
  // credenciales funcionan, en vez de asumir que "existir" significa "servir".
  let apiKey: string;
  let apiSecret: string;
  try {
    apiKey = desencriptarSiHaceFalta(usuario!.cloudinary_key);
    apiSecret = desencriptarSiHaceFalta(usuario!.cloudinary_secret);
  } catch (err) {
    console.error("Error al descifrar credenciales de Cloudinary:", err);
    return NextResponse.json({
      hasConfig: true,
      verificado: false,
      mensaje: "No se pudieron leer tus credenciales guardadas. Vuelve a conectarlas.",
    });
  }

  const cloudName = usuario!.cloudinary_name;

  try {
    // La API de administración de Cloudinary usa autenticación básica
    // (api_key:api_secret) — es la forma más directa de confirmar que
    // ambas credenciales son válidas para esa cuenta, sin necesitar subir
    // nada ni replicar la lógica de firma que usa el endpoint de subida.
    const auth64 = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/image?max_results=1`,
      {
        headers: { Authorization: `Basic ${auth64}` },
        cache: "no-store",
      }
    );

    if (res.ok) {
      return NextResponse.json({ hasConfig: true, verificado: true });
    }

    if (res.status === 401) {
      return NextResponse.json({
        hasConfig: true,
        verificado: false,
        mensaje: "Tu API Key o API Secret de Cloudinary son incorrectos. Revísalos en tu Dashboard de Cloudinary y vuelve a guardarlos.",
      });
    }

    if (res.status === 404) {
      return NextResponse.json({
        hasConfig: true,
        verificado: false,
        mensaje: "El Cloud Name que guardaste no existe en Cloudinary. Verifícalo en tu Dashboard.",
      });
    }

    return NextResponse.json({
      hasConfig: true,
      verificado: false,
      mensaje: `Cloudinary respondió con un error inesperado (código ${res.status}). Intenta verificar de nuevo en unos minutos.`,
    });
  } catch (err) {
    console.error("Error al verificar credenciales de Cloudinary:", err);
    return NextResponse.json({
      hasConfig: true,
      verificado: false,
      mensaje: "No se pudo conectar con Cloudinary para verificar. Intenta de nuevo.",
    });
  }
}