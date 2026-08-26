import { NextRequest, NextResponse } from "next/server";
import { enviarCorreoAlertaAdmin } from "@/lib/email";

// Endpoint interno, NO pensado para el frontend -- lo llama directo el
// workflow de n8n cuando Kling rechaza una solicitud de video por falta de
// saldo. Mismo patrón que /api/internal/openai-key-admin (secreto
// compartido en vez de sesión de usuario, porque quien llama es n8n), pero
// con su PROPIO secreto (INTERNAL_API_SECRET_ALERTAS) -- separado a
// propósito del INTERNAL_API_SECRET que protege una credencial real, para
// que filtrar el menos sensible (este, solo dispara un correo) no
// comprometa el más sensible.
export async function POST(req: NextRequest) {
  const secreto = req.headers.get("x-internal-secret");
  if (!secreto || secreto !== process.env.INTERNAL_API_SECRET_ALERTAS) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { job_id, email_usuario, detalle_error } = await req.json();

  if (!job_id || !email_usuario || !detalle_error) {
    return NextResponse.json(
      { error: "Faltan campos: job_id, email_usuario, detalle_error" },
      { status: 400 }
    );
  }

  try {
    await enviarCorreoAlertaAdmin(
      "🚨 Kling sin saldo -- videos de clientes estan fallando",
      `El servicio de generación de video (Kling) rechazó una solicitud por falta de saldo. Los videos de los clientes están fallando en este momento. Recarga saldo cuanto antes en el panel de Kling. Job afectado: ${job_id} -- usuario: ${email_usuario}. Detalle técnico: ${detalle_error}`
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al notificar a los admins (Kling sin saldo):", err);
    return NextResponse.json({ error: "No se pudo enviar la notificación" }, { status: 500 });
  }
}
