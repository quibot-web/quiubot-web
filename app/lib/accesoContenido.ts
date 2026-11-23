import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Acceso a /contenido para clientes (lanzamiento 30 nov 2026). Antes todo
// /contenido era solo admin. Ahora:
//   - Cualquier usuario con suscripción activa (prueba gratis vigente, o
//     pago con fecha_vencimiento futura) usa /contenido con SUS piezas.
//   - Toda consulta de piezas filtra por user_id del que pide: nadie ve,
//     edita, renderiza ni publica piezas de otro (las rutas devuelven 404,
//     igual que si la pieza no existiera, para no revelar ids ajenos).
//   - Admin siempre tiene acceso, y además puede VER (solo lectura) las
//     piezas de cualquier cliente para dar soporte. Para cambiar una pieza,
//     admin también tiene que ser su dueño: así nunca se genera una voz o
//     un guion con la llave de OpenAI o las credenciales equivocadas.

export type UsuarioAcceso = {
  id: string;
  rol: string | null;
  activo: boolean | null;
  en_trial: boolean | null;
  trial_termina_en: string | null;
  fecha_vencimiento: string | null;
};

const COLUMNAS_ACCESO = "id, rol, activo, en_trial, trial_termina_en, fecha_vencimiento";

export const MENSAJE_SUSCRIPCION_INACTIVA = "Tu plan no está activo. Renueva tu suscripción para seguir creando y publicando contenido.";

export function esAdmin(usuario: { rol?: string | null }): boolean {
  return usuario.rol === "admin";
}

// Mismo criterio de vigencia que tieneAutopiloto (planesConfig.ts), sin
// exigir un plan en particular: /contenido es para todos los planes.
export function suscripcionActiva(usuario: Pick<UsuarioAcceso, "rol" | "activo" | "en_trial" | "trial_termina_en" | "fecha_vencimiento">, ahora = new Date()): boolean {
  if (esAdmin(usuario)) return true;
  if (usuario.en_trial && usuario.trial_termina_en && new Date(usuario.trial_termina_en) >= ahora) return true;
  return usuario.activo === true && !!usuario.fecha_vencimiento && new Date(usuario.fecha_vencimiento) >= ahora;
}

// Sesión + usuario + suscripción activa. columnasExtra: lo que la ruta
// necesita además (ej. "openai_key, cloudinary_name").
export async function accesoContenido<Extra extends object = Record<never, never>>(
  columnasExtra = ""
): Promise<{ usuario: UsuarioAcceso & Extra; email: string; error?: undefined } | { error: NextResponse; usuario?: undefined; email?: undefined }> {
  const session = await auth();
  if (!session?.user?.email) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const email = session.user.email.trim().toLowerCase();
  const columnas = columnasExtra ? `${COLUMNAS_ACCESO}, ${columnasExtra}` : COLUMNAS_ACCESO;
  const { data: usuario } = await supabaseAdmin.from("usuarios").select(columnas).eq("email", email).single();
  if (!usuario) return { error: NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 }) };
  const u = usuario as unknown as UsuarioAcceso & Extra;
  if (!suscripcionActiva(u)) return { error: NextResponse.json({ error: MENSAJE_SUSCRIPCION_INACTIVA, codigo: "suscripcion_inactiva" }, { status: 403 }) };
  return { usuario: u, email };
}

// De quién se leen las piezas: el propio usuario, o (solo admin, solo
// lectura) el cliente indicado en ?usuario=<id>.
export function duenoParaLeer(usuario: UsuarioAcceso, usuarioPedido: string | null | undefined): string {
  return esAdmin(usuario) && usuarioPedido ? usuarioPedido : usuario.id;
}

// El producto y las piezas del álbum que se eligen para una pieza tienen
// que ser del mismo usuario (antes no se revisaba: con el id de otro
// cliente se podía armar un reel con su producto o sus fotos).
export async function recursosSonDelUsuario(userId: string, recursos: { producto_id?: string | null; media_ids?: string[] | null }): Promise<boolean> {
  if (recursos.producto_id) {
    const { data } = await supabaseAdmin.from("productos").select("id").eq("id", recursos.producto_id).eq("user_id", userId).maybeSingle();
    if (!data) return false;
  }
  const ids = [...new Set(recursos.media_ids ?? [])];
  if (ids.length > 0) {
    const { data } = await supabaseAdmin.from("album_creativos").select("id").eq("user_id", userId).in("id", ids);
    if ((data ?? []).length !== ids.length) return false;
  }
  return true;
}
