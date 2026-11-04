// Borrador que llena la conversación con el Director (sección 4 del
// plan: "la IA solo conversa y llena un borrador estructurado, validado
// con zod"). Dos niveles, mismo criterio que video/guion.schema.ts:
// - BorradorMetaSchema: laxo, todo opcional -- es lo que se va guardando
//   turno a turno en conversaciones_meta.borrador, nunca se exige nada.
// - BorradorMetaListoSchema: estricto, discriminado por tipo -- es el
//   único que decide si ya se puede mostrar el resumen y el botón
//   "Crear mi meta". La IA puede "creer" que el borrador está listo,
//   pero el servidor es quien valida contra este schema antes de
//   confiar en eso (ver app/api/metas/conversacion/route.ts, Commit 3).
import { z } from "zod";
import { CATEGORIAS_TASA_CIERRE } from "@/app/lib/metas";

export const TIPOS_META_DIRECTOR = [
  "conversaciones_whatsapp",
  "leads",
  "ventas_web",
  "visitas_web",
  "seguidores_facebook",
  "seguidores_instagram",
] as const;

// Plazo propuesto por defecto cuando el Director arma la simulación sin
// que el cliente haya dicho nada todavía de plazo (decisión del plan).
export const PLAZO_DIAS_DEFECTO = 30;

export const BorradorMetaSchema = z.object({
  tipo: z.enum(TIPOS_META_DIRECTOR).optional(),
  producto: z.string().min(1).max(200).optional(),
  precio_cop: z.number().positive().optional(),
  tasa_cierre_categoria: z.enum(CATEGORIAS_TASA_CIERRE).optional(),
  presupuesto_cop: z.number().positive().optional(),
  plazo_dias: z.number().int().min(14).max(90).optional(),
  // Solo seguidores_instagram (el @usuario que necesita el botón real).
  usuario_cta: z
    .string()
    .regex(/^@/, "usuario_cta debe empezar con @")
    .optional(),
  // Solo ventas_web.
  roas_minimo: z.number().positive().optional(),
});

export type BorradorMeta = z.infer<typeof BorradorMetaSchema>;

// Campos que SIEMPRE hacen falta sin importar el tipo -- producto da
// contexto útil en cualquier campaña (igual que ya se pide hoy en
// /estrategia), presupuesto y plazo son los mismos que ya exige
// POST /api/metas.
const BaseListo = {
  producto: z.string().min(1).max(200),
  presupuesto_cop: z.number().positive(),
  plazo_dias: z.number().int().min(14).max(90),
};

export const BorradorMetaListoSchema = z.discriminatedUnion("tipo", [
  // conversaciones_whatsapp y leads: la cantidad de la meta son
  // conversaciones/leads, no ventas -- tasa_cierre_categoria es
  // obligatoria para poder mostrar el estimado de ventas (sección 5 del
  // plan). precio_cop es opcional (contexto, no se usa en el cálculo).
  z.object({ ...BaseListo, tipo: z.literal("conversaciones_whatsapp"), precio_cop: z.number().positive().optional(), tasa_cierre_categoria: z.enum(CATEGORIAS_TASA_CIERRE) }),
  z.object({ ...BaseListo, tipo: z.literal("leads"), precio_cop: z.number().positive().optional(), tasa_cierre_categoria: z.enum(CATEGORIAS_TASA_CIERRE) }),
  // ventas_web: la cantidad YA es ventas -- no hace falta tasa de
  // cierre. precio_cop sí es obligatorio (contexto real de venta).
  z.object({ ...BaseListo, tipo: z.literal("ventas_web"), precio_cop: z.number().positive(), roas_minimo: z.number().positive().optional() }),
  z.object({ ...BaseListo, tipo: z.literal("visitas_web") }),
  z.object({ ...BaseListo, tipo: z.literal("seguidores_facebook") }),
  z.object({ ...BaseListo, tipo: z.literal("seguidores_instagram"), usuario_cta: z.string().regex(/^@/) }),
]);

export type BorradorMetaListo = z.infer<typeof BorradorMetaListoSchema>;
