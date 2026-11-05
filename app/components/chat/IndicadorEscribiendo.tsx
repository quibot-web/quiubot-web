"use client";
// Burbuja "escribiendo..." con la esfera de quien responde -- tres
// puntos animados, mismo estilo visual que las burbujas normales del
// chat.
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { AsistenteId } from "@/app/components/esferas/esferasShared";

export default function IndicadorEscribiendo({ asistente }: { asistente: AsistenteId }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <style>{`
        @keyframes qbPunto { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }
      `}</style>
      <EsferaAsistente asistente={asistente} estado="trabajando" tamano={26} />
      <div style={{ background: "#f2f2f0", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{ width: 6, height: 6, borderRadius: "50%", background: "#999", animation: "qbPunto 1.2s infinite", animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
