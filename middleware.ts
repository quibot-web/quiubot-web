import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { NOMBRE_COOKIE_ADMIN, verificarCandadoAdmin } from "@/lib/adminCandado"

const DOMINIO_LANDING_ADS = "prueba-gratis.quiubot.site"

export default auth(async (req) => {
  const host = req.headers.get("host") || ""

  // Cualquier visita al subdominio de ads va directo a /bienvenida en el dominio principal,
  // conservando los parámetros de seguimiento (utm_source, etc.) de la campaña.
  if (host === DOMINIO_LANDING_ADS) {
    return NextResponse.redirect(`https://quiubot.site/bienvenida${req.nextUrl.search}`)
  }

  const isLoggedIn = !!req.auth
  const pathname = req.nextUrl.pathname
  const isLoginPage = pathname === "/login"
  const isBienvenidaPage = pathname === "/bienvenida"
  const isTerminosPage = pathname === "/terminos"
  const isActivarRoute = pathname === "/api/activar"

  if (isActivarRoute) return NextResponse.next()
  if (!isLoggedIn && !isLoginPage && !isBienvenidaPage && !isTerminosPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }

  // Segunda puerta: aunque el usuario ya tenga sesión y rol admin, cualquier
  // ruta bajo /admin o /api/admin exige además este candado con contraseña
  // propia, firmado y con expiración de 8 horas. Así, si alguien logra que
  // el sistema lo trate como admin (rol falseado, sesión robada, etc.), igual
  // se topa con esta puerta extra que no depende de la base de datos.
  // Se excluyen las rutas de la propia pantalla/endpoint de desbloqueo,
  // para no crear un loop de redirecciones.
  const esRutaAdmin = pathname.startsWith("/admin") || pathname.startsWith("/api/admin")
  const esRutaDesbloqueo = pathname === "/admin/desbloquear" || pathname === "/api/admin/desbloquear"

  if (esRutaAdmin && !esRutaDesbloqueo) {
    const secreto = process.env.ADMIN_PANEL_PASSWORD

    if (!secreto) {
      // Si no hay contraseña configurada en el servidor, no se deja pasar
      // por seguridad — mejor bloquear el panel que dejarlo sin candado.
      return NextResponse.redirect(new URL("/", req.nextUrl))
    }

    const cookieCandado = req.cookies.get(NOMBRE_COOKIE_ADMIN)?.value
    const candadoValido = await verificarCandadoAdmin(cookieCandado, secreto)

    if (!candadoValido) {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { error: "Se requiere desbloquear el panel de administrador" },
          { status: 401 }
        )
      }
      const url = new URL("/admin/desbloquear", req.nextUrl)
      url.searchParams.set("next", pathname)
      return NextResponse.redirect(url)
    }
  }
})

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
}