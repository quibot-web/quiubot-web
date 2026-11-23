import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarLimite } from "@/lib/rateLimit";
import { accesoContenido } from "@/app/lib/accesoContenido";
import { correrControlVision } from "@/app/lib/videoOrganico/controlVision";

// Paso de visión del control de calidad de /contenido (antes en
// /api/admin/reel-automatico-prueba/control-calidad, que un cliente no
// puede abrir). Solo el dueño de la pieza, con SU llave de OpenAI.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acceso = await accesoContenido<{ openai_key: string | null }>("openai_key");
  if (acceso.error) return acceso.error;
  const { usuario, email } = acceso;
  if (!verificarLimite(`contenido-control-calidad:${email}`, 20, 5 * 60 * 1000)) return NextResponse.json({ error: "Demasiados controles seguidos." }, { status: 429 });

  const { data: pieza } = await supabaseAdmin.from("publicaciones_organicas").select("id").eq("id", id).eq("user_id", usuario.id).maybeSingle();
  if (!pieza) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
  if (!usuario.openai_key) return NextResponse.json({ error: "Conecta tu cuenta de OpenAI en Integraciones." }, { status: 400 });

  let apiKey: string;
  try {
    apiKey = desencriptarSiHaceFalta(usuario.openai_key);
  } catch {
    return NextResponse.json({ error: "No se pudo leer tu llave de OpenAI guardada." }, { status: 500 });
  }
  const r = await correrControlVision(apiKey, await req.json().catch(() => null));
  return NextResponse.json(r.cuerpo, { status: r.status });
}
