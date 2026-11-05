// Esquema de mensajes_equipo (Fase 2, Commit 1) -- fila ya con el
// texto final interpolado con números reales (mismo espíritu que
// directorTextos.ts: "nunca gastamos IA en esto, son plantillas"). El
// materializador del Commit 2 es quien decide el texto; acá solo se
// valida y tipa la forma que puede tener "contenido".
import { z } from "zod";
import { ASISTENTES_CON_CHAT_PROPIO } from "@/app/lib/director/chatsEquipo";

export const TIPOS_EVENTO_EQUIPO = ["reporte_diario", "creativos_listos"] as const;
export type TipoEventoEquipo = (typeof TIPOS_EVENTO_EQUIPO)[number];

// Mismo subconjunto que tiene chat propio -- un mensaje de evento
// siempre lo "dice" uno de estos 3, nunca el Director ni Soporte (esos
// no generan eventos automáticos, solo conversan).
export const ASISTENTE_EVENTO_EQUIPO = z.enum(ASISTENTES_CON_CHAT_PROPIO);

export const MensajeEquipoContenidoSchema = z.object({
  texto: z.string().min(1),
  // Chips de datos chicos (ej. "Conversaciones: 14") -- opcional, solo
  // para reporte_diario.
  datos: z.array(z.object({ etiqueta: z.string().min(1), valor: z.string().min(1) })).max(4).optional(),
  // URLs de Cloudinary de los creativos listos -- solo para
  // creativos_listos.
  miniaturas: z.array(z.string().url()).max(6).optional(),
});
export type MensajeEquipoContenido = z.infer<typeof MensajeEquipoContenidoSchema>;

export type MensajeEquipo = {
  id: string;
  user_id: string;
  asistente: z.infer<typeof ASISTENTE_EVENTO_EQUIPO>;
  tipo_evento: TipoEventoEquipo;
  contenido: MensajeEquipoContenido;
  origen_id: string | null;
  creado_en: string;
};
