import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Llamado cada hora por un Schedule Trigger en n8n (mismo patrón que
// sync-meta-insights). Respaldo del vencimiento-al-leer que ya hace
// obtenerPropuestasPendientes -- esto cubre a los usuarios que no abren
// la bandeja, para que sus propuestas vencidas no se queden "pendiente"
// para siempre esperando una aprobación que ya no debería ser posible.
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

  const { data, error } = await supabaseAdmin
    .from("propuestas")
    .update({ estado: "vencida" })
    .eq("estado", "pendiente")
    .lt("vence_en", new Date().toISOString())
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, vencidas: data?.length ?? 0 });
}
