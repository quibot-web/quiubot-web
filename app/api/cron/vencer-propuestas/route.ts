import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const VENCE_ESPERANDO_FOTOS_MS = 72 * 60 * 60 * 1000;

// Llamado cada hora por un Schedule Trigger en n8n (mismo patrón que
// sync-meta-insights). Dos barridos, ambos respaldo de algo que ya pasa
// al leer: propuestas "pendiente" con vence_en cumplido (ver
// obtenerPropuestasPendientes), y crear_creativos "aprobada" que lleva
// más de 72h esperando que el cliente suba las fotos (ver
// vencerPropuestasDelUsuario) -- así ninguna queda colgada para
// siempre aunque el cliente nunca vuelva a abrir la bandeja.
export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error("ADMIN_SECRET no configurado.");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const authHeader = req.headers.get("authorization") || "";
  if (!compararSeguro(authHeader, `Bearer ${adminSecret}`)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: vencidasPendiente, error: errorPendiente } = await supabaseAdmin
    .from("propuestas")
    .update({ estado: "vencida" })
    .eq("estado", "pendiente")
    .lt("vence_en", new Date().toISOString())
    .select("id");

  if (errorPendiente) {
    return NextResponse.json({ error: errorPendiente.message }, { status: 500 });
  }

  const { data: vencidasEsperandoFotos, error: errorEsperandoFotos } = await supabaseAdmin
    .from("propuestas")
    .update({ estado: "vencida" })
    .eq("estado", "aprobada")
    .eq("accion", "crear_creativos")
    .eq("resultado->>etapa", "esperando_fotos")
    .lt("decidido_en", new Date(Date.now() - VENCE_ESPERANDO_FOTOS_MS).toISOString())
    .select("id");

  if (errorEsperandoFotos) {
    return NextResponse.json({ error: errorEsperandoFotos.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    vencidas: vencidasPendiente?.length ?? 0,
    vencidas_esperando_fotos: vencidasEsperandoFotos?.length ?? 0,
  });
}
