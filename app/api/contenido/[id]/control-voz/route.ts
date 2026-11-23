import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { accesoContenido } from "@/app/lib/accesoContenido";
import { errorDeOpenAI, respuestaErrorOpenAI } from "@/app/lib/openaiErrores";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { verificarLimite } from "@/lib/rateLimit";
import { transcribirAudioFinal } from "@/app/lib/videoOrganico/generarVoz";
import { hallazgosPalabrasFaltantes, palabrasFaltantes } from "@/app/lib/videoOrganico/palabrasFaltantes";
import type { Guion } from "@/video/guion.schema";

// Segundo control de la voz después del render (23 nov 2026): Whisper
// transcribe el audio FINAL del video (WAV de 16 kHz que arma el navegador)
// y se compara con la narración del guion de esta pieza. El control
// principal (energía de cada arranque contra la voz TTS original) corre en
// el navegador; este solo busca palabras que faltan del todo. Fuera de
// /api/admin a propósito (lo usa /contenido).
const TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acceso = await accesoContenido<{ openai_key: string | null }>("openai_key");
  if (acceso.error) return acceso.error;
  const { usuario, email } = acceso;
  if (!verificarLimite(`contenido-control-voz:${email}`, 20, 5 * 60 * 1000)) return NextResponse.json({ error: "Demasiados controles seguidos." }, { status: 429 });
  if (!usuario.openai_key) return NextResponse.json({ error: "Sin llave de OpenAI." }, { status: 400 });

  const { data: pieza } = await supabaseAdmin.from("publicaciones_organicas").select("id, guion").eq("id", id).eq("user_id", usuario.id).maybeSingle();
  const guion = pieza?.guion as Guion | null | undefined;
  if (!guion?.escenas) return NextResponse.json({ error: "Pieza sin guion." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0 || audio.size > TAMANO_MAXIMO_BYTES) return NextResponse.json({ error: "Falta el audio del video." }, { status: 400 });

  try {
    const transcripcion = await transcribirAudioFinal(desencriptarSiHaceFalta(usuario.openai_key), await audio.arrayBuffer());
    const faltantes = palabrasFaltantes(
      guion.escenas.map((e) => ({ id: e.id, narracion: e.narracion ?? "" })),
      transcripcion
    );
    return NextResponse.json({ faltantes, hallazgos: hallazgosPalabrasFaltantes(faltantes) });
  } catch (err) {
    const errorOpenAI = errorDeOpenAI(err);
    if (errorOpenAI) {
      const r = respuestaErrorOpenAI(errorOpenAI);
      return NextResponse.json(r.cuerpo, { status: r.status });
    }
    return NextResponse.json({ error: "No se pudo transcribir el audio." }, { status: 502 });
  }
}
