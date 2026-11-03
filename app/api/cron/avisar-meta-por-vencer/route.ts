import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

// Ajustable: cuántos días antes del vencimiento se avisa. El token de
// larga duración de Meta dura ~60 días, así que 7 es proporcional.
const DIAS_ANTES_DE_AVISAR = 7;

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Llamado una vez al día por un Schedule Trigger en n8n -- mismo patrón
// que /api/cron/recordatorio-vencimiento (protegido con el mismo
// ADMIN_SECRET que ya usa /api/activar). Esto es el aviso PROACTIVO, por
// fecha (meta_token_expira); el reactivo -- cuando Meta ya rechazó una
// llamada real con el error 190 -- vive en /api/cron/sync-meta-insights.
export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error("ADMIN_SECRET no configurado.");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const authHeader = req.headers.get("authorization") || "";
  const esperado = `Bearer ${adminSecret}`;
  if (!compararSeguro(authHeader, esperado)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const hoy = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + DIAS_ANTES_DE_AVISAR);

  // Usuarios con una conexión de Meta activa, cuyo token vence dentro de
  // la ventana de aviso, y a los que todavía no se les avisó para ESTE
  // vencimiento (el flag se resetea a false cada vez que se reconecta,
  // en /api/meta/callback).
  const { data: usuarios, error } = await supabaseAdmin
    .from("usuarios")
    .select("id, email, meta_token_expira")
    .not("meta_ad_account_id", "is", null)
    .eq("meta_token_vencera_avisado", false)
    .lte("meta_token_expira", limite.toISOString())
    .gte("meta_token_expira", hoy.toISOString());

  if (error) {
    console.error("Error consultando usuarios con Meta por vencer:", error);
    return NextResponse.json({ error: "Error consultando usuarios" }, { status: 500 });
  }

  let avisados = 0;

  for (const usuario of usuarios || []) {
    const diasRestantes = Math.max(
      0,
      Math.ceil((new Date(usuario.meta_token_expira).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    );

    const { error: errorInsert } = await supabaseAdmin.from("notificaciones").insert({
      user_id: usuario.id,
      tipo: "meta_token_por_vencer",
      titulo: "Tu conexión con Meta está por vencer",
      mensaje: `Tu conexión con Meta vence en ${diasRestantes} día${diasRestantes === 1 ? "" : "s"}. Reconéctala para no perder la publicación automática de tus campañas.`,
      estado: "pendiente",
    });

    if (errorInsert) {
      console.error(`Error avisando a ${usuario.email} sobre vencimiento de Meta:`, errorInsert);
      continue;
    }

    await supabaseAdmin.from("usuarios").update({ meta_token_vencera_avisado: true }).eq("id", usuario.id);
    avisados++;
  }

  return NextResponse.json({ ok: true, revisados: usuarios?.length || 0, avisados });
}
