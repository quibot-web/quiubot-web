"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CargandoQuiubotInline } from "@/app/components/CargandoQuiubot";

const TIPOS = [
  { id: "conversaciones_whatsapp", label: "Conversaciones de WhatsApp" },
  { id: "leads", label: "Leads (contactos)" },
];

type Fila = { tipo: string; costo_referencia_cop: number; actualizado_en: string };

export default function AdminCostosReferenciaClient() {
  const router = useRouter();
  const [config, setConfig] = useState<Fila[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const res = await fetch("/api/admin/costos-referencia");
    const data = await res.json();
    const filas: Fila[] = data.config ?? [];
    setConfig(filas);
    setValores(Object.fromEntries(filas.map((f) => [f.tipo, String(f.costo_referencia_cop)])));
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const guardar = async (tipo: string) => {
    setGuardandoId(tipo);
    try {
      const res = await fetch("/api/admin/costos-referencia", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, costo_referencia_cop: Number(valores[tipo]) }),
      });
      if (!res.ok) alert("No se pudo guardar el valor.");
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "#7F77DD", fontSize: 14, cursor: "pointer", marginBottom: 20, padding: 0 }}>
          ← Volver al panel principal
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: "#1a1a1a" }}>Costos de referencia</h1>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
          Lo que el wizard de Autopiloto usa para revisar si una meta es realista cuando el cliente no tiene su propio
          historial, ni hay suficientes clientes de Quiubot con datos para ese tipo todavía.
        </p>

        {cargando && <CargandoQuiubotInline />}

        {!cargando && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TIPOS.map((t) => {
              const guardando = guardandoId === t.id;
              const existe = config.some((c) => c.tipo === t.id);
              return (
                <div key={t.id} style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 12, padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>{t.label}</div>
                    {!existe && <div style={{ fontSize: 12, color: "#B3261E", marginTop: 2 }}>No configurado todavía</div>}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 10, color: "#999", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>COP por resultado</span>
                      <input
                        type="number"
                        min={1}
                        value={valores[t.id] ?? ""}
                        disabled={guardando}
                        onChange={(e) => setValores((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 12.5, fontWeight: 600, color: "#534AB7", background: "#fff", width: 130 }}
                      />
                    </label>

                    <button
                      onClick={() => guardar(t.id)}
                      disabled={guardando || !valores[t.id]}
                      style={{
                        flexShrink: 0,
                        background: "#534AB7",
                        color: "#fff",
                        border: "none",
                        padding: "8px 16px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: guardando ? "not-allowed" : "pointer",
                        minWidth: 90,
                        alignSelf: "flex-end",
                      }}
                    >
                      {guardando ? "..." : "Guardar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
