// Tipos y validación del catálogo de productos y servicios (punto 4
// del plan) -- sin ningún import de Supabase a propósito, igual que
// app/lib/director/tasaCierre.ts, para que los componentes cliente que
// vengan después (el selector en /estrategia, metas, /video) puedan
// importar estos tipos/schemas sin arrastrar código server-only a su
// bundle.
import { z } from "zod";

export const TIPOS_PRODUCTO = ["producto", "servicio"] as const;
export type TipoProducto = (typeof TIPOS_PRODUCTO)[number];

export type Producto = {
  id: string;
  user_id: string;
  tipo: TipoProducto;
  nombre: string;
  precio_cop: number | null;
  destacar: string | null;
  album_ids: string[];
  url: string | null;
  activo: boolean;
  ultimo_uso_en: string | null;
  creado_en: string;
  actualizado_en: string;
};

const CamposComunes = {
  tipo: z.enum(TIPOS_PRODUCTO),
  nombre: z.string().trim().min(1, "Falta el nombre.").max(200),
  precio_cop: z.number().int().positive().nullable().optional(),
  destacar: z.string().trim().max(500).nullable().optional(),
  // ids del álbum del usuario -- si alguno deja de existir ahí, se
  // ignora al mostrar la tarjeta (nunca se valida acá que existan de
  // verdad, eso lo decide quien los lea).
  album_ids: z.array(z.string()).max(20).optional(),
  url: z.string().trim().max(500).nullable().optional(),
};

export const CrearProductoSchema = z.object(CamposComunes);

export const ActualizarProductoSchema = z.object({
  ...CamposComunes,
  tipo: CamposComunes.tipo.optional(),
  nombre: CamposComunes.nombre.optional(),
  activo: z.boolean().optional(),
});
