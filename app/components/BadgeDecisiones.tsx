"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Pill reutilizable con el conteo de propuestas pendientes (lectura dual
// propuestas + notificaciones, vía /api/propuestas) -- admin-only: si la
// API no responde 200 (no-admin), no renderiza nada. Se usa junto a la
// campana de notificaciones y dentro de "Decisiones pendientes" del
// Inicio, cada uno con su propio fetch (el volumen es bajo, no vale la
// pena compartir estado entre dos puntos de la UI por esto).
export default function BadgeDecisiones({ compacto = false }: { compacto?: boolean }) {
  const router = useRouter();
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/propuestas")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setTotal((data.propuestas ?? []).length))
      .catch(() => setTotal(null));
  }, []);

  if (!total) return null;

  if (compacto) {
    return (
      <span
        onClick={() => router.push("/decisiones")}
        style={{
          position: "absolute",
          top: -2,
          left: -2,
          background: "#534AB7",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          borderRadius: "50%",
          width: 16,
          height: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid #fff",
          cursor: "pointer",
        }}
        title="Propuestas esperando tu decisión"
      >
        {total}
      </span>
    );
  }

  return (
    <button
      onClick={() => router.push("/decisiones")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#F3F2FE",
        border: "none",
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 14,
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
      }}
    >
      <span style={{ background: "#534AB7", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {total}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>
        {total === 1 ? "1 propuesta esperando tu decisión" : `${total} propuestas esperando tu decisión`}
      </span>
    </button>
  );
}
