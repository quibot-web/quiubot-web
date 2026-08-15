"use client"

export default function CargandoQuiubot({ mensaje = "Cargando" }: { mensaje?: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <div className="cq-anillo" />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src="/marca/icono-quiubot.svg" alt="" width={30} height={30} className="cq-logo" />
        </div>
      </div>
      <p style={{ color: "#6B6478", fontSize: 13.5, fontWeight: 500, margin: 0 }}>{mensaje}...</p>
      <style>{`
        .cq-anillo { position: absolute; inset: 0; border-radius: 50%; border: 3px solid #ECE9F7; border-top-color: #7F77DD; animation: cqGiro 0.9s linear infinite; }
        .cq-logo { animation: cqPulso 1.6s ease-in-out infinite; }
        @keyframes cqGiro { to { transform: rotate(360deg); } }
        @keyframes cqPulso { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.12); opacity: .75; } }
        @media (prefers-reduced-motion: reduce) { .cq-anillo, .cq-logo { animation: none !important; } }
      `}</style>
    </div>
  )
}

export function CargandoQuiubotInline({ mensaje = "Cargando" }: { mensaje?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", justifyContent: "center" }}>
      <div style={{ position: "relative", width: 22, height: 22, flexShrink: 0 }}>
        <div className="cq-anillo-mini" />
      </div>
      <span style={{ color: "#6B6478", fontSize: 13.5, fontWeight: 500 }}>{mensaje}...</span>
      <style>{`
        .cq-anillo-mini { position: absolute; inset: 0; border-radius: 50%; border: 2.5px solid #ECE9F7; border-top-color: #7F77DD; animation: cqGiroMini 0.8s linear infinite; }
        @keyframes cqGiroMini { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .cq-anillo-mini { animation: none !important; } }
      `}</style>
    </div>
  )
}
