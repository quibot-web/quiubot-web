import { auth } from "@/auth"
import { NextResponse } from "next/server"

const DOMINIO_LANDING_ADS = "prueba-gratis.quiubot.site"

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
  const isActivarRoute = req.nextUrl.pathname === "/api/activar"

  if (isActivarRoute) return NextResponse.next()
  if (!isLoggedIn && !isLoginPage && !isBienvenidaPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }
})

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
}