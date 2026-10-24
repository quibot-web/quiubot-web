"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import FilaMeta from "@/app/components/FilaMeta";
import type { AvanceMeta, Meta } from "@/app/lib/metas";

type ItemMeta = { meta: Meta; avance: AvanceMeta | null };

// Bloque "Mis metas" del Inicio -- se resuelve solo, sin depender del
// fetch compartido de home-resumen, porque /api/metas 403-ea a quien no
// tiene Autopiloto, así que para ese resto esta tarjeta simplemente no
// renderiza nada, igual que un bloque desconocido. Reemplaza a
// TarjetaMeta (una sola meta) -- ahora puede haber varias a la vez, una
// por tipo.
export default function ListaMisMetas() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<ItemMeta[]>([]);

  useEffect(() => {
    fetch("/api/metas")
      .then((r) => {
        if (!r.ok) throw new Error();
        setVisible(true);
        return r.json();
      })
      .then((data) => setItems(data.metas ?? []))
      .catch(() => setVisible(false))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return null;
  if (!visible) return null;

  if (items.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <EsferaAsistente asistente="director" estado="normal" tamano={64} />
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#1a1a1a" }}>Mis metas</p>
        </div>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px" }}>
          Todavía no tienes ninguna meta de Autopiloto activa.
        </p>
        <button
          onClick={() => router.push("/metas/crear")}
          style={{ padding: "10px 18px", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer" }}
        >
          Crear mi primera meta
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1.5rem" }}>
      <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px", color: "#1a1a1a" }}>Mis metas</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {items.map(({ meta, avance }) => (
          <FilaMeta
            key={meta.id}
            meta={meta}
            avance={avance}
            compacta
            onCambio={(metaActualizada) =>
              setItems((prev) => prev.map((it) => (it.meta.id === metaActualizada.id ? { ...it, meta: metaActualizada } : it)))
            }
          />
        ))}
      </div>
      <button
        onClick={() => router.push("/metas/crear")}
        style={{ marginTop: 18, padding: "10px 18px", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer" }}
      >
        + Nueva meta
      </button>
    </div>
  );
}
