// Agregador de "contexto de cuenta" (Paso 3/6 de la burbuja del
// Director) -- una sola función reusada por GET /api/director/contexto
// (tarjetas de la UI) y por el cerebro general del Director (Paso 4,
// que la interpola en su prompt). Puro backend, sin IA.
import { supabaseAdmin } from "@/lib/supabase";
import { obtenerSaludInstagram } from "@/app/lib/metaInstagramSalud";
import { obtenerPropuestasPendientes } from "@/app/lib/propuestas";
import { calcularAvanceMeta } from "@/app/lib/metas";

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
  // id: para que el Director (confirmar_cambio_meta) pueda referirse a
  // UNA meta exacta en su respuesta estructurada, nunca adivinando
  // "la" meta de un tipo. estado/conversiones/diasRestantes: el mismo
  // calcularAvanceMeta() que usan /metas y el chat -- nunca un número
  // recalculado aparte para el Director.
  metasActivas: { id: string; tipo: string; cantidadObjetivo: number; fechaFin: string; estado: "activa" | "pausada"; conversiones: number; diasRestantes: number }[];
  campanasActivas: number;
  propuestasPendientes: number;
};

export async function obtenerContextoCuenta(usuario: UsuarioContextoCuenta): Promise<ContextoCuentaDirector> {
  const tokenVencido = !!(usuario.meta_token_expira && new Date(usuario.meta_token_expira) <= new Date());
  const metaConectado = !!usuario.meta_ad_account_id && !tokenVencido;

  const [metasRes, campanasRes, saludInstagram, propuestasPendientes] = await Promise.all([
    supabaseAdmin
      .from("metas")
      .select("id, tipo, cantidad_objetivo, fecha_inicio, fecha_fin, valor_inicial, pausado_autopiloto")
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

  const metasActivas = await Promise.all(
    (metasRes.data ?? []).map(async (m) => {
      let conversiones = 0;
      let diasRestantes = 0;
      try {
        const avance = await calcularAvanceMeta({ id: m.id, tipo: m.tipo, user_id: usuario.id, fecha_inicio: m.fecha_inicio, fecha_fin: m.fecha_fin, valor_inicial: m.valor_inicial });
        conversiones = avance.conversiones;
        diasRestantes = avance.diasRestantes;
      } catch (err) {
        console.error(`Error calculando el avance de la meta ${m.id} para el contexto del Director:`, err);
      }
      return {
        id: m.id as string,
        tipo: m.tipo as string,
        cantidadObjetivo: m.cantidad_objetivo as number,
        fechaFin: m.fecha_fin as string,
        estado: (m.pausado_autopiloto ? "pausada" : "activa") as "activa" | "pausada",
        conversiones,
        diasRestantes,
      };
    })
  );

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
    metasActivas,
    campanasActivas: campanasRes.count ?? 0,
    propuestasPendientes: propuestasPendientes.length,
  };
}
