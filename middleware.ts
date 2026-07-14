import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
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