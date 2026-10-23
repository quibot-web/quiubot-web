import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verificarLimite } from "@/lib/rateLimit";
import { generarToken, hashearToken } from "@/lib/tokens";
import { enviarCorreoVerificacion } from "@/lib/email";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "desconocida";
  const permitido = verificarLimite(`reenviar-verificacion:${ip}`, 5, 60 * 60 * 1000);
  if (!permitido) {
    return NextResponse.json({ error: "Demasiados intentos. Intenta más tarde." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const next = typeof body.next === "string" && body.next.startsWith("/") && !body.next.startsWith("//") ? body.next.slice(0, 200) : "/";

  // Mismo mensaje genérico sin importar el caso -- nunca revela si el
  // correo existe, si ya estaba verificado, o si es una cuenta de Google.
  const respuestaGenerica = NextResponse.json({ ok: true });

  if (!email || !email.includes("@")) return respuestaGenerica;

  // Tope aparte por correo (no solo por IP) para que alguien no pueda hacer
  // que a una cuenta ajena le lleguen correos de verificación en cadena.
  const permitidoPorEmail = verificarLimite(`reenviar-verificacion-email:${email}`, 3, 60 * 60 * 1000);
  if (!permitidoPorEmail) return respuestaGenerica;

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, nombre, password_hash, email_verificado")
    .eq("email", email)
    .maybeSingle();

  // Nada que reenviar si no existe, si ya se verificó, o si es una cuenta
  // de Google (esas quedan verificadas desde el alta, no usan este token).
  if (!usuario || usuario.email_verificado || !usuario.password_hash) {
    return respuestaGenerica;
  }

  const tokenCrudo = generarToken();
  const tokenHash = hashearToken(tokenCrudo);
  const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await supabaseAdmin
    .from("usuarios")
    .update({ token_verificacion: tokenHash, token_verificacion_expira: expira })
    .eq("id", usuario.id);

  const baseUrl = process.env.NEXTAUTH_URL || "https://quiubot.site";
  const link = `${baseUrl}/api/auth/verificar-email?token=${tokenCrudo}&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
  await enviarCorreoVerificacion(email, usuario.nombre || "", link);

  return respuestaGenerica;
}
