import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// Guard de 2 niveles para /admin/musica y sus API routes: rol admin (ve y
// gestiona todo, incluida la lista de colaboradores) o un email activo en
// colaboradores_musica (solo puede subir/ver/desactivar SUS propias
// pistas, identificadas por cloudinary_name -- no hay columna user_id/email
// propia en pistas_musicales, así que ese es el único campo disponible
// para distinguir de quién es cada pista).
//
// Gestionar la lista de colaboradores NO pasa por acá -- esas rutas
// chequean rol === "admin" directo, mismo guard simple que el resto del
// proyecto, para no mezclar ambos casos en una sola función.
export type AccesoMusica = {
  permitido: boolean;
  esAdmin: boolean;
  usuarioId: string | null;
  cloudinaryName: string | null;
};

export async function verificarAccesoMusica(email: string): Promise<AccesoMusica> {
  const emailBusqueda = email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, cloudinary_name")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return { permitido: false, esAdmin: false, usuarioId: null, cloudinaryName: null };
  }

  if (usuario.rol === "admin") {
    return { permitido: true, esAdmin: true, usuarioId: usuario.id, cloudinaryName: usuario.cloudinary_name };
  }

  const { data: colaborador } = await supabaseAdmin
    .from("colaboradores_musica")
    .select("id")
    .eq("email", emailBusqueda)
    .eq("activo", true)
    .maybeSingle();

  return {
    permitido: !!colaborador,
    esAdmin: false,
    usuarioId: usuario.id,
    cloudinaryName: usuario.cloudinary_name,
  };
}
