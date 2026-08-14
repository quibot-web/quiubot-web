"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPlantillasPublicitariasClient() {
  const router = useRouter();
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/plantillas-publicitarias");
      const data = await res.json();
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudieron cargar las plantillas pendientes.");
        return;
      }
      setPendientes(data.pendientes || []);
    } catch (e) {
      setErrorMsg("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const handleAprobar = async (id: string) => {
    setProcesando(id);
    try {
      const res = await fetch(`/api/admin/plantillas-publicitarias/${id}/aprobar`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "No se pudo aprobar la plantilla.");
        return;
      }
      cargar();
    } finally {
      setProcesando(null);
    }
  };

  const handleDescartar = async (id: string) => {
    setProcesando(id);
    try {
      const res = await fetch(`/api/admin/plantillas-publicitarias/${id}/descartar`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "No se pudo descartar la plantilla.");
        return;
      }
      cargar();
    } finally {
      setProcesando(null);
    }
  };

  const pageStyle = {
    minHeight: "100vh",
    background: "rgb(249, 249, 248)",
    fontFamily: "system-ui, sans-serif",
    padding: "2rem",
  };

  const containerStyle = {
    maxWidth: 800,
    margin: "0 auto",
  };

  const cardStyle = {
    background: "rgb(255, 255, 255)",
    border: "1px solid rgb(232, 232, 230)",
    borderRadius: 16,
    padding: "1.5rem",
  };

  const chipStyle = (bg: string, color: string) => ({
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 10px",
    borderRadius: 20,
    background: bg,
    color,
  });

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            onClick={() => router.push("/")}
            style={{ background: "none", border: "none", color: "rgb(127, 119, 221)", fontSize: 14, cursor: "pointer", padding: 0 }}
          >
            Volver al panel principal
          </button>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "rgb(26, 26, 26)" }}>
          Plantillas publicitarias - Revision pendiente
        </h1>
        <p style={{ fontSize: 13, color: "rgb(153, 153, 153)", marginBottom: "1.5rem" }}>
          Plantillas nuevas o actualizadas detectadas automaticamente, esperando tu aprobacion.
        </p>

        {cargando && (
          <div style={cardStyle}>
            <p style={{ color: "rgb(153, 153, 153)", fontSize: 14, textAlign: "center", margin: 0 }}>
              Cargando...
            </p>
          </div>
        )}

        {!cargando && errorMsg && (
          <div style={cardStyle}>
            <p style={{ color: "rgb(153, 27, 27)", fontSize: 14, textAlign: "center" }}>{errorMsg}</p>
          </div>
        )}

        {!cargando && !errorMsg && pendientes.length === 0 && (
          <div style={{ ...cardStyle, textAlign: "center", padding: "2.5rem" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "rgb(26, 26, 26)", marginBottom: 8 }}>
              No hay plantillas pendientes
            </p>
            <p style={{ fontSize: 13, color: "rgb(102, 102, 102)", margin: 0 }}>
              Las plantillas publicitarias estan al dia. Vuelve a revisar despues de la proxima actualizacion.
            </p>
          </div>
        )}

        {!cargando && !errorMsg && pendientes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {pendientes.map((p) => (
              <div key={p.id} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "rgb(26, 26, 26)" }}>
                      {p.nombre}
                    </div>
                    <div style={{ fontSize: 12, color: "rgb(153, 153, 153)", marginTop: 2 }}>
                      Version {p.version_activa?.version ?? "?"} a {p.version} . Fuente: {p.fuente}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      background: "rgb(254, 243, 199)",
                      color: "rgb(180, 83, 9)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Pendiente
                  </div>
                </div>

                {((p.aplica_a?.length ?? 0) > 0 || (p.objetivos?.length ?? 0) > 0) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                    {(p.aplica_a || []).map((a: string) => (
                      <span key={`aplica-${a}`} style={chipStyle("rgb(237, 233, 254)", "rgb(91, 33, 182)")}>
                        {a}
                      </span>
                    ))}
                    {(p.objetivos || []).map((o: string) => (
                      <span key={`obj-${o}`} style={chipStyle("rgb(224, 242, 254)", "rgb(3, 105, 161)")}>
                        {o}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div style={{ background: "rgb(254, 242, 242)", borderRadius: 10, padding: "0.9rem 1rem" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "rgb(153, 27, 27)", marginBottom: 6 }}>
                      Instrucciones actuales
                    </div>
                    <div style={{ fontSize: 12.5, color: "rgb(60, 60, 60)", lineHeight: 1.6 }}>
                      {p.version_activa?.instrucciones || "(sin version activa previa)"}
                    </div>
                  </div>
                  <div style={{ background: "rgb(240, 253, 244)", borderRadius: 10, padding: "0.9rem 1rem" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "rgb(21, 128, 61)", marginBottom: 6 }}>
                      Instrucciones propuestas
                    </div>
                    <div style={{ fontSize: 12.5, color: "rgb(60, 60, 60)", lineHeight: 1.6 }}>
                      {p.instrucciones}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => handleAprobar(p.id)}
                    disabled={procesando === p.id}
                    style={{
                      flex: 1,
                      background: "rgb(83, 74, 183)",
                      color: "rgb(255, 255, 255)",
                      border: "none",
                      padding: "10px 16px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: procesando === p.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {procesando === p.id ? "Procesando..." : "Aprobar y activar"}
                  </button>
                  <button
                    onClick={() => handleDescartar(p.id)}
                    disabled={procesando === p.id}
                    style={{
                      flex: 1,
                      background: "rgb(255, 255, 255)",
                      color: "rgb(102, 102, 102)",
                      border: "1px solid rgb(220, 220, 220)",
                      padding: "10px 16px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: procesando === p.id ? "not-allowed" : "pointer",
                    }}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
