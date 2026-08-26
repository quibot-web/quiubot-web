import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const REMITENTE = "Quiubot <noreply@quiubot.site>";

async function enviarCorreo(destinatario: string, asunto: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error("Falta la variable RESEND_API_KEY — no se pudo enviar el correo a", destinatario);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: REMITENTE, to: destinatario, subject: asunto, html }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.error("Error enviando correo con Resend:", data);
  }
}

export async function enviarCorreoVerificacion(email: string, nombre: string, link: string) {
  await enviarCorreo(
    email,
    "Confirma tu correo — Quiubot",
    `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#17152B;">Hola${nombre ? " " + nombre : ""} 👋</h2>
      <p style="color:#333; font-size:14px; line-height:1.6;">
        Confirma tu correo para activar tu cuenta de Quiubot y empezar tu prueba gratuita de 7 días.
      </p>
      <a href="${link}" style="display:inline-block; background:#534AB7; color:#fff; padding:12px 24px; border-radius:10px; text-decoration:none; font-weight:600; margin-top:12px;">
        Confirmar mi correo
      </a>
      <p style="color:#999; font-size:12px; margin-top:24px;">
        Este enlace vence en 24 horas. Si no creaste esta cuenta, ignora este correo.
      </p>
    </div>`
  );
}

export async function enviarCorreoResetPassword(email: string, link: string) {
  await enviarCorreo(
    email,
    "Restablece tu contraseña — Quiubot",
    `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#17152B;">Restablece tu contraseña</h2>
      <p style="color:#333; font-size:14px; line-height:1.6;">
        Recibimos una solicitud para cambiar tu contraseña de Quiubot. Si fuiste tú, haz clic abajo:
      </p>
      <a href="${link}" style="display:inline-block; background:#534AB7; color:#fff; padding:12px 24px; border-radius:10px; text-decoration:none; font-weight:600; margin-top:12px;">
        Cambiar mi contraseña
      </a>
      <p style="color:#999; font-size:12px; margin-top:24px;">
        Este enlace vence en 1 hora. Si no fuiste tú, ignora este correo — tu contraseña actual sigue funcionando.
      </p>
    </div>`
  );
}

// Los dos correos siguientes se disparan desde /api/webhooks/bold, en dos
// momentos distintos del mismo evento de pago: apenas Bold confirma la
// venta (correo 1), y despues de que el plan del usuario ya quedo escrito
// en la base de datos (correo 2). Van al correo del admin (ADMIN_EMAIL),
// no al del cliente -- son el registro formal para Juan, no una
// confirmacion de cara al usuario final.

export async function enviarCorreoPagoExitoso(datos: {
  clienteEmail: string;
  clienteNombre: string | null;
  planId: string;
  ciclo: string;
  monto: number;
  boldPaymentId: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("Falta ADMIN_EMAIL — no se pudo enviar el correo de pago exitoso.");
    return;
  }

  await enviarCorreo(
    adminEmail,
    `✅ Pago recibido — ${datos.clienteEmail} (${datos.planId})`,
    `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#17152B;">💳 Pago confirmado por Bold</h2>
      <div style="background:#f0fdf4; border-radius:10px; padding:16px; font-size:14px; color:#333; line-height:1.8;">
        <div><strong>Cliente:</strong> ${datos.clienteNombre || "—"} (${datos.clienteEmail})</div>
        <div><strong>Plan:</strong> ${datos.planId} (${datos.ciclo})</div>
        <div><strong>Monto:</strong> $${datos.monto.toLocaleString("es-CO")} COP</div>
        <div><strong>ID de transacción Bold:</strong> ${datos.boldPaymentId}</div>
      </div>
      <p style="color:#999; font-size:12px; margin-top:16px;">
        Activando el plan automáticamente ahora — en unos segundos llega el correo de confirmación.
      </p>
    </div>`
  );
}

export async function enviarCorreoPlanActivado(datos: {
  clienteEmail: string;
  clienteNombre: string | null;
  planId: string;
  fechaPago: string;
  fechaVencimiento: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("Falta ADMIN_EMAIL — no se pudo enviar el correo de plan activado.");
    return;
  }

  const formatearFecha = (iso: string) =>
    new Date(iso).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });

  await enviarCorreo(
    adminEmail,
    `🚀 Plan activado — ${datos.clienteEmail} → ${datos.planId}`,
    `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#17152B;">✅ Activación completada</h2>
      <div style="background:#f3f2fe; border-radius:10px; padding:16px; font-size:14px; color:#333; line-height:1.8;">
        <div><strong>Cliente:</strong> ${datos.clienteNombre || "—"} (${datos.clienteEmail})</div>
        <div><strong>Plan activo:</strong> ${datos.planId}</div>
        <div><strong>Fecha de pago:</strong> ${formatearFecha(datos.fechaPago)}</div>
        <div><strong>Vence:</strong> ${formatearFecha(datos.fechaVencimiento)}</div>
      </div>
      <p style="color:#999; font-size:12px; margin-top:16px;">
        Todo esto se hizo automáticamente, sin intervención manual.
      </p>
    </div>`
  );
}

// ============================================================
// Correos de cara al CLIENTE (no al admin) — bienvenida y
// confirmacion de plan.
// ============================================================

// Se dispara justo cuando el cliente termina de registrarse (verifica su
// correo). Explica que ya esta en su prueba gratuita, da los primeros
// pasos, y deja clarisimos los enlaces legales desde el dia uno.
export async function enviarCorreoBienvenida(datos: {
  email: string;
  nombre: string | null;
  diasTrial: number;
}) {
  await enviarCorreo(
    datos.email,
    "¡Bienvenido a Quiubot! 🎉 Ya puedes empezar",
    `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#17152B;">¡Hola${datos.nombre ? " " + datos.nombre : ""}! 👋</h2>
      <p style="color:#333; font-size:14px; line-height:1.6;">
        Ya tienes acceso a Quiubot, tu copiloto de campañas publicitarias con IA.
        Tu prueba gratuita de <strong>${datos.diasTrial} días</strong> ya empezó — sin necesidad de tarjeta.
      </p>

      <div style="background:#f3f2fe; border-radius:12px; padding:18px; margin:20px 0;">
        <p style="color:#3C3489; font-size:13px; font-weight:700; margin:0 0 10px;">Para empezar:</p>
        <ol style="color:#333; font-size:13.5px; line-height:1.9; margin:0; padding-left:18px;">
          <li>Sintetiza el <strong>ADN de tu marca</strong> subiendo 4-8 creativos que ya hayas usado</li>
          <li>Conecta tu cuenta de <strong>Meta Ads</strong> en Integraciones</li>
          <li>Genera tu primera estrategia en el <strong>Motor de Estrategia</strong></li>
        </ol>
      </div>

      <a href="https://quiubot.site" style="display:inline-block; background:#534AB7; color:#fff; padding:12px 24px; border-radius:10px; text-decoration:none; font-weight:600;">
        Ir a mi panel
      </a>

      <hr style="border:none; border-top:1px solid #eee; margin:28px 0 16px;" />

      <p style="color:#999; font-size:11.5px; line-height:1.7;">
        Al usar Quiubot aceptaste nuestros
        <a href="https://quiubot.site/terminos" style="color:#7F77DD;">Términos y Condiciones</a>
        y nuestra
        <a href="https://quiubot.site/privacidad" style="color:#7F77DD;">Política de Privacidad</a>,
        donde explicamos cómo tratamos tus datos y los de tu cuenta publicitaria conectada.
        ¿Dudas? Responde este correo, con gusto te ayudamos.
      </p>
    </div>`
  );
}

// Se dispara al cliente (no al admin) cada vez que su plan cambia, justo
// despues de que el pago se confirma. A diferencia de enviarCorreoPlanActivado
// (que es el registro interno para Juan), este es el mensaje de cara al
// cliente: que sepa exactamente que pago, que incluye, y cuando vence --
// aclarando explicitamente que no hay cobro automatico recurrente, para
// que nadie se sorprenda pensando que le van a volver a cobrar solo.
export async function enviarCorreoConfirmacionPlanCliente(datos: {
  email: string;
  nombre: string | null;
  planNombre: string;
  monto: number;
  ciclo: string;
  fechaVencimiento: string;
}) {
  const formatearFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

  await enviarCorreo(
    datos.email,
    `Tu plan ${datos.planNombre} ya está activo ✅`,
    `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#17152B;">¡Listo${datos.nombre ? ", " + datos.nombre : ""}! Tu plan ya está activo</h2>
      <p style="color:#333; font-size:14px; line-height:1.6;">
        Confirmamos tu pago y tu cuenta de Quiubot ya está en el plan <strong>${datos.planNombre}</strong>.
      </p>

      <div style="background:#f0fdf4; border-radius:12px; padding:18px; margin:20px 0; font-size:13.5px; color:#333; line-height:1.9;">
        <div><strong>Plan:</strong> ${datos.planNombre}</div>
        <div><strong>Monto pagado:</strong> $${datos.monto.toLocaleString("es-CO")} COP (${datos.ciclo})</div>
        <div><strong>Tu plan es válido hasta:</strong> ${formatearFecha(datos.fechaVencimiento)}</div>
      </div>

      <div style="background:#fef3c7; border-radius:10px; padding:14px 16px; margin:0 0 20px;">
        <p style="color:#92400e; font-size:12.5px; line-height:1.6; margin:0;">
          ⚠️ <strong>Importante:</strong> este pago NO se repite automáticamente. Antes de que venza tu plan,
          te avisaremos para que renueves manualmente si quieres seguir. No te vamos a cobrar nada sin que tú lo confirmes.
        </p>
      </div>

      <a href="https://quiubot.site/billing" style="display:inline-block; background:#534AB7; color:#fff; padding:12px 24px; border-radius:10px; text-decoration:none; font-weight:600;">
        Ver detalles de mi plan
      </a>

      <hr style="border:none; border-top:1px solid #eee; margin:28px 0 16px;" />

      <p style="color:#999; font-size:11.5px; line-height:1.7;">
        Puedes revisar los detalles de facturación en cualquier momento en
        <a href="https://quiubot.site/billing" style="color:#7F77DD;">Mi plan</a>.
        Consulta también nuestros
        <a href="https://quiubot.site/terminos" style="color:#7F77DD;">Términos y Condiciones</a>.
        ¿Alguna duda con el cobro? Responde este correo.
      </p>
    </div>`
  );
}

// Se dispara desde /api/cron/recordatorio-vencimiento, llamado una vez al
// dia por un Schedule Trigger en n8n. Avisa al cliente ANTES de que su
// plan venza, para que pueda renovar manualmente si quiere -- esto es lo
// que reemplaza al cobro automatico (que Bold todavia no soporta de forma
// nativa): en vez de cobrarle solo, le avisamos con tiempo para que decida.
export async function enviarCorreoRecordatorioVencimiento(datos: {
  email: string;
  nombre: string | null;
  planNombre: string;
  fechaVencimiento: string;
  diasRestantes: number;
}) {
  const formatearFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

  await enviarCorreo(
    datos.email,
    `Tu plan ${datos.planNombre} vence en ${datos.diasRestantes} día${datos.diasRestantes !== 1 ? "s" : ""} ⏰`,
    `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#17152B;">Hola${datos.nombre ? " " + datos.nombre : ""} 👋</h2>
      <p style="color:#333; font-size:14px; line-height:1.6;">
        Tu plan <strong>${datos.planNombre}</strong> de Quiubot vence el
        <strong>${formatearFecha(datos.fechaVencimiento)}</strong>
        (en ${datos.diasRestantes} día${datos.diasRestantes !== 1 ? "s" : ""}).
      </p>
      <p style="color:#333; font-size:14px; line-height:1.6;">
        Como te contamos cuando activaste tu plan, esto no se renueva solo — si quieres seguir
        usando Quiubot sin interrupciones, renueva antes de esa fecha.
      </p>

      <a href="https://quiubot.site/billing" style="display:inline-block; background:#534AB7; color:#fff; padding:12px 24px; border-radius:10px; text-decoration:none; font-weight:600; margin-top:8px;">
        Renovar mi plan
      </a>

      <p style="color:#999; font-size:12px; margin-top:24px;">
        Si no renuevas, tu cuenta vuelve automáticamente al plan gratuito (Arranque) el día del
        vencimiento, sin ningún cobro adicional.
      </p>
    </div>`
  );
}

// Se dispara desde lib/registrarError.ts cada vez que CUALQUIER endpoint
// de Quiubot registra un error significativo -- no solo publicar
// estrategia. Va a cada contacto activo en admin_contactos (o a
// ADMIN_EMAIL como respaldo).
export async function enviarCorreoErrorSistema(datos: {
  destinatario: string;
  origen: string;
  clienteEmail: string | null;
  errorTitulo: string | null;
  errorMensaje: string;
  campanaNombre: string | null;
}) {
  const NOMBRES_ORIGEN: Record<string, string> = {
    publicar_estrategia: "Publicar estrategia en Meta",
    generar_estrategia: "Generar estrategia",
    crear_creativos: "Crear creativos",
    conectar_meta: "Conectar Meta",
    billing_bold: "Pago con Bold",
  };
  const origenLegible = NOMBRES_ORIGEN[datos.origen] || datos.origen;

  await enviarCorreo(
    datos.destinatario,
    `⚠️ Error en Quiubot — ${origenLegible}${datos.clienteEmail ? " · " + datos.clienteEmail : ""}`,
    `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#17152B;">⚠️ Un usuario tuvo un error</h2>
      <div style="background:#fef2f2; border-radius:10px; padding:16px; font-size:14px; color:#333; line-height:1.8;">
        <div><strong>Dónde:</strong> ${origenLegible}</div>
        ${datos.clienteEmail ? `<div><strong>Usuario:</strong> ${datos.clienteEmail}</div>` : ""}
        ${datos.campanaNombre ? `<div><strong>Campaña:</strong> ${datos.campanaNombre}</div>` : ""}
        ${datos.errorTitulo ? `<div><strong>Tipo:</strong> ${datos.errorTitulo}</div>` : ""}
        <div style="margin-top:8px;"><strong>Mensaje:</strong> ${datos.errorMensaje}</div>
      </div>
      <a href="https://quiubot.site/admin/errores" style="display:inline-block; background:#534AB7; color:#fff; padding:12px 24px; border-radius:10px; text-decoration:none; font-weight:600; margin-top:16px;">
        Ver en el panel de admin
      </a>
    </div>`
  );
}

// Resuelve a quién avisar: cada contacto activo en admin_contactos, o
// ADMIN_EMAIL como respaldo si esa tabla todavía está vacía. Extraída de
// lib/registrarError.ts (que la sigue usando) para que cualquier otro aviso
// a admins -- no solo "un usuario tuvo un error" -- tenga una sola fuente
// de verdad de a quién llegarle.
export async function obtenerEmailsAdmins(): Promise<string[]> {
  const { data: contactos } = await supabaseAdmin
    .from("admin_contactos")
    .select("email")
    .eq("activo", true);

  const destinatarios = (contactos || []).map((c) => c.email);

  if (destinatarios.length === 0 && process.env.ADMIN_EMAIL) {
    destinatarios.push(process.env.ADMIN_EMAIL);
  }

  return destinatarios;
}

// Aviso operativo a TODOS los admins activos con asunto/cuerpo libres -- a
// diferencia de enviarCorreoErrorSistema (plantilla fija para "un usuario
// tuvo un error"), esta es para alertas puntuales que necesitan su propio
// texto (ej. un proveedor externo sin saldo). Usada hoy desde
// /api/internal/notificar-error-kling.
export async function enviarCorreoAlertaAdmin(asunto: string, mensajeTexto: string) {
  const destinatarios = await obtenerEmailsAdmins();

  for (const destinatario of destinatarios) {
    await enviarCorreo(
      destinatario,
      asunto,
      `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color:#17152B;">${asunto}</h2>
        <p style="color:#333; font-size:14px; line-height:1.6; white-space: pre-line;">${mensajeTexto}</p>
      </div>`
    );
  }
}