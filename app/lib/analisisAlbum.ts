// Análisis automático del álbum (18 nov 2026): solo 8 de 60 imágenes de
// la cuenta de prueba tenían análisis, así que el estilo Foto (que solo
// usa fotos sin texto, video/estilos/estilos.ts idsFotosSinTexto) casi
// nunca estaba disponible. Ahora cada imagen se analiza al subirla
// (/api/album/subir, con after()) y las pendientes se analizan en lote
// desde /album (/api/album/analizar-pendientes). Mismo análisis de
// siempre (gpt-4o, app/lib/analizarPiezaImagen.ts) con la llave de
// OpenAI del propio usuario, guardado en album_creativos.analisis.
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { AnalisisPiezaSchema, type AnalisisPieza } from "@/app/lib/analisisPieza";
import { analizarPiezaConOpenAI } from "@/app/lib/analizarPiezaImagen";

// Una imagen sirve de fondo / de borde a borde en un reel solo si no tiene
// texto (mismo criterio que idsFotosSinTexto).
export function aptaParaFondo(analisis: Pick<AnalisisPieza, "tiene_texto"> | null | undefined): boolean {
  return !!analisis && !analisis.tiene_texto;
}

export type ResultadoAnalisisPieza = { id: string; ok: true; analisis: AnalisisPieza } | { id: string; ok: false; error: string };

export async function analizarYGuardarPieza(apiKey: string, pieza: { id: string; url_imagen: string }): Promise<ResultadoAnalisisPieza> {
  try {
    const analisis = await analizarPiezaConOpenAI(apiKey, pieza.url_imagen);
    const { error } = await supabaseAdmin.from("album_creativos").update({ analisis, analisis_en: new Date().toISOString() }).eq("id", pieza.id);
    if (error) return { id: pieza.id, ok: false, error: "No se pudo guardar el análisis." };
    return { id: pieza.id, ok: true, analisis };
  } catch (err) {
    return { id: pieza.id, ok: false, error: String(err) };
  }
}

// Llave de OpenAI del usuario, descifrada; null si no la tiene o no se
// puede leer (el álbum funciona igual, solo sin análisis).
export function llaveOpenAIDe(usuario: { openai_key: string | null }): string | null {
  if (!usuario.openai_key) return null;
  try {
    return desencriptarSiHaceFalta(usuario.openai_key);
  } catch {
    return null;
  }
}

export async function contarPendientes(userId: string): Promise<number> {
  const { count } = await supabaseAdmin.from("album_creativos").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("tipo", "imagen").is("analisis", null);
  return count ?? 0;
}

// Analiza hasta "limite" imágenes pendientes, una por una (cada llamada a
// gpt-4o tarda unos segundos; en serie para no saturar la llave del
// usuario). Una que falla no detiene las demás.
export async function analizarPendientes(userId: string, apiKey: string, limite: number): Promise<{ analizadas: number; fallidas: number; pendientes: number }> {
  const { data: piezas } = await supabaseAdmin
    .from("album_creativos")
    .select("id, url_imagen")
    .eq("user_id", userId)
    .eq("tipo", "imagen")
    .is("analisis", null)
    .order("creado_en", { ascending: false })
    .limit(limite);
  let analizadas = 0;
  let fallidas = 0;
  for (const pieza of piezas ?? []) {
    const resultado = await analizarYGuardarPieza(apiKey, pieza as { id: string; url_imagen: string });
    if (resultado.ok) analizadas++;
    else fallidas++;
  }
  return { analizadas, fallidas, pendientes: await contarPendientes(userId) };
}

export function analisisValido(crudo: unknown): AnalisisPieza | null {
  const r = AnalisisPiezaSchema.safeParse(crudo);
  return r.success ? r.data : null;
}
