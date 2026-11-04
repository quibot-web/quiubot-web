// Tipo compartido del jsonb album_creativos.analisis -- con version desde
// ya porque esta misma columna es la base de la Fase 2 del álbum
// (etiquetas y colecciones), no solo de video/. Cambiar la forma del
// análisis más adelante significa sumar una v2 acá, nunca mutar v1 en
// el lugar (las filas viejas quedan con version:1 para siempre).
import { z } from "zod";

export const RecuadroProductoSchema = z.object({
  // Porcentaje (0-100) del ancho/alto de la imagen, no píxeles -- así
  // sirve sin importar la resolución real de la pieza.
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
});
export type RecuadroProducto = z.infer<typeof RecuadroProductoSchema>;

export const AnalisisPiezaSchema = z.object({
  version: z.literal(1),
  tiene_texto: z.boolean(),
  es_publicitaria: z.boolean(),
  fondo_limpio: z.boolean(),
  recuadro_producto: RecuadroProductoSchema.nullable(),
});
export type AnalisisPieza = z.infer<typeof AnalisisPiezaSchema>;

export const VERSION_ANALISIS_PIEZA = 1;
