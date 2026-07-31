import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { enviarCorreoRecordatorioVencimiento } from "@/lib/email";

const DIAS_ANTES_DE_AVISAR = 3;

const NOMBRE_PLAN: Record<string, string> = {
  crecimiento: "Crecimiento",
  escala: "Escala",
};

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Llamado una vez al dia por un Schedule Trigger en n8n (mismo patron que
// ya usan para otras tareas automaticas de la plataforma). Protegido con
// el mismo ADMIN_SECRET que ya usa /api/activar -- no expone nada nuevo,
// reutiliza el candado que ya existe.
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

  // Usuarios con plan pago (no "arranque"), que vencen dentro de la
  // ventana de aviso, y a los que todavia no se les ha mandado el
  // recordatorio para ESTE vencimiento (el flag se resetea a false cada
  // vez que se activa/renueva un plan, en el webhook de Bold).
  const { data: usuarios, error } = await supabaseAdmin
    .from("usuarios")
    .select("email, nombre, plan, fecha_vencimiento")
    .neq("plan", "arranque")
    .eq("recordatorio_vencimiento_enviado", false)
    .lte("fecha_vencimiento", limite.toISOString())
    .gte("fecha_vencimiento", hoy.toISOString());

  if (error) {
    console.error("Error consultando usuarios por vencer:", error);
    return NextResponse.json({ error: "Error consultando usuarios" }, { status: 500 });
  }

  let enviados = 0;

  for (const usuario of usuarios || []) {
    const diasRestantes = Math.max(
      0,
      Math.ceil((new Date(usuario.fecha_vencimiento).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    );

    try {
      await enviarCorreoRecordatorioVencimiento({
        email: usuario.email,
        nombre: usuario.nombre || null,
        planNombre: NOMBRE_PLAN[usuario.plan] || usuario.plan,
        fechaVencimiento: usuario.fecha_vencimiento,
        diasRestantes,
      });

      await supabaseAdmin
        .from("usuarios")
        .update({ recordatorio_vencimiento_enviado: true })
        .eq("email", usuario.email);

      enviados++;
    } catch (err) {
      console.error(`Error mandando recordatorio a ${usuario.email}:`, err);
    }
  }

  return NextResponse.json({ ok: true, revisados: usuarios?.length || 0, enviados });
}