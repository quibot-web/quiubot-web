import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { esAdmin, motivoSinContenido, puedeCrearContenido, type UsuarioAcceso } from "./planContenido";

export { esAdmin, motivoSinContenido, puedeCrearContenido, suscripcionActiva, PLANES_CON_CONTENIDO, MENSAJE_PLAN_SIN_CONTENIDO, MENSAJE_SUSCRIPCION_INACTIVA, type UsuarioAcceso } from "./planContenido";

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



const COLUMNAS_ACCESO = "id, rol, plan, activo, en_trial, trial_termina_en, fecha_vencimiento";


// Sesión + usuario + (salvo soloLectura) un plan con Contenido vigente.
// soloLectura: ver la página, el calendario y sus propias piezas (Arranque
// también). columnasExtra: lo que la ruta necesita además.
export async function accesoContenido<Extra extends object = Record<never, never>>(
  columnasExtra = "",
  opciones: { soloLectura?: boolean } = {}
): Promise<{ usuario: UsuarioAcceso & Extra; email: string; error?: undefined } | { error: NextResponse; usuario?: undefined; email?: undefined }> {
  const session = await auth();
  if (!session?.user?.email) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const email = session.user.email.trim().toLowerCase();
  const columnas = columnasExtra ? `${COLUMNAS_ACCESO}, ${columnasExtra}` : COLUMNAS_ACCESO;
  const { data: usuario } = await supabaseAdmin.from("usuarios").select(columnas).eq("email", email).single();
  if (!usuario) return { error: NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 }) };
  const u = usuario as unknown as UsuarioAcceso & Extra;
  if (!opciones.soloLectura && !puedeCrearContenido(u)) {
    const m = motivoSinContenido(u);
    return { error: NextResponse.json({ error: m.mensaje, codigo: m.codigo }, { status: 403 }) };
  }
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
