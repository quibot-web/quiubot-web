import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Guion } from "@/video/guion.schema";
import type { PalabraConTiempo } from "@/app/lib/videoOrganico/generarVoz";
import { detectarSilenciosReales, UMBRAL_SILENCIO_VOZ_DB, type SilencioReal } from "@/app/lib/videoOrganico/detectarSilenciosReales";
import { construirCamposDeTiempo } from "@/app/lib/videoOrganico/compactarPausas";
import { verificarPalabrasCompletas } from "@/app/lib/videoOrganico/verificarPalabrasCompletas";

// Fase B v2.0, ronda J, punto B (revisión de escucha en staging, 18
// nov 2026). Hermano liviano de POST /guion -- NUNCA llama a la IA ni
// a generarVoz() (cero costo, cero variación de la voz real). Solo
// para cuando el control de calidad del arnés (render + visión +
// audio, en AdminReelAutomaticoPruebaClient.tsx) encuentra ÚNICAMENTE
// un problema de pausas (silencio largo) sobre un reel que por lo
// demás está bien: en vez de pedir un guion y una voz nuevas desde
// cero (caro, y sin ninguna garantía de que la nueva toma no tenga el
// mismo problema), recompacta la MISMA voz ya generada -- usando los
// "crudo" (palabrasPorEscenaCrudo + silencios reales) que POST /guion
// ya devolvió -- con límites de pausa más estrictos.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin.from("usuarios").select("rol").eq("email", emailBusqueda).single();
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const cuerpo = await req.json().catch(() => null);
  const guion = cuerpo?.guion as Guion | undefined;
  let crudo = cuerpo?.crudo as { palabrasPorEscenaCrudo: { escena_id: string; palabras: PalabraConTiempo[] }[]; silencios: SilencioReal[]; silenciosUmbral_db?: number } | undefined;
  const pausaDentroDeFrase_s = typeof cuerpo?.pausaDentroDeFrase_s === "number" ? cuerpo.pausaDentroDeFrase_s : undefined;
  const pausaEntreFrases_s = typeof cuerpo?.pausaEntreFrases_s === "number" ? cuerpo.pausaEntreFrases_s : undefined;

  if (!guion || !crudo || !Array.isArray(crudo.palabrasPorEscenaCrudo) || !Array.isArray(crudo.silencios)) {
    return NextResponse.json({ error: "Falta el guion o los datos crudos de la voz ya generada (guion/crudo)." }, { status: 400 });
  }

  // Voces generadas antes del 23 nov 2026 guardaron silencios medidos a
  // -30 dB (con esos el corte mordía el ataque de las palabras): se vuelven
  // a medir sobre la misma voz, sin regenerar nada.
  if (crudo.silenciosUmbral_db !== UMBRAL_SILENCIO_VOZ_DB) {
    if (!guion.vozUrl) return NextResponse.json({ error: "Esta voz no tiene URL para volver a medir sus silencios." }, { status: 400 });
    const res = await fetch(guion.vozUrl).catch(() => null);
    if (!res?.ok) return NextResponse.json({ error: "No se pudo leer la voz para volver a medir sus silencios." }, { status: 502 });
    crudo = { ...crudo, silencios: await detectarSilenciosReales(await res.arrayBuffer()), silenciosUmbral_db: UMBRAL_SILENCIO_VOZ_DB };
  }

  const { tiemposRender, palabrasPorEscena, segmentosAudio, palabrasFlat, tramosPorEscena } = construirCamposDeTiempo(crudo.palabrasPorEscenaCrudo, crudo.silencios, {
    pausaDentroDeFrase_s,
    pausaEntreFrases_s,
  });

  // Misma red de seguridad que POST /guion -- recompactar con límites
  // más estrictos nunca puede morder una palabra (compactarConSilenciosReales
  // solo recorta dentro de silencio real medido), pero se verifica
  // igual, nunca se asume.
  const hallazgosPalabrasPerdidas = verificarPalabrasCompletas(palabrasFlat, tramosPorEscena, crudo.silencios);
  if (hallazgosPalabrasPerdidas.length > 0) {
    return NextResponse.json(
      {
        error: "La recompactación con estos límites se comió parte de una palabra real -- no se entrega un reel con audio mordido.",
        resumenErrores: hallazgosPalabrasPerdidas.map((h) => h.mensaje),
      },
      { status: 502 }
    );
  }

  const guionActualizado: Guion = { ...guion, tiemposRender, palabrasPorEscena, segmentosAudio };

  return NextResponse.json({ guion: guionActualizado, crudo });
}
