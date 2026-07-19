import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { verificarLimite } from "@/lib/rateLimit";
import { generarToken, hashearToken } from "@/lib/tokens";
import { enviarCorreoVerificacion } from "@/lib/email";

const MIN_LARGO = 10;

function passwordEsFuerte(password: string): boolean {
  if (password.length < MIN_LARGO) return false;
  const tieneLetra = /[a-zA-Z]/.test(password);
  const tieneNumero = /[0-9]/.test(password);
  return tieneLetra && tieneNumero;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "desconocida";
  const permitido = verificarLimite(`registro:${ip}`, 5, 60 * 60 * 1000);
  if (!permitido) {
    return NextResponse.json({ error: "Demasiados intentos de registro. Intenta más tarde." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const nombre = String(body.nombre || "").trim().slice(0, 100);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  }

  if (!passwordEsFuerte(password)) {
    return NextResponse.json(
      { error: `La contraseña debe tener al menos ${MIN_LARGO} caracteres, con letras y números.` },
      { status: 400 }
    );
  }

  const respuestaGenerica = NextResponse.json({
    ok: true,
    mensaje: "Si ese correo no tenía cuenta todavía, te enviamos un enlace de confirmación.",
  });

  const { data: existente } = await supabaseAdmin
    .from("usuarios")
    .select("id, password_hash")
    .eq("email", email)
    .maybeSingle();

  // Si ya existe una cuenta CON contraseña, no revelamos nada — mismo
  // mensaje genérico de siempre, para no confirmarle a nadie que ese
  // correo ya está registrado.
  if (existente?.password_hash) {
    return respuestaGenerica;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const tokenCrudo = generarToken();
  const tokenHash = hashearToken(tokenCrudo);
  const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  if (existente) {
    // La fila ya existía (por ejemplo, se creó antes por Google) pero sin
    // contraseña — se completa con la nueva.
    await supabaseAdmin
      .from("usuarios")
      .update({
        password_hash: passwordHash,
        nombre: nombre || undefined,
        email_verificado: false,
        token_verificacion: tokenHash,
        token_verificacion_expira: expira,
      })
      .eq("id", existente.id);
  } else {
    await supabaseAdmin.from("usuarios").insert({
      email,
      nombre,
      password_hash: passwordHash,
      activo: false,
      email_verificado: false,
      token_verificacion: tokenHash,
      token_verificacion_expira: expira,
    });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "https://quiubot.site";
  const link = `${baseUrl}/api/auth/verificar-email?token=${tokenCrudo}&email=${encodeURIComponent(email)}`;
  await enviarCorreoVerificacion(email, nombre, link);

  return respuestaGenerica;
}