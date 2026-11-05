// Agregador de "contexto de cuenta" (Paso 3/6 de la burbuja del
// Director) -- una sola función reusada por GET /api/director/contexto
// (tarjetas de la UI) y por el cerebro general del Director (Paso 4,
// que la interpola en su prompt). Puro backend, sin IA.
import { supabaseAdmin } from "@/lib/supabase";
import { obtenerSaludInstagram } from "@/app/lib/metaInstagramSalud";
import { obtenerPropuestasPendientes } from "@/app/lib/propuestas";

export type UsuarioContextoCuenta = {
  id: string;
  meta_ad_account_id: string | null;
  meta_ad_account_nombre: string | null;
  meta_user_name: string | null;
  meta_token_expira: string | null;
  meta_page_id: string | null;
  meta_page_name: string | null;
  meta_pixel_id: string | null;
  meta_pixel_nombre: string | null;
  meta_access_token: string | null;
  openai_key: string | null;
  cloudinary_name: string | null;
  cloudinary_key: string | null;
  cloudinary_secret: string | null;
};

export type ContextoCuentaDirector = {
  conexiones: {
    meta: { conectado: boolean; tokenVencido: boolean; cuentaPublicitariaNombre: string | null; paginaNombre: string | null };
    pixel: { conectado: boolean; nombre: string | null };
    instagram: { conectado: boolean; username: string | null; seguidores: number | null };
    openai: { conectado: boolean };
    cloudinary: { conectado: boolean };
  };
  metasActivas: { tipo: string; cantidad_objetivo: number; fecha_fin: string }[];
  campanasActivas: number;
  propuestasPendientes: number;
};

export async function obtenerContextoCuenta(usuario: UsuarioContextoCuenta): Promise<ContextoCuentaDirector> {
  const tokenVencido = !!(usuario.meta_token_expira && new Date(usuario.meta_token_expira) <= new Date());
  const metaConectado = !!usuario.meta_ad_account_id && !tokenVencido;

  const [metasRes, campanasRes, saludInstagram, propuestasPendientes] = await Promise.all([
    supabaseAdmin
      .from("metas")
      .select("tipo, cantidad_objetivo, fecha_fin")
      .eq("user_id", usuario.id)
      .eq("estado", "activa"),
    supabaseAdmin
      .from("campanas_publicadas")
      .select("id", { count: "exact", head: true })
      .eq("user_id", usuario.id)
      .eq("estado", "activa"),
    obtenerSaludInstagram({ meta_page_id: usuario.meta_page_id, meta_access_token: usuario.meta_access_token }),
    obtenerPropuestasPendientes(usuario.id),
  ]);

  return {
    conexiones: {
      meta: {
        conectado: metaConectado,
        tokenVencido,
        cuentaPublicitariaNombre: usuario.meta_ad_account_nombre,
        paginaNombre: usuario.meta_page_name,
      },
      pixel: {
        conectado: metaConectado && !!usuario.meta_pixel_id,
        nombre: usuario.meta_pixel_nombre,
      },
      instagram: {
        conectado: saludInstagram.conectado,
        username: saludInstagram.username,
        seguidores: saludInstagram.followers_count,
      },
      openai: { conectado: !!usuario.openai_key },
      cloudinary: {
        conectado: !!(usuario.cloudinary_name && usuario.cloudinary_key && usuario.cloudinary_secret),
      },
    },
    metasActivas: metasRes.data ?? [],
    campanasActivas: campanasRes.count ?? 0,
    propuestasPendientes: propuestasPendientes.length,
  };
}
