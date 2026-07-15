import { auth } from "@/auth"
import { NextResponse } from "next/server"

const DOMINIO_LANDING_ADS = "prueba-gratis.quiubot.site"

function generarNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString("base64")
}

export default auth((req) => {
  const host = req.headers.get("host") || ""

  // Cualquier visita al subdominio de ads va directo a /bienvenida en el dominio principal,
  // conservando los parámetros de seguimiento (utm_source, etc.) de la campaña.
  if (host === DOMINIO_LANDING_ADS) {
    return NextResponse.redirect(`https://quiubot.site/bienvenida${req.nextUrl.search}`)
  }

  const isLoggedIn = !!req.auth
  const isLoginPage = req.nextUrl.pathname === "/login"
  const isBienvenidaPage = req.nextUrl.pathname === "/bienvenida"
  const isTerminosPage = req.nextUrl.pathname === "/terminos"
  const isActivarRoute = req.nextUrl.pathname === "/api/activar"

  if (isActivarRoute) return NextResponse.next()
  if (!isLoggedIn && !isLoginPage && !isBienvenidaPage && !isTerminosPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }

  // A partir de aquí: generamos un nonce único por petición y lo agregamos
  // tanto a los headers de la petición (para que Next.js lo use en sus propios
  // scripts internos) como a la respuesta (para que el navegador reciba el CSP).
  const nonce = generarNonce()

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-nonce", nonce)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co https://accounts.google.com",
    "frame-src https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ")

  // Modo "solo reportar" mientras confirmamos que no rompe nada.
  // Cuando esté limpio, cambiar este nombre de header a "Content-Security-Policy".
  response.headers.set("Content-Security-Policy-Report-Only", csp)

  return response
})

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
}