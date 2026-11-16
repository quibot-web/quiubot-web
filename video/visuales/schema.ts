import { z } from "zod";

// Fase B v2.0 (ver docs/diseno/plan_contenido_organico_fase_b_v2.md,
// punto 6). Schema con los visuales ya aprobados en
// video/fixtures/organico/referencia/visuales/ -- primero 4
// (CelularChat, CursorClicGenerico, Contador, molde.tsx's BotonEstado),
// y 3 más (AnuncioBoton, ConexionWhatsapp, RespuestaLenta) agregados
// el 16 nov 2026 (3ra revisión de staging): con solo esos 4 tipos, la
// IA no tenía cómo MOSTRAR la mayoría de los consejos reales (un botón
// sin antes/después, un número sin contexto) -- "decía, no mostraba".
// Los componentes reales se promueven a video/visuales/ en un commit
// aparte (punto 5 del orden de commits) -- este archivo solo define
// QUÉ decide la IA, no cómo se renderiza.
//
// "eventos" reemplaza a "duracion_s" como lo que de verdad amarra el
// ritmo visual: cada evento cae en la N-ésima palabra de la
// narración de ESA escena (nunca en segundos -- el código resuelve el
// segundo real con los tiempos por palabra de generarVoz(), ver punto
// 3 del plan). "accion" está restringido por tipo de visual -- nunca
// texto libre -- porque cada componente real solo sabe animar lo que
// su propia lógica ya implementa.
const Evento = z.object({
  palabra: z.number().int().min(0),
});

export const VisualSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("celular_chat"),
    // "numero_sube" es puramente ilustrativo (regla ya aprobada en
    // Contador.tsx): nunca una cifra de resultado real de Quiubot.
    eventos: z.array(Evento.extend({ accion: z.enum(["notificacion_llega", "numero_sube"]) })).min(1).max(6),
  }),
  z.object({
    tipo: z.literal("cursor_clic"),
    texto_boton: z.string().min(1).max(28),
    eventos: z.array(Evento.extend({ accion: z.enum(["aparece", "clic"]) })).min(1).max(4),
  }),
  z.object({
    tipo: z.literal("contador"),
    desde: z.number().int().min(0),
    hasta: z.number().int().min(0),
    // Pedido explícito (16 nov 2026, 3ra revisión de staging): un
    // número solo, sin decir qué cuenta, "no muestra" nada -- la
    // etiqueta es lo que convierte el número en un dato que se
    // entiende ("mensajes nuevos", nunca una cifra de resultado real
    // de Quiubot, mismo criterio que "hasta").
    etiqueta: z.string().min(1).max(28),
    eventos: z.array(Evento.extend({ accion: z.literal("sube") })).min(1).max(4),
  }),
  z.object({
    tipo: z.literal("boton_estado"),
    texto: z.string().min(1).max(28),
    texto_activo: z.string().min(1).max(28),
    eventos: z.array(Evento.extend({ accion: z.enum(["aparece", "clic", "cambia_estado"]) })).min(1).max(4),
  }),
  // Los 3 siguientes son SIEMPRE de 2 estados (problema -> arreglo),
  // con un solo evento que marca el cambio -- pedido explícito (16 nov
  // 2026, 3ra revisión de staging): "cada escena valor usa un visual
  // de dos estados, y el cambio de estado está amarrado a la palabra
  // de la narración donde se da la solución". Nunca más de 1 evento:
  // con 2 estados no hay un "a medio camino", es antes o después.
  z.object({
    tipo: z.literal("anuncio_boton"),
    eventos: z.array(Evento.extend({ accion: z.literal("cambia_estado") })).length(1),
  }),
  z.object({
    tipo: z.literal("conexion_whatsapp"),
    eventos: z.array(Evento.extend({ accion: z.literal("cambia_estado") })).length(1),
  }),
  z.object({
    tipo: z.literal("respuesta_lenta"),
    eventos: z.array(Evento.extend({ accion: z.literal("cambia_estado") })).length(1),
  }),
]);

export type Visual = z.infer<typeof VisualSchema>;

// Todos los "eventos" de un visual, sin importar el tipo -- para
// validar sus índices de palabra contra la narración real de la
// escena (video/guion.schema.ts) sin un switch por tipo ahí.
export function eventosDeVisual(visual: Visual): { palabra: number }[] {
  return visual.eventos;
}
