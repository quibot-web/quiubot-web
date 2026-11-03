import { auth } from "@/auth";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { COOKIE_STATE_META } from "@/app/lib/metaErrors";

// Vida de la cookie que guarda el nonce anti-CSRF del OAuth de Meta -- ver
// app/api/meta/callback/route.ts, que la compara contra el "state" que
// regresa Facebook. 10 minutos de sobra para un login normal.
const VIDA_COOKIE_STATE_SEGUNDOS = 10 * 60;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/login?modo=ingresar", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  }

  const appId = process.env.META_APP_ID;
  const configId = process.env.META_CONFIG_ID;
  const redirectUri = process.env.META_REDIRECT_URI;

  // Antes "state" era el correo en texto plano, sin firmar ni verificar al
  // volver -- cualquiera podia armar un callback con el "state" de otra
  // persona. Ahora es solo un nonce aleatorio de un solo uso, guardado en
  // una cookie httpOnly: el callback exige que ambos coincidan Y que haya
  // una sesion activa antes de tocar la base de datos (ver callback/route.ts).
  const state = randomBytes(32).toString("hex");

  const authUrl =
    `https://www.facebook.com/v21.0/dialog/oauth` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri || "")}` +
    `&config_id=${configId}` +
    `&state=${state}`;

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(COOKIE_STATE_META, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: VIDA_COOKIE_STATE_SEGUNDOS,
    path: "/api/meta",
  });
  return res;
}
