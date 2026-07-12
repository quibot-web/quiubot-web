"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

function useContarHasta(valorFinal: number, activo: boolean) {
  const [valor, setValor] = useState(0);
  useEffect(() => {
    if (!activo) return;
    let inicio: number | null = null;
    const duracion = 900;
    const paso = (t: number) => {
      if (inicio === null) inicio = t;
      const progreso = Math.min((t - inicio) / duracion, 1);
      setValor(Math.round(valorFinal * (1 - Math.pow(1 - progreso, 3))));
      if (progreso < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }, [valorFinal, activo]);
  return valor;
}

function saludoSegunHora() {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function HomeInicio({ nombreUsuario }: { nombreUsuario: string }) {
  const router = useRouter();
  const [datos, setDatos] = useState<any | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch("/api/home-resumen")
      .then((r) => r.json())
      .then((data) => {
        setDatos(data);
        requestAnimationFrame(() => setVisible(true));
      })
      .catch(() => setDatos({ kpis: {}, pendientes: [], actividad_reciente: [], novedades: [] }));
  }, []);

  const gastoAnimado = useContarHasta(datos?.kpis?.gasto_activo ?? 0, visible);

  if (!datos) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "#999", fontSize: 13 }}>Cargando tu resumen...</div>;
  }

  const primerNombre = nombreUsuario?.split(" ")[0] || "";
  const totalPendientes = datos.pendientes.length;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem", display: "flex", flexDirection: "column", gap: 24 }}>

      <div>
        <h1 style={{ fontSize: 27, fontWeight: 600, margin: 0, color: "#1a1a1a", letterSpacing: "-0.5px" }}>
          {saludoSegunHora()}{primerNombre ? `, ${primerNombre}` : ""}
        </h1>
        <p style={{ fontSize: 14, color: "#666", margin: "6px 0 0" }}>
          {totalPendientes > 0
            ? `Tienes ${totalPendientes} ${totalPendientes === 1 ? "cosa que revisar" : "cosas que revisar"} — el resto lo está manejando Quiubot solo.`
            : "Todo está tranquilo. Quiubot sigue optimizando tus campañas en segundo plano."}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 14, padding: "1.1rem" }}>
          <p style={{ fontSize: 12, color: "#999", margin: "0 0 6px" }}>Gasto activo diario</p>
          <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#1a1a1a" }}>${gastoAnimado.toLocaleString("es-CO")}</p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 14, padding: "1.1rem" }}>
          <p style={{ fontSize: 12, color: "#999", margin: "0 0 6px" }}>CPA promedio (7 días)</p>
          <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: datos.kpis.cpa_promedio ? "#1a1a1a" : "#bbb" }}>
            {datos.kpis.cpa_promedio ? `$${Math.round(datos.kpis.cpa_promedio).toLocaleString("es-CO")}` : "Aún sin datos"}
          </p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 14, padding: "1.1rem" }}>
          <p style={{ fontSize: 12, color: "#999", margin: "0 0 6px" }}>Campañas activas</p>
          <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#1a1a1a" }}>{datos.kpis.campanas_activas ?? 0}</p>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 16, padding: "1.5rem" }}>
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px", color: "#1a1a1a" }}>Decisiones pendientes</p>
        {datos.pendientes.length === 0 && (
          <p style={{ fontSize: 13, color: "#999", margin: 0 }}>No hay nada esperando tu revisión ahora mismo.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {datos.pendientes.map((n: any, i: number) => (
            <div
              key={n.id}
              onClick={() => n.campana_id && router.push(`/campanas?highlight=${n.campana_id}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: n.tipo === "alerta" ? "#fef2f2" : "#f3f2fe",
                cursor: n.campana_id ? "pointer" : "default",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(6px)",
                transition: `opacity 0.35s ease ${i * 70}ms, transform 0.35s ease ${i * 70}ms`,
              }}
            >
              <span style={{ fontSize: 18 }}>{n.tipo === "alerta" ? "🚨" : "💡"}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#1a1a1a" }}>{n.titulo}</p>
                <p style={{ fontSize: 12, color: "#666", margin: "2px 0 0" }}>{n.mensaje}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 16, padding: "1.5rem" }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", color: "#1a1a1a" }}>Actividad reciente</p>
          {datos.actividad_reciente.length === 0 && <p style={{ fontSize: 13, color: "#999", margin: 0 }}>Genera tu primera estrategia para ver actividad aquí.</p>}
          {datos.actividad_reciente.map((a: any) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <img src={a.url_imagen} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
              <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Creativo nuevo generado</p>
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 16, padding: "1.5rem" }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", color: "#1a1a1a" }}>Novedades de Quiubot</p>
          {datos.novedades.length === 0 && <p style={{ fontSize: 13, color: "#999", margin: 0 }}>Por ahora no hay novedades nuevas.</p>}
          {datos.novedades.map((n: any) => (
            <div key={n.id} style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#1a1a1a" }}>{n.titulo}</p>
              {n.descripcion && <p style={{ fontSize: 12, color: "#666", margin: "2px 0 0" }}>{n.descripcion}</p>}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}