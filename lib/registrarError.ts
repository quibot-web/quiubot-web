import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { enviarCorreoErrorSistema, obtenerEmailsAdmins } from "@/lib/email";

// Funcion central para registrar CUALQUIER error de Quiubot -- no solo
// los de publicar estrategia. Cualquier endpoint que pueda fallar de
// forma significativa para un usuario deberia llamar a esta funcion en
// su catch/manejo de error, pasando el "origen" (que parte de Quiubot
// fallo) para poder despues buscar/filtrar por eso en el panel de admin.
//
// Hace 2 cosas, ninguna de las cuales debe tumbar la respuesta original
// al usuario si falla (por eso todo esta envuelto en try/catch interno):
// 1. Guarda el error en la tabla errores_publicacion.
// 2. Le manda un correo a cada contacto de admin activo (tabla
//    admin_contactos), o al ADMIN_EMAIL de las variables de entorno como
//    respaldo si esa tabla esta vacia.
export async function registrarError(datos: {
  origen: string; // "publicar_estrategia" | "generar_estrategia" | "crear_creativos" | "conectar_meta" | "billing_bold" | etc.
  email: string | null;
  userId?: string | null;
  paso?: string | null;
  errorSubcode?: number | null;
  errorTitulo?: string | null;
  errorMensaje: string;
  detalleTecnico?: string | null;
  campanaNombre?: string | null;
  objetivoId?: string | null;
}) {
  try {
    await supabaseAdmin.from("errores_publicacion").insert({
      origen: datos.origen,
      user_id: datos.userId ?? null,
      email: datos.email ?? "desconocido",
      paso: datos.paso ?? null,
      error_subcode: datos.errorSubcode ?? null,
      error_titulo: datos.errorTitulo ?? null,
      error_mensaje: datos.errorMensaje,
      detalle_tecnico: datos.detalleTecnico ?? null,
      campana_nombre: datos.campanaNombre ?? null,
      objetivo_id: datos.objetivoId ?? null,
    });
  } catch (err) {
    console.error("Error guardando en errores_publicacion:", err);
  }

  try {
    await notificarAdmins(datos);
  } catch (err) {
    console.error("Error notificando a los admins:", err);
  }
}

async function notificarAdmins(datos: {
  origen: string;
  email: string | null;
  errorTitulo?: string | null;
  errorMensaje: string;
  campanaNombre?: string | null;
}) {
  const destinatarios = await obtenerEmailsAdmins();

  for (const destinatario of destinatarios) {
    await enviarCorreoErrorSistema({
      destinatario,
      origen: datos.origen,
      clienteEmail: datos.email,
      errorTitulo: datos.errorTitulo ?? null,
      errorMensaje: datos.errorMensaje,
      campanaNombre: datos.campanaNombre ?? null,
    });
  }
}