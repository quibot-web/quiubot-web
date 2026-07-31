import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Precios calculados SIEMPRE del lado del servidor -- nunca se confía en
// un monto que venga del frontend, para que nadie pueda manipular el
// precio antes de mandarlo a Bold.
const PRECIOS: Record<string, number> = {
  crecimiento: 149900,
  escala: 249900,
};
const DESCUENTO_ANUAL = 0.15;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { planId, ciclo } = await req.json();

  if (!PRECIOS[planId]) {
    return NextResponse.json({ error: "Plan invalido" }, { status: 400 });
  }
  if (ciclo !== "mensual" && ciclo !== "anual") {
    return NextResponse.json({ error: "Ciclo invalido" }, { status: 400 });
  }

  const boldApiKey = process.env.BOLD_API_KEY;
  if (!boldApiKey) {
    console.error("Falta BOLD_API_KEY");
    return NextResponse.json({ error: "Pagos no configurados" }, { status: 500 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();

  // Monto: mensual es el precio de tabla; anual es 12 meses con 15% de
  // descuento, facturado una sola vez -- mismo calculo que ya usa el
  // frontend, replicado aqui porque el monto real SIEMPRE debe salir del
  // servidor, nunca del cliente.
  const precioBase = PRECIOS[planId];
  const monto = ciclo === "anual" ? Math.round(precioBase * 12 * (1 - DESCUENTO_ANUAL)) : precioBase;

  // Referencia unica que Bold nos devuelve intacta en el webhook -- es la
  // unica forma de saber, cuando llega el pago, a que usuario y plan
  // corresponde (antes no existia esto: el link era estatico e identico
  // para todos, por eso la activacion tenia que hacerse a mano).
  const reference = `QB-${emailBusqueda.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}`.slice(0, 60);

  const { error: errorInsert } = await supabaseAdmin.from("ordenes_pago").insert({
    email: emailBusqueda,
    plan_id: planId,
    ciclo,
    reference,
    monto,
    estado: "pendiente",
  });

  if (errorInsert) {
    console.error("Error creando orden de pago:", errorInsert);
    return NextResponse.json({ error: "No se pudo iniciar el pago" }, { status: 500 });
  }

  try {
    const boldRes = await fetch("https://integrations.api.bold.co/online/link/v1", {
      method: "POST",
      headers: {
        Authorization: `x-api-key ${boldApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount_type: "CLOSE",
        amount: { currency: "COP", total_amount: monto, tip_amount: 0 },
        reference,
        description: `Quiubot — Plan ${planId} (${ciclo})`,
        payer_email: emailBusqueda,
        callback_url: `${process.env.NEXTAUTH_URL}/billing?pago=procesando`,
      }),
    });

    const boldData = await boldRes.json();

    if (!boldRes.ok || !boldData.payload?.url) {
      console.error("Error creando link de pago en Bold:", boldData);
      return NextResponse.json({ error: "No se pudo generar el link de pago" }, { status: 502 });
    }

    return NextResponse.json({ url: boldData.payload.url });
  } catch (err) {
    console.error("Error conectando con Bold:", err);
    return NextResponse.json({ error: "No se pudo conectar con la pasarela de pagos" }, { status: 503 });
  }
}