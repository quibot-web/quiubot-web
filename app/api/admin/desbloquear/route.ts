import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { verificarLimite } from "@/lib/rateLimit";
import { firmarCandadoAdmin, NOMBRE_COOKIE_ADMIN } from "@/lib/adminCandado";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const permitido = verificarLimite(`admin-desbloqueo:${emailBusqueda}`, 5, 5 * 60 * 1000);
  if (!permitido) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos antes de volver a intentar." },
      { status: 429 }
    );
  }

  const secreto = process.env.ADMIN_PANEL_PASSWORD;
  if (!secreto) {
    return NextResponse.json(
      { error: "El panel de administrador no tiene contraseña configurada en el servidor." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json({ error: "Escribe la contraseña." }, { status: 400 });
  }

  // Comparacion en tiempo constante, mismo patron que /api/activar,
  // para no filtrar por timing cuanto de la contraseña acertaste.
  const bufA = Buffer.from(password);
  const bufB = Buffer.from(secreto);
  const esValida = bufA.length === bufB.length && timingSafeEqual(bufA, bufB);

  if (!esValida) {
    return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }

  const token = await firmarCandadoAdmin(secreto);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(NOMBRE_COOKIE_ADMIN, token, {
    httpOnly: true,
    // Se adapta solo: exige "secure" si la peticion llego por https (produccion),
    // pero no la exige si llego por http (por ejemplo tu dominio de staging .sslip.io),
    // para que el candado tambien funcione ahi mientras pruebas.
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60, // 8 horas
  });
  return res;
}