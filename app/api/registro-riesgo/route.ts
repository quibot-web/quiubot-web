import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

const NOMBRE_COOKIE_DISPOSITIVO = "qb_device_id";
const VENTANA_DIAS = 30;
const UMBRAL_SOSPECHOSO = 3;

function obtenerIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "desconocida";
}

function hashearIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, plan, en_trial")
    .eq("email", emailBusqueda)
    .maybeSingle();

  if (!usuario) {
    return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
  }

  // Si esta cuenta ya fue evaluada antes, no repetir el analisis.
  const { data: yaEvaluado } = await supabaseAdmin
    .from("senales_registro")
    .select("id")
    .eq("usuario_id", usuario.id)
    .maybeSingle();

  if (yaEvaluado) {
    return NextResponse.json({ ok: true, ya_evaluado: true });
  }

  // Dispositivo: cookie de larga duracion, anonima. Si no existe, se crea.
  let dispositivoId = req.cookies.get(NOMBRE_COOKIE_DISPOSITIVO)?.value;
  let esDispositivoNuevo = false;
  if (!dispositivoId) {
    dispositivoId = randomUUID();
    esDispositivoNuevo = true;
  }

  const ipHash = hashearIp(obtenerIp(req));
  const desde = new Date(Date.now() - VENTANA_DIAS * 24 * 60 * 60 * 1000).toISOString();

  const { count: countIp } = await supabaseAdmin
    .from("senales_registro")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("creado_en", desde);

  const { count: countDispositivo } = await supabaseAdmin
    .from("senales_registro")
    .select("*", { count: "exact", head: true })
    .eq("dispositivo_id", dispositivoId)
    .gte("creado_en", desde);

  let riesgo = 0;
  if ((countIp ?? 0) > 0) riesgo += 2;
  if ((countDispositivo ?? 0) > 0) riesgo += 3;

  const sospechoso = riesgo >= UMBRAL_SOSPECHOSO;

  await supabaseAdmin.from("senales_registro").insert({
    usuario_id: usuario.id,
    ip_hash: ipHash,
    dispositivo_id: dispositivoId,
    riesgo,
    marcado_sospechoso: sospechoso,
  });

  // Solo se toca el trial si esta sospechoso Y todavia lo tenia activo —
  // nunca se le quita nada a alguien que ya viene usando la app normal.
  if (sospechoso && usuario.en_trial) {
    await supabaseAdmin
      .from("usuarios")
      .update({ en_trial: false, plan: "arranque", trial_termina_en: null })
      .eq("id", usuario.id);
  }

  const res = NextResponse.json({ ok: true, riesgo, sospechoso });

  if (esDispositivoNuevo) {
    res.cookies.set(NOMBRE_COOKIE_DISPOSITIVO, dispositivoId, {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2, // 2 años
    });
  }

  return res;
}