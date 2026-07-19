"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OBJETIVOS_INFO } from "@/app/lib/objetivosInfo";

const PLANES = [
  { id: "arranque", label: "Arranque" },
  { id: "crecimiento", label: "Crecimiento" },
  { id: "escala", label: "Escala" },
];

export default function AdminObjetivosClient() {
  const router = useRouter();
  const [config, setConfig] = useState<{ id: string; activo: boolean; plan_minimo?: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const res = await fetch("/api/admin/objetivos");
    const data = await res.json();
    setConfig(data.config ?? []);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const toggle = async (id: string, activoActual: boolean) => {
    setGuardandoId(id);
    try {
      const res = await fetch(`/api/admin/objetivos/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !activoActual }),
      });
      if (res.ok) {
        setConfig((prev) => prev.map((c) => (c.id === id ? { ...c, activo: !activoActual } : c)));
      } else {
        alert("No se pudo actualizar el objetivo.");
      }
    } finally {
      setGuardandoId(null);
    }
  };

  const cambiarPlanMinimo = async (id: string, nuevoPlan: string) => {
    setGuardandoId(id);
    try {
      const res = await fetch(`/api/admin/objetivos/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_minimo: nuevoPlan }),
      });
      if (res.ok) {
        setConfig((prev) => prev.map((c) => (c.id === id ? { ...c, plan_minimo: nuevoPlan } : c)));
      } else {
        alert("No se pudo actualizar el plan mínimo.");
      }
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
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: "#1a1a1a" }}>Objetivos publicitarios</h1>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
          Activa o desactiva cada objetivo, y elige desde qué plan queda disponible. Mientras un objetivo esté desactivado, solo los administradores podrán probarlo en el Motor de Estrategia.
        </p>

        {cargando && <p style={{ color: "#666", fontSize: 13 }}>Cargando...</p>}

        {!cargando && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {OBJETIVOS_INFO.map((info) => {
              const item = config.find((c) => c.id === info.id);
              const activo = item?.activo ?? true;
              const planMinimo = item?.plan_minimo ?? "arranque";
              const guardando = guardandoId === info.id;
              return (
                <div key={info.id} style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 12, padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>{info.label}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{info.desc}</div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 10, color: "#999", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Plan mínimo</span>
                      <select
                        value={planMinimo}
                        disabled={guardando}
                        onChange={(e) => cambiarPlanMinimo(info.id, e.target.value)}
                        style={{
                          padding: "7px 10px",
                          borderRadius: 8,
                          border: "1px solid #e0e0e0",
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "#534AB7",
                          background: "#fff",
                          cursor: guardando ? "not-allowed" : "pointer",
                        }}
                      >
                        {PLANES.map((p) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                    </label>

                    <button
                      onClick={() => toggle(info.id, activo)}
                      disabled={guardando}
                      style={{
                        flexShrink: 0,
                        background: activo ? "#10b981" : "#e5e7eb",
                        color: activo ? "#fff" : "#666",
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
                      {guardando ? "..." : activo ? "Activo" : "Inactivo"}
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