"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CampanasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [campanas, setCampanas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [modoDemo, setModoDemo] = useState(false);
  const [campanaResaltada, setCampanaResaltada] = useState<string | null>(null);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const CAMPANAS_DEMO = [
    {
      id: "demo_1",
      nombre: "Venta directa - Deseo y urgencia",
      objetivo: "Ventas (OUTCOME_SALES)",
      presupuesto_diario: 60000,
      efectividad_estimada: 92,
      estado: "activa",
      sugerencia_preview: {
        tipo: "sugerencia",
        titulo: "Esta campana esta funcionando muy bien",
        mensaje: "El sistema recomienda aumentar el presupuesto diario un 20% para escalar resultados.",
      },
    },
    {
      id: "demo_2",
      nombre: "Reconocimiento - Construccion de marca",
      objetivo: "Reconocimiento (OUTCOME_AWARENESS)",
      presupuesto_diario: 45000,
      efectividad_estimada: 58,
      estado: "activa",
      sugerencia_preview: {
        tipo: "alerta",
        titulo: "Bajo rendimiento estimado",
        mensaje: "Esta campana tiene una efectividad estimada baja. Sugerimos pausarla y revisar los creativos.",
      },
    },
    {
      id: "demo_3",
      nombre: "Retargeting - Visitantes 14 dias",
      objetivo: "Trafico / Mensajes",
      presupuesto_diario: 30000,
      efectividad_estimada: 76,
      estado: "pausada",
      sugerencia_preview: {
        tipo: "sugerencia",
        titulo: "Optimizacion sugerida",
        mensaje: "Prueba rotar los creativos cada 5-7 dias para evitar fatiga de audiencia.",
      },
    },
  ];

  const cargar = async () => {
    setCargando(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/campanas");
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudieron cargar tus campanas.");
        setCampanas([]);
        return;
      }
      setCampanas(data.campanas || []);
    } catch (e) {
      setErrorMsg("No se pudo conectar con el servidor.");
      setCampanas([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // --- Nuevo: scroll + resaltado hacia la campaña indicada en ?highlight= ---
  useEffect(() => {
    if (!highlightId || cargando) return;

    const timer = setTimeout(() => {
      const el = cardRefs.current[highlightId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setCampanaResaltada(highlightId);

        const fadeTimer = setTimeout(() => {
          setCampanaResaltada(null);
          router.replace("/campanas");
        }, 3000);
        return () => clearTimeout(fadeTimer);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [highlightId, cargando, campanas]);

  const handleAceptarSugerencia = async (campanaId: string) => {
    setProcesando(campanaId);
    try {
      const res = await fetch("/api/notificaciones");
      const data = await res.json();
      const lista = data.notificaciones || [];
      let notiId = null;
      for (let i = 0; i < lista.length; i++) {
        if (lista[i].campana_id === campanaId && lista[i].estado === "pendiente") {
          notiId = lista[i].id;
          break;
        }
      }
      if (notiId) {
        await fetch("/api/notificaciones/" + notiId + "/aceptar", { method: "POST" });
      }
      cargar();
    } finally {
      setProcesando(null);
    }
  };

  const getEstadoLabel = (estado: string) => {
    if (estado === "activa") return "Activa";
    if (estado === "pausada") return "Pausada";
    return estado;
  };

  const getEstadoColor = (estado: string) => {
    if (estado === "activa") return "rgb(21, 128, 61)";
    if (estado === "pausada") return "rgb(180, 83, 9)";
    return "rgb(107, 114, 128)";
  };

  const getEstadoBg = (estado: string) => {
    if (estado === "activa") return "rgb(220, 252, 231)";
    if (estado === "pausada") return "rgb(254, 243, 199)";
    return "rgb(243, 244, 246)";
  };

  const irAPanel = () => {
    router.push("/");
  };

  const irAEstrategia = () => {
    router.push("/estrategia");
  };

  const pageStyle = {
    minHeight: "100vh",
    background: "rgb(249, 249, 248)",
    fontFamily: "system-ui, sans-serif",
    padding: "2rem",
  };

  const containerStyle = {
    maxWidth: 700,
    margin: "0 auto",
  };

  const cardStyleBase = {
    background: "rgb(255, 255, 255)",
    border: "1px solid rgb(232, 232, 230)",
    borderRadius: 16,
    padding: "1.5rem",
    transition: "box-shadow 0.4s ease, border-color 0.4s ease",
  };

  const campanasAMostrar = modoDemo ? CAMPANAS_DEMO : campanas;

  let contenido = null;

  if (cargando) {
    contenido = (
      <div style={cardStyleBase}>
        <p style={{ color: "rgb(153, 153, 153)", fontSize: 14, textAlign: "center", margin: 0 }}>
          Cargando campanas...
        </p>
      </div>
    );
  } else if (errorMsg) {
    contenido = (
      <div style={cardStyleBase}>
        <p style={{ color: "rgb(153, 27, 27)", fontSize: 14, textAlign: "center", marginBottom: 12 }}>
          {errorMsg}
        </p>
        <button
          onClick={cargar}
          style={{
            display: "block",
            margin: "0 auto",
            background: "rgb(127, 119, 221)",
            color: "rgb(255, 255, 255)",
            border: "none",
            padding: "10px 20px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </div>
    );
  } else if (campanasAMostrar.length === 0) {
    contenido = (
      <div style={{ ...cardStyleBase, textAlign: "center", padding: "2.5rem" }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "rgb(26, 26, 26)", marginBottom: 8 }}>
          Aun no tienes campanas publicadas
        </p>
        <p style={{ fontSize: 13, color: "rgb(102, 102, 102)", marginBottom: "1.5rem" }}>
          Crea tu primera estrategia y publicala para empezar a recibir recomendaciones aqui.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={irAEstrategia}
            style={{
              background: "rgb(127, 119, 221)",
              color: "rgb(255, 255, 255)",
              padding: "12px 24px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Ir al Motor de Estrategia
          </button>
          <button
            onClick={function () { setModoDemo(true); }}
            style={{
              background: "rgb(255, 255, 255)",
              color: "rgb(127, 119, 221)",
              padding: "12px 24px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              border: "1px solid rgb(127, 119, 221)",
              cursor: "pointer",
            }}
          >
            Ver ejemplo
          </button>
        </div>
      </div>
    );
  } else {
    contenido = (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {campanasAMostrar.map(function (c) {
          const presupuestoTexto = c.presupuesto_diario
            ? "$" + Number(c.presupuesto_diario).toLocaleString("es-CO") + " COP"
            : "-";
          const efectividadTexto = c.efectividad_estimada != null ? c.efectividad_estimada + "%" : "-";
          const sugerencia = c.sugerencia_preview;
          const esAlerta = sugerencia && sugerencia.tipo === "alerta";
          const estaResaltada = campanaResaltada === c.id;

          const cardStyle = {
            ...cardStyleBase,
            ...(estaResaltada
              ? {
                  borderColor: "rgb(127, 119, 221)",
                  boxShadow: "0 0 0 3px rgba(127, 119, 221, 0.25), 0 8px 20px rgba(127, 119, 221, 0.15)",
                }
              : {}),
          };

          return (
            <div
              key={c.id}
              ref={(el) => { cardRefs.current[c.id] = el; }}
              style={cardStyle}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "rgb(26, 26, 26)" }}>{c.nombre}</div>
                  <div style={{ fontSize: 12, color: "rgb(153, 153, 153)", marginTop: 2 }}>
                    {c.objetivo || "Sin objetivo definido"}
                  </div>
                </div>
                <div
                  style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    background: getEstadoBg(c.estado),
                    color: getEstadoColor(c.estado),
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {getEstadoLabel(c.estado)}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "rgb(249, 249, 248)", borderRadius: 10, padding: "0.75rem 1rem" }}>
                  <div style={{ fontSize: 11, color: "rgb(153, 153, 153)", marginBottom: 4 }}>Presupuesto diario</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "rgb(51, 51, 51)" }}>{presupuestoTexto}</div>
                </div>
                <div style={{ background: "rgb(249, 249, 248)", borderRadius: 10, padding: "0.75rem 1rem" }}>
                  <div style={{ fontSize: 11, color: "rgb(153, 153, 153)", marginBottom: 4 }}>Efectividad estimada</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "rgb(51, 51, 51)" }}>{efectividadTexto}</div>
                </div>
              </div>

              {sugerencia ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: "1rem",
                    borderRadius: 10,
                    background: esAlerta ? "rgb(254, 242, 242)" : "rgb(243, 242, 254)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: esAlerta ? "rgb(153, 27, 27)" : "rgb(83, 74, 183)" }}>
                    {sugerencia.titulo}
                  </div>
                  <div style={{ fontSize: 12, color: "rgb(102, 102, 102)", marginTop: 4, lineHeight: 1.5 }}>
                    {sugerencia.mensaje}
                  </div>
                  <button
                    onClick={function () { handleAceptarSugerencia(c.id); }}
                    disabled={procesando === c.id}
                    style={{
                      marginTop: 10,
                      background: "rgb(83, 74, 183)",
                      color: "rgb(255, 255, 255)",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: procesando === c.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {procesando === c.id ? "Aplicando..." : "Aplicar sugerencia"}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            onClick={irAPanel}
            style={{ background: "none", border: "none", color: "rgb(127, 119, 221)", fontSize: 14, cursor: "pointer", padding: 0 }}
          >
            Volver al panel principal
          </button>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "rgb(26, 26, 26)" }}>Mis Campanas</h1>
        <p style={{ fontSize: 13, color: "rgb(153, 153, 153)", marginBottom: "1.5rem" }}>
          Seguimiento y recomendaciones automaticas para tus campanas activas.
        </p>

        {contenido}
      </div>
    </div>
  );
}