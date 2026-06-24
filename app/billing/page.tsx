"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

export default function BillingPage() {
  const { data: session } = useSession()
  const [info, setInfo] = useState<{ activo: boolean; fecha_vencimiento: string | null; fecha_pago: string | null } | null>(null)

  useEffect(() => {
    fetch("/api/billing")
      .then(r => r.json())
      .then(setInfo)
  }, [])

  const formatFecha = (fecha: string | null) => {
    if (!fecha) return "—"
    return new Date(fecha).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })
  }

  const diasRestantes = () => {
    if (!info?.fecha_vencimiento) return 0
    const diff = new Date(info.fecha_vencimiento).getTime() - new Date().getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const waMensaje = `Hola, ya realicé el pago de Quiubot Pro. Mi correo es ${session?.user?.email}`

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <a href="/" style={{ color: "#7F77DD", textDecoration: "none", fontSize: 14 }}>← Volver</a>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: "1.5rem", color: "#1a1a1a" }}>Mi plan</h1>

        {info === null && (
          <div style={{ color: "#999", fontSize: 14 }}>Cargando...</div>
        )}

        {info !== null && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 16, padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>Plan Pro</div>
                  <div style={{ fontSize: 13, color: "#999", marginTop: 2 }}>$50 USD / mes</div>
                </div>
                <div style={{ padding: "4px 12px", borderRadius: 20, background: info.activo ? "#dcfce7" : "#fee2e2", color: info.activo ? "#15803d" : "#dc2626", fontSize: 12, fontWeight: 600 }}>
                  {info.activo ? "● Activo" : "● Inactivo"}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#f9f9f8", borderRadius: 10, padding: "0.75rem 1rem" }}>
                  <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>Último pago</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{formatFecha(info.fecha_pago)}</div>
                </div>
                <div style={{ background: "#f9f9f8", borderRadius: 10, padding: "0.75rem 1rem" }}>
                  <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>Vence el</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{formatFecha(info.fecha_vencimiento)}</div>
                </div>
              </div>
              {info.activo && (
                <div style={{ marginTop: 12, padding: "0.75rem 1rem", background: "#f3f2fe", borderRadius: 10, fontSize: 13, color: "#534AB7" }}>
                  Te quedan <strong>{diasRestantes()} días</strong> de acceso
                </div>
              )}
            </div>

            <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 16, padding: "1.5rem" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>
                {info.activo ? "Renovar plan" : "Activar plan"}
              </div>
              <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
                {info.activo ? "Renueva antes de que venza para no perder el acceso." : "Activa tu plan para empezar a generar imágenes publicitarias con IA."}
              </p>
              <a href="https://checkout.wompi.co/l/gcYZn4" target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "#7F77DD", color: "#fff", padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
                {info.activo ? "💳 Renovar — $50 USD" : "💳 Pagar — $50 USD"}
              </a>
              <p style={{ fontSize: 11, color: "#aaa", marginTop: 8, textAlign: "center" }}>
                Tu acceso se activa manualmente en menos de 24 horas hábiles
              </p>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 16, padding: "1.5rem" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>¿Necesitas ayuda?</div>
              <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
                Si ya pagaste y tu cuenta no está activa, contáctanos.
              </p>
              <a href={"https://wa.me/573122462312?text=" + encodeURIComponent(waMensaje)} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "#25D366", color: "#fff", padding: "10px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
                💬 Contactar por WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}