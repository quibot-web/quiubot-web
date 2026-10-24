"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import CargandoQuiubot from "@/app/components/CargandoQuiubot";
import FilaMeta, { TIPO_LABEL } from "@/app/components/FilaMeta";
import type { AvanceMeta, Meta } from "@/app/lib/metas";

type ItemMeta = { meta: Meta; avance: AvanceMeta | null };

const ESTADO_LABEL: Record<string, string> = {
  cancelada: "Cancelada",
  vencida: "Vencida",
  cumplida: "Cumplida",
};

export default function MetasPage() {
  const router = useRouter();
  const [puedeUsarAutopiloto, setPuedeUsarAutopiloto] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);
  const [activas, setActivas] = useState<ItemMeta[]>([]);
  const [terminadas, setTerminadas] = useState<Meta[]>([]);

  useEffect(() => {
    fetch("/api/usuario/rol")
      .then((r) => r.json())
      .then((data) => setPuedeUsarAutopiloto(!!data.tieneAutopiloto))
      .catch(() => setPuedeUsarAutopiloto(false));
  }, []);

  useEffect(() => {
    if (!puedeUsarAutopiloto) return;
    Promise.all([
      fetch("/api/metas").then((r) => (r.ok ? r.json() : { metas: [] })),
      fetch("/api/metas/historial").then((r) => (r.ok ? r.json() : { metas: [] })),
    ])
      .then(([activasData, terminadasData]) => {
        setActivas(activasData.metas ?? []);
        setTerminadas(terminadasData.metas ?? []);
      })
      .finally(() => setCargando(false));
  }, [puedeUsarAutopiloto]);

  if (puedeUsarAutopiloto === null || (puedeUsarAutopiloto && cargando)) {
    return <CargandoQuiubot mensaje="Cargando tus metas" />;
  }

  if (puedeUsarAutopiloto === false) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 20, border: "1px solid #e8e8e6", padding: "2.5rem 2rem", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F3F2FE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
            <Clock size={28} color="#534AB7" strokeWidth={2} aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px" }}>Autopiloto — Próximamente</h1>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 24px" }}>
            Todavía estamos puliendo Autopiloto. Muy pronto lo abrimos para todos.
          </p>
          <button
            onClick={() => router.push("/")}
            style={{ display: "block", width: "100%", padding: "13px", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}
          >
            Volver al panel principal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2rem 1.25rem" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Metas</h1>
          <button
            onClick={() => router.push("/metas/crear")}
            style={{ padding: "11px 20px", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}
          >
            + Nueva meta
          </button>
        </div>

        {activas.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1.5rem", marginBottom: 24, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#666", margin: 0 }}>Todavía no tienes ninguna meta activa.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
            {activas.map(({ meta, avance }) => (
              <FilaMeta
                key={meta.id}
                meta={meta}
                avance={avance}
                onCambio={(metaActualizada) => {
                  if (metaActualizada.estado !== "activa") {
                    setActivas((prev) => prev.filter((it) => it.meta.id !== metaActualizada.id));
                    setTerminadas((prev) => [metaActualizada, ...prev]);
                  } else {
                    setActivas((prev) => prev.map((it) => (it.meta.id === metaActualizada.id ? { ...it, meta: metaActualizada } : it)));
                  }
                }}
              />
            ))}
          </div>
        )}

        {terminadas.length > 0 && (
          <>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#666", margin: "0 0 12px" }}>Terminadas</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {terminadas.map((meta) => (
                <div key={meta.id} style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.75 }}>
                  <span style={{ fontSize: 13.5, color: "#1a1a1a" }}>
                    {meta.cantidad_objetivo} {TIPO_LABEL[meta.tipo] || meta.tipo} · {meta.fecha_inicio} a {meta.fecha_fin}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#888" }}>
                    {ESTADO_LABEL[meta.estado] || meta.estado}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
