"use client";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Cloud, Radio, ExternalLink, CheckCircle2 } from "lucide-react";
import HomeInicio from "@/app/components/HomeInicio";
import TutorialVideo from "@/app/components/TutorialVideo";
import TourGuiado from "@/app/components/TourGuiado";

function Icono({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

// Encabezado reutilizable de cada tarjeta de integración: icono de marca,
// estado de conexión (sin puntos/emoji sueltos, con un icono de check real
// cuando está conectado) y el enlace directo a la plataforma externa.
function EncabezadoIntegracion({
  icono: Icono2,
  nombre,
  conectado,
  textoConectado,
  textoNoConectado,
  urlExterna,
  textoUrlExterna,
}: {
  icono: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  nombre: string;
  conectado: boolean;
  textoConectado: string;
  textoNoConectado: string;
  urlExterna: string;
  textoUrlExterna: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: 48, height: 48, borderRadius: "12px", background: conectado ? "#534AB7" : "#F3F2FE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icono2 size={22} color={conectado ? "#fff" : "#534AB7"} strokeWidth={2} />
        </div>
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: 600, margin: 0, color: "#1a1a1a" }}>{nombre}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: conectado ? "#15803d" : "#999", marginTop: 2, fontWeight: 500 }}>
            {conectado ? <CheckCircle2 size={13} strokeWidth={2.5} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ccc" }} />}
            {conectado ? textoConectado : textoNoConectado}
          </div>
        </div>
      </div>
      <a
        href={urlExterna}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#534AB7", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0, marginTop: 4 }}
      >
        {textoUrlExterna}
        <ExternalLink size={13} strokeWidth={2} />
      </a>
    </div>
  );
}

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"inicio" | "album" | "integraciones">("inicio");
  const [albumItems, setAlbumItems] = useState<{ id: string; url_imagen: string; tipo: string; public_id: string }[]>([]);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const albumFileRef = useRef<HTMLInputElement>(null);
  const [apiKeyInfo, setApiKeyInfo] = useState<{ hasKey: boolean; preview: string | null } | null>(null);
  const [nuevaApiKey, setNuevaApiKey] = useState("");
  const [cloudinaryInfo, setCloudinaryInfo] = useState<{ hasConfig: boolean } | null>(null);
  const [guardandoApiKey, setGuardandoApiKey] = useState(false);
  const [apiKeyGuardada, setApiKeyGuardada] = useState(false);

  const [cloudinaryData, setCloudinaryData] = useState({ name: "", key: "", secret: "" });
  const [guardandoCloud, setGuardandoCloud] = useState(false);

  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [mostrarNotis, setMostrarNotis] = useState(false);
  const [procesandoNoti, setProcesandoNoti] = useState<string | null>(null);

  const [campanaShaking, setCampanaShaking] = useState(false);
  const conteoPendientesPrevio = useRef<number | null>(null);

  const [metaInfo, setMetaInfo] = useState<{ conectado: boolean; nombre: string | null; cuentaPublicitaria: string | null; pagina: string | null } | null>(null);

  const [rol, setRol] = useState<string | null>(null);
  const [colapsado, setColapsado] = useState(false);
  const [tutorialListoInicio, setTutorialListoInicio] = useState(false);
  const [tutorialListoAlbum, setTutorialListoAlbum] = useState(false);
  const [tutorialListoOpenai, setTutorialListoOpenai] = useState(false);
  const [tutorialListoCloudinary, setTutorialListoCloudinary] = useState(false);
  const [tutorialListoMeta, setTutorialListoMeta] = useState(false);
  const [adminAbierto, setAdminAbierto] = useState(false);
  const [hoverExpandido, setHoverExpandido] = useState(false);
  const expandidoVisual = !colapsado || hoverExpandido;

  const cargarRol = () => {
    fetch("/api/usuario/rol").then(r => r.json()).then(data => setRol(data.rol));
  };

  const cargarApiKeyInfo = () => {
    fetch("/api/apikey").then(r => r.json()).then(setApiKeyInfo);
  };

  const cargarCloudinaryInfo = async () => {
    fetch("/api/verificar-cloudinary").then(r => r.json()).then(setCloudinaryInfo);
  };

  const cargarMetaInfo = () => {
    fetch("/api/meta/estado").then(r => r.json()).then(setMetaInfo);
  };

  const handleGuardarApiKey = async () => {
    if (!nuevaApiKey) return;
    setGuardandoApiKey(true);
    setApiKeyGuardada(false);
    const res = await fetch("/api/apikey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: nuevaApiKey }),
    });
    setGuardandoApiKey(false);
    if (res.ok) {
      setNuevaApiKey("");
      setApiKeyGuardada(true);
      cargarApiKeyInfo();
    }
  };

  const cargarAlbum = async () => {
    const res = await fetch("/api/album");
    const data = await res.json();
    if (data.imagenes) {
      setAlbumItems(data.imagenes);
    }
  };

  const handleSubirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoArchivo(true);
    const formData = new FormData();
    formData.append("archivo", file);
    try {
      const res = await fetch("/api/album/subir", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        cargarAlbum();
      } else {
        alert(data.error || "Error al subir el archivo");
      }
    } catch (err) {
      alert("No se pudo conectar con el servidor.");
    } finally {
      setSubiendoArchivo(false);
      if (albumFileRef.current) albumFileRef.current.value = "";
    }
  };

  const handleEliminarCreativo = async (id: string) => {
    if (!confirm("¿Eliminar este creativo? Esta acción no se puede deshacer.")) return;
    setEliminandoId(id);
    try {
      const res = await fetch(`/api/album/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAlbumItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "No se pudo eliminar el creativo.");
      }
    } finally {
      setEliminandoId(null);
    }
  };

  const cargarNotificaciones = async () => {
    const res = await fetch("/api/notificaciones");
    const data = await res.json();
    setNotificaciones(data.notificaciones ?? []);
  };

  const handleAceptarNoti = async (id: string) => {
    setProcesandoNoti(id);
    try {
      const res = await fetch(`/api/notificaciones/${id}/aceptar`, { method: "POST" });
      if (res.ok) {
        setNotificaciones((prev) => prev.filter((n) => n.id !== id));
      } else {
        alert("No se pudo aplicar la sugerencia.");
      }
    } finally {
      setProcesandoNoti(null);
    }
  };

  const handleDescartarNoti = async (id: string) => {
    setProcesandoNoti(id);
    try {
      await fetch(`/api/notificaciones/${id}/descartar`, { method: "POST" });
      setNotificaciones((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setProcesandoNoti(null);
    }
  };

  const handleEliminarNoti = async (id: string) => {
    await fetch(`/api/notificaciones/${id}/eliminar`, { method: "DELETE" });
    setNotificaciones((prev) => prev.filter((n) => n.id !== id));
  };

  useEffect(() => {
    cargarApiKeyInfo();
    cargarCloudinaryInfo();
    cargarAlbum();
    cargarNotificaciones();
    cargarMetaInfo();
    cargarRol();
    fetch("/api/registro-riesgo", { method: "POST" }).catch(() => {}); // anti-multicuenteo: se auto-protege, seguro llamarlo siempre

    const params = new URLSearchParams(window.location.search);
    if (params.get("meta_conectado") === "1") {
      alert("¡Tu cuenta de Meta se conectó correctamente!");
      window.history.replaceState({}, "", "/");
      cargarMetaInfo();
    }
    if (params.get("meta_error") === "1") {
      alert("No se pudo conectar tu cuenta de Meta. Intenta de nuevo.");
      window.history.replaceState({}, "", "/");
    }

    const interval = setInterval(() => {
      cargarNotificaciones();
    }, 60000);
    return () => clearInterval(interval);
  }, [])

  useEffect(() => {
    const pendientes = notificaciones.filter((n) => n.estado === "pendiente").length;

    if (conteoPendientesPrevio.current !== null && pendientes > conteoPendientesPrevio.current) {
      setCampanaShaking(true);
      const timer = setTimeout(() => setCampanaShaking(false), 700);
      conteoPendientesPrevio.current = pendientes;
      return () => clearTimeout(timer);
    }

    conteoPendientesPrevio.current = pendientes;
  }, [notificaciones]);

  const handleGuardarCloudinary = async () => {
    setGuardandoCloud(true);
    try {
      const res = await fetch("/api/configurar-cloudinary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cloudinaryData),
      });

      if (res.ok) {
        alert("¡Credenciales de Cloudinary guardadas correctamente!");
        cargarCloudinaryInfo();
      } else {
        alert("Error al guardar, intenta nuevamente.");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setGuardandoCloud(false);
    }
  };

  // Determina si una notificación es "clicable" (navega a algún lado)
  const notiEsClicable = (n: any) =>
    n.tipo === "playbook_pendiente" ||
    !!n.campana_id ||
    (n.tipo === "creativos_listos" && !!n.accion_sugerida?.job_id);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#f9f9f8" }}>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #534AB7; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        @keyframes shake-bell {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(14deg); }
          40% { transform: rotate(-12deg); }
          60% { transform: rotate(8deg); }
          80% { transform: rotate(-4deg); }
        }
        .shake-bell { animation: shake-bell 0.6s ease-in-out; transform-origin: top center; }

        @keyframes qbOrbPulse {
          0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          70% { box-shadow: 0 0 0 7px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        .qb-sidebar { transition: width .25s ease; position: relative; }
        .qb-sidebar-toggle {
          position: absolute; top: 22px; right: -12px; width: 24px; height: 24px; border-radius: 50%;
          background: #fff; border: 1px solid #e8e8e6; box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 6;
        }
        .qb-sidebar-toggle:hover { border-color: #534AB7; color: #534AB7; }
        .qb-orb { width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: qbOrbPulse 2.4s infinite; flex-shrink: 0; }
        .qb-logo-mark {
          width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0; overflow: hidden;
          display: flex; align-items: center; justify-content: center; background: #534AB7;
        }
        .qb-nav-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px;
          color: #666; font-size: 13.5px; text-decoration: none; cursor: pointer; position: relative;
          transition: background .15s ease, color .15s ease;
        }
        .qb-nav-item:hover { background: #f9f9fc; color: #534AB7; }
        .qb-nav-item.activo { background: #f3f2fe; color: #534AB7; font-weight: 600; }
        .qb-nav-icon {
          width: 28px; height: 28px; border-radius: 8px; background: #f3f2fe; color: #534AB7;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          transition: background .15s ease, color .15s ease;
        }
        .qb-nav-item.activo .qb-nav-icon, .qb-nav-item:hover .qb-nav-icon { background: #534AB7; color: #fff; }
        .qb-nav-label { white-space: nowrap; overflow: hidden; }
        .qb-sidebar.colapsado .qb-nav-label { display: none; }
        .qb-tooltip {
          position: absolute; left: calc(100% + 10px); top: 50%; transform: translateY(-50%);
          background: #1a1a1a; color: #fff; font-size: 12px; padding: 5px 10px; border-radius: 6px;
          white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .15s ease; z-index: 30;
        }
        .qb-sidebar.colapsado .qb-nav-item:hover .qb-tooltip,
        .qb-sidebar.colapsado .qb-admin-toggle:hover .qb-tooltip { opacity: 1; }
        .qb-admin-toggle {
          display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; cursor: pointer;
          color: #534AB7; font-weight: 600; font-size: 13px; background: transparent; border: none; width: 100%;
          text-align: left; position: relative;
        }
        .qb-admin-toggle:hover { background: #f9f9fc; }
        .qb-admin-toggle .qb-nav-icon { background: #ece9fb; }
        .qb-admin-chevron { margin-left: auto; transition: transform .2s ease; flex-shrink: 0; }
        .qb-admin-chevron.abierto { transform: rotate(90deg); }
        .qb-admin-panel {
          max-height: 0; overflow: hidden; transition: max-height .3s ease, padding .3s ease, margin .3s ease;
          background: linear-gradient(180deg, #f7f6ff, #fcfbff); border-radius: 12px;
        }
        .qb-admin-panel.abierto { max-height: 280px; padding: 8px; margin-top: 4px; border: 1px dashed #d8d3f5; }
        .qb-admin-item {
          display: flex; align-items: center; gap: 9px; padding: 7px 8px; border-radius: 8px;
          color: #534AB7; font-size: 12.5px; text-decoration: none; font-weight: 500;
        }
        .qb-admin-item:hover { background: #fff; }
        .qb-admin-item .qb-nav-icon { width: 24px; height: 24px; background: #fff; }
        .qb-footer-btn { display: flex; align-items: center; gap: 8px; justify-content: flex-start; }
        .qb-sidebar.colapsado .qb-footer-btn { justify-content: center; }
      `}</style>
      <div
        className={`qb-sidebar${expandidoVisual ? "" : " colapsado"}`}
        style={{ width: expandidoVisual ? 232 : 72, background: "#fff", borderRight: "1px solid #e8e8e6", padding: "1.25rem 0.85rem", display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}
        onMouseEnter={() => { if (colapsado) setHoverExpandido(true); }}
        onMouseLeave={() => setHoverExpandido(false)}
      >

        <div className="qb-sidebar-toggle" onClick={() => setColapsado((v) => !v)} title={colapsado ? "Expandir menú" : "Contraer menú"}>
          <Icono>
            {colapsado ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
          </Icono>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.75rem", padding: "0 2px" }}>
          <div className="qb-logo-mark">
            <img src="/marca/icono-quiubot.svg" alt="" width={20} height={20} />
          </div>
          {expandidoVisual && (
            <div className="qb-logo-texto" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>
                quiu<span style={{ color: "#7F77DD" }}>bot</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                <span className="qb-orb" />
                <span style={{ fontSize: 10, color: "#999", fontFamily: "monospace", letterSpacing: "0.02em" }}>sistema activo</span>
              </div>
            </div>
          )}
        </div>

        <div data-tour="sidebar-inicio" onClick={() => setTab("inicio")} className={`qb-nav-item${tab === "inicio" ? " activo" : ""}`}>
          <span className="qb-nav-icon"><Icono><path d="M3 11l9-8 9 8" /><path d="M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" /></Icono></span>
          <span className="qb-nav-label">Inicio</span>
          <span className="qb-tooltip">Inicio</span>
        </div>

        <a href="/marca" className="qb-nav-item">
          <span className="qb-nav-icon"><Icono><path d="M20.59 13.41L11 3.83A2 2 0 009.57 3H4a1 1 0 00-1 1v5.57a2 2 0 00.59 1.41l9.58 9.59a2 2 0 002.83 0l4.59-4.59a2 2 0 000-2.83z" /><circle cx="7.5" cy="7.5" r="1.2" /></Icono></span>
          <span className="qb-nav-label">Mi marca</span>
          <span className="qb-tooltip">Mi marca</span>
        </a>

        <a data-tour="sidebar-estrategia" href="/estrategia" className="qb-nav-item">
          <span className="qb-nav-icon"><Icono><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></Icono></span>
          <span className="qb-nav-label">Motor de Estrategia</span>
          <span className="qb-tooltip">Motor de Estrategia</span>
        </a>

        <a href="/campanas" className="qb-nav-item">
          <span className="qb-nav-icon"><Icono><rect x="4" y="12" width="3" height="8" /><rect x="10.5" y="6" width="3" height="14" /><rect x="17" y="9" width="3" height="11" /></Icono></span>
          <span className="qb-nav-label">Mis Campañas</span>
          <span className="qb-tooltip">Mis Campañas</span>
        </a>

        <div onClick={() => setTab("album")} className={`qb-nav-item${tab === "album" ? " activo" : ""}`}>
          <span className="qb-nav-icon"><Icono><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.4" /><path d="M21 15l-5-5L5 21" /></Icono></span>
          <span className="qb-nav-label">Álbum Creativos</span>
          <span className="qb-tooltip">Álbum Creativos</span>
        </div>

        <div onClick={() => setTab("integraciones")} className={`qb-nav-item${tab === "integraciones" ? " activo" : ""}`}>
          <span className="qb-nav-icon"><Icono><path d="M9 2v4M15 2v4M6 8h12l-1 6a5 5 0 01-10 0L6 8z" /><path d="M12 18v4" /></Icono></span>
          <span className="qb-nav-label">Integraciones</span>
          <span className="qb-tooltip">Integraciones</span>
        </div>

        <a data-tour="sidebar-plan" href="/billing" className="qb-nav-item">
          <span className="qb-nav-icon"><Icono><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></Icono></span>
          <span className="qb-nav-label">Mi plan</span>
          <span className="qb-tooltip">Mi plan</span>
        </a>

        {rol === "admin" && (
          <div style={{ borderTop: "1px solid #e8e8e6", marginTop: 8, paddingTop: 8 }}>
            <button
              className="qb-admin-toggle"
              onClick={() => {
                if (colapsado) {
                  setColapsado(false);
                  setAdminAbierto(true);
                } else {
                  setAdminAbierto((v) => !v);
                }
              }}
            >
              <span className="qb-nav-icon"><Icono><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z" /></Icono></span>
              <span className="qb-nav-label">Admin</span>
              <span className="qb-tooltip">Panel de Admin</span>
              <span className={`qb-admin-chevron${adminAbierto ? " abierto" : ""} qb-nav-label`}>
                <Icono><path d="M9 6l6 6-6 6" /></Icono>
              </span>
            </button>

            <div className={`qb-admin-panel${adminAbierto && !colapsado ? " abierto" : ""}`}>
              <a href="/admin/playbook" className="qb-admin-item">
                <span className="qb-nav-icon"><Icono><path d="M2 5a2 2 0 012-2h6v18H4a2 2 0 01-2-2V5z" /><path d="M22 5a2 2 0 00-2-2h-6v18h6a2 2 0 002-2V5z" /></Icono></span>
                Playbook
              </a>
              <a href="/admin/objetivos" className="qb-admin-item">
                <span className="qb-nav-icon"><Icono><path d="M5 21V4M5 4h13l-3 4 3 4H5" /></Icono></span>
                Objetivos
              </a>
              <a href="/admin/conocimiento" className="qb-admin-item">
                <span className="qb-nav-icon"><Icono><path d="M9 18h6M10 22h4M12 2a6 6 0 00-6 6c0 2 1 3 2 4.5S9 15 9 16h6c0-1 0-2 1-3.5S18 10 18 8a6 6 0 00-6-6z" /></Icono></span>
                Conocimiento
              </a>
              <a href="/admin/tutoriales" className="qb-admin-item">
                <span className="qb-nav-icon"><Icono><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M10 8l6 4-6 4V8z" /></Icono></span>
                Tutoriales
              </a>
            </div>
          </div>
        )}

        <div style={{ marginTop: "auto", borderTop: "1px solid #e8e8e6", paddingTop: 12 }}>
          {session?.user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, justifyContent: expandidoVisual ? "flex-start" : "center" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#7F77DD", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                {session.user.name?.[0]?.toUpperCase() ?? "U"}
              </div>
              {expandidoVisual && (
                <div style={{ overflow: "hidden" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#333", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.user.name}</div>
                  <div style={{ fontSize: 10, color: "#999", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.user.email}</div>
                </div>
              )}
            </div>
          )}
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="qb-footer-btn" style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #e8e8e6", background: "transparent", color: "#666", fontSize: 13, cursor: "pointer" }} title="Cerrar sesión">
            <Icono><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Icono>
            <span className="qb-nav-label">Cerrar sesión</span>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e8e8e6", background: "#fff", fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span>{tab === "inicio" ? "Inicio" : tab === "album" ? "Álbum de Creativos" : "Integraciones"}</span>
            {tab === "inicio" && <TutorialVideo seccion="inicio" onListo={() => setTutorialListoInicio(true)} />}
            {tab === "inicio" && (
              <TourGuiado
                seccion="inicio"
                listo={tutorialListoInicio}
                pasos={[
                  { selector: '[data-tour="sidebar-inicio"]', titulo: "Tu punto de partida", texto: "Aquí siempre verás un resumen de lo que pasó mientras no estabas: gasto, campañas activas y decisiones pendientes." },
                  { selector: '[data-tour="campana-notificaciones"]', titulo: "Alertas y sugerencias", texto: "Cuando Quiubot detecte algo que necesita tu atención (o proponga un ajuste), te avisa aquí." },
                  { selector: '[data-tour="sidebar-estrategia"]', titulo: "Genera tu primera campaña", texto: "Cuando estés listo, aquí es donde subes tu producto y Quiubot arma la estrategia completa." },
                  { selector: '[data-tour="sidebar-plan"]', titulo: "Tu plan", texto: "Aquí ves cuánto te queda del plan actual y puedes subir de plan cuando quieras." },
                  { selector: '[data-tour="asistente-flotante"]', titulo: "Tu asistente siempre disponible", texto: "¿Tienes una duda sobre cómo funciona algo? Este ícono abre un chat con IA que conoce Quiubot a fondo y te guía en el momento." },
                ]}
              />
            )}
            {tab === "album" && <TutorialVideo seccion="album-creativos" onListo={() => setTutorialListoAlbum(true)} />}
            {tab === "album" && (
              <TourGuiado
                seccion="album-creativos"
                listo={tutorialListoAlbum}
                pasos={[
                  { selector: '[data-tour="album-subir"]', titulo: "Sube tus propios creativos", texto: "Aquí puedes subir imágenes o videos que ya tengas — luego los podrás usar directo en cualquier estrategia sin generar de nuevo con IA." },
                ]}
              />
            )}
          </div>
          <div style={{ position: "relative" }}>
            <button
              data-tour="campana-notificaciones"
              onClick={() => setMostrarNotis((v) => !v)}
              className={campanaShaking ? "shake-bell" : ""}
              style={{
                background: mostrarNotis ? "#f3f2fe" : "transparent",
                border: "none",
                cursor: "pointer",
                position: "relative",
                width: 38,
                height: 38,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => { if (!mostrarNotis) e.currentTarget.style.background = "#f9f9f8"; }}
              onMouseLeave={(e) => { if (!mostrarNotis) e.currentTarget.style.background = "transparent"; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notificaciones.filter((n) => n.estado === "pendiente").length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 5,
                    background: "#DC2626",
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
                    boxShadow: "0 0 0 2px rgba(220,38,38,0.15)",
                  }}
                >
                  {notificaciones.filter((n) => n.estado === "pendiente").length}
                </span>
              )}
            </button>

            {mostrarNotis && (
              <div style={{ position: "absolute", right: 0, top: "130%", width: 340, maxHeight: 420, overflowY: "auto", background: "#fff", border: "1px solid #e8e8e6", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50 }}>
                <div style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14, borderBottom: "1px solid #f0f0f0" }}>Notificaciones</div>
                {notificaciones.length === 0 && (
                  <div style={{ padding: 16, fontSize: 13, color: "#999" }}>No tienes notificaciones.</div>
                )}
                {notificaciones.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (n.tipo === "playbook_pendiente") {
                        setMostrarNotis(false);
                        router.push("/admin/playbook");
                      } else if (n.tipo === "creativos_listos" && n.accion_sugerida?.job_id) {
                        setMostrarNotis(false);
                        handleEliminarNoti(n.id); // se borra al abrirla, así no vuelve a redirigir a un lote viejo
                        router.push(`/estrategia?job=${n.accion_sugerida.job_id}`);
                      } else if (n.campana_id) {
                        setMostrarNotis(false);
                        router.push(`/campanas?highlight=${n.campana_id}`);
                      }
                    }}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #f5f5f5",
                      cursor: notiEsClicable(n) ? "pointer" : "default",
                      transition: "background 0.12s ease",
                    }}
                    onMouseEnter={(e) => { if (notiEsClicable(n)) e.currentTarget.style.background = "#fafafa"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: n.tipo === "alerta" ? "#dc2626" : n.tipo === "sugerencia" ? "#534AB7" : "#666" }}>
                        {n.tipo === "alerta" ? "🚨" : n.tipo === "sugerencia" ? "💡" : n.tipo === "playbook_pendiente" ? "📘" : n.tipo === "creativos_listos" ? "🎨" : "ℹ️"} {n.titulo}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEliminarNoti(n.id); }}
                        title="Eliminar notificación"
                        style={{ background: "none", border: "none", color: "#bbb", fontSize: 14, cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#999"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#bbb"; }}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{n.mensaje}</div>
                    {n.tipo === "sugerencia" && n.estado === "pendiente" && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAceptarNoti(n.id); }}
                          disabled={procesandoNoti === n.id}
                          style={{ flex: 1, background: "#534AB7", color: "#fff", border: "none", padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          {procesandoNoti === n.id ? "Aplicando..." : "✅ Aceptar"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDescartarNoti(n.id); }}
                          disabled={procesandoNoti === n.id}
                          style={{ flex: 1, background: "#fff", color: "#666", border: "1px solid #ddd", padding: "6px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                        >
                          Descartar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>

          {tab === "inicio" && <HomeInicio nombreUsuario={session?.user?.name || ""} />}

          {tab === "album" && (
            <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Álbum de Creativos</h2>
                <button
                  data-tour="album-subir"
                  onClick={() => albumFileRef.current?.click()}
                  disabled={subiendoArchivo}
                  style={{
                    background: "#534AB7", color: "#fff", border: "none", padding: "10px 16px",
                    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: subiendoArchivo ? "not-allowed" : "pointer",
                  }}
                >
                  {subiendoArchivo ? "⏳ Subiendo..." : "⬆️ Subir imagen o video"}
                </button>
                <input
                  ref={albumFileRef}
                  type="file"
                  accept="image/*,video/*"
                  style={{ display: "none" }}
                  onChange={handleSubirArchivo}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {albumItems.length > 0 ? albumItems.map((item) => (
                  <div key={item.id} style={{ position: "relative" }}>
                    {item.tipo === "video" ? (
                      <video src={item.url_imagen} controls style={{ width: "100%", borderRadius: 12, border: "1px solid #e8e8e6", background: "#000" }} />
                    ) : (
                      <img src={item.url_imagen} alt="creatividad" style={{ width: "100%", borderRadius: 12, border: "1px solid #e8e8e6", display: "block" }} />
                    )}
                    <button
                      onClick={() => handleEliminarCreativo(item.id)}
                      disabled={eliminandoId === item.id}
                      title="Eliminar creativo"
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.55)",
                        color: "#fff",
                        border: "none",
                        cursor: eliminandoId === item.id ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                      }}
                    >
                      {eliminandoId === item.id ? "…" : "✕"}
                    </button>
                  </div>
                )) : <p style={{ fontSize: 14, color: "#666" }}>Aún no tienes imágenes o videos en tu álbum.</p>}
              </div>
            </div>
          )}

          {tab === "integraciones" && (
            <div style={{ maxWidth: "600px", margin: "2rem auto", display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div style={{ background: "#fff", padding: "2rem", borderRadius: "16px", border: apiKeyInfo?.hasKey ? "1.5px solid #d9d4f7" : "1px solid #e8e8e6", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <EncabezadoIntegracion
                  icono={BrainCircuit}
                  nombre="OpenAI"
                  conectado={!!apiKeyInfo?.hasKey}
                  textoConectado="Conectado"
                  textoNoConectado="No configurado"
                  urlExterna="https://platform.openai.com/api-keys"
                  textoUrlExterna="Obtener API Key"
                />
                {apiKeyInfo?.hasKey && <div style={{ background: "#f9fafb", padding: "10px", borderRadius: "8px", fontSize: "12px", color: "#666", marginBottom: "15px", fontFamily: "monospace" }}>{apiKeyInfo.preview}</div>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>Tu API key de OpenAI</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <TutorialVideo seccion="integraciones-openai" onListo={() => setTutorialListoOpenai(true)} />
                    <TourGuiado
                      seccion="integraciones-openai"
                      listo={tutorialListoOpenai}
                      pasos={[
                        { selector: '[data-tour="openai-input"]', titulo: "Pega tu API key aquí", texto: "Empieza con sk-. La consigues en tu cuenta de platform.openai.com, sección API Keys." },
                        { selector: '[data-tour="openai-conectar"]', titulo: "Conecta tu cuenta", texto: "Con un clic queda guardada y lista para que Quiubot genere estrategia y creativos." },
                      ]}
                    />
                  </div>
                </div>
                <input data-tour="openai-input" type="password" placeholder={apiKeyInfo?.hasKey ? "Actualizar API Key..." : "sk-..."} value={nuevaApiKey} onChange={(e) => setNuevaApiKey(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e0e0e0", marginBottom: "10px", boxSizing: "border-box" }} />
                <button data-tour="openai-conectar" onClick={handleGuardarApiKey} style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#534AB7", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>{guardandoApiKey ? "Guardando..." : apiKeyInfo?.hasKey ? "Actualizar Conexión" : "Conectar OpenAI"}</button>
              </div>

              <div style={{ background: "#fff", padding: "2rem", borderRadius: "16px", border: cloudinaryInfo?.hasConfig ? "1.5px solid #d9d4f7" : "1px solid #e8e8e6", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <EncabezadoIntegracion
                  icono={Cloud}
                  nombre="Cloudinary"
                  conectado={!!cloudinaryInfo?.hasConfig}
                  textoConectado="Conectado"
                  textoNoConectado="Configuración pendiente"
                  urlExterna="https://console.cloudinary.com/console"
                  textoUrlExterna="Ver mi Dashboard"
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>Tus credenciales de Cloudinary</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <TutorialVideo seccion="integraciones-cloudinary" onListo={() => setTutorialListoCloudinary(true)} />
                    <TourGuiado
                      seccion="integraciones-cloudinary"
                      listo={tutorialListoCloudinary}
                      pasos={[
                        { selector: '[data-tour="cloudinary-inputs"]', titulo: "Tus 3 credenciales de Cloudinary", texto: "Las encuentras en el Dashboard de tu cuenta de Cloudinary: Cloud Name, API Key y API Secret." },
                        { selector: '[data-tour="cloudinary-guardar"]', titulo: "Guarda y listo", texto: "Con esto Quiubot ya puede almacenar tus creativos generados con IA." },
                      ]}
                    />
                  </div>
                </div>
                <div data-tour="cloudinary-inputs" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input placeholder="Cloud Name" value={cloudinaryData.name} onChange={(e) => setCloudinaryData({...cloudinaryData, name: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e0e0e0", boxSizing: "border-box" }} />
                  <input placeholder="API Key" value={cloudinaryData.key} onChange={(e) => setCloudinaryData({...cloudinaryData, key: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e0e0e0", boxSizing: "border-box" }} />
                  <input type="password" placeholder="API Secret" value={cloudinaryData.secret} onChange={(e) => setCloudinaryData({...cloudinaryData, secret: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e0e0e0", boxSizing: "border-box" }} />
                </div>
                <button data-tour="cloudinary-guardar" onClick={handleGuardarCloudinary} style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#534AB7", color: "#fff", border: "none", marginTop: "15px", fontWeight: 600, cursor: "pointer" }}>{guardandoCloud ? "Guardando..." : "Guardar Credenciales"}</button>
              </div>

              <div style={{ background: "#fff", padding: "2rem", borderRadius: "16px", border: metaInfo?.conectado ? "1.5px solid #d9d4f7" : "1px solid #e8e8e6", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <EncabezadoIntegracion
                  icono={Radio}
                  nombre="Meta Ads"
                  conectado={!!metaInfo?.conectado}
                  textoConectado="Conectado"
                  textoNoConectado="No conectado"
                  urlExterna="https://business.facebook.com/adsmanager"
                  textoUrlExterna="Ir a Meta Business"
                />

                {metaInfo?.conectado ? (
                  <div>
                    <div style={{ background: "#f9fafb", padding: "12px", borderRadius: "8px", fontSize: "13px", color: "#333", marginBottom: "12px" }}>
                      <div><strong>Cuenta:</strong> {metaInfo.nombre || "—"}</div>
                      <div style={{ marginTop: 4 }}><strong>Cuenta publicitaria:</strong> {metaInfo.cuentaPublicitaria || "—"}</div>
                      <div style={{ marginTop: 4 }}><strong>Página de Facebook:</strong> {metaInfo.pagina || "—"}</div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <TutorialVideo seccion="integraciones-meta" onListo={() => setTutorialListoMeta(true)} />
                      <TourGuiado
                        seccion="integraciones-meta"
                        listo={tutorialListoMeta}
                        pasos={[
                          { selector: '[data-tour="meta-conectar"]', titulo: "Reconecta cuando lo necesites", texto: "Si tu conexión con Meta se cae, aquí la vuelves a autorizar en un clic." },
                        ]}
                      />
                    </div>

                    <a  data-tour="meta-conectar" href="/api/meta/conectar"
                      style={{ display: "block", textAlign: "center", width: "100%", padding: "10px", borderRadius: "8px", background: "#fff", color: "#534AB7", border: "1px solid #534AB7", fontWeight: 600, textDecoration: "none", boxSizing: "border-box" }}
                    >
                      Reconectar cuenta
                    </a>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
                      Conecta tu cuenta publicitaria de Meta para poder publicar campañas directamente desde Quiubot.
                    </p>

                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <TutorialVideo seccion="integraciones-meta" onListo={() => setTutorialListoMeta(true)} />
                      <TourGuiado
                        seccion="integraciones-meta"
                        listo={tutorialListoMeta}
                        pasos={[
                          { selector: '[data-tour="meta-conectar"]', titulo: "Conecta tu cuenta de Meta", texto: "Sin esto, tus campañas no se pueden publicar. Te lleva al login de Facebook para autorizar el acceso." },
                        ]}
                      />
                    </div>

                    <a  data-tour="meta-conectar" href="/api/meta/conectar"
                      style={{ display: "block", textAlign: "center", width: "100%", padding: "10px", borderRadius: "8px", background: "#534AB7", color: "#fff", fontWeight: 600, textDecoration: "none", boxSizing: "border-box" }}
                    >
                      Conectar con Meta
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}