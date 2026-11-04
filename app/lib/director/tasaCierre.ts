// Categorías de tasa de cierre -- separado de app/lib/metas.ts (que
// importa lib/supabase.ts, marcado "server-only") para que el chat del
// Director (app/metas/crear/ConversacionDirector.tsx, un componente
// cliente) pueda convertir la categoría elegida en un número sin
// arrastrar código server-only a su bundle. app/lib/metas.ts re-exporta
// estos dos nombres para que el resto del backend siga importándolos
// desde ahí sin cambios.
export const CATEGORIAS_TASA_CIERRE = ["1_de_10", "2_3_de_10", "4_5_de_10", "mas_5_de_10", "no_sabe"] as const;
export type CategoriaTasaCierre = (typeof CATEGORIAS_TASA_CIERRE)[number];

// Punto medio de cada categoría, para convertir la respuesta del chip en
// un número usable por calcularRangoResultados(). "no_sabe" usa un valor
// conservador (bajo) a propósito -- mejor subestimar las ventas
// esperadas que prometer de más con un dato que el cliente mismo dijo no
// conocer; el Director lo muestra como "estimado" y sugiere medirlo de
// verdad en las primeras semanas (decisión del plan).
export const TASA_CIERRE_POR_CATEGORIA: Record<CategoriaTasaCierre, number> = {
  "1_de_10": 0.1,
  "2_3_de_10": 0.25,
  "4_5_de_10": 0.45,
  mas_5_de_10: 0.6,
  no_sabe: 0.15,
};
