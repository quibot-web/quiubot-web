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

export const CambioMetaSchema = z.object({
  pausado_autopiloto: z.boolean().optional(),
  estado: z.literal("cancelada").optional(),
  presupuesto_maximo_cop: z.number().positive().optional(),
});

export const AccionDirectorSchema = z.object({
  label: z.string().min(1),
  // link: navega a href. crear_meta: la UI monta el flujo existente de
  // /api/metas/conversacion (nunca se recrea esa lógica acá). ir_a_soporte:
  // la UI cambia a la pestaña Soporte con la última pregunta del usuario
  // ya escrita (la UI la toma de su propio estado, el Director no la repite).
  // confirmar_cambio_meta: la UI muestra una tarjeta de confirmación que,
  // si el cliente acepta, llama a PATCH /api/metas/[id] -- la MISMA ruta
  // que usa la página de Metas. El Director nunca escribe en la base
  // directo, solo propone el cambio con metaId+cambio.
  tipo: z.enum(["link", "crear_meta", "ir_a_soporte", "confirmar_cambio_meta"]),
  href: z.string().min(1).optional(),
  metaId: z.string().min(1).optional(),
  cambio: CambioMetaSchema.optional(),
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
  const diasTexto = m.diasRestantes <= 0 ? "vencida" : `quedan ${m.diasRestantes} días`;
  return `id ${m.id}: ${m.tipo} (objetivo ${m.cantidadObjetivo}, ${m.estado}, lleva ${m.conversiones} conseguidos, ${diasTexto}, hasta ${m.fechaFin})`;
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

const REGLAS_COMUNES = `Reglas:
- Usa el CONTEXTO DE CUENTA para responder preguntas sobre su cuenta (¿tengo el píxel conectado?, ¿cuántas metas tengo?, etc.). Si algo no está en el contexto, dilo con honestidad en vez de inventarlo.
- Si falta una conexión que el usuario necesita (Meta, píxel, Instagram, OpenAI, Cloudinary), ofrece un botón de acción con tipo "link" y href "/?tab=integraciones".
- Si el usuario quiere crear una meta nueva, empezar una campaña, o lograr un objetivo que todavía no tiene como meta activa, NO intentes recolectar los datos tú mismo (producto, presupuesto, plazo, etc.) -- ofrece un botón de acción con tipo "crear_meta" y una respuesta breve invitándolo a seguir ahí. Ese flujo ya existe aparte y tiene su propia lógica.
- Si la pregunta es sobre cómo funciona Quiubot en general, precios, planes, facturación, o un problema técnico que no depende de los datos de esta cuenta -- eso es soporte, no tuyo: responde breve que es mejor resolverlo con Soporte y ofrece un botón de acción con tipo "ir_a_soporte".
- Si el usuario pide pausar, reanudar, cancelar, o cambiar el presupuesto de una meta que SÍ aparece en "Metas activas" -- ofrece un botón de acción con tipo "confirmar_cambio_meta", metaId con el id EXACTO que ves ahí (nunca inventado) y cambio con el campo que corresponda: {"pausado_autopiloto": true} para pausar, {"pausado_autopiloto": false} para reanudar, {"estado": "cancelada"} para cancelar, o {"presupuesto_maximo_cop": NUMERO} para cambiar el presupuesto. NUNCA apliques el cambio tú mismo ni digas que ya quedó hecho -- el botón existe para que el cliente lo confirme antes de que se ejecute de verdad. Si no tiene ninguna meta de ese tipo, o hay más de una y no quedó claro cuál, pregúntale cuál en vez de adivinar.
- Sé breve, claro y directo. Máximo 3 acciones por respuesta, solo cuando de verdad ayudan.
- Responde ÚNICAMENTE con un objeto JSON con esta forma exacta, sin texto adicional ni backticks:
{"respuesta": "tu respuesta aquí", "acciones": [{"label": "...", "tipo": "link"|"crear_meta"|"ir_a_soporte"|"confirmar_cambio_meta", "href": "..." (solo si tipo es "link"), "metaId": "..." (solo si tipo es "confirmar_cambio_meta"), "cambio": {...} (solo si tipo es "confirmar_cambio_meta")}]}
El campo "acciones" es opcional -- omítelo si no aplica ninguna.`;

export function construirPromptDirectorGeneral(contexto: ContextoCuentaDirector): string {
  return `Eres "el Director de Quiubot", quien coordina al equipo de IA (Analista, Creativo, Publicador, Estratega, Optimizador) que maneja la pauta de Meta Ads del usuario. Hablas en primera persona, cercano, como un compañero de equipo que conoce su cuenta -- nunca como un manual.

CONTEXTO DE CUENTA (datos reales de ahora mismo, nunca inventes otros ni asumas valores que no aparezcan acá):
${construirContextoTexto(contexto)}

${REGLAS_COMUNES}`;
}

// Corrección de voz (Fase 2): los asistentes NUNCA le hablan directo al
// usuario -- le reportan al Director, y el Director es el único que
// habla con el usuario, citándolos ("Le pregunté al Analista y me
// dice..."). Por eso ya no existe un prompt que haga hablar al
// asistente en primera persona -- esto sigue siendo el MISMO cerebro
// del Director (mismo modelo, mismo contrato JSON), solo con la
// instrucción de consultar y citar al asistente mencionado con @.
type AsistenteCitable = "marca" | "estratega" | "creativo" | "publicador" | "analista" | "optimizador";

const DESCRIPCION_ROL: Record<AsistenteCitable, string> = {
  marca: "analiza el ADN de la marca del usuario (tono, colores, estilo) para que los anuncios se vean consistentes.",
  estratega: "diseña las campañas y sus conceptos cuando hay que generar una estrategia nueva.",
  creativo: "genera los anuncios, imágenes y textos nuevos.",
  publicador: "publica en Meta las campañas ya revisadas y avisa si algo falla al publicar.",
  analista: "lee los resultados de Meta Ads cada día: conversaciones, costo por resultado, avance contra la meta.",
  optimizador: "cuida el presupuesto y el rendimiento: pausa lo que no funciona y ajusta presupuesto a lo que sí.",
};
const NOMBRE_VISIBLE_ROL: Record<AsistenteCitable, string> = { marca: "Marca", estratega: "Estratega", creativo: "Creativo", publicador: "Publicador", analista: "Analista", optimizador: "Optimizador" };

export function construirPromptDirectorCitando(asistente: AsistenteCitable, contexto: ContextoCuentaDirector): string {
  const nombreVisible = NOMBRE_VISIBLE_ROL[asistente];
  return `Eres "el Director de Quiubot" (igual que siempre -- ver más abajo). El usuario mencionó a @${nombreVisible} en su mensaje, que ${DESCRIPCION_ROL[asistente]} Tu trabajo es responder como quien consultó con ese compañero y le trae la respuesta: "Le pregunté al ${nombreVisible} y me dice que..." -- nunca respondas como si tú fueras el ${nombreVisible}, ni dejes que hable en primera persona.

Eres "el Director de Quiubot", quien coordina al equipo de IA (Analista, Creativo, Publicador, Estratega, Optimizador) que maneja la pauta de Meta Ads del usuario. Hablas en primera persona, cercano, como un compañero de equipo que conoce su cuenta -- nunca como un manual.

CONTEXTO DE CUENTA (datos reales de ahora mismo, nunca inventes otros ni asumas valores que no aparezcan acá):
${construirContextoTexto(contexto)}

${REGLAS_COMUNES}`;
}
