import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { obtenerPropuestasPendientes } from "@/app/lib/propuestas";
import { enviarCorreoPropuestasPendientes } from "@/lib/email";

const VENTANA_MINIMA_MS = 6 * 60 * 60 * 1000;

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Llamado cada hora por un Schedule Trigger en n8n (mismo patrón que
// sync-meta-insights y vencer-propuestas). Por cada admin con al menos
// una propuesta pendiente (lectura dual, igual que la bandeja), manda
// un correo agrupado -- nunca uno por propuesta -- y nunca más de uno
// cada 6 horas por usuario, verificado contra el último evento
// "correo_propuestas_enviado" en bitacora. Solo admins: Autopiloto
// sigue oculto para el resto, así que hoy no debería haber propuestas
// para nadie más, pero el filtro queda explícito igual.
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

  const { data: admins } = await supabaseAdmin
    .from("usuarios")
    .select("id, email, nombre")
    .eq("rol", "admin");

  let avisados = 0;
  let omitidosPorVentana = 0;

  for (const usuario of admins || []) {
    const pendientes = await obtenerPropuestasPendientes(usuario.id);
    if (pendientes.length === 0) continue;

    const { data: ultimoAviso } = await supabaseAdmin
      .from("bitacora")
      .select("creado_en")
      .eq("user_id", usuario.id)
      .eq("tipo_evento", "correo_propuestas_enviado")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimoAviso && Date.now() - new Date(ultimoAviso.creado_en).getTime() < VENTANA_MINIMA_MS) {
      omitidosPorVentana++;
      continue;
    }

    await enviarCorreoPropuestasPendientes({ email: usuario.email, nombre: usuario.nombre, total: pendientes.length });
    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: null,
      propuesta_id: null,
      tipo_evento: "correo_propuestas_enviado",
      detalle: { total: pendientes.length },
    });
    avisados++;
  }

  return NextResponse.json({ ok: true, avisados, omitidosPorVentana });
}
