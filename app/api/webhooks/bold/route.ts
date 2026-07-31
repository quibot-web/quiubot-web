import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { enviarCorreoPagoExitoso, enviarCorreoPlanActivado } from "@/lib/email";

// Duracion de cada ciclo. El "mes" se cuenta como 30 dias por simplicidad
// (igual que ya hacia /api/activar con "dias ?? 30").
const DIAS_POR_CICLO: Record<string, number> = {
  mensual: 30,
  anual: 365,
};

function calcularFirma(cuerpoCrudo: string, secreto: string): string {
  const codificadoBase64 = Buffer.from(cuerpoCrudo, "utf-8").toString("base64");
  return createHmac("sha256", secreto).update(codificadoBase64).digest("hex");
}

function coinciden(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Bold firma las transacciones de PRODUCCION con la Llave secreta real,
// pero las transacciones de PRUEBAS (sandbox) las firma con una llave
// VACIA -- documentado explicitamente por Bold: "en modo pruebas la firma
// usa una clave vacia". Por eso se prueban las dos posibilidades en vez
// de asumir una sola, sin necesidad de detectar de antemano si el pago
// es de pruebas o de produccion.
function firmaValida(cuerpoCrudo: string, firmaRecibida: string, secretoProduccion: string): boolean {
  const firmaConSecretoReal = calcularFirma(cuerpoCrudo, secretoProduccion);
  if (coinciden(firmaConSecretoReal, firmaRecibida)) return true;

  const firmaConSecretoVacio = calcularFirma(cuerpoCrudo, "");
  return coinciden(firmaConSecretoVacio, firmaRecibida);
}

export async function POST(req: NextRequest) {
  // LOG TEMPORAL DE DIAGNOSTICO -- confirma si la peticion de Bold esta
  // llegando siquiera al servidor, antes de cualquier verificacion. Se
  // puede quitar una vez confirmemos que el webhook funciona de punta a
  // punta.
  console.log("🔔 Webhook de Bold recibido — headers:", Object.fromEntries(req.headers.entries()));

  // Bold exige responder 200 en menos de 2 segundos -- todo lo pesado
  // (verificar firma, buscar la orden, activar el plan, mandar 2 correos)
  // tiene que ser rapido. Si algo tarda demasiado, Bold reintenta solo, asi
  // que no pasa nada grave si esta vez no se alcanza a responder a tiempo.
  const cuerpoCrudo = await req.text();
  console.log("🔔 Cuerpo crudo recibido:", cuerpoCrudo);
  const firmaRecibida = req.headers.get("x-bold-signature") || "";
  const secreto = process.env.BOLD_WEBHOOK_SECRET || "";

  console.log("🔔 x-bold-signature recibida:", firmaRecibida || "(vacia)");
  const firmaOk = firmaValida(cuerpoCrudo, firmaRecibida, secreto);
  console.log("🔔 ¿Firma valida?:", firmaOk);

  if (!firmaOk) {
    return NextResponse.json({ error: "Firma invalida" }, { status: 400 });
  }

  const evento = JSON.parse(cuerpoCrudo);

  // Solo nos interesan las ventas aprobadas -- SALE_REJECTED, VOID_APPROVED,
  // etc. se ignoran para efectos de activar un plan.
  if (evento.type !== "SALE_APPROVED") {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const data = evento.data || {};
  const reference = data.metadata?.reference;
  const boldPaymentId = data.payment_id;

  if (!reference || !boldPaymentId) {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const { data: orden } = await supabaseAdmin
    .from("ordenes_pago")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (!orden) {
    console.error("Webhook de Bold con reference desconocida:", reference);
    return NextResponse.json({ ok: true, ignorado: true });
  }

  // Idempotencia: Bold puede reenviar la misma notificacion varias veces
  // (reintentos automaticos). Si esta orden ya quedo marcada como pagada,
  // no se repite la activacion ni se duplican los correos.
  if (orden.estado === "pagado") {
    return NextResponse.json({ ok: true, ya_procesado: true });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("nombre")
    .eq("email", orden.email)
    .maybeSingle();

  // Correo 1: confirmacion de que el pago llego, antes de tocar el plan.
  await enviarCorreoPagoExitoso({
    clienteEmail: orden.email,
    clienteNombre: usuario?.nombre || null,
    planId: orden.plan_id,
    ciclo: orden.ciclo,
    monto: orden.monto,
    boldPaymentId,
  }).catch((err) => console.error("Error enviando correo de pago exitoso:", err));

  const fechaPago = new Date();
  const fechaVencimiento = new Date();
  fechaVencimiento.setDate(fechaVencimiento.getDate() + (DIAS_POR_CICLO[orden.ciclo] ?? 30));

  const { error: errorActivar } = await supabaseAdmin
    .from("usuarios")
    .update({
      plan: orden.plan_id,
      activo: true,
      fecha_pago: fechaPago.toISOString(),
      fecha_vencimiento: fechaVencimiento.toISOString(),
    })
    .eq("email", orden.email);

  if (errorActivar) {
    console.error("Error activando el plan tras el pago:", errorActivar);
    // Igual devolvemos 200 -- el pago SI se recibio y quedo registrado en
    // ordenes_pago, asi que no tiene sentido que Bold siga reintentando
    // el webhook por un error que esta de nuestro lado. Queda para
    // resolver manualmente con el registro de la orden.
    return NextResponse.json({ ok: true, error_interno: true });
  }

  await supabaseAdmin
    .from("ordenes_pago")
    .update({ estado: "pagado", bold_payment_id: boldPaymentId, actualizado_en: new Date().toISOString() })
    .eq("id", orden.id);

  // Correo 2: confirmacion separada de que el plan ya quedo activado.
  await enviarCorreoPlanActivado({
    clienteEmail: orden.email,
    clienteNombre: usuario?.nombre || null,
    planId: orden.plan_id,
    fechaPago: fechaPago.toISOString(),
    fechaVencimiento: fechaVencimiento.toISOString(),
  }).catch((err) => console.error("Error enviando correo de plan activado:", err));

  return NextResponse.json({ ok: true });
}