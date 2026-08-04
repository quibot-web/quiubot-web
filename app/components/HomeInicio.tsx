"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import NotificacionIcono from "@/app/components/NotificacionIcono";

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

// "Hace 12 minutos" / "Hace 3 horas" -- esto es lo que hace sentir que el
// sistema esta vivo y vigilando de verdad, no mostrando numeros viejos.
function tiempoRelativo(iso: string | null): string {
  if (!iso) return "aún no hay una revisión registrada";
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "hace un momento";
  if (minutos < 60) return `hace ${minutos} minuto${minutos === 1 ? "" : "s"}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} hora${horas === 1 ? "" : "s"}`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} día${dias === 1 ? "" : "s"}`;
}

// Iconos simples, en linea con el resto del sistema (mismo estilo lineal
// que ya usa NotificacionIcono en otras partes).
function IconoEscudo({ size = 18, color = "#534AB7" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function IconoBilletera({ size = 16, color = "#534AB7" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 010-4h14v4" />
      <path d="M3 5v14a2 2 0 002 2h16v-5" />
      <path d="M18 12a2 2 0 000 4h4v-4h-4z" />
    </svg>
  );
}
function IconoDiana({ size = 16, color = "#534AB7" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function IconoRayo({ size = 16, color = "#534AB7" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L4.5 13.5H11L10 22l9-11.5H12.5L13 2z" />
    </svg>
  );
}

function TarjetaKpi({
  icono,
  colorFondo,
  etiqueta,
  valor,
  subtexto,
  barraProgreso,
}: {
  icono: React.ReactNode;
  colorFondo: string;
  etiqueta: string;
  valor: React.ReactNode;
  subtexto?: string;
  barraProgreso?: number | null; // 0-100, opcional
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1.15rem", boxShadow: "0 1px 3px rgba(83,74,183,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: colorFondo, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icono}
        </div>
        <p style={{ fontSize: 11.5, color: "#8b87a0", margin: 0, fontWeight: 500 }}>{etiqueta}</p>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#1a1a1a", letterSpacing: "-0.3px" }}>{valor}</p>
      {typeof barraProgreso === "number" && (
        <div style={{ marginTop: 10, height: 5, borderRadius: 4, background: "#f0eefb", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(barraProgreso, 100)}%`,
              background: barraProgreso > 100 ? "#f59e0b" : "#7F77DD",
              borderRadius: 4,
              transition: "width 0.6s cubic-bezier(.34,1.56,.4,1)",
            }}
          />
        </div>
      )}
      {subtexto && <p style={{ fontSize: 11, color: "#a8a4b8", margin: "8px 0 0" }}>{subtexto}</p>}
    </div>
  );
}

function BannerNovedades({ novedades, visible }: { novedades: any[]; visible: boolean }) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (novedades.length <= 1) return;
    const intervalo = setInterval(() => {
      setIndice((i) => (i + 1) % novedades.length);
    }, 6000);
    return () => clearInterval(intervalo);
  }, [novedades.length]);

  if (novedades.length === 0) return null;

  const n = novedades[indice];
  const badge =
    n.tipo === "proximamente"
      ? { label: "Próximamente", color: "#fff", fondo: "#534AB7" }
      : n.tipo === "actualizacion"
      ? { label: "Actualización", color: "#fff", fondo: "#1d4ed8" }
      : { label: "Nuevo", color: "#fff", fondo: "#16A34A" };

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        minHeight: 200,
        background: "linear-gradient(135deg, #3C3489 0%, #534AB7 55%, #7F77DD 100%)",
        display: "flex",
        alignItems: "stretch",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      {/* Contenido de texto */}
      <div key={n.id} style={{ flex: 1, padding: "1.8rem 2rem", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, animation: "qb-fade-in 0.5s ease" }}>
        <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 700, color: badge.color, background: badge.fondo, padding: "3px 10px", borderRadius: 8, letterSpacing: "0.3px" }}>
          {badge.label}
        </span>
        <p style={{ fontSize: 21, fontWeight: 700, margin: 0, color: "#fff", letterSpacing: "-0.3px", lineHeight: 1.25 }}>{n.titulo}</p>
        {n.descripcion && <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 420, lineHeight: 1.5 }}>{n.descripcion}</p>}
      </div>

      {/* Imagen grande, ocupando toda la mitad derecha */}
      {n.imagen_url && (
        <div key={`img-${n.id}`} style={{ flex: 1, position: "relative", minWidth: 220, animation: "qb-fade-in 0.5s ease" }}>
          <img
            src={n.imagen_url}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(83,74,183,0.55) 0%, rgba(83,74,183,0) 35%)" }} />
        </div>
      )}

      {/* Puntitos de navegación, solo si hay mas de una novedad */}
      {novedades.length > 1 && (
        <div style={{ position: "absolute", bottom: 14, left: 24, display: "flex", gap: 6 }}>
          {novedades.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndice(i)}
              aria-label={`Ver novedad ${i + 1}`}
              style={{
                width: i === indice ? 18 : 6,
                height: 6,
                borderRadius: 4,
                border: "none",
                background: i === indice ? "#fff" : "rgba(255,255,255,0.4)",
                cursor: "pointer",
                transition: "width 0.3s ease, background 0.3s ease",
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      <style>{`@keyframes qb-fade-in { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
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
      .catch(() => setDatos({ kpis: {}, pendientes: [], actividad_reciente: [], novedades: [], ultima_sincronizacion: null }));
  }, []);

  const gastoAnimado = useContarHasta(datos?.kpis?.gasto_activo ?? 0, visible);
  const resultadosAnimados = useContarHasta(datos?.kpis?.resultados_7dias ?? 0, visible);

  if (!datos) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "#999", fontSize: 13 }}>Cargando tu resumen...</div>;
  }

  const primerNombre = nombreUsuario?.split(" ")[0] || "";
  const totalPendientes = datos.pendientes.length;
  const todoTranquilo = totalPendientes === 0;

  const presupuestoTotal = datos.kpis.presupuesto_diario_total || 0;
  const porcentajeGasto = presupuestoTotal > 0 ? (datos.kpis.gasto_activo / presupuestoTotal) * 100 : null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Banner de estado -- lo primero que se ve, para transmitir "esto
          esta vivo y cuidado" antes que cualquier numero */}
      <div
        style={{
          background: "linear-gradient(135deg, #f3f2fe 0%, #ece9fb 100%)",
          borderRadius: 18,
          padding: "1.4rem 1.6rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-6px)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <IconoEscudo size={20} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#3C3489" }}>
              {todoTranquilo ? "Quiubot está cuidando tus campañas" : "Quiubot está trabajando en segundo plano"}
            </p>
            <p style={{ fontSize: 12, color: "#7F77DD", margin: "2px 0 0" }}>
              Última revisión: {tiempoRelativo(datos.ultima_sincronizacion)}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.6)", padding: "6px 12px", borderRadius: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 0 3px rgba(34,197,94,0.25)" }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#166534" }}>Sistema activo</span>
        </div>
      </div>

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <TarjetaKpi
          icono={<IconoBilletera size={14} color="#534AB7" />}
          colorFondo="#f0eefb"
          etiqueta="Gasto de hoy"
          valor={`$${gastoAnimado.toLocaleString("es-CO")}`}
          barraProgreso={porcentajeGasto}
          subtexto={
            porcentajeGasto === null
              ? undefined
              : porcentajeGasto <= 100
              ? "Dentro de lo planeado"
              : "Por encima de lo planeado hoy"
          }
        />
        <TarjetaKpi
          icono={<IconoRayo size={14} color="#534AB7" />}
          colorFondo="#f0eefb"
          etiqueta="Costo por resultado (7 días)"
          valor={datos.kpis.cpa_promedio ? `$${Math.round(datos.kpis.cpa_promedio).toLocaleString("es-CO")}` : "Aún sin datos"}
        />
        <TarjetaKpi
          icono={<IconoDiana size={14} color="#534AB7" />}
          colorFondo="#f0eefb"
          etiqueta="Resultados (7 días)"
          valor={resultadosAnimados.toLocaleString("es-CO")}
          subtexto="Leads, ventas o conversaciones logradas"
        />
        <TarjetaKpi
          icono={<span style={{ width: 6, height: 6, borderRadius: "50%", background: "#534AB7" }} />}
          colorFondo="#f0eefb"
          etiqueta="Campañas activas"
          valor={datos.kpis.campanas_activas ?? 0}
        />
      </div>

      <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1.5rem" }}>
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px", color: "#1a1a1a" }}>Decisiones pendientes</p>
        {todoTranquilo && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <IconoEscudo size={16} color="#22C55E" />
            </div>
            <p style={{ fontSize: 13, color: "#4b5563", margin: 0 }}>
              Todo bajo control — no hay nada esperando tu revisión ahora mismo.
            </p>
          </div>
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
              <NotificacionIcono tipo={n.tipo} size={32} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#1a1a1a" }}>{n.titulo}</p>
                <p style={{ fontSize: 12, color: "#666", margin: "2px 0 0" }}>{n.mensaje}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BannerNovedades novedades={datos.novedades} visible={visible} />

      <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1.5rem" }}>
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", color: "#1a1a1a" }}>Actividad reciente</p>
        {datos.actividad_reciente.length === 0 && <p style={{ fontSize: 13, color: "#999", margin: 0 }}>Genera tu primera estrategia para ver actividad aquí.</p>}
        {datos.actividad_reciente.map((a: any) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <img src={a.url_imagen} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
            <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Creativo nuevo generado</p>
          </div>
        ))}
      </div>

    </div>
  );
}