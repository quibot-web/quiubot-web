"use client"
import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { DIAS_PRUEBA } from "@/app/lib/planesConfig"
import { leerUtmPrimerContacto } from "@/app/lib/utmTracking"
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente"
import { ProveedorEsferas } from "@/app/components/esferas/ProveedorEsferas"
import type { AsistenteId } from "@/app/components/esferas/esferasShared"

type Modo = "crear" | "ingresar"

// Fila decorativa de abajo -- el Director ya tiene su propio lugar junto
// a la burbuja de bienvenida, estos son el resto del equipo.
const EQUIPO_MINI: AsistenteId[] = ["marca", "estratega", "creativo", "publicador", "analista", "optimizador"]

// Solo se acepta una ruta relativa propia (ej. "/billing") -- nunca una URL
// completa, para no abrir la puerta a un redirect externo vía ?next=.
function sanitizarNext(valor: string | null): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//")) return "/"
  return valor.slice(0, 200)
}

function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const next = sanitizarNext(searchParams.get("next"))
  const vaAPagar = next === "/billing"
  const verificado = searchParams.get("verificado")

  const [modo, setModo] = useState<Modo>(searchParams.get("modo") === "ingresar" ? "ingresar" : "crear")

  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [cuentaCreada, setCuentaCreada] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [reenviado, setReenviado] = useState(false)

  const handleSubmitIngresar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError(null)
    try {
      const res = await signIn("credentials", { email, password, redirect: false })
      if (res?.error) {
        setError("Correo o contraseña incorrectos. Si no verificaste tu correo, revisa tu bandeja de entrada.")
        return
      }
      router.push(next)
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.")
    } finally {
      setEnviando(false)
    }
  }

  const handleSubmitCrear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError(null)
    try {
      const utm = leerUtmPrimerContacto()
      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, password, next, ...utm }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "No se pudo crear la cuenta.")
        return
      }
      setCuentaCreada(true)

      // Meta Pixel: registro completado con correo y contraseña. El flujo de
      // Google dispara estos mismos eventos aparte, desde TrackerRegistroGoogle
      // (vive en el layout raíz, activado por la bandera esRegistroNuevo de la
      // sesión), porque ahí no hay un "submit" al que enganchar el evento.
      if (typeof window !== "undefined") {
        ;(window as any).fbq?.("track", "CompleteRegistration")
        ;(window as any).fbq?.("track", "StartTrial")
      }
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.")
    } finally {
      setEnviando(false)
    }
  }

  const handleReenviar = async () => {
    if (reenviando) return
    setReenviando(true)
    try {
      await fetch("/api/auth/reenviar-verificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next }),
      })
      setReenviado(true)
    } catch {
      // silencioso -- el botón vuelve a quedar disponible para reintentar
    } finally {
      setReenviando(false)
    }
  }

  const tituloBurbuja = vaAPagar
    ? "Ya casi. Entra o crea tu cuenta para elegir tu plan y seguir creciendo."
    : modo === "crear"
      ? <>¡Bienvenido! Crea tu cuenta y en unos minutos empezamos con tu negocio. Tienes <strong>{DIAS_PRUEBA} días gratis</strong>, sin tarjeta.</>
      : "¡Qué bueno verte de nuevo! Ingresa para seguir donde quedaste."

  return (
    <div className="qbl-escena">
      <style>{`
        .qbl-escena {
          --bg: #0C0A17; --card: #1B1733; --line: #2C2747;
          --ink: #F4F2FF; --muted: #B4AED3; --soft: #8E88B0;
          --brand: #7C6CF2; --brand-d: #6858E6; --ok: #5EE0A8;
          position: relative; min-height: 100vh; min-height: 100svh;
          display: flex; align-items: center; justify-content: center;
          padding: 28px 18px 40px; isolation: isolate; overflow-x: hidden;
          background: var(--bg); color: var(--ink);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased; line-height: 1.5;
        }
        .qbl-escena::before { content: ""; position: absolute; inset: 0; z-index: -2; background: radial-gradient(55% 45% at 50% 12%, rgba(124,108,242,.30), transparent 70%), radial-gradient(35% 35% at 85% 85%, rgba(94,224,168,.10), transparent 70%), radial-gradient(35% 35% at 12% 80%, rgba(242,141,183,.10), transparent 70%); }
        .qbl-escena::after { content: ""; position: absolute; inset: 0; z-index: -1; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 44px 44px; mask-image: radial-gradient(60% 55% at 50% 30%, #000, transparent); }

        .qbl-caja { position: relative; z-index: 1; width: min(440px, 100%); display: flex; flex-direction: column; gap: 18px; }

        .qbl-logo { display: flex; align-items: center; justify-content: center; gap: 10px; color: #fff; font-weight: 800; font-size: 22px; letter-spacing: -.02em; }
        .qbl-logo img { width: 34px; height: 34px; border-radius: 9px; }
        .qbl-logo b { color: #B9AEFF; }

        .qbl-director { display: flex; gap: 12px; align-items: flex-end; }
        .qbl-burbuja { background: var(--card); border: 1px solid var(--line); border-radius: 20px 20px 20px 6px; padding: 14px 16px; font-size: 15.5px; line-height: 1.5; color: #ECE9FF; }
        .qbl-burbuja strong { color: #fff; }

        .qbl-tarjeta { background: rgba(23,20,43,.86); border: 1px solid var(--line); border-radius: 24px; padding: 24px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 30px 70px -35px rgba(124,108,242,.55); }

        .qbl-tabs { display: grid; grid-template-columns: 1fr 1fr; background: #0F0D1F; border: 1px solid var(--line); border-radius: 14px; padding: 4px; }
        .qbl-tabs button { min-height: 42px; border: 0; border-radius: 10px; background: transparent; color: var(--muted); font: inherit; font-weight: 700; font-size: 14.5px; cursor: pointer; }
        .qbl-tabs button[aria-selected="true"] { background: #2A2450; color: #fff; }

        .qbl-google { width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 52px; border-radius: 14px; background: #fff; color: #1F1F1F; font-weight: 700; font-size: 15px; border: 0; cursor: pointer; }
        .qbl-google:hover { opacity: .92; }

        .qbl-sep { display: flex; align-items: center; gap: 12px; color: var(--soft); font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin: 2px 0; }
        .qbl-sep::before, .qbl-sep::after { content: ""; flex: 1; height: 1px; background: var(--line); }

        .qbl-form { display: flex; flex-direction: column; gap: 10px; }
        .qbl-form label { font-size: 13px; font-weight: 600; color: var(--muted); display: block; margin-bottom: 4px; }
        .qbl-input { width: 100%; min-height: 50px; border-radius: 13px; border: 1px solid #3A3460; background: #0F0D1F; color: #fff; font: inherit; font-size: 15px; padding: 0 14px; outline: none; box-sizing: border-box; }
        .qbl-input:focus { border-color: #8C7EF7; box-shadow: 0 0 0 3px rgba(124,108,242,.25); }
        .qbl-input::placeholder { color: #6E6890; }

        .qbl-cta { min-height: 54px; border: 0; border-radius: 14px; background: var(--brand); color: #fff; font: inherit; font-weight: 800; font-size: 16.5px; cursor: pointer; box-shadow: 0 14px 34px -14px var(--brand); margin-top: 4px; }
        .qbl-cta:hover { background: var(--brand-d); }
        .qbl-cta:disabled { opacity: .6; cursor: not-allowed; }

        .qbl-fila { display: flex; justify-content: space-between; font-size: 13.5px; }
        .qbl-fila a { color: #C9C2FF; text-decoration: none; font-weight: 600; }

        .qbl-alerta-ok { background: rgba(94,224,168,.12); border: 1px solid rgba(94,224,168,.35); color: var(--ok); border-radius: 10px; padding: 10px 14px; font-size: 13px; text-align: center; }
        .qbl-alerta-error { background: rgba(255,120,120,.1); border: 1px solid rgba(255,120,120,.35); color: #FF9B9B; border-radius: 10px; padding: 10px 14px; font-size: 13px; text-align: center; }

        .qbl-exito { display: flex; flex-direction: column; gap: 14px; align-items: center; text-align: center; }
        .qbl-exito .qbl-burbuja { text-align: left; }
        .qbl-reenviar { background: none; border: 0; color: #C9C2FF; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: underline; }
        .qbl-reenviar:disabled { opacity: .6; cursor: not-allowed; text-decoration: none; }

        .qbl-confianza { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; color: var(--muted); font-size: 13px; }
        .qbl-confianza span::before { content: "✓ "; color: var(--ok); font-weight: 800; }

        .qbl-equipo { display: flex; justify-content: center; gap: 8px; }

        .qbl-legal { text-align: center; color: var(--soft); font-size: 12px; margin: 0; }
        .qbl-legal a { color: #C9C2FF; }

        @media (max-width: 420px) {
          .qbl-tarjeta { padding: 20px 18px; }
        }
        @media (prefers-reduced-motion: reduce) { .qbl-escena * { animation: none !important; transition: none !important; } }
      `}</style>

      <div className="qbl-caja">
        <Link href="/bienvenida" className="qbl-logo">
          <img src="/marca/icono-quiubot.svg" alt="" />
          <span>quiu<b>bot</b></span>
        </Link>

        <div className="qbl-director">
          <EsferaAsistente asistente="director" estado="normal" tamano={54} />
          <div className="qbl-burbuja" aria-live="polite">{tituloBurbuja}</div>
        </div>

        <div className="qbl-tarjeta">
          {cuentaCreada ? (
            <div className="qbl-exito">
              <div className="qbl-burbuja">¡Listo! Te envié un correo para confirmar tu cuenta. Ábrelo y empezamos.</div>
              {reenviado ? (
                <p className="qbl-alerta-ok" style={{ width: "100%", boxSizing: "border-box" }}>Te reenviamos el correo. Revisa también la carpeta de spam.</p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "var(--soft)" }}>
                  ¿No te llegó?{" "}
                  <button type="button" className="qbl-reenviar" onClick={handleReenviar} disabled={reenviando}>
                    {reenviando ? "Reenviando..." : "Reenviar correo"}
                  </button>
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="qbl-tabs" role="tablist" aria-label="Tipo de acceso">
                <button
                  role="tab"
                  type="button"
                  aria-selected={modo === "crear"}
                  onClick={() => { setModo("crear"); setError(null) }}
                >
                  Crear cuenta
                </button>
                <button
                  role="tab"
                  type="button"
                  aria-selected={modo === "ingresar"}
                  onClick={() => { setModo("ingresar"); setError(null) }}
                >
                  Ya tengo cuenta
                </button>
              </div>

              {verificado === "1" && <div className="qbl-alerta-ok">✅ Correo confirmado. Ya puedes iniciar sesión.</div>}
              {verificado === "error" && <div className="qbl-alerta-error">El enlace de confirmación no es válido o ya venció.</div>}

              <button type="button" className="qbl-google" onClick={() => signIn("google", { callbackUrl: next })}>
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
                  <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.9-6.2z" />
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.2-8.5 2.2-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
                </svg>
                Continuar con Google
              </button>

              <div className="qbl-sep">O con tu correo</div>

              {modo === "crear" ? (
                <form className="qbl-form" onSubmit={handleSubmitCrear}>
                  <div>
                    <label htmlFor="nombre">Tu nombre</label>
                    <input id="nombre" className="qbl-input" placeholder="¿Cómo te llamas?" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="correo">Correo electrónico</label>
                    <input id="correo" className="qbl-input" type="email" autoComplete="email" placeholder="tu@negocio.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="clave">Crea una contraseña</label>
                    <div style={{ position: "relative" }}>
                      <input
                        id="clave"
                        className="qbl-input"
                        type={mostrarPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Mínimo 10 caracteres, con letras y números"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ paddingRight: 44 }}
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarPassword((v) => !v)}
                        aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", color: "var(--soft)" }}
                      >
                        {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  {error && <div className="qbl-alerta-error">{error}</div>}
                  <button className="qbl-cta" type="submit" disabled={enviando}>
                    {enviando ? "Creando cuenta..." : "Crear mi cuenta gratis →"}
                  </button>
                  <p className="qbl-legal">Al crear tu cuenta aceptas los <a href="/terminos">términos y condiciones</a>.</p>
                </form>
              ) : (
                <form className="qbl-form" onSubmit={handleSubmitIngresar}>
                  <div>
                    <label htmlFor="correo-in">Correo electrónico</label>
                    <input id="correo-in" className="qbl-input" type="email" autoComplete="email" placeholder="tu@negocio.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="clave-in">Contraseña</label>
                    <div style={{ position: "relative" }}>
                      <input
                        id="clave-in"
                        className="qbl-input"
                        type={mostrarPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Tu contraseña"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ paddingRight: 44 }}
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarPassword((v) => !v)}
                        aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", color: "var(--soft)" }}
                      >
                        {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  {error && <div className="qbl-alerta-error">{error}</div>}
                  <button className="qbl-cta" type="submit" disabled={enviando}>
                    {enviando ? "Entrando..." : "Iniciar sesión"}
                  </button>
                  <div className="qbl-fila">
                    <Link href="/olvide-password">Olvidé mi contraseña</Link>
                  </div>
                  <p className="qbl-legal">Al ingresar aceptas los <a href="/terminos">términos de uso</a>.</p>
                </form>
              )}
            </>
          )}
        </div>

        <div className="qbl-confianza">
          <span>{DIAS_PRUEBA} días gratis</span>
          <span>Sin tarjeta de crédito</span>
          <span>Nada se publica sin tu aprobación</span>
        </div>
        <div className="qbl-equipo" aria-hidden="true">
          {EQUIPO_MINI.map((id) => (
            <EsferaAsistente key={id} asistente={id} estado="normal" tamano={32} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <ProveedorEsferas>
        <LoginContent />
      </ProveedorEsferas>
    </Suspense>
  )
}
