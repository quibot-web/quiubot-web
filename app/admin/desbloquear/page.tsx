"use client"
import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function DesbloquearForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [password, setPassword] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/desbloquear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "No se pudo desbloquear.")
        return
      }
      const next = params.get("next") || "/admin/playbook"
      router.push(next)
      router.refresh()
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f9f9f8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 380,
          width: "100%",
          background: "#fff",
          border: "1px solid #e8e8e6",
          borderRadius: 20,
          padding: "2.25rem 2rem",
          boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "#f3f2fe",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>

        <h1 style={{ fontSize: 19, fontWeight: 700, color: "#1a1a1a", textAlign: "center", margin: "0 0 6px" }}>
          Panel de administrador
        </h1>
        <p style={{ fontSize: 13, color: "#666", textAlign: "center", margin: "0 0 22px", lineHeight: 1.5 }}>
          Esta sección tiene una contraseña propia, separada de tu cuenta.
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña de administrador"
          autoFocus
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #e0e0e0",
            fontSize: 14,
            marginBottom: 12,
            boxSizing: "border-box",
          }}
        />

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12.5,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={enviando || !password}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 10,
            border: "none",
            background: "#534AB7",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: enviando ? "default" : "pointer",
            opacity: enviando || !password ? 0.7 : 1,
          }}
        >
          {enviando ? "Verificando..." : "Desbloquear"}
        </button>

        <a href="/" style={{ display: "block", textAlign: "center", marginTop: 14, fontSize: 12.5, color: "#999", textDecoration: "none" }}>
          ← Volver a la app
        </a>
      </form>
    </div>
  )
}

export default function DesbloquearPage() {
  return (
    <Suspense fallback={null}>
      <DesbloquearForm />
    </Suspense>
  )
}