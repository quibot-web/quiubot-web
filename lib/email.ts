import "server-only";

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