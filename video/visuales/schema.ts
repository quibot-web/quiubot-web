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

// Texto que escribe la IA DENTRO de un visual (parte 2b, 18 nov 2026:
// los visuales de 2 estados pasan a tener textos propios según el tema).
// Lista blanca de caracteres: letras latinas (con tildes y ñ), números,
// puntuación común y emoji. Fuera quedan flechas y marcas de texto
// (→ ↓ ✓ ✗ ...): no están en el cmap de las 4 fuentes cargadas y solo
// se ven gracias al fallback del sistema, que no está garantizado (ver
// memoria feedback_glifos_faltantes_en_fuentes_cargadas). Para esos,
// el emoji equivalente (✔️ ❌ ➡️ ⬇️) sí pasa.
export const PATRON_TEXTO_VISUAL_SEGURO = /^[\p{Script=Latin}\p{N} .,;:¿?¡!'"()\-/%$+&@#=*·…°\p{Extended_Pictographic}\u200d\ufe0f]*$/u;

export function TextoVisual(maximo: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maximo)
    .refine((t) => PATRON_TEXTO_VISUAL_SEGURO.test(t), {
      message: "usa solo letras, números, puntuación común o emoji (nada de flechas ni símbolos como → ✓ ✗)",
    });
}

// Un solo emoji (con sus modificadores/uniones) -- el ícono grande de la
// tarjeta en anuncio_boton/conexion_whatsapp, para que calce con la
// etiqueta (📷 para "Publicación" de fotos, 🛍️ para "Catálogo"...): un
// 📣 fijo con la etiqueta "Catálogo" contradice lo que dice el visual.
export const PATRON_UN_EMOJI = /^\p{Extended_Pictographic}\ufe0f?(\u200d\p{Extended_Pictographic}\ufe0f?)*$/u;
export const IconoVisual = z
  .string()
  .trim()
  .refine((t) => PATRON_UN_EMOJI.test(t), { message: "debe ser un solo emoji" });

// Límites de largo de cada texto, en un solo lugar: el prompt los cita
// y el banco de pruebas visual (video/BancoVisuales.tsx) los renderiza
// al máximo para comprobar que caben.
export const LIMITES_TEXTO_VISUAL = {
  anuncio_boton: { etiqueta: 16, texto_problema: 26, texto_arreglo: 20 },
  conexion_whatsapp: { etiqueta: 16, texto_problema: 18, mensaje: 36 },
  respuesta_lenta: { pregunta_cliente: 40, respuesta: 36, confirmacion: 28 },
  comparacion: { etiqueta: 14, texto: 44 },
  icono_palabra: { palabra: 16 },
} as const;

export const VisualSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("celular_chat"),
    // "numero_sube" es puramente ilustrativo (regla ya aprobada en
    // Contador.tsx): nunca una cifra de resultado real de Quiubot.
    // min(0) -- ronda J: el gancho de consejos_numerados reutiliza este
    // mismo visual pero DEBE quedarse congelado en 0 (la narración dice
    // "cero mensajes"; un numero_sube/notificacion_llega ahí contradice
    // su propia narración) -- CelularChat.tsx ya soporta notificaciones
    // vacías sin romperse (nuevos = [].filter(...).length = 0), antes
    // el schema simplemente no dejaba construir ese estado.
    eventos: z.array(Evento.extend({ accion: z.enum(["notificacion_llega", "numero_sube"]) })).min(0).max(6),
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
  // Textos opcionales (parte 2b): si la IA no los manda, el componente
  // usa los textos de siempre -- así los guiones ya guardados siguen
  // siendo válidos y se ven igual que antes.
  z.object({
    tipo: z.literal("anuncio_boton"),
    icono: IconoVisual.optional(),
    etiqueta: TextoVisual(LIMITES_TEXTO_VISUAL.anuncio_boton.etiqueta).optional(),
    texto_problema: TextoVisual(LIMITES_TEXTO_VISUAL.anuncio_boton.texto_problema).optional(),
    texto_arreglo: TextoVisual(LIMITES_TEXTO_VISUAL.anuncio_boton.texto_arreglo).optional(),
    eventos: z.array(Evento.extend({ accion: z.literal("cambia_estado") })).length(1),
  }),
  z.object({
    tipo: z.literal("conexion_whatsapp"),
    icono: IconoVisual.optional(),
    etiqueta: TextoVisual(LIMITES_TEXTO_VISUAL.conexion_whatsapp.etiqueta).optional(),
    texto_problema: TextoVisual(LIMITES_TEXTO_VISUAL.conexion_whatsapp.texto_problema).optional(),
    mensaje: TextoVisual(LIMITES_TEXTO_VISUAL.conexion_whatsapp.mensaje).optional(),
    eventos: z.array(Evento.extend({ accion: z.literal("cambia_estado") })).length(1),
  }),
  // Parte 2c: visuales genéricos de 2 estados del catálogo de la Fase B,
  // sin ningún consejo escrito en el dibujo -- todo el texto lo pone la
  // IA según el eje del reel.
  z.object({
    tipo: z.literal("comparacion"),
    etiqueta_mal: TextoVisual(LIMITES_TEXTO_VISUAL.comparacion.etiqueta).optional(),
    texto_mal: TextoVisual(LIMITES_TEXTO_VISUAL.comparacion.texto),
    etiqueta_bien: TextoVisual(LIMITES_TEXTO_VISUAL.comparacion.etiqueta).optional(),
    texto_bien: TextoVisual(LIMITES_TEXTO_VISUAL.comparacion.texto),
    eventos: z.array(Evento.extend({ accion: z.literal("cambia_estado") })).length(1),
  }),
  z.object({
    tipo: z.literal("icono_palabra"),
    icono_antes: IconoVisual,
    palabra_antes: TextoVisual(LIMITES_TEXTO_VISUAL.icono_palabra.palabra),
    icono_despues: IconoVisual,
    palabra_despues: TextoVisual(LIMITES_TEXTO_VISUAL.icono_palabra.palabra),
    eventos: z.array(Evento.extend({ accion: z.literal("cambia_estado") })).length(1),
  }),
  z.object({
    tipo: z.literal("respuesta_lenta"),
    pregunta_cliente: TextoVisual(LIMITES_TEXTO_VISUAL.respuesta_lenta.pregunta_cliente).optional(),
    respuesta: TextoVisual(LIMITES_TEXTO_VISUAL.respuesta_lenta.respuesta).optional(),
    confirmacion: TextoVisual(LIMITES_TEXTO_VISUAL.respuesta_lenta.confirmacion).optional(),
    eventos: z.array(Evento.extend({ accion: z.literal("cambia_estado") })).length(1),
  }),
]);

export type Visual = z.infer<typeof VisualSchema>;

// Visuales que muestran un problema -> arreglo de verdad (2 estados, 1
// evento "cambia_estado", o el contador que sube) -- los únicos válidos
// para un consejo. Lista ÚNICA: la usan el validador
// (validarEdicionDesdeAudio.ts) y el prompt. boton_estado/cursor_clic
// quedan afuera (1 estado con una acción) y celular_chat también (es el
// visual del gancho/cierre).
export const TIPOS_VISUAL_DOS_ESTADOS = ["anuncio_boton", "conexion_whatsapp", "respuesta_lenta", "comparacion", "icono_palabra", "contador"] as const satisfies readonly Visual["tipo"][];

// Todos los "eventos" de un visual, sin importar el tipo -- para
// validar sus índices de palabra contra la narración real de la
// escena (video/guion.schema.ts) sin un switch por tipo ahí.
export function eventosDeVisual(visual: Visual): { palabra: number }[] {
  return visual.eventos;
}
