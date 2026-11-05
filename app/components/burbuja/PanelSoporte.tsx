"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import { urlWhatsappSoporte } from "@/app/lib/contacto";

type Mensaje = {
  rol: "user" | "assistant";
  mensaje: string;
};

export default function PanelSoporte({
  activo,
  historialInicial,
  autoenviar,
  onConsumidoAutoenviar,
  onIrADirector,
}: {
  activo: boolean;
  historialInicial: Mensaje[];
  autoenviar: string | null;
  onConsumidoAutoenviar: () => void;
  onIrADirector: (pregunta: string) => void;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(historialInicial);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [escalar, setEscalar] = useState(false);
  const [preguntaEscalada, setPreguntaEscalada] = useState("");
  const [redirigir, setRedirigir] = useState(false);
  const [ultimaPregunta, setUltimaPregunta] = useState("");
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function enviar(contenido: string) {
    const mensaje = contenido.trim();
    if (!mensaje || enviando) return;

    setMensajes((prev) => [...prev, { rol: "user", mensaje }]);
    setTexto("");
    setEnviando(true);
    setEscalar(false);
    setRedirigir(false);
    setUltimaPregunta(mensaje);

    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMensajes((prev) => [...prev, { rol: "assistant", mensaje: data.error || "Algo salió mal, intenta de nuevo." }]);
      } else {
        setMensajes((prev) => [...prev, { rol: "assistant", mensaje: data.respuesta }]);
        if (data.escalar) {
          setEscalar(true);
          setPreguntaEscalada(mensaje);
        }
        if (data.redirigirADirector) setRedirigir(true);
      }
    } catch {
      setMensajes((prev) => [...prev, { rol: "assistant", mensaje: "No se pudo conectar. Intenta de nuevo en un momento." }]);
    } finally {
      setEnviando(false);
    }
  }

  // Handoff desde el Director (Paso 4, acción "ir_a_soporte") -- llega
  // con la pregunta ya escrita y se manda sola, una sola vez.
  useEffect(() => {
    if (!autoenviar) return;
    // setTimeout(0): el enviar() real queda en un callback, no en el
    // cuerpo síncrono del efecto (react-hooks/set-state-in-effect).
    const id = setTimeout(() => {
      enviar(autoenviar);
      onConsumidoAutoenviar();
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoenviar]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {!activo ? (
          <div style={{ background: "#f5f4fb", border: "1px solid #e3e1f7", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#444", textAlign: "center" }}>
            Para activar el asistente, conecta tu cuenta de OpenAI en{" "}
            <Link href="/?tab=integraciones" style={{ color: "#7F77DD", fontWeight: 600 }}>
              Integraciones
            </Link>
            .
          </div>
        ) : mensajes.length === 0 ? (
          <div style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 20 }}>Pregúntame lo que necesites sobre Quiubot.</div>
        ) : (
          mensajes.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", alignSelf: m.rol === "user" ? "flex-end" : "flex-start" }}>
              {m.rol === "assistant" && <EsferaAsistente asistente="soporte" estado="normal" tamano={26} />}
              <div
                style={{
                  background: m.rol === "user" ? "#7F77DD" : "#f2f2f0",
                  color: m.rol === "user" ? "#fff" : "#1a1a1a",
                  padding: "8px 12px",
                  borderRadius: 12,
                  fontSize: 13,
                  maxWidth: "80%",
                  lineHeight: 1.4,
                }}
              >
                {m.mensaje}
              </div>
            </div>
          ))
        )}

        {escalar && (
          <div style={{ background: "#fff7e6", border: "1px solid #ffe1a8", borderRadius: 12, padding: "10px 12px", fontSize: 12, color: "#7a5c00", textAlign: "center" }}>
            Esto es mejor resolverlo con el equipo directamente.{" "}
            <a href={urlWhatsappSoporte(preguntaEscalada)} target="_blank" rel="noreferrer" style={{ color: "#7a5c00", fontWeight: 700, textDecoration: "underline" }}>
              Escríbenos por WhatsApp
            </a>
          </div>
        )}

        {redirigir && (
          <div style={{ alignSelf: "flex-start", background: "#F3F2FE", border: "1.5px solid #534AB7", borderRadius: 12, padding: "10px 12px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "#1a1a1a" }}>Esto es sobre tu cuenta -- mejor te responde el Director.</p>
            <button
              onClick={() => onIrADirector(ultimaPregunta)}
              style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
            >
              Hablar con el Director →
            </button>
          </div>
        )}

        <div ref={finRef} />
      </div>

      {activo && (
        <div style={{ display: "flex", borderTop: "1px solid #eee", padding: 10, gap: 8 }}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviar(texto)}
            placeholder="Escribe tu pregunta..."
            disabled={enviando}
            style={{ flex: 1, border: "1px solid #e0e0e0", borderRadius: 10, padding: "8px 12px", fontSize: 13, outline: "none" }}
          />
          <button
            onClick={() => enviar(texto)}
            disabled={enviando || !texto.trim()}
            style={{
              background: "#7F77DD",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: enviando ? "default" : "pointer",
              opacity: enviando || !texto.trim() ? 0.6 : 1,
            }}
          >
            {enviando ? "..." : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}
