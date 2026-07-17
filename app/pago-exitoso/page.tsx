"use client"

const TU_WHATSAPP = "573122462312"

export default function PagoExitosoPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ maxWidth: 440, width: "100%", background: "#fff", borderRadius: 20, border: "1px solid #e8e8e6", padding: "2.5rem 2rem", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#dcfce7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px" }}>
          ¡Gracias por tu pago!
        </h1>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 4px" }}>
          Ya recibimos tu confirmación de Wompi.
        </p>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 24px" }}>
          Tu acceso se activa manualmente en menos de <strong>24 horas hábiles</strong> — te avisamos por WhatsApp en cuanto esté listo.
        </p>

        <a
          href="/"
          style={{
            display: "block",
            width: "100%",
            padding: "13px",
            borderRadius: 10,
            background: "#534AB7",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            boxSizing: "border-box",
          }}
        >
          Volver a la app
        </a>

        <a
          href={"https://wa.me/" + TU_WHATSAPP + "?text=" + encodeURIComponent("Hola, ya realicé el pago de Quiubot y quería confirmarlo.")}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            width: "100%",
            padding: "12px",
            borderRadius: 10,
            border: "1px solid #e8e8e6",
            color: "#666",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            marginTop: 10,
            boxSizing: "border-box",
          }}
        >
          💬 Escribir por WhatsApp
        </a>
      </div>
    </div>
  )
}