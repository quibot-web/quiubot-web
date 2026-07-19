import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verificarLimite } from "@/lib/rateLimit";
import { generarToken, hashearToken } from "@/lib/tokens";
import { enviarCorreoResetPassword } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();

  // Esta respuesta es SIEMPRE la misma, pase lo que pase — es la clave para
  // que nadie pueda usar este endpoint para averiguar qué correos están
  // registrados en Quiubot.
  const respuestaGenerica = NextResponse.json({
    ok: true,
    mensaje: "Si ese correo tiene una cuenta, te enviamos instrucciones para restablecer tu contraseña.",
  });

  if (!email) return respuestaGenerica;

  const permitido = verificarLimite(`olvide-password:${email}`, 3, 15 * 60 * 1000);
  if (!permitido) return respuestaGenerica;

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, password_hash")
    .eq("email", email)
    .maybeSingle();

  if (!usuario || !usuario.password_hash) return respuestaGenerica;

  const tokenCrudo = generarToken();
  const tokenHash = hashearToken(tokenCrudo);
  const expira = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await supabaseAdmin
    .from("usuarios")
    .update({ token_reset_password: tokenHash, token_reset_expira: expira })
    .eq("id", usuario.id);

  const baseUrl = process.env.NEXTAUTH_URL || "https://quiubot.site";
  const link = `${baseUrl}/resetear-password?token=${tokenCrudo}&email=${encodeURIComponent(email)}`;
  await enviarCorreoResetPassword(email, link);

  return respuestaGenerica;
}