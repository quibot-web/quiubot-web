import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { correrControlVision } from "@/app/lib/videoOrganico/controlVision";

// Fase B v2.0, paso 7 del plan -- el paso de visión del control de
// calidad (código + visión, nunca solo uno). Verificado antes con un
// spike descartable (3 cuadros reales, una sola petición a gpt-4o con
// varias image_url + response_format json_object) que esto funciona:
// el modelo distinguió cada cuadro y devolvió un hallazgo por imagen.
// Mismo modelo que ya usa analizarPiezaConOpenAI (MODELO_ANALISIS_IMAGEN,
// "gpt-4o") -- no uno nuevo.

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin.from("usuarios").select("rol, openai_key").eq("email", emailBusqueda).single();
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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
