"use client"
import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"

function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const next = searchParams.get("next") || "/"
  const vaAPagar = next === "/billing"
  const verificado = searchParams.get("verificado")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmitPassword = async (e: React.FormEvent) => {
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

  return (
    <div className="ql-page">
      <style>{`
        .ql-page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: system-ui, sans-serif;
          padding: 2rem;
          background: #f9f9f8;
        }
        .ql-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.32;
          z-index: 0;
        }
        .ql-blob-a { width: 440px; height: 440px; background: #7F77DD; top: -160px; left: -140px; animation: qlBlobMove 15s ease-in-out infinite; }
        .ql-blob-b { width: 380px; height: 380px; background: #1FA97C; bottom: -160px; right: -140px; animation: qlBlobMove 19s ease-in-out infinite reverse; }
        @keyframes qlBlobMove { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px, 40px) scale(1.08); } }

        .ql-card {
          position: relative;
          z-index: 1;
          background: #fff;
          border: 1px solid #ECE9F7;
          border-radius: 24px;
          padding: 3rem 2.5rem 2.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 24px 60px rgba(74,63,174,0.14);
        }

        .ql-icon-stage { position: relative; width: 92px; height: 92px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
        .ql-icon-ring { position: absolute; inset: 0; border-radius: 50%; border: 1.5px dashed rgba(127,119,221,0.35); animation: qlSpin 18s linear infinite; }
        .ql-icon-badge {
          position: relative;
          width: 68px; height: 68px;
          border-radius: 20px;
          background: linear-gradient(135deg, #4A3FAE, #7F77DD);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 14px 32px rgba(74,63,174,0.35);
          animation: qlBreathe 4s ease-in-out infinite;
        }
        .ql-icon-badge img { width: 36px; height: 36px; }
        @keyframes qlSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes qlBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }

        .ql-wordmark { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #17152B; }
        .ql-wordmark .acc { color: #7F77DD; }

        .ql-headline { font-size: 19px; font-weight: 700; color: #17152B; text-align: center; margin: 2px 0 0; line-height: 1.3; }
        .ql-sub { color: #6B6478; font-size: 14px; text-align: center; margin: 0; line-height: 1.5; }

        .ql-btn-google {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: #fff;
          border: 1.5px solid #E5E1F5;
          color: #17152B;
          font-weight: 600;
          font-size: 14px;
          padding: 14px;
          border-radius: 13px;
          cursor: pointer;
          margin-top: 6px;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .ql-btn-google:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(74,63,174,0.16);
          border-color: #C4BFF0;
        }

        .ql-divider { display: flex; align-items: center; gap: 10px; width: 100%; margin: 4px 0; }
        .ql-divider::before, .ql-divider::after { content: ""; flex: 1; height: 1px; background: #ECE9F7; }
        .ql-divider span { font-size: 11px; color: #aaa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

        .ql-form { width: 100%; display: flex; flex-direction: column; gap: 10px; }
        .ql-input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #e0e0e0; font-size: 14px; box-sizing: border-box; font-family: inherit; }
        .ql-btn-password { width: 100%; background: #534AB7; color: #fff; border: none; padding: 13px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .ql-btn-password:disabled { opacity: 0.6; cursor: not-allowed; }

        .ql-links { display: flex; justify-content: space-between; width: 100%; font-size: 12.5px; }
        .ql-links a { color: #7F77DD; font-weight: 600; text-decoration: none; }

        .ql-chips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
        .ql-chip { font-size: 11px; font-weight: 600; color: #4A3FAE; background: #F1EFFB; padding: 5px 10px; border-radius: 20px; }

        .ql-terminos { color: #aaa; font-size: 11px; text-align: center; margin: 4px 0 0; }
        .ql-alerta-ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; border-radius: 8px; padding: 8px 12px; font-size: 12.5px; width: 100%; box-sizing: border-box; text-align: center; }
        .ql-alerta-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 8px; padding: 8px 12px; font-size: 12.5px; width: 100%; box-sizing: border-box; text-align: center; }
      `}</style>

      <div className="ql-blob ql-blob-a" />
      <div className="ql-blob ql-blob-b" />

      <div className="ql-card">
        <div className="ql-icon-stage">
          <div className="ql-icon-ring" />
          <div className="ql-icon-badge">
            <img src="/marca/icono-quiubot.svg" alt="" />
          </div>
        </div>

        <div className="ql-wordmark">quiu<span className="acc">bot</span></div>

        <p className="ql-headline">
          {vaAPagar ? "Ya casi. Elige tu plan y sigue creciendo." : "Ya casi. Tu prueba gratuita de 7 días te espera."}
        </p>
        <p className="ql-sub">
          {vaAPagar
            ? "Inicia sesión para ver tus opciones de plan y activar el que se ajuste a tu negocio."
            : "Estrategia, creativos y campañas con IA — mientras Quiubot vigila y ajusta todo por ti."}
        </p>

        {verificado === "1" && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, width: "100%", boxSizing: "border-box", textAlign: "center" }}>
            ✅ Correo confirmado. Ya puedes iniciar sesión.
          </div>
        )}
        {verificado === "error" && (
          <div className="ql-alerta-error">
            El enlace de confirmación no es válido o ya venció.
          </div>
        )}

        <button
          className="ql-btn-google"
          onClick={() => signIn("google", { callbackUrl: next })}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
          </svg>
          Continuar con Google
        </button>

        <div className="ql-divider"><span>o con tu correo</span></div>

        <form className="ql-form" onSubmit={handleSubmitPassword}>
          <input
            className="ql-input"
            type="email"
            placeholder="Correo electrónico"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="ql-input"
            type="password"
            placeholder="Contraseña"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="ql-alerta-error">{error}</div>}
          <button className="ql-btn-password" type="submit" disabled={enviando}>
            {enviando ? "Entrando..." : "Iniciar sesión"}
          </button>
          <div className="ql-links">
            <Link href="/registro">Crear cuenta</Link>
            <Link href="/olvide-password">Olvidé mi contraseña</Link>
          </div>
        </form>

        <div className="ql-chips">
          <span className="ql-chip">Sin tarjeta de crédito</span>
          <span className="ql-chip">Cancela cuando quieras</span>
        </div>

        <p className="ql-terminos">Al ingresar aceptas los <a href="/terminos" style={{ color: "#7F77DD", fontWeight: 600 }}>términos de uso</a></p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}