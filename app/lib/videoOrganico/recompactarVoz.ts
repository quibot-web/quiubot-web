import type { Guion } from "@/video/guion.schema";
import type { PalabraConTiempo } from "@/app/lib/videoOrganico/generarVoz";
import { detectarSilenciosReales, UMBRAL_SILENCIO_VOZ_DB, type SilencioReal } from "@/app/lib/videoOrganico/detectarSilenciosReales";
import { construirCamposDeTiempo } from "@/app/lib/videoOrganico/compactarPausas";
import { verificarPalabrasCompletas } from "@/app/lib/videoOrganico/verificarPalabrasCompletas";

// Recompactar la MISMA voz ya generada con límites de pausa más estrictos
// (nunca llama a la IA ni a la voz). Extraído de
// /api/admin/reel-automatico-prueba/recompactar (lanzamiento 30 nov 2026)
// para que /contenido lo use desde /api/contenido/[id]/recompactar con
// permiso de dueño. vozUrlConfiable: la URL de la voz leída de la pieza
// guardada (nunca la que manda el navegador: así el servidor no descarga
// una URL cualquiera).
export async function recompactarVoz(
  cuerpo: { guion?: unknown; crudo?: unknown; pausaDentroDeFrase_s?: unknown; pausaEntreFrases_s?: unknown } | null,
  opciones: { vozUrlConfiable?: string | null } = {}
): Promise<{ cuerpo: Record<string, unknown>; status: number }> {
  const guion = (cuerpo?.guion as unknown) as Guion | undefined;
  let crudo = (cuerpo?.crudo as unknown) as { palabrasPorEscenaCrudo: { escena_id: string; palabras: PalabraConTiempo[] }[]; silencios: SilencioReal[]; silenciosUmbral_db?: number } | undefined;
  const pausaDentroDeFrase_s = typeof cuerpo?.pausaDentroDeFrase_s === "number" ? cuerpo.pausaDentroDeFrase_s : undefined;
  const pausaEntreFrases_s = typeof cuerpo?.pausaEntreFrases_s === "number" ? cuerpo.pausaEntreFrases_s : undefined;

  if (!guion || !crudo || !Array.isArray(crudo.palabrasPorEscenaCrudo) || !Array.isArray(crudo.silencios)) {
    return { cuerpo: { error: "Falta el guion o los datos crudos de la voz ya generada (guion/crudo)." }, status: 400 };
  }

  // Voces generadas antes del 23 nov 2026 guardaron silencios medidos a
  // -30 dB (con esos el corte mordía el ataque de las palabras): se vuelven
  // a medir sobre la misma voz, sin regenerar nada.
  if (crudo.silenciosUmbral_db !== UMBRAL_SILENCIO_VOZ_DB) {
    const vozUrl = opciones.vozUrlConfiable ?? guion.vozUrl;
    if (!vozUrl) return { cuerpo: { error: "Esta voz no tiene URL para volver a medir sus silencios." }, status: 400 };
    const res = await fetch(vozUrl).catch(() => null);
    if (!res?.ok) return { cuerpo: { error: "No se pudo leer la voz para volver a medir sus silencios." }, status: 502 };
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
    return {
      cuerpo: {
        error: "La recompactación con estos límites se comió parte de una palabra real -- no se entrega un reel con audio mordido.",
        resumenErrores: hallazgosPalabrasPerdidas.map((h) => h.mensaje),
      },
      status: 502,
    };
  }

  const guionActualizado: Guion = { ...guion, tiemposRender, palabrasPorEscena, segmentosAudio };

  return { cuerpo: { guion: guionActualizado, crudo }, status: 200 };
}
