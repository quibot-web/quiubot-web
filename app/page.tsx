"use client";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<"imagenes" | "integraciones">("imagenes");
  const [prompt, setPrompt] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [galeria, setGaleria] = useState<string[]>([]);
  const [suscripcionActiva, setSuscripcionActiva] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [necesitaApiKey, setNecesitaApiKey] = useState(false);
  const [apiKeyInfo, setApiKeyInfo] = useState<{ hasKey: boolean; preview: string | null } | null>(null);
  const [nuevaApiKey, setNuevaApiKey] = useState("");
  const [guardandoApiKey, setGuardandoApiKey] = useState(false);
  const [apiKeyGuardada, setApiKeyGuardada] = useState(false);
  
  const [cantidad, setCantidad] = useState(1);
  const [incluirTexto, setIncluirTexto] = useState(false);
  
  const fileRef = useRef<HTMLInputElement>(null);

  const cargarApiKeyInfo = () => {
    fetch("/api/apikey").then(r => r.json()).then(setApiKeyInfo);
  };

  useEffect(() => {
    fetch("/api/verificar-suscripcion")
      .then(r => r.json())
      .then(data => setSuscripcionActiva(data.activo))
    cargarApiKeyInfo();
  }, [])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagen(file);
    setImagenPreview(URL.createObjectURL(file));
  };

  const handleGenerar = async () => {
    if (!imagen || !prompt) return;
    setGenerando(true);
    setErrorMsg(null);
    setNecesitaApiKey(false);
    const formData = new FormData();
    formData.append("imagen", imagen);
    formData.append("prompt_texto", prompt);
    formData.append("cantidad", cantidad.toString());
    formData.append("incluir_texto", incluirTexto.toString());
    try {
      const res = await fetch("/api/generar", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || data.error) {
        if (data.error?.toLowerCase().includes("api key")) {
          setNecesitaApiKey(true);
          setErrorMsg("Necesitas configurar tu API key de OpenAI para generar imágenes.");
        } else {
          setErrorMsg(data.error || "Ocurrió un error al generar la imagen.");
        }
        return;
      }

      if (data.imagen_base64) {
        setGaleria((prev) => [`data:image/png;base64,${data.imagen_base64}`, ...prev]);
      }
    } catch (e) {
      setErrorMsg("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
      setGenerando(false);
    }
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

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#f9f9f8" }}>
      <div style={{ width: 220, background: "#fff", borderRight: "1px solid #e8e8e6", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: "1.5rem", letterSpacing: "-0.5px" }}>
          quiu<span style={{ color: "#7F77DD" }}>bot</span>
        </div>
        <a href="/marca" style={{ padding: "8px 12px", borderRadius: 8, color: "#666", fontSize: 14, textDecoration: "none" }}>
          🎨 Mi marca
        </a>
        <div onClick={() => setTab("imagenes")} style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: tab === "imagenes" ? "#f3f2fe" : "transparent", color: tab === "imagenes" ? "#534AB7" : "#666", fontWeight: tab === "imagenes" ? 500 : 400, fontSize: 14 }}>
          🎨 Imágenes IA
        </div>
        <div onClick={() => setTab("integraciones")} style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: tab === "integraciones" ? "#f3f2fe" : "transparent", color: tab === "integraciones" ? "#534AB7" : "#666", fontWeight: tab === "integraciones" ? 500 : 400, fontSize: 14 }}>
          🔌 Integraciones
        </div>
        <a href="/settings" style={{ padding: "8px 12px", borderRadius: 8, color: "#666", fontSize: 14, textDecoration: "none" }}>
          ⚙️ Configuración
        </a>
        <a href="/billing" style={{ padding: "8px 12px", borderRadius: 8, color: "#666", fontSize: 14, textDecoration: "none" }}>
          💳 Mi plan
        </a>
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
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e8e8e6", background: "#fff", fontSize: 15, fontWeight: 500 }}>
          {tab === "imagenes" ? "Generador de imágenes IA" : "Integraciones"}
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
          {tab === "imagenes" && (
            <div>
              {suscripcionActiva === null && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#999", fontSize: 14 }}>
                  Verificando suscripción...
                </div>
              )}
              {suscripcionActiva === false && (
                <div style={{ maxWidth: 480, margin: "2rem auto", background: "#fff", border: "2px solid #7F77DD", borderRadius: 16, padding: "2rem", textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>Activa tu suscripción</div>
                  <p style={{ fontSize: 14, color: "#666", marginBottom: "1.5rem" }}>Para generar imágenes necesitas tener un plan activo. Accede al plan Pro por $50 USD/mes.</p>
                  <a href="https://checkout.wompi.co/l/gcYZn4" target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "#7F77DD", color: "#fff", padding: "12px", borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
                    💳 Pagar $50 USD — Activar plan Pro
                  </a>
                  <a href="/pricing" style={{ display: "block", marginTop: 8, color: "#7F77DD", fontSize: 13, textDecoration: "none" }}>
                    Ver detalles del plan
                  </a>
                </div>
              )}
              {suscripcionActiva === true && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 900 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div onClick={() => fileRef.current?.click()} style={{ border: "1.5px dashed #ccc", borderRadius: 12, padding: "2rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fff", minHeight: 180 }}>
                      {imagenPreview ? (
                        <img src={imagenPreview} alt="preview" style={{ maxHeight: 150, borderRadius: 8, objectFit: "contain" }} />
                      ) : (
                        <>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>☁️</div>
                          <div style={{ fontSize: 13, color: "#666" }}>Sube tu imagen base</div>
                          <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>PNG, JPG hasta 10MB</div>
                        </>
                      )}
                      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe el producto o la imagen que quieres generar..." style={{ flex: 1, resize: "none", border: "1px solid #e0e0e0", borderRadius: 10, padding: 12, fontSize: 13, fontFamily: "inherit", minHeight: 100 }} />
                      
                      <div style={{ display: "flex", gap: "20px", alignItems: "center", fontSize: 14 }}>
                        <label>Cantidad: <input type="number" min="1" max="4" value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} style={{ width: 40, padding: 4 }} /></label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="checkbox" checked={incluirTexto} onChange={(e) => setIncluirTexto(e.target.checked)} /> Incluir texto
                        </label>
                      </div>

                      <button onClick={handleGenerar} disabled={generando || !imagen || !prompt} style={{ background: generando ? "#aaa" : "#7F77DD", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: generando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                        {generando ? "⏳ Generando..." : "✨ Generar imagen"}
                      </button>
                      {errorMsg && (
                        <div style={{ background: necesitaApiKey ? "#fef3c7" : "#fee2e2", border: `1px solid ${necesitaApiKey ? "#fbbf24" : "#fca5a5"}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: necesitaApiKey ? "#92400e" : "#991b1b" }}>
                          <div style={{ marginBottom: necesitaApiKey ? 8 : 0 }}>{errorMsg}</div>
                          {necesitaApiKey && (
                            <button onClick={() => setTab("integraciones")} style={{ display: "inline-block", background: "#7F77DD", color: "#fff", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                              🔌 Ir a Integraciones
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {(galeria.length > 0 || generando) && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.75rem" }}>Galería</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        {generando && (
                          <div style={{ aspectRatio: "1", background: "#f3f2fe", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #AFA9EC" }}>
                            <div style={{ fontSize: 12, color: "#7F77DD" }}>Generando...</div>
                          </div>
                        )}
                        {galeria.map((img, i) => (
                          <img key={i} src={img} alt={`resultado ${i}`} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 12, border: "1px solid #e8e8e6", cursor: "pointer" }} onClick={() => window.open(img)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {tab === "integraciones" && (
            <div style={{ maxWidth: "600px", margin: "0 auto", padding: "2rem", background: "#fff", borderRadius: "16px", border: "1px solid #e8e8e6", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "2rem" }}>
                <div style={{ width: "60px", height: "60px", borderRadius: "12px", background: "#f3f2fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px" }}>🤖</div>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Conexión con OpenAI</h2>
                  <p style={{ fontSize: "14px", color: "#666", margin: "4px 0 0 0" }}>Configura tu API Key para habilitar la generación inteligente.</p>
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#333", marginBottom: "8px" }}>Estado de la conexión</label>
                <div style={{ padding: "12px 16px", borderRadius: "8px", background: apiKeyInfo?.hasKey ? "#f0fdf4" : "#fef2f2", border: apiKeyInfo?.hasKey ? "1px solid #bbf7d0" : "1px solid #fecaca", fontSize: "14px", color: apiKeyInfo?.hasKey ? "#166534" : "#991b1b", fontWeight: 500 }}>
                  {apiKeyInfo === null ? "Verificando..." : apiKeyInfo.hasKey ? `● Conectado: ${apiKeyInfo.preview}` : "● No conectado: Se requiere API Key"}
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#333", marginBottom: "8px" }}>API Key de OpenAI</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={nuevaApiKey}
                  onChange={(e) => setNuevaApiKey(e.target.value)}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e0e0e0", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              <button
                onClick={handleGuardarApiKey}
                disabled={!nuevaApiKey || guardandoApiKey}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "#7F77DD", color: "#fff", border: "none", fontSize: "14px", fontWeight: 600, cursor: nuevaApiKey ? "pointer" : "not-allowed", opacity: nuevaApiKey ? 1 : 0.6 }}
              >
                {guardandoApiKey ? "Guardando..." : apiKeyInfo?.hasKey ? "Actualizar API Key" : "Guardar API Key"}
              </button>
              
              {apiKeyGuardada && (
                <div style={{ marginTop: "1rem", textAlign: "center", fontSize: "13px", color: "#166534" }}>✓ Cambios guardados correctamente</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}