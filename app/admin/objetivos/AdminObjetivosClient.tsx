"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OBJETIVOS_INFO } from "@/app/lib/objetivosInfo";

export default function AdminObjetivosClient() {
  const router = useRouter();
  const [config, setConfig] = useState<{ id: string; activo: boolean }[]>([]);
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

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "#7F77DD", fontSize: 14, cursor: "pointer", marginBottom: 20, padding: 0 }}>
          ← Volver al panel principal
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: "#1a1a1a" }}>Objetivos publicitarios</h1>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
          Activa o desactiva cada objetivo para los usuarios. Mientras un objetivo este desactivado, solo los administradores podran probarlo en el Motor de Estrategia.
        </p>

        {cargando && <p style={{ color: "#666", fontSize: 13 }}>Cargando...</p>}

        {!cargando && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {OBJETIVOS_INFO.map((info) => {
              const item = config.find((c) => c.id === info.id);
              const activo = item?.activo ?? true;
              const guardando = guardandoId === info.id;
              return (
                <div key={info.id} style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 12, padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>{info.label}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{info.desc}</div>
                  </div>
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
                      minWidth: 110,
                    }}
                  >
                    {guardando ? "..." : activo ? "Activo" : "Inactivo"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}