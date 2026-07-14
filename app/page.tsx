"use client";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import HomeInicio from "@/app/components/HomeInicio";

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
      `}</style>
      <div style={{ width: 220, background: "#fff", borderRight: "1px solid #e8e8e6", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.5rem" }}>
          <img src="/marca/icono-quiubot.svg" alt="" width={28} height={28} style={{ borderRadius: 7 }} />
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.5px" }}>
            quiu<span style={{ color: "#7F77DD" }}>bot</span>
          </div>
        </div>
        <div onClick={() => setTab("inicio")} style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: tab === "inicio" ? "#f3f2fe" : "transparent", color: tab === "inicio" ? "#534AB7" : "#666", fontWeight: tab === "inicio" ? 500 : 400, fontSize: 14 }}>
          🏠 Inicio
        </div>
        <a href="/marca" style={{ padding: "8px 12px", borderRadius: 8, color: "#666", fontSize: 14, textDecoration: "none" }}>🎨 Mi marca</a>
        <a href="/estrategia" style={{ padding: "8px 12px", borderRadius: 8, color: "#666", fontSize: 14, textDecoration: "none" }}>🎯 Motor de Estrategia</a>
        <a href="/campanas" style={{ padding: "8px 12px", borderRadius: 8, color: "#666", fontSize: 14, textDecoration: "none" }}>📊 Mis Campañas</a>
        <div onClick={() => setTab("album")} style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: tab === "album" ? "#f3f2fe" : "transparent", color: tab === "album" ? "#534AB7" : "#666", fontWeight: tab === "album" ? 500 : 400, fontSize: 14 }}>
          📸 Álbum Creativos
        </div>
        <div onClick={() => setTab("integraciones")} style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: tab === "integraciones" ? "#f3f2fe" : "transparent", color: tab === "integraciones" ? "#534AB7" : "#666", fontWeight: tab === "integraciones" ? 500 : 400, fontSize: 14 }}>
          🔌 Integraciones
        </div>
        <a href="/billing" style={{ padding: "8px 12px", borderRadius: 8, color: "#666", fontSize: 14, textDecoration: "none" }}>💳 Mi plan</a>
        {rol === "admin" && (<a href="/admin/playbook" style={{ padding: "8px 12px", borderRadius: 8, color: "#7F77DD", fontSize: 14, textDecoration: "none", fontWeight: 500, borderTop: "1px solid #e8e8e6", marginTop: 8, paddingTop: 16 }}>🛡️ Playbook (Admin)</a>)}
        {rol === "admin" && (<a href="/admin/objetivos" style={{ padding: "8px 12px", borderRadius: 8, color: "#7F77DD", fontSize: 14, textDecoration: "none", fontWeight: 500 }}>🎯 Objetivos (Admin)</a>)}
        {rol === "admin" && (<a href="/admin/conocimiento" style={{ padding: "8px 12px", borderRadius: 8, color: "#7F77DD", fontSize: 14, textDecoration: "none", fontWeight: 500 }}>🧠 Conocimiento (Admin)</a>)}

        <div style={{ marginTop: "auto", borderTop: "1px solid #e8e8e6", paddingTop: 12 }}>
          {session?.user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#7F77DD", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                {session.user.name?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#333", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.user.name}</div>
                <div style={{ fontSize: 10, color: "#999", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.user.email}</div>
              </div>
            </div>
          )}
          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ width: "100%", padding: "7px 12px", borderRadius: 8, border: "1px solid #e8e8e6", background: "transparent", color: "#666", fontSize: 13, cursor: "pointer", textAlign: "left" }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e8e8e6", background: "#fff", fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{tab === "inicio" ? "Inicio" : tab === "album" ? "Álbum de Creativos" : "Integraciones"}</span>
          <div style={{ position: "relative" }}>
            <button
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
              <div style={{ background: "#fff", padding: "2rem", borderRadius: "16px", border: "1px solid #e8e8e6", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: 48, height: 48, borderRadius: "12px", background: "#f3f2fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>🤖</div>
                    <div>
                      <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>OpenAI</h2>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: apiKeyInfo?.hasKey ? "#10b981" : "#6b7280" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: apiKeyInfo?.hasKey ? "#10b981" : "#6b7280" }}></span>
                        {apiKeyInfo?.hasKey ? "Conectado" : "No configurado"}
                      </div>
                    </div>
                  </div>
                </div>
                {apiKeyInfo?.hasKey && <div style={{ background: "#f9fafb", padding: "10px", borderRadius: "8px", fontSize: "12px", color: "#666", marginBottom: "15px", fontFamily: "monospace" }}>{apiKeyInfo.preview}</div>}
                <input type="password" placeholder={apiKeyInfo?.hasKey ? "Actualizar API Key..." : "sk-..."} value={nuevaApiKey} onChange={(e) => setNuevaApiKey(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e0e0e0", marginBottom: "10px" }} />
                <button onClick={handleGuardarApiKey} style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#534AB7", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>{guardandoApiKey ? "Guardando..." : apiKeyInfo?.hasKey ? "Actualizar Conexión" : "Conectar OpenAI"}</button>
              </div>

              <div style={{ background: "#fff", padding: "2rem", borderRadius: "16px", border: "1px solid #e8e8e6", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.5rem" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "12px", background: "#f3f2fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>☁️</div>
                  <div>
                    <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Cloudinary</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: cloudinaryInfo?.hasConfig ? "#10b981" : "#6b7280" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cloudinaryInfo?.hasConfig ? "#10b981" : "#6b7280" }}></span>
                      {cloudinaryInfo?.hasConfig ? "Conectado" : "Configuración pendiente"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input placeholder="Cloud Name" value={cloudinaryData.name} onChange={(e) => setCloudinaryData({...cloudinaryData, name: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e0e0e0" }} />
                  <input placeholder="API Key" value={cloudinaryData.key} onChange={(e) => setCloudinaryData({...cloudinaryData, key: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e0e0e0" }} />
                  <input type="password" placeholder="API Secret" value={cloudinaryData.secret} onChange={(e) => setCloudinaryData({...cloudinaryData, secret: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e0e0e0" }} />
                </div>
                <button onClick={handleGuardarCloudinary} style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#534AB7", color: "#fff", border: "none", marginTop: "15px", fontWeight: 600 }}>{guardandoCloud ? "Guardando..." : "Guardar Credenciales"}</button>
              </div>

              <div style={{ background: "#fff", padding: "2rem", borderRadius: "16px", border: "1px solid #e8e8e6", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.5rem" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "12px", background: "#f3f2fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>📣</div>
                  <div>
                    <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Meta Ads</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: metaInfo?.conectado ? "#10b981" : "#6b7280" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: metaInfo?.conectado ? "#10b981" : "#6b7280" }}></span>
                      {metaInfo?.conectado ? "Conectado" : "No conectado"}
                    </div>
                  </div>
                </div>

                {metaInfo?.conectado ? (
                  <div>
                    <div style={{ background: "#f9fafb", padding: "12px", borderRadius: "8px", fontSize: "13px", color: "#333", marginBottom: "12px" }}>
                      <div><strong>Cuenta:</strong> {metaInfo.nombre || "—"}</div>
                      <div style={{ marginTop: 4 }}><strong>Cuenta publicitaria:</strong> {metaInfo.cuentaPublicitaria || "—"}</div>
                      <div style={{ marginTop: 4 }}><strong>Página de Facebook:</strong> {metaInfo.pagina || "—"}</div>
                    </div>

                    <a  href="/api/meta/conectar"
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

                    <a   href="/api/meta/conectar"
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