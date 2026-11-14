import { z } from "zod";
import { RECETAS_ORGANICAS_IDS, type RecetaOrganicaId } from "@/video/guion.schema";
import { fechaBogota, inicioDiaBogota } from "@/app/lib/fechaBogota";

// Fase O1, contenido orgánico -- ver docs/diseno/plan_contenido_organico.md.

export const ESTADOS_CONTENIDO = [
  "borrador",
  "generando",
  "aprobada",
  "renderizando",
  "lista",
  "publicando",
  "procesando",
  "publicada",
  "error",
  "vencida",
  "cancelada",
] as const;
export type EstadoContenido = (typeof ESTADOS_CONTENIDO)[number];

export interface PublicacionOrganica {
  id: string;
  user_id: string;
  plataforma: "instagram" | "tiktok";
  receta_organica: RecetaOrganicaId;
  producto_id: string | null;
  // Fotos o videos del álbum elegidos para esta pieza (hasta 3, commit
  // 4b.2) -- se resuelven a URL real recién al generar el guion y al
  // mostrar la revisión, igual que medios en video/guion.schema.ts.
  media_ids: string[] | null;
  guion: unknown;
  caption: string | null;
  hashtags: string[] | null;
  programada_para: string;
  estado: EstadoContenido;
  generando_desde: string | null;
  url_video: string | null;
  cloudinary_public_id: string | null;
  album_id: string | null;
  ig_container_id: string | null;
  ig_media_id: string | null;
  permalink: string | null;
  error: string | null;
  tipo_error: string | null;
  intentos: number;
  semana: string;
  continua_de_id: string | null;
  creado_en: string;
  actualizado_en: string;
}

export const RECETAS_ORGANICAS_INFO: { id: RecetaOrganicaId; label: string; desc: string }[] = [
  { id: "consejos_numerados", label: "Consejos numerados", desc: "3 consejos útiles del rubro -- valor, no venta." },
  { id: "mito_verdad", label: "Mito o verdad", desc: "Desmentir 1 o 2 mitos del rubro." },
  { id: "producto_en_uso", label: "Producto en uso", desc: "El producto real resolviendo algo." },
  { id: "serie_partes", label: "Serie en partes", desc: '"Parte 1 de 3" -- la siguiente pieza retoma el tema.' },
  { id: "pregunta_comunidad", label: "Pregunta a la comunidad", desc: "Elige A o B, opina en los comentarios." },
  { id: "detras_de_marca", label: "Detrás de la marca", desc: "Valores, cómo se hace, por qué existe la marca." },
];

export function labelReceta(id: RecetaOrganicaId): string {
  return RECETAS_ORGANICAS_INFO.find((r) => r.id === id)?.label ?? id;
}

export const ESTADOS_INFO: Record<EstadoContenido, { label: string; color: string }> = {
  borrador: { label: "Borrador", color: "#999" },
  generando: { label: "Generando guion…", color: "#C8893F" },
  aprobada: { label: "Aprobada", color: "#2E9E6B" },
  renderizando: { label: "Renderizando…", color: "#534AB7" },
  lista: { label: "Lista para programar", color: "#2E9E6B" },
  publicando: { label: "Publicando…", color: "#534AB7" },
  procesando: { label: "Procesando en Instagram…", color: "#534AB7" },
  publicada: { label: "Publicada", color: "#2E9E6B" },
  error: { label: "Error", color: "#B91C1C" },
  vencida: { label: "Vencida", color: "#B91C1C" },
  cancelada: { label: "Cancelada", color: "#999" },
};

// Lunes de la semana (Bogotá) que contiene fechaYMD -- mismo criterio
// que diasEntre()/hoyBogota(): todo en fechas de calendario, sin tocar
// la hora salvo para calcular el día de la semana real.
export function lunesDeLaSemana(fechaYMD: string): string {
  const fecha = inicioDiaBogota(fechaYMD);
  // getUTCDay(): 0=domingo..6=sábado -- inicioDiaBogota ya fija la hora
  // en el offset de Bogotá, así que el día de la semana en UTC de ese
  // instante es el día real en Bogotá.
  const diaSemana = fecha.getUTCDay();
  const diasHastaLunes = diaSemana === 0 ? 6 : diaSemana - 1;
  const lunes = new Date(fecha.getTime() - diasHastaLunes * 24 * 60 * 60 * 1000);
  return fechaBogota(lunes);
}

// Recetas que no se pueden elegir sin al menos una foto/video del
// álbum (commit 4b.2, pedido explícito: "producto_en_uso exige al
// menos una pieza; si no hay, no se puede elegir esa receta").
export const RECETAS_QUE_EXIGEN_MEDIA: RecetaOrganicaId[] = ["producto_en_uso"];

export const CrearPiezaManualSchema = z
  .object({
    receta_organica: z.enum(RECETAS_ORGANICAS_IDS),
    // offset: true acepta tanto "...Z" como "...-05:00" -- el navegador
    // manda la hora local de la marca con su propio offset, nunca UTC a mano.
    programada_para: z.iso.datetime({ offset: true }),
    producto_id: z.uuid().optional().nullable(),
    media_ids: z.array(z.uuid()).max(3).optional(),
  })
  .refine((v) => !RECETAS_QUE_EXIGEN_MEDIA.includes(v.receta_organica) || (v.media_ids?.length ?? 0) > 0, {
    message: "Esta receta exige al menos una foto o video del álbum.",
    path: ["media_ids"],
  });
