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

// Lo que devuelve GET /api/productos -- album_ids resuelto a {id,
// url_imagen} reales (album_creativos), ignorando cualquier id que ya
// no exista en el álbum sin romper nada. Se guarda el id junto a la
// url (no solo la url) para que el formulario pueda editar la
// selección sin adivinar a qué id pertenece cada foto. "fotos" nunca
// se guarda así en la base, se resuelve en cada lectura.
export type ProductoConFotos = Producto & { fotos: { id: string; url_imagen: string }[] };

const MAX_FOTOS_PRODUCTO = 3;

const CamposComunes = {
  tipo: z.enum(TIPOS_PRODUCTO),
  nombre: z.string().trim().min(1, "Falta el nombre.").max(200),
  precio_cop: z.number().int().positive().nullable().optional(),
  destacar: z.string().trim().max(500).nullable().optional(),
  // ids del álbum del usuario, hasta 3 -- si alguno deja de existir
  // ahí, se ignora al mostrar la tarjeta (nunca se valida acá que
  // existan de verdad, eso lo decide quien los lea).
  album_ids: z.array(z.string()).max(MAX_FOTOS_PRODUCTO).optional(),
  url: z.string().trim().max(500).nullable().optional(),
};

export const CrearProductoSchema = z.object(CamposComunes);

export const ActualizarProductoSchema = z.object({
  ...CamposComunes,
  tipo: CamposComunes.tipo.optional(),
  nombre: CamposComunes.nombre.optional(),
  activo: z.boolean().optional(),
});

// Chips sugeridos para "qué destacar" -- completan el texto en vez de
// reemplazarlo, para que el usuario pueda combinar varios.
export const CHIPS_DESTACAR = [
  { emoji: "🚚", texto: "Envío gratis" },
  { emoji: "🛡️", texto: "Garantía" },
  { emoji: "💵", texto: "Contraentrega" },
  { emoji: "💳", texto: "Cuotas" },
] as const;

function normalizarNombre(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Distancia de edición simple -- sin librería externa, solo para
// nombres de productos (strings cortas, nunca párrafos).
function distanciaLevenshtein(a: string, b: string): number {
  const filas = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) filas[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      filas[i][j] = a[i - 1] === b[j - 1] ? filas[i - 1][j - 1] : 1 + Math.min(filas[i - 1][j], filas[i][j - 1], filas[i - 1][j - 1]);
    }
  }
  return filas[a.length][b.length];
}

// ¿"nombreNuevo" se parece lo suficiente a alguno de los guardados
// como para preguntar "¿es el mismo que '...'?" en vez de dejar crear
// un duplicado? Heurística simple a propósito: mismo nombre
// normalizado, uno contiene al otro, o distancia de edición chica
// (typos / variaciones cortas) -- nunca compara nombres muy cortos
// (3 letras o menos), donde cualquier heurística da falsos positivos.
export function productoParecido(nombreNuevo: string, guardados: { nombre: string }[]): string | null {
  const normalizado = normalizarNombre(nombreNuevo);
  if (normalizado.length < 4) return null;

  for (const g of guardados) {
    const otro = normalizarNombre(g.nombre);
    if (otro.length < 4) continue;
    if (normalizado === otro) continue; // ya es exactamente igual -- eso lo bloquea el índice único, no esta pregunta.
    if (normalizado.includes(otro) || otro.includes(normalizado)) return g.nombre;
    if (distanciaLevenshtein(normalizado, otro) <= 2) return g.nombre;
  }
  return null;
}
