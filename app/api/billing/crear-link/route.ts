import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AUTOPILOTO_PUBLICO, nombreVisiblePlan, precioMensual, precioAnual, CUPOS_FUNDADOR } from "@/app/lib/planesConfig";

const PLANES_COMPRABLES = ["crecimiento", "escala"] as const;
type PlanComprable = (typeof PLANES_COMPRABLES)[number];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { planId, ciclo } = await req.json();

  if (!PLANES_COMPRABLES.includes(planId)) {
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

  // Precio de fundador: vigente si el usuario ya tiene fundador_hasta en
  // el futuro (está renovando dentro de sus 12 meses), o si este sería su
  // PRIMER pago de escala/Autopiloto y todavía quedan cupos -- se cobra
  // fundador de una vez, de forma optimista: quien deja el cupo
  // escriturado de verdad, con un segundo chequeo, es el webhook de Bold
  // al confirmar el pago (ver app/api/webhooks/bold/route.ts).
  let esFundadorVigente = false;
  if (AUTOPILOTO_PUBLICO && planId === "escala") {
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("fundador_hasta")
      .eq("email", emailBusqueda)
      .maybeSingle();

    if (usuario?.fundador_hasta && new Date(usuario.fundador_hasta) >= new Date()) {
      esFundadorVigente = true;
    } else {
      const { data: pagoPrevio } = await supabaseAdmin
        .from("ordenes_pago")
        .select("id")
        .eq("email", emailBusqueda)
        .eq("plan_id", "escala")
        .eq("estado", "pagado")
        .limit(1)
        .maybeSingle();

      if (!pagoPrevio) {
        const { count: cuposUsados } = await supabaseAdmin
          .from("usuarios")
          .select("id", { count: "exact", head: true })
          .not("fundador_hasta", "is", null);

        if ((cuposUsados ?? 0) < CUPOS_FUNDADOR) {
          esFundadorVigente = true;
        }
      }
    }
  }

  // Monto SIEMPRE calculado del lado del servidor -- nunca se confía en
  // un monto que venga del frontend, para que nadie pueda manipular el
  // precio antes de mandarlo a Bold. precioMensual()/precioAnual() en
  // planesConfig.ts son la única fuente de verdad (ver ahí para la
  // fórmula exacta en cada caso).
  const plan = planId as PlanComprable;
  const monto = ciclo === "anual" ? precioAnual(plan, { esFundadorVigente }) : precioMensual(plan, { esFundadorVigente });

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

  // Con el interruptor encendido, el recibo de Bold dice el nombre
  // comercial de Escala ("Autopiloto") pero conserva el id entre
  // paréntesis para poder conciliar -- apagado, queda igual que hoy.
  // "(fundador)" se agrega solo cuando el cobro usa ese precio, para
  // poder revisar los 50 cupos contra los recibos reales de Bold.
  const description =
    AUTOPILOTO_PUBLICO && planId === "escala"
      ? `Quiubot — Plan ${nombreVisiblePlan("escala")} (${planId}, ${ciclo}${esFundadorVigente ? ", fundador" : ""})`
      : `Quiubot — Plan ${planId} (${ciclo})`;

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
        description,
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