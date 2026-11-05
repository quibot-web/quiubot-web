// Esquema de mensajes_equipo (Fase 2, Commit 1; ampliado en el Commit
// 4 con mensaje_usuario/respuesta -- la conversación libre del grupo
// "Equipo" vive en la misma tabla que los eventos automáticos, para
// que ambos se intercalen en un solo hilo). El texto de los eventos
// automáticos sale de textosEquipo.ts sin IA; el de mensaje_usuario/
// respuesta sale de la conversación real (Commit 4).
import { z } from "zod";
import { ASISTENTES_CON_CHAT_PROPIO } from "@/app/lib/director/chatsEquipo";

export const TIPOS_EVENTO_EQUIPO = ["reporte_diario", "creativos_listos", "mensaje_usuario", "respuesta"] as const;
export type TipoEventoEquipo = (typeof TIPOS_EVENTO_EQUIPO)[number];

// Un mensaje de evento automático siempre lo "dice" uno de estos 3,
// nunca el Director ni Soporte (esos no generan eventos automáticos).
export const ASISTENTE_EVENTO_EQUIPO = z.enum(ASISTENTES_CON_CHAT_PROPIO);

// mensaje_usuario/respuesta sí pueden ser del Director -- es quien
// responde por defecto cuando nadie menciona a un asistente puntual.
export const ASISTENTE_CONVERSACION_EQUIPO = z.enum(["director", ...ASISTENTES_CON_CHAT_PROPIO]);
export type AsistenteConversacionEquipo = z.infer<typeof ASISTENTE_CONVERSACION_EQUIPO>;

export const AccionMensajeEquipoSchema = z.object({
  label: z.string().min(1),
  tipo: z.enum(["link", "crear_meta", "ir_a_soporte"]),
  href: z.string().min(1).optional(),
});

export const MensajeEquipoContenidoSchema = z.object({
  texto: z.string().min(1),
  // Chips de datos chicos (ej. "Conversaciones: 14") -- opcional, solo
  // para reporte_diario.
  datos: z.array(z.object({ etiqueta: z.string().min(1), valor: z.string().min(1) })).max(4).optional(),
  // URLs de Cloudinary (o de video) de lo que esté listo -- opcional,
  // solo para creativos_listos.
  miniaturas: z.array(z.string().url()).max(6).optional(),
  // Botones de acción en una respuesta del Director/asistente dentro
  // del grupo -- mismo contrato que promptDirectorGeneral.ts.
  acciones: z.array(AccionMensajeEquipoSchema).max(3).optional(),
});
export type MensajeEquipoContenido = z.infer<typeof MensajeEquipoContenidoSchema>;

export type MensajeEquipo = {
  id: string;
  user_id: string;
  asistente: AsistenteConversacionEquipo;
  tipo_evento: TipoEventoEquipo;
  contenido: MensajeEquipoContenido;
  origen_id: string | null;
  creado_en: string;
};
