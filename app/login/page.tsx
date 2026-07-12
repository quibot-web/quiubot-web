"use client"
import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 20, padding: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, width: "100%", maxWidth: 380, boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>

        <img src="/marca/icono-quiubot.svg" alt="" width={64} height={64} style={{ borderRadius: 16 }} />

        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.5px", color: "#1a1a1a" }}>
          quiu<span style={{ color: "#7F77DD" }}>bot</span>
        </div>

        <p style={{ color: "#666", fontSize: 14, textAlign: "center", margin: 0 }}>
          Genera estrategia, creativos y campañas con IA — mientras Quiubot vigila y ajusta todo por ti.
        </p>

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            background: "#fff",
            border: "1px solid #e0e0e0",
            color: "#1a1a1a",
            fontWeight: 600,
            fontSize: 14,
            padding: "13px",
            borderRadius: 12,
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
          </svg>
          Continuar con Google
        </button>

        <p style={{ color: "#aaa", fontSize: 11, textAlign: "center", margin: 0 }}>
          Al ingresar aceptas los términos de uso
        </p>
      </div>
    </div>
  )
}