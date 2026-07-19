import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { tokensCoinciden } from "@/lib/tokens";

const MIN_LARGO = 10;

function passwordEsFuerte(password: string): boolean {
  if (password.length < MIN_LARGO) return false;
  return /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const token = String(body.token || "");
  const nuevaPassword = String(body.password || "");

  if (!email || !token || !nuevaPassword) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  if (!passwordEsFuerte(nuevaPassword)) {
    return NextResponse.json(
      { error: `La contraseña debe tener al menos ${MIN_LARGO} caracteres, con letras y números.` },
      { status: 400 }
    );
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, token_reset_password, token_reset_expira")
    .eq("email", email)
    .maybeSingle();

  const tokenValido =
    usuario?.token_reset_password &&
    tokensCoinciden(usuario.token_reset_password, token) &&
    usuario.token_reset_expira &&
    new Date(usuario.token_reset_expira) > new Date();

  if (!usuario || !tokenValido) {
    return NextResponse.json({ error: "El enlace no es válido o ya venció. Solicita uno nuevo." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(nuevaPassword, 12);

  await supabaseAdmin
    .from("usuarios")
    .update({
      password_hash: passwordHash,
      token_reset_password: null,
      token_reset_expira: null,
      intentos_login_fallidos: 0,
      bloqueado_hasta: null,
    })
    .eq("id", usuario.id);

  return NextResponse.json({ ok: true });
}