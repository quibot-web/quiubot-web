import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { generarVozYTiempos } from "@/app/lib/videoOrganico/generarGuionConVoz";
import { NARRACION_PROTOTIPO } from "@/video/ilustrado/guionPrototipo";

// Reel ilustrado, fase 1 (motor + rendimiento): arnés admin. Genera la
// voz REAL del guion fijo del prototipo ("Por qué tus anuncios no
// venden") con la voz de la marca del admin -- mismo pipeline que
// /contenido (TTS -> Whisper -> alineación -> pausas compactadas) -- para
// renderizar el reel ilustrado en el navegador y medir cuánto tarda.
// Solo LEE la base (llaves y voz de la marca); no escribe nada: no es
// una pieza real ni entra al calendario. La voz queda en el Cloudinary
// del admin, como en el arnés del reel automático.
const VOZ_POR_DEFECTO = "cedar";

export const maxDuration = 120;

export async function POST(req: Request) {
  // conFotoAlbum: además de la voz (ya en Cloudinary), una foto del álbum
  // del admin (Cloudinary) -- reproduce el caso real de /contenido, con
  // recursos de otro origen (ver video/ilustrado/recursosLocales.ts).
  const cuerpo = await req.json().catch(() => null);
  const conFotoAlbum = cuerpo?.conFotoAlbum === true;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const email = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, openai_key, cloudinary_name, cloudinary_key, cloudinary_secret")
    .eq("email", email)
    .single();
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!usuario.openai_key) return NextResponse.json({ error: "Conecta tu cuenta de OpenAI en Integraciones antes de generar la voz." }, { status: 400 });
  if (!usuario.cloudinary_name || !usuario.cloudinary_key || !usuario.cloudinary_secret) {
    return NextResponse.json({ error: "Conecta tu cuenta de Cloudinary en Integraciones antes de generar la voz." }, { status: 400 });
  }

  let openaiKey: string;
  let cloudinaryKey: string;
  let cloudinarySecret: string;
  try {
    openaiKey = desencriptarSiHaceFalta(usuario.openai_key);
    cloudinaryKey = desencriptarSiHaceFalta(usuario.cloudinary_key);
    cloudinarySecret = desencriptarSiHaceFalta(usuario.cloudinary_secret);
  } catch {
    return NextResponse.json({ error: "No se pudo leer alguna de tus llaves guardadas." }, { status: 500 });
  }
  const { data: marca } = await supabaseAdmin.from("marcas").select("voz_tts").eq("email", email).maybeSingle();
  const voz = (marca?.voz_tts as string | null) || VOZ_POR_DEFECTO;

  try {
    const resultado = await generarVozYTiempos(NARRACION_PROTOTIPO, {
      openaiKey,
      voz,
      cloudinary: { cloudName: usuario.cloudinary_name, apiKey: cloudinaryKey, apiSecret: cloudinarySecret },
      revisarVozCompleta: true,
    });
    if (!resultado.ok) return NextResponse.json({ error: resultado.error, resumenErrores: resultado.resumenErrores }, { status: resultado.status });
    const { tiemposRender, palabrasPorEscena, segmentosAudio, vozUrl } = resultado.campos;
    let fotoUrl: string | null = null;
    if (conFotoAlbum) {
      // Solo lectura: la imagen más reciente del álbum, de preferencia sin texto encima.
      const { data: imagenes } = await supabaseAdmin.from("album_creativos").select("url_imagen, analisis").eq("user_id", usuario.id).eq("tipo", "imagen").order("creado_en", { ascending: false }).limit(20);
      const sinTexto = (imagenes ?? []).find((i) => (i.analisis as { tiene_texto?: boolean } | null)?.tiene_texto === false);
      fotoUrl = (sinTexto ?? imagenes?.[0])?.url_imagen ?? null;
      if (!fotoUrl) return NextResponse.json({ error: "Tu álbum no tiene imágenes: sube una para probar el modo con foto del álbum." }, { status: 400 });
    }
    return NextResponse.json({ tiempos: { tiemposRender, palabrasPorEscena, segmentosAudio }, vozUrl, voz, puntajeAlineacion: resultado.puntajeAlineacion, fotoUrl });
  } catch (err) {
    const detalle = String(err instanceof Error ? err.message : err);
    if (/insufficient_quota|credit_balance_exhausted|no tiene créditos/.test(detalle)) {
      return NextResponse.json({ error: "Tu cuenta de OpenAI no tiene créditos. Agrega saldo en platform.openai.com y vuelve a intentar." }, { status: 503 });
    }
    console.error("Error generando la voz del reel ilustrado de prueba:", err);
    return NextResponse.json({ error: "No se pudo generar la voz en este momento. Intenta de nuevo." }, { status: 503 });
  }
}
