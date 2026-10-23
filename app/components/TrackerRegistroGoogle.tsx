"use client"
import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { leerUtmPrimerContacto } from "@/app/lib/utmTracking"

// Vive montado en todo momento (layout raiz) porque no sabemos de antemano
// en que pagina va a "aterrizar" alguien recien registrado por Google --
// depende del "next" que traiga el login. Se queda callado en el 99% de
// las cargas de pagina; solo actua si la sesion trae la bandera
// esRegistroNuevo en true (ver callback jwt/session en auth.ts).
export default function TrackerRegistroGoogle() {
  const { data: session } = useSession()

  useEffect(() => {
    const esNuevo = (session?.user as any)?.esRegistroNuevo
    if (!esNuevo) return
    if (typeof window === "undefined") return

    // Guardia en sessionStorage: sin esto, como la bandera queda en el
    // JWT durante toda la sesion (hasta que se renueve, hasta 1 hora),
    // este componente se montaria en cada pagina que visite el usuario
    // recien registrado y dispararia el evento una y otra vez.
    if (sessionStorage.getItem("qb_complete_registration_enviado")) return

    ;(window as any).fbq?.("track", "CompleteRegistration")
    // en_trial queda en true desde el INSERT (default de la columna),
    // asi que crear la cuenta y arrancar la prueba son el mismo
    // instante hoy -- de ahi que los dos eventos se disparen juntos.
    ;(window as any).fbq?.("track", "StartTrial")
    sessionStorage.setItem("qb_complete_registration_enviado", "1")

    // El UTM de primer contacto (si lo hay, guardado en sessionStorage
    // desde /bienvenida) sobrevive la ida y vuelta por Google OAuth
    // porque es la misma pestaña y el mismo origen al volver -- se
    // manda una sola vez, justo aquí, al mismo tiempo que los eventos.
    const utm = leerUtmPrimerContacto()
    if (utm) {
      fetch("/api/usuario/utm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(utm),
      }).catch(() => {})
    }
  }, [session])

  return null
}