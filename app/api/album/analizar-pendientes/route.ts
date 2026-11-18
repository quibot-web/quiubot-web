// Análisis en lote de las imágenes del álbum que todavía no tienen
// análisis (ver app/lib/analisisAlbum.ts). GET: cuántas faltan. POST:
// analiza las siguientes LOTE (la página llama en bucle hasta que no
// quede ninguna, mostrando el avance). Usa la llave de OpenAI del propio
// usuario.
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verificarLimite } from "@/lib/rateLimit";
import { registrarError } from "@/lib/registrarError";
import { analizarPendientes, contarPendientes, llaveOpenAIDe } from "@/app/lib/analisisAlbum";

const LOTE = 4;

async function usuarioDeSesion() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const email = session.user.email.trim().toLowerCase();
  const { data: usuario } = await supabaseAdmin.from("usuarios").select("id, openai_key").eq("email", email).single();
  return usuario ? { ...usuario, email } : null;
}

export async function GET() {
  const usuario = await usuarioDeSesion();
  if (!usuario) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ pendientes: await contarPendientes(usuario.id), tieneLlave: !!usuario.openai_key });
}

export async function POST() {
  const usuario = await usuarioDeSesion();
  if (!usuario) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!verificarLimite(`album-analizar-pendientes:${usuario.email}`, 40, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Estás analizando muy rápido. Espera un momento e intenta de nuevo." }, { status: 429 });
  }
  const apiKey = llaveOpenAIDe(usuario);
  if (!apiKey) return NextResponse.json({ error: "Conecta tu cuenta de OpenAI en Integraciones para analizar tus imágenes." }, { status: 400 });

  const resultado = await analizarPendientes(usuario.id, apiKey, LOTE);
  if (resultado.analizadas === 0 && resultado.fallidas > 0) {
    registrarError({
      origen: "album_analizar_pendientes",
      userId: usuario.id,
      email: usuario.email,
      paso: "llamada_openai",
      errorMensaje: "No se pudo analizar ninguna imagen del lote.",
      detalleTecnico: `${resultado.fallidas} fallidas`,
    });
    return NextResponse.json({ ...resultado, error: "No se pudieron analizar las imágenes en este momento. Revisa tu cuenta de OpenAI e intenta de nuevo." }, { status: 503 });
  }
  return NextResponse.json(resultado);
}
