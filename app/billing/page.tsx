"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const TU_WHATSAPP = "573122462312"

const LINKS_WOMPI: Record<string, string> = {
  crecimiento: "https://checkout.wompi.co/l/xUEbaU",
  escala: "https://checkout.wompi.co/l/4Ybupm",
}

type BillingInfo = {
  plan: string
  en_trial: boolean
  trial_termina_en: string | null
  fecha_vencimiento: string | null
  fecha_pago: string | null
}

const PLANES = [
  {
    id: "arranque",
    nombre: "Arranque",
    tagline: "Para probar si la publicidad te funciona.",
    precio: 0,
    features: [
      "1 estrategia nueva por mes",
      "Venta Directa y Tráfico/Mensajes",
      "Álbum de creativos con auditoría de marca",
      "Notificaciones informativas",
    ],
  },
  {
    id: "crecimiento",
    nombre: "Crecimiento",
    tagline: "Para dejar de revisar tus campañas a mano todos los días.",
    precio: 149900,
    features: [
      "4 estrategias nuevas por mes",
      "Todos los objetivos publicitarios",
      "Playbook vigilando 2 campañas",
      "Alertas y sugerencias inteligentes",
    ],
  },
  {
    id: "escala",
    nombre: "Escala",
    tagline: "Para que Quiubot vigile y ajuste todo mientras creces.",
    precio: 249900,
    masElegido: true,
    features: [
      "Estrategias nuevas ilimitadas",
      "Todos los objetivos publicitarios",
      "Playbook vigilando todas tus campañas",
      "Alertas y sugerencias con prioridad",
    ],
  },
]

export default function BillingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [info, setInfo] = useState<BillingInfo | null>(null)

  useEffect(() => {
    fetch("/api/billing")
      .then(r => r.json())
      .then(setInfo)
  }, [])

  const formatFecha = (fecha: string | null) => {
    if (!fecha) return "—"
    return new Date(fecha).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })
  }

  const diasRestantes = (fecha: string | null) => {
    if (!fecha) return 0
    const diff = new Date(fecha).getTime() - new Date().getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const handlePagar = (planId: "crecimiento" | "escala", planNombre: string) => {
    window.open(LINKS_WOMPI[planId], "_blank")
    const mensaje = encodeURIComponent(
      `Hola, ya voy a pagar el plan ${planNombre} de Quiubot. Mi correo es ${session?.user?.email || ""}`
    )
    window.open(`https://wa.me/${TU_WHATSAPP}?text=${mensaje}`, "_blank")
  }

  if (info === null) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9f9f8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#999", fontSize: 14 }}>Cargando...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <a href="/" style={{ color: "#7F77DD", textDecoration: "none", fontSize: 14 }}>← Volver</a>

        <div style={{ marginTop: "1rem", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Mi plan</h1>
          {info.en_trial ? (
            <p style={{ fontSize: 14, color: "#534AB7", marginTop: 6, background: "#f3f2fe", display: "inline-block", padding: "6px 14px", borderRadius: 20 }}>
              🎁 Estás en tu prueba de 7 días — termina el {formatFecha(info.trial_termina_en)} ({diasRestantes(info.trial_termina_en)} días restantes)
            </p>
          ) : (
            info.plan !== "arranque" && (
              <p style={{ fontSize: 13, color: "#999", marginTop: 6 }}>
                Último pago: {formatFecha(info.fecha_pago)} · Vence: {formatFecha(info.fecha_vencimiento)}
              </p>
            )
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, alignItems: "start" }}>
          {PLANES.map((plan) => {
            const esPlanActual = plan.id === info.plan
            const destacarComoPopular = plan.masElegido && !esPlanActual

            return (
              <div
                key={plan.id}
                style={{
                  background: "#fff",
                  borderRadius: 20,
                  padding: "2rem 1.75rem",
                  border: esPlanActual ? "2.5px solid #10b981" : destacarComoPopular ? "2.5px solid #534AB7" : "1px solid #e8e8e6",
                  boxShadow: esPlanActual ? "0 8px 30px rgba(16,185,129,0.15)" : destacarComoPopular ? "0 8px 30px rgba(83,74,183,0.18)" : "none",
                  transform: esPlanActual || destacarComoPopular ? "scale(1.03)" : "none",
                  position: "relative",
                }}
              >
                {esPlanActual && (
                  <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "#10b981", color: "#fff", fontSize: 12, fontWeight: 700, padding: "5px 16px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    ✓ Tu plan actual
                  </div>
                )}
                {destacarComoPopular && (
                  <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "#534AB7", color: "#fff", fontSize: 12, fontWeight: 700, padding: "5px 16px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    ⭐ Más elegido
                  </div>
                )}

                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: "8px 0 4px" }}>{plan.nombre}</h2>
                <p style={{ fontSize: 13, color: "#666", minHeight: 40, margin: "0 0 16px" }}>{plan.tagline}</p>

                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color: "#1a1a1a" }}>
                    {plan.precio === 0 ? "Gratis" : `$${plan.precio.toLocaleString("es-CO")}`}
                  </span>
                  {plan.precio > 0 && <span style={{ fontSize: 14, color: "#999" }}>/mes</span>}
                </div>
                {plan.precio > 0 ? (
                  <p style={{ fontSize: 12, color: "#999", margin: "0 0 20px" }}>
                    Menos de ${Math.round(plan.precio / 30).toLocaleString("es-CO")} al día
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: "#999", margin: "0 0 20px" }}>Para siempre, sin tarjeta</p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#333" }}>
                      <span style={{ color: "#10b981", fontWeight: 700, flexShrink: 0 }}>✓</span>
                      {f}
                    </div>
                  ))}
                </div>

                {esPlanActual ? (
                  <div style={{ width: "100%", padding: "13px", borderRadius: 10, background: "#f0fdf4", color: "#15803d", fontSize: 14, fontWeight: 700, textAlign: "center" }}>
                    Ya lo tienes activo
                  </div>
                ) : plan.id === "arranque" ? (
                  <div style={{ width: "100%", padding: "13px", borderRadius: 10, border: "1px solid #e8e8e6", color: "#999", fontSize: 13, textAlign: "center" }}>
                    Bajas automático al terminar tu plan pago
                  </div>
                ) : (
                  <button
                    onClick={() => handlePagar(plan.id as "crecimiento" | "escala", plan.nombre)}
                    style={{
                      width: "100%",
                      padding: "13px",
                      borderRadius: 10,
                      border: destacarComoPopular ? "none" : "1px solid #534AB7",
                      background: destacarComoPopular ? "#534AB7" : "#fff",
                      color: destacarComoPopular ? "#fff" : "#534AB7",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    💳 {info.plan === "arranque" ? "Mejorar a" : "Cambiar a"} {plan.nombre}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#999", marginTop: 20 }}>
          Tu acceso se activa manualmente en menos de 24 horas hábiles tras confirmar el pago.
        </p>

        <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 16, padding: "1.5rem", marginTop: 32, maxWidth: 500, marginLeft: "auto", marginRight: "auto" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>¿Necesitas ayuda?</div>
          <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
            Si ya pagaste y tu cuenta no está activa, contáctanos.
          </p>
          <a
            href={"https://wa.me/" + TU_WHATSAPP + "?text=" + encodeURIComponent(`Hola, ya realicé el pago de Quiubot. Mi correo es ${session?.user?.email}`)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "block", background: "#25D366", color: "#fff", padding: "10px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}
          >
            💬 Contactar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}