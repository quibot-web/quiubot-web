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
  
  // --- NUEVOS ESTADOS ---
  const [cantidad, setCantidad] = useState(1);
  const [conTexto, setConTexto] = useState(false);
  // ----------------------

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/verificar-suscripcion")
      .then(r => r.json())
      .then(data => setSuscripcionActiva(data.activo))
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
    const formData = new FormData();
    formData.append("imagen", imagen);
    formData.append("prompt_texto", prompt);
    
    // --- ENVIAR NUEVOS VALORES ---
    formData.append("cantidad", cantidad.toString());
    formData.append("incluir_texto", conTexto.toString());
    // -----------------------------

    try {
      const res = await fetch("/api/generar", { method: "POST", body: formData });
      const data = await res.json();
      if (data.imagen_base64) {
        setGaleria((prev) => [`data:image/png;base64,${data.imagen_base64}`, ...prev]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerando(false);
    }
  };

  const sidebarItem = (label: string, active: boolean, onClick: () => void) => (
    <div onClick={onClick} style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: active ? "#f3f2fe" : "transparent", color: active ? "#534AB7" : "#666", fontWeight: active ? 500 : 400, fontSize: 14 }}>
      {label}
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#f9f9f8" }}>
      <div style={{ width: 220, background: "#fff", borderRight: "1px solid #e8e8e6", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: "1.5rem", letterSpacing: "-0.5px" }}>
          quiu<span style={{ color: "#7F77DD" }}>bot</span>
        </div>
        {sidebarItem("🎨 Imágenes IA", tab === "imagenes", () => setTab("imagenes"))}
        {sidebarItem("🔌 Integraciones", tab === "integraciones", () => setTab("integraciones"))}
        <a href="/settings" style={{ padding: "8px 12px", borderRadius: 8, color: "#666", fontSize: 14, textDecoration: "none" }}>⚙️ Configuración</a>
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
              {/* ... [Bloques de suscripción igual] ... */}
              {suscripcionActiva === true && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 900 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div onClick={() => fileRef.current?.click()} style={{ border: "1.5px dashed #ccc", borderRadius: 12, padding: "2rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fff", minHeight: 180 }}>
                       {/* ... [Input de archivo igual] ... */}
                       <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe el producto..." style={{ flex: 1, resize: "none", border: "1px solid #e0e0e0", borderRadius: 10, padding: 12, fontSize: 13, minHeight: 100 }} />
                      
                      {/* --- NUEVA INTERFAZ DE OPCIONES --- */}
                      <div style={{ display: "flex", gap: "20px", alignItems: "center", padding: "5px 0" }}>
                        <label style={{ fontSize: 13, color: "#666" }}>
                          Cantidad:
                          <input type="number" min="1" max="4" value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} style={{ marginLeft: 8, width: 45, padding: 4, borderRadius: 6, border: "1px solid #ccc" }} />
                        </label>
                        <label style={{ fontSize: 13, color: "#666", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input type="checkbox" checked={conTexto} onChange={(e) => setConTexto(e.target.checked)} />
                          Incluir texto
                        </label>
                      </div>
                      {/* ---------------------------------- */}

                      <button onClick={handleGenerar} disabled={generando || !imagen || !prompt} style={{ background: generando ? "#aaa" : "#7F77DD", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: generando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                        {generando ? "⏳ Generando..." : "✨ Generar imagen"}
                      </button>
                    </div>
                  </div>
                  {/* ... [Galería igual] ... */}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}