// Cerebro general del Director (Paso 4/6 de la burbuja) -- distinto de
// promptMetaConversacion.ts (acotado a llenar el borrador de una meta
// nueva). Este es el que conversa libre en la pestaña "Director" de la
// burbuja y responde preguntas sobre la cuenta usando CONTEXTO DE
// CUENTA real. Por pedido explícito del usuario, se construye una sola
// vez: la Fase 2 (grupo "Equipo") reutilizará este mismo prompt/modelo
// para las @menciones.
import { z } from "zod";
import type { ContextoCuentaDirector } from "@/app/lib/director/contextoCuenta";

export const MODELO_DIRECTOR_GENERAL = "gpt-4o";

export const AccionDirectorSchema = z.object({
  label: z.string().min(1),
  // link: navega a href. crear_meta: la UI monta el flujo existente de
  // /api/metas/conversacion (nunca se recrea esa lógica acá). ir_a_soporte:
  // la UI cambia a la pestaña Soporte con la última pregunta del usuario
  // ya escrita (la UI la toma de su propio estado, el Director no la repite).
  tipo: z.enum(["link", "crear_meta", "ir_a_soporte"]),
  href: z.string().min(1).optional(),
});

export const RespuestaDirectorGeneralSchema = z.object({
  respuesta: z.string().min(1),
  acciones: z.array(AccionDirectorSchema).max(3).optional(),
});

export type AccionDirector = z.infer<typeof AccionDirectorSchema>;

function formatoConexionMeta(c: ContextoCuentaDirector["conexiones"]["meta"]): string {
  if (c.tokenVencido) return "conectado antes, pero el token venció -- hay que reconectar";
  if (!c.conectado) return "no conectado";
  return `conectado (cuenta "${c.cuentaPublicitariaNombre ?? "sin nombre"}", página "${c.paginaNombre ?? "sin nombre"}")`;
}

function formatoMeta(m: ContextoCuentaDirector["metasActivas"][number]): string {
  return `${m.tipo} (objetivo ${m.cantidad_objetivo}, hasta ${m.fecha_fin})`;
}

function construirContextoTexto(contexto: ContextoCuentaDirector): string {
  const lineas = [
    `- Meta Ads: ${formatoConexionMeta(contexto.conexiones.meta)}`,
    `- Píxel de Meta: ${contexto.conexiones.pixel.conectado ? `conectado ("${contexto.conexiones.pixel.nombre ?? "sin nombre"}")` : "no conectado"}`,
    `- Instagram: ${contexto.conexiones.instagram.conectado ? `vinculado (@${contexto.conexiones.instagram.username}, ${contexto.conexiones.instagram.seguidores ?? 0} seguidores)` : "no vinculado"}`,
    `- Llave de OpenAI: ${contexto.conexiones.openai.conectado ? "conectada" : "no conectada"}`,
    `- Credenciales de Cloudinary: ${contexto.conexiones.cloudinary.conectado ? "conectadas" : "no conectadas"}`,
    `- Metas activas: ${contexto.metasActivas.length === 0 ? "ninguna" : contexto.metasActivas.map(formatoMeta).join("; ")}`,
    `- Campañas activas: ${contexto.campanasActivas}`,
    `- Propuestas pendientes de aprobar: ${contexto.propuestasPendientes}`,
  ];
  return lineas.join("\n");
}

export function construirPromptDirectorGeneral(contexto: ContextoCuentaDirector): string {
  return `Eres "el Director de Quiubot", quien coordina al equipo de IA (Analista, Creativo, Publicador, Estratega, Optimizador) que maneja la pauta de Meta Ads del usuario. Hablas en primera persona, cercano, como un compañero de equipo que conoce su cuenta -- nunca como un manual.

CONTEXTO DE CUENTA (datos reales de ahora mismo, nunca inventes otros ni asumas valores que no aparezcan acá):
${construirContextoTexto(contexto)}

Reglas:
- Usa el CONTEXTO DE CUENTA para responder preguntas sobre su cuenta (¿tengo el píxel conectado?, ¿cuántas metas tengo?, etc.). Si algo no está en el contexto, dilo con honestidad en vez de inventarlo.
- Si falta una conexión que el usuario necesita (Meta, píxel, Instagram, OpenAI, Cloudinary), ofrece un botón de acción con tipo "link" y href "/?tab=integraciones".
- Si el usuario quiere crear una meta nueva, empezar una campaña, o lograr un objetivo que todavía no tiene como meta activa, NO intentes recolectar los datos tú mismo (producto, presupuesto, plazo, etc.) -- ofrece un botón de acción con tipo "crear_meta" y una respuesta breve invitándolo a seguir ahí. Ese flujo ya existe aparte y tiene su propia lógica.
- Si la pregunta es sobre cómo funciona Quiubot en general, precios, planes, facturación, o un problema técnico que no depende de los datos de esta cuenta (no de qué está conectado o no) -- eso es soporte, no tuyo: responde breve que es mejor resolverlo con Soporte y ofrece un botón de acción con tipo "ir_a_soporte".
- Sé breve, claro y directo. Máximo 3 acciones por respuesta, solo cuando de verdad ayudan.
- Responde ÚNICAMENTE con un objeto JSON con esta forma exacta, sin texto adicional ni backticks:
{"respuesta": "tu respuesta aquí", "acciones": [{"label": "...", "tipo": "link"|"crear_meta"|"ir_a_soporte", "href": "..." (solo si tipo es "link")}]}
El campo "acciones" es opcional -- omítelo si no aplica ninguna.`;
}
