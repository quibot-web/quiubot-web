"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";

const COLOR_ACTIVO = "#534AB7";

type Props = {
  pasos: string[];
  activo: boolean;
  completado?: boolean;
  duracionEstimadaMs?: number;
  tituloEnCurso: string;
  tituloFinal?: string;
  nota?: string;
};

// Checklist de progreso simulado: como no tenemos eventos reales del
// backend paso a paso, distribuimos el tiempo estimado entre los pasos
// (avance rápido al inicio, que se siente bien; el último paso queda
// "abierto"). Si la operación real tarda más de lo estimado, el último
// paso entra en un modo "sigue trabajando" (glow que respira + spinner +
// puntos suspensivos) en vez de quedarse quieto — evita la sensación de
// que la app se congeló. Si `completado` llega en true antes de que el
// timer simulado termine, salta directo a todo marcado.
export default function ProgresoPasos({
  pasos,
  activo,
  completado = false,
  duracionEstimadaMs = 20000,
  tituloEnCurso,
  tituloFinal = "¡Listo!",
  nota,
}: Props) {
  const [pasoActual, setPasoActual] = useState(-1);
  const [puntos, setPuntos] = useState(".");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!activo) {
      setPasoActual(-1);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      return;
    }
    setPasoActual(0);
    const pesos = pasos.map((_, i) => (i === 0 ? 0.55 : 1));
    const totalPeso = pesos.reduce((a, b) => a + b, 0);
    let acumulado = 0;
    pasos.forEach((_, i) => {
      if (i === 0) return;
      acumulado += (pesos[i] / totalPeso) * duracionEstimadaMs;
      const t = setTimeout(() => setPasoActual(i), acumulado);
      timersRef.current.push(t);
    });
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  useEffect(() => {
    if (completado) {
      timersRef.current.forEach(clearTimeout);
      setPasoActual(pasos.length);
    }
  }, [completado, pasos.length]);

  const sintetizando = activo && pasoActual >= pasos.length - 1 && !completado;

  useEffect(() => {
    if (!sintetizando) return;
    const secuencia = [".", "..", "..."];
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % secuencia.length;
      setPuntos(secuencia[i]);
    }, 450);
    return () => clearInterval(id);
  }, [sintetizando]);

  if (!activo) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2.5rem 1rem" }}>
      <div className="spinner-estrategia" style={{ marginBottom: 20 }}></div>

      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 20 }}>
        {sintetizando && <Loader2 size={13} color={COLOR_ACTIVO} strokeWidth={2.5} className="progreso-spin" />}
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: COLOR_ACTIVO, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
          {completado ? tituloFinal : sintetizando ? `${tituloEnCurso}${puntos}` : tituloEnCurso}
        </span>
      </div>

      <div
        className={sintetizando ? "progreso-checklist-vivo" : undefined}
        style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 280, borderRadius: 14 }}
      >
        {pasos.map((texto, i) => {
          const pasoCompletado = i < pasoActual || completado;
          const actual = i === pasoActual && !completado;
          const visible = pasoCompletado || actual;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: visible ? 1 : 0.3,
                transform: visible ? "translateX(0)" : "translateX(-8px)",
                transition: "opacity .45s ease, transform .45s ease",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: pasoCompletado ? COLOR_ACTIVO : "#fff",
                  border: `1.5px solid ${visible ? COLOR_ACTIVO : "#ddd"}`,
                  transition: "background .3s ease, border-color .3s ease",
                  animation: sintetizando ? `progreso-ola 2.2s ease-in-out ${i * 0.12}s infinite` : undefined,
                }}
              >
                {pasoCompletado && <Check size={11} color="#fff" strokeWidth={3} />}
                {actual && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLOR_ACTIVO, animation: "progreso-pulse 1s ease-in-out infinite" }} />
                )}
              </span>
              <span style={{ fontSize: 13, color: pasoCompletado ? "#1a1a1a" : actual ? COLOR_ACTIVO : "#999", fontWeight: actual ? 600 : 500 }}>
                {texto}
              </span>
            </div>
          );
        })}
      </div>

      {nota && <p style={{ marginTop: 20, color: "#999", fontSize: 12, textAlign: "center", maxWidth: 320 }}>{nota}</p>}

      <style>{`
        @keyframes progreso-spin { to { transform: rotate(360deg); } }
        .progreso-spin { animation: progreso-spin .9s linear infinite; }
        @keyframes progreso-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
        @keyframes progreso-respirar {
          0%, 100% { box-shadow: 0 0 0 0 rgba(83,74,183,0); }
          50% { box-shadow: 0 0 26px 6px rgba(83,74,183,0.14); }
        }
        .progreso-checklist-vivo { animation: progreso-respirar 2.6s ease-in-out infinite; }
        @keyframes progreso-ola { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
      `}</style>
    </div>
  );
}