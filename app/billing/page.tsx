"use client"
import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

import { OBJETIVOS_INFO } from "@/app/lib/objetivosInfo"

const TU_WHATSAPP = "573122462312"

const LINKS_WOMPI: Record<string, string> = {
  crecimiento: "https://checkout.wompi.co/l/zIDoEZ",
  escala: "https://checkout.wompi.co/l/zTDsWF",
  crecimiento_anual: "https://checkout.wompi.co/l/Bhqrus",
  escala_anual: "https://checkout.wompi.co/l/Zqip25",
}

const DESCUENTO_ANUAL = 0.15
const ORDEN_PLANES = ["arranque", "crecimiento", "escala"]

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
      "Playbook vigilando todas tus campañas",
      "Alertas y sugerencias con prioridad",
    ],
  },
]

function PrecioAnimado({ valor }: { valor: number }) {
  const [mostrado, setMostrado] = useState(valor)
  const anteriorRef = useRef(valor)

  useEffect(() => {
    const inicio = anteriorRef.current
    const fin = valor
    if (inicio === fin) return
    const inicioTiempo = performance.now()
    const duracion = 450
    let raf = 0
    const paso = (ahora: number) => {
      const p = Math.min(1, (ahora - inicioTiempo) / duracion)
      const ease = 1 - Math.pow(1 - p, 3)
      setMostrado(Math.round(inicio + (fin - inicio) * ease))
      if (p < 1) {
        raf = requestAnimationFrame(paso)
      } else {
        anteriorRef.current = fin
      }
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor])

  return <>{mostrado.toLocaleString("es-CO")}</>
}

export default function BillingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [info, setInfo] = useState<BillingInfo | null>(null)
  const [ciclo, setCiclo] = useState<"mensual" | "anual">("mensual")
  const [objetivosActivos, setObjetivosActivos] = useState<string[]>([])
  const [planMinimoPorId, setPlanMinimoPorId] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch("/api/billing")
      .then(r => r.json())
      .then(setInfo)

    fetch("/api/objetivos-activos")
      .then(r => r.json())
      .then((data) => {
        setObjetivosActivos(data.activos ?? [])
        setPlanMinimoPorId(data.planMinimoPorId ?? {})
      })
      .catch(() => {})
  }, [])

  const objetivosDelPlan = (planId: string): string[] => {
    return OBJETIVOS_INFO
      .filter((o) => {
        if (!objetivosActivos.includes(o.id)) return false
        const planRequerido = planMinimoPorId[o.id] || "arranque"
        return ORDEN_PLANES.indexOf(planId) >= ORDEN_PLANES.indexOf(planRequerido)
      })
      .map((o) => o.label)
  }

  const formatFecha = (fecha: string | null) => {
    if (!fecha) return "—"
    return new Date(fecha).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })
  }

  const diasRestantes = (fecha: string | null) => {
    if (!fecha) return 0
    const diff = new Date(fecha).getTime() - new Date().getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const handlePagarMensual = (planId: "crecimiento" | "escala", planNombre: string) => {
    window.open(LINKS_WOMPI[planId], "_blank")
    const mensaje = encodeURIComponent(
      `Hola, ya voy a pagar el plan ${planNombre} (mensual) de Quiubot. Mi correo es ${session?.user?.email || ""}`
    )
    window.open(`https://wa.me/${TU_WHATSAPP}?text=${mensaje}`, "_blank")
  }

  const handlePagarAnual = (planId: "crecimiento" | "escala", planNombre: string, totalAnual: number) => {
    window.open(LINKS_WOMPI[`${planId}_anual`], "_blank")
    const mensaje = encodeURIComponent(
      `Hola, ya voy a pagar el plan ${planNombre} ANUAL de Quiubot (con 15% de descuento), por $${totalAnual.toLocaleString("es-CO")} facturado una vez al año. Mi correo es ${session?.user?.email || ""}`
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

        <div style={{ marginTop: "1rem", marginBottom: "1.5rem" }}>
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

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <div style={{ display: "inline-flex", background: "#fff", border: "1px solid #e8e8e6", borderRadius: 999, padding: 4, gap: 2 }}>
            <button
              onClick={() => setCiclo("mensual")}
              style={{
                padding: "9px 20px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontSize: 13.5,
                fontWeight: 600,
                background: ciclo === "mensual" ? "#534AB7" : "transparent",
                color: ciclo === "mensual" ? "#fff" : "#666",
                transition: "background .15s ease, color .15s ease",
              }}
            >
              Mensual
            </button>
            <button
              onClick={() => setCiclo("anual")}
              style={{
                padding: "9px 20px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontSize: 13.5,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: ciclo === "anual" ? "#534AB7" : "transparent",
                color: ciclo === "anual" ? "#fff" : "#666",
                transition: "background .15s ease, color .15s ease",
              }}
            >
              Anual
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: ciclo === "anual" ? "rgba(255,255,255,0.22)" : "#dcfce7",
                  color: ciclo === "anual" ? "#fff" : "#15803d",
                }}
              >
                -15%
              </span>
            </button>
          </div>
        </div>
        <p style={{ textAlign: "center", fontSize: 12.5, color: "#999", marginBottom: 28 }}>
          {ciclo === "anual"
            ? "Pagas una vez al año, tu precio queda congelado los 12 meses."
            : "Cambia a anual cuando quieras y ahorra cerca de 2 meses de plan."}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, alignItems: "start" }}>
          {PLANES.map((plan) => {
            const esPlanActual = plan.id === info.plan
            const destacarComoPopular = plan.masElegido && !esPlanActual
            const esAnual = ciclo === "anual" && plan.precio > 0
            const totalAnual = Math.round(plan.precio * 12 * (1 - DESCUENTO_ANUAL))
            const mensualEquivalente = Math.round(totalAnual / 12)
            const ahorroAnual = plan.precio * 12 - totalAnual
            const precioMostrado = esAnual ? mensualEquivalente : plan.precio
            const objetivosIncluidos = objetivosDelPlan(plan.id)

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

                <div style={{ marginBottom: 2, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color: "#1a1a1a" }}>
                    {plan.precio === 0 ? "Gratis" : <>${<PrecioAnimado valor={precioMostrado} />}</>}
                  </span>
                  {plan.precio > 0 && <span style={{ fontSize: 14, color: "#999" }}>/mes</span>}
                  {esAnual && (
                    <span style={{ fontSize: 14, color: "#bbb", textDecoration: "line-through" }}>
                      ${plan.precio.toLocaleString("es-CO")}
                    </span>
                  )}
                </div>

                {plan.precio > 0 ? (
                  esAnual ? (
                    <div style={{ margin: "0 0 14px" }}>
                      <p style={{ fontSize: 12, color: "#999", margin: "0 0 8px" }}>
                        ${totalAnual.toLocaleString("es-CO")} facturado una vez al año
                      </p>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#dcfce7", color: "#15803d", fontSize: 12.5, fontWeight: 700, padding: "5px 12px", borderRadius: 999 }}>
                        🎉 Ahorras ${ahorroAnual.toLocaleString("es-CO")} al año
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: "#999", margin: "0 0 20px" }}>
                      Menos de ${Math.round(plan.precio / 30).toLocaleString("es-CO")} al día
                    </p>
                  )
                ) : (
                  <p style={{ fontSize: 12, color: "#999", margin: "0 0 20px" }}>Para siempre, sin tarjeta</p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, marginTop: esAnual ? 14 : 0 }}>
                  {objetivosIncluidos.length > 0 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#333" }}>
                      <span style={{ color: "#10b981", fontWeight: 700, flexShrink: 0 }}>✓</span>
                      <span>
                        {objetivosIncluidos.length === OBJETIVOS_INFO.filter((o) => objetivosActivos.includes(o.id)).length
                          ? "Todos los objetivos publicitarios activos"
                          : `Objetivos: ${objetivosIncluidos.join(", ")}`}
                      </span>
                    </div>
                  )}
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#333" }}>
                      <span style={{ color: "#10b981", fontWeight: 700, flexShrink: 0 }}>✓</span>
                      {f}
                    </div>
                  ))}
                  {esAnual && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#333" }}>
                      <span style={{ color: "#534AB7", fontWeight: 700, flexShrink: 0 }}>🔒</span>
                      Precio congelado por 12 meses, aunque suban las tarifas
                    </div>
                  )}
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
                    onClick={() =>
                      esAnual
                        ? handlePagarAnual(plan.id as "crecimiento" | "escala", plan.nombre, totalAnual)
                        : handlePagarMensual(plan.id as "crecimiento" | "escala", plan.nombre)
                    }
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
                    💳 {info.plan === "arranque" ? "Mejorar a" : "Cambiar a"} {plan.nombre}{esAnual ? " · Anual" : ""}
                  </button>
                )}
                {esAnual && !esPlanActual && plan.id !== "arranque" && (
                  <p style={{ fontSize: 10.5, color: "#bbb", textAlign: "center", marginTop: 8 }}>
                    Pago anual único, sin reembolsos — te llevará a la pasarela de pago segura de Wompi.
                  </p>
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