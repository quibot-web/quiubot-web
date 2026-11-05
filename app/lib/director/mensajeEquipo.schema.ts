// Esquema de mensajes_equipo (Fase 2, Commit 1; ampliado en el Commit
// 4 con mensaje_usuario/respuesta -- la conversación libre del grupo
// "Equipo" vive en la misma tabla que los eventos automáticos, para
// que ambos se intercalen en un solo hilo). El texto de los eventos
// automáticos sale de textosEquipo.ts sin IA; el de mensaje_usuario/
// respuesta sale de la conversación real (Commit 4).
import { z } from "zod";
import { ASISTENTES_CON_CHAT_PROPIO } from "@/app/lib/director/chatsEquipo";

export const TIPOS_EVENTO_EQUIPO = ["reporte_diario", "creativos_listos", "adn_marca_listo", "mensaje_usuario", "respuesta"] as const;
export type TipoEventoEquipo = (typeof TIPOS_EVENTO_EQUIPO)[number];

// Un mensaje de evento automático siempre lo "dice" uno de estos
// asistentes, reportándole al Director -- nunca el Director ni
// Soporte (esos no generan eventos automáticos).
export const ASISTENTE_EVENTO_EQUIPO = z.enum(ASISTENTES_CON_CHAT_PROPIO);
export type AsistenteEventoEquipo = z.infer<typeof ASISTENTE_EVENTO_EQUIPO>;

// Corrección de voz (Fase 2): mensaje_usuario/respuesta son SIEMPRE
// del Director -- es el único que le habla al usuario. Si el usuario
// menciona a un asistente con @, eso queda en contenido.asistenteCitado
// (solo para que la UI muestre la mini-esfera correcta), nunca cambia
// quién "dice" la fila.
export const ASISTENTE_CONVERSACION_EQUIPO = z.literal("director");
export type AsistenteConversacionEquipo = z.infer<typeof ASISTENTE_CONVERSACION_EQUIPO>;

export const AccionMensajeEquipoSchema = z.object({
  label: z.string().min(1),
  tipo: z.enum(["link", "crear_meta", "ir_a_soporte"]),
  href: z.string().min(1).optional(),
});

export const MensajeEquipoContenidoSchema = z.object({
  texto: z.string().min(1),
  // Chips de datos chicos (ej. "Conversaciones: 14") -- opcional, solo
  // para eventos automáticos.
  datos: z.array(z.object({ etiqueta: z.string().min(1), valor: z.string().min(1) })).max(4).optional(),
  // URLs de Cloudinary (o de video) de lo que esté listo -- opcional.
  miniaturas: z.array(z.string().url()).max(6).optional(),
  // Botones de acción en una respuesta del Director dentro del grupo
  // -- mismo contrato que promptDirectorGeneral.ts.
  acciones: z.array(AccionMensajeEquipoSchema).max(3).optional(),
  // Qué asistente citó el Director en esta respuesta (si el usuario
  // mencionó uno con @) -- solo para la mini-esfera de la UI.
  asistenteCitado: ASISTENTE_EVENTO_EQUIPO.optional(),
  // Solo para eventos automáticos -- la versión "asistente le reporta
  // al Director" (primera persona, dirigida al Director, nunca al
  // usuario) y la respuesta corta del Director a ESE asistente. Vive
  // junto a "texto" (la versión que el Director le cuenta al usuario
  // en el grupo) para no recalcular nada al armar el chat individual
  // de solo lectura (Commit 2).
  textoInterno: z.string().min(1).optional(),
  respuestaDirector: z.string().min(1).optional(),
});
export type MensajeEquipoContenido = z.infer<typeof MensajeEquipoContenidoSchema>;

export type MensajeEquipo = {
  id: string;
  user_id: string;
  asistente: z.infer<typeof ASISTENTE_EVENTO_EQUIPO> | AsistenteConversacionEquipo;
  tipo_evento: TipoEventoEquipo;
  contenido: MensajeEquipoContenido;
  origen_id: string | null;
  creado_en: string;
};
