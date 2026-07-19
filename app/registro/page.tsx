"use client"
import { useState } from "react"
import Link from "next/link"

export default function RegistroPage() {
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "No se pudo crear la cuenta.")
        return
      }
      setEnviado(true)
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="ql-page">
      <style>{`
        .ql-page { min-height: 100vh; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; padding: 2rem; background: #f9f9f8; }
        .ql-blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.32; z-index: 0; }
        .ql-blob-a { width: 440px; height: 440px; background: #7F77DD; top: -160px; left: -140px; animation: qlBlobMove 15s ease-in-out infinite; }
        .ql-blob-b { width: 380px; height: 380px; background: #1FA97C; bottom: -160px; right: -140px; animation: qlBlobMove 19s ease-in-out infinite reverse; }
        @keyframes qlBlobMove { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px, 40px) scale(1.08); } }
        .ql-card { position: relative; z-index: 1; background: #fff; border: 1px solid #ECE9F7; border-radius: 24px; padding: 2.5rem; display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 400px; box-shadow: 0 24px 60px rgba(74,63,174,0.14); }
        .ql-wordmark { font-size: 20px; font-weight: 700; color: #17152B; text-align: center; }
        .ql-wordmark .acc { color: #7F77DD; }
        .ql-input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #e0e0e0; font-size: 14px; box-sizing: border-box; font-family: inherit; }
        .ql-btn { width: 100%; background: #534AB7; color: #fff; border: none; padding: 13px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .ql-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div className="ql-blob ql-blob-a" />
      <div className="ql-blob ql-blob-b" />

      <div className="ql-card">
        <div className="ql-wordmark">quiu<span className="acc">bot</span></div>

        {enviado ? (
          <>
            <p style={{ textAlign: "center", fontSize: 14, color: "#333", lineHeight: 1.6, margin: "8px 0" }}>
              📩 Revisa tu correo — te enviamos un enlace para confirmar tu cuenta. Puede tardar unos minutos, y a veces cae en spam.
            </p>
            <Link href="/login" style={{ textAlign: "center", color: "#7F77DD", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              ← Volver a iniciar sesión
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#17152B", textAlign: "center", margin: 0 }}>Crea tu cuenta</p>

            <input className="ql-input" placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <input className="ql-input" type="email" placeholder="Correo electrónico" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="ql-input" type="password" placeholder="Contraseña (mín. 10 caracteres)" required value={password} onChange={(e) => setPassword(e.target.value)} />

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}>
                {error}
              </div>
            )}

            <button className="ql-btn" type="submit" disabled={enviando}>
              {enviando ? "Creando cuenta..." : "Crear cuenta"}
            </button>

            <p style={{ textAlign: "center", fontSize: 12.5, color: "#999", margin: 0 }}>
              ¿Ya tienes cuenta? <Link href="/login" style={{ color: "#7F77DD", fontWeight: 600 }}>Inicia sesión</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}