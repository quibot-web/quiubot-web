import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tokensCoinciden } from "@/lib/tokens";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email")?.trim().toLowerCase();
  const baseUrl = process.env.NEXTAUTH_URL || "https://quiubot.site";

  if (!token || !email) {
    return NextResponse.redirect(`${baseUrl}/login?verificado=error`);
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, token_verificacion, token_verificacion_expira")
    .eq("email", email)
    .maybeSingle();

  const tokenValido =
    usuario?.token_verificacion &&
    tokensCoinciden(usuario.token_verificacion, token) &&
    usuario.token_verificacion_expira &&
    new Date(usuario.token_verificacion_expira) > new Date();

  if (!usuario || !tokenValido) {
    return NextResponse.redirect(`${baseUrl}/login?verificado=error`);
  }

  await supabaseAdmin
    .from("usuarios")
    .update({ email_verificado: true, token_verificacion: null, token_verificacion_expira: null })
    .eq("id", usuario.id);

  return NextResponse.redirect(`${baseUrl}/login?verificado=1`);
}