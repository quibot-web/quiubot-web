"use client";
import { useRouter } from "next/navigation";
import { Sparkles, Bell } from "lucide-react";

type CreativoParcial = { url_imagen?: string; titulo?: string };

type Props = {
  completados: number;
  total: number | null;
  creativosListos: CreativoParcial[];
};

// Pantalla de espera para "crear creativos con IA" — el proceso puede
// tardar entre 46 segundos y 15 minutos según cuántos anuncios genere la
// estrategia, así que un checklist con tiempo estimado se sentiría falso
// en cualquiera de los dos extremos. En vez de simular avance, mostramos
// PROGRESO REAL (cuántos anuncios ya están listos, con su miniatura), y
// usamos psicología inversa: en vez de pedirle al usuario que espere,
// activamente le decimos que se vaya y le avisamos por notificación —
// convertimos la espera larga en una razón para confiar (estamos
// revisando cada imagen con cuidado), no en una fuente de ansiedad.
export default function EsperaCreativos({ completados, total, creativosListos }: Props) {
  const router = useRouter();
  const porcentaje = total ? Math.min(100, Math.round((completados / total) * 100)) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2.5rem 1rem", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F3F2FE", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Sparkles size={28} color="#534AB7" strokeWidth={2} className="espera-sparkle" aria-hidden="true" />
      </div>

      <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>
        Estamos creando tus anuncios con calma
      </h3>
      <p style={{ fontSize: 13, color: "#666", maxWidth: 420, lineHeight: 1.6, margin: "0 0 24px" }}>
        Cada imagen se genera, se audita, y se corrige de nuevo si tu logo o tu marca no quedaron bien — por eso no es
        instantáneo. Preferimos tardar unos minutos más a entregarte algo que no puedas usar.
      </p>

      {total ? (
        <div style={{ width: "100%", maxWidth: 320, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#534AB7", fontWeight: 600, marginBottom: 6 }}>
            <span>{completados} de {total} anuncios listos</span>
            <span>{porcentaje}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "#f0f0f0", overflow: "hidden", position: "relative" }}>
            <div style={{ height: "100%", width: `${porcentaje}%`, background: "#534AB7", borderRadius: 4, transition: "width .6s ease" }} />
            {completados === 0 && (
              <div className="espera-shimmer" style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "40%", background: "linear-gradient(90deg, transparent, rgba(83,74,183,0.35), transparent)" }} />
            )}
          </div>
        </div>
      ) : (
        <div className="spinner-estrategia" style={{ marginBottom: 24 }}></div>
      )}

      {creativosListos.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 28, maxWidth: 420 }}>
          {creativosListos.map((c, i) => (
            <div key={i} style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", border: "1px solid #e8e8e6", animation: "espera-aparecer .4s ease", flexShrink: 0 }}>
              {c.url_imagen ? (
                <img src={c.url_imagen} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "#F3F2FE" }} />
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "#F3F2FE", borderRadius: 14, padding: "16px 20px", maxWidth: 420, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Bell size={18} color="#534AB7" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <div style={{ textAlign: "left" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#3C3489", margin: "0 0 4px" }}>
            No hace falta que esperes aquí
          </p>
          <p style={{ fontSize: 12.5, color: "#534AB7", margin: "0 0 10px", lineHeight: 1.5 }}>
            Sigue con lo tuyo — te avisamos por notificación apenas estén listos, y puedes retomar justo donde vas.
          </p>
          <button
            onClick={() => router.push("/")}
            style={{ background: "#534AB7", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
          >
            Volver al panel — me avisan cuando esté
          </button>
        </div>
      </div>

      <style>{`
        @keyframes espera-sparkle-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .6; transform: scale(1.08); } }
        .espera-sparkle { animation: espera-sparkle-pulse 1.8s ease-in-out infinite; }
        @keyframes espera-aparecer { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes espera-shimmer-mover { from { left: -40%; } to { left: 100%; } }
        .espera-shimmer { animation: espera-shimmer-mover 1.3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}