"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CargandoQuiubotInline } from "@/app/components/CargandoQuiubot";
import { MOODS_MUSICA, MOOD_LABEL, type MoodMusica } from "@/app/lib/moodsMusica";

type Pista = {
  id: string;
  mood: MoodMusica;
  public_id: string;
  nombre: string | null;
  activo: boolean;
  creado_en: string;
  cloudinary_name: string | null;
};

type Colaborador = {
  id: string;
  email: string;
  activo: boolean;
  creado_en: string;
};

export default function AdminMusicaClient({ esAdmin }: { esAdmin: boolean }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pistas, setPistas] = useState<Pista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [mood, setMood] = useState<MoodMusica | "">("");
  const [nombre, setNombre] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [cargandoColaboradores, setCargandoColaboradores] = useState(esAdmin);
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [agregandoColaborador, setAgregandoColaborador] = useState(false);
  const [errorColaborador, setErrorColaborador] = useState<string | null>(null);
  const [procesandoColaborador, setProcesandoColaborador] = useState<string | null>(null);

  const cargarPistas = async () => {
    setCargando(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/musica");
      const data = await res.json();
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudieron cargar las pistas.");
        return;
      }
      setPistas(data.pistas || []);
    } catch {
      setErrorMsg("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  const cargarColaboradores = async () => {
    if (!esAdmin) return;
    setCargandoColaboradores(true);
    try {
      const res = await fetch("/api/admin/musica/colaboradores");
      const data = await res.json();
      if (res.ok) setColaboradores(data.colaboradores || []);
    } finally {
      setCargandoColaboradores(false);
    }
  };

  useEffect(() => {
    cargarPistas();
    cargarColaboradores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubir = async () => {
    if (!archivo || !mood) return;
    setSubiendo(true);
    setErrorSubida(null);
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("mood", mood);
      if (nombre.trim()) formData.append("nombre", nombre.trim());

      const res = await fetch("/api/admin/musica", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorSubida(data.error || "No se pudo subir la pista.");
        return;
      }

      setArchivo(null);
      setMood("");
      setNombre("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      cargarPistas();
    } catch {
      setErrorSubida("No se pudo conectar con el servidor.");
    } finally {
      setSubiendo(false);
    }
  };

  const handleToggleActivoPista = async (p: Pista) => {
    setProcesando(p.id);
    try {
      const res = await fetch(`/api/admin/musica/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !p.activo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo actualizar la pista.");
        return;
      }
      cargarPistas();
    } finally {
      setProcesando(null);
    }
  };

  const handleAgregarColaborador = async () => {
    const emailNuevo = nuevoEmail.trim().toLowerCase();
    if (!emailNuevo) return;
    setAgregandoColaborador(true);
    setErrorColaborador(null);
    try {
      const res = await fetch("/api/admin/musica/colaboradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNuevo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorColaborador(data.error || "No se pudo agregar el colaborador.");
        return;
      }
      setNuevoEmail("");
      cargarColaboradores();
    } catch {
      setErrorColaborador("No se pudo conectar con el servidor.");
    } finally {
      setAgregandoColaborador(false);
    }
  };

  const handleToggleActivoColaborador = async (c: Colaborador) => {
    setProcesandoColaborador(c.id);
    try {
      const res = await fetch(`/api/admin/musica/colaboradores/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !c.activo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo actualizar el colaborador.");
        return;
      }
      cargarColaboradores();
    } finally {
      setProcesandoColaborador(null);
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

  const inputStyle = {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid rgb(224, 224, 224)",
    fontSize: 13,
    boxSizing: "border-box" as const,
  };

  const pistasPorMood: Record<MoodMusica, Pista[]> = {
    energetica: [],
    inspiradora: [],
    urgente: [],
    confiable: [],
    calida: [],
  };
  for (const p of pistas) {
    if (pistasPorMood[p.mood]) pistasPorMood[p.mood].push(p);
  }

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
          Música por mood
        </h1>
        <p style={{ fontSize: 13, color: "rgb(153, 153, 153)", marginBottom: "1.5rem" }}>
          {esAdmin
            ? "Pistas musicales para los videos con IA, agrupadas por mood."
            : "Tus pistas musicales subidas para los videos con IA."}
        </p>

        {/* Formulario de subida */}
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "rgb(26, 26, 26)", marginBottom: 12 }}>Subir pista nueva</p>

          {errorSubida && (
            <div style={{ background: "rgb(254, 242, 242)", border: "1px solid rgb(252, 165, 165)", color: "rgb(153, 27, 27)", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
              {errorSubida}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "rgb(102, 102, 102)", display: "block", marginBottom: 4 }}>
                Archivo (mp3)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mpeg,audio/mp3,.mp3"
                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "rgb(102, 102, 102)", display: "block", marginBottom: 4 }}>
                Mood
              </label>
              <select value={mood} onChange={(e) => setMood(e.target.value as MoodMusica)} style={inputStyle}>
                <option value="">Selecciona un mood...</option>
                {MOODS_MUSICA.map((m) => (
                  <option key={m} value={m}>{MOOD_LABEL[m]}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "rgb(102, 102, 102)", display: "block", marginBottom: 4 }}>
                Nombre (opcional)
              </label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Synth motivacional"
                style={inputStyle}
              />
            </div>

            <button
              onClick={handleSubir}
              disabled={!archivo || !mood || subiendo}
              style={{
                background: !archivo || !mood || subiendo ? "rgb(204, 204, 204)" : "rgb(83, 74, 183)",
                color: "#fff",
                border: "none",
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: !archivo || !mood || subiendo ? "not-allowed" : "pointer",
              }}
            >
              {subiendo ? "Subiendo..." : "Subir pista"}
            </button>
          </div>
        </div>

        {/* Lista de pistas */}
        {cargando && (
          <div style={cardStyle}>
            <CargandoQuiubotInline />
          </div>
        )}

        {!cargando && errorMsg && (
          <div style={cardStyle}>
            <p style={{ color: "rgb(153, 27, 27)", fontSize: 14, textAlign: "center" }}>{errorMsg}</p>
          </div>
        )}

        {!cargando && !errorMsg && pistas.length === 0 && (
          <div style={{ ...cardStyle, textAlign: "center", padding: "2.5rem" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "rgb(26, 26, 26)", marginBottom: 8 }}>
              Todavía no hay pistas
            </p>
            <p style={{ fontSize: 13, color: "rgb(102, 102, 102)", margin: 0 }}>
              Sube la primera pista con el formulario de arriba.
            </p>
          </div>
        )}

        {!cargando && !errorMsg && pistas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {MOODS_MUSICA.map((m) => {
              const delMood = pistasPorMood[m];
              if (delMood.length === 0) return null;
              return (
                <div key={m}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "rgb(83, 74, 183)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    {MOOD_LABEL[m]}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {delMood.map((p) => (
                      <div key={p.id} style={{ ...cardStyle, padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "rgb(26, 26, 26)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.nombre || p.public_id}
                          </div>
                          <div style={{ fontSize: 11.5, color: "rgb(153, 153, 153)", marginTop: 2 }}>
                            {esAdmin && p.cloudinary_name ? `${p.cloudinary_name} · ` : ""}
                            {new Date(p.creado_en).toLocaleDateString("es-CO")}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <span style={chipStyle(p.activo ? "rgb(220, 252, 231)" : "rgb(243, 244, 246)", p.activo ? "rgb(22, 163, 74)" : "rgb(107, 114, 128)")}>
                            {p.activo ? "Activa" : "Inactiva"}
                          </span>
                          <button
                            onClick={() => handleToggleActivoPista(p)}
                            disabled={procesando === p.id}
                            style={{
                              background: "rgb(255, 255, 255)",
                              color: "rgb(102, 102, 102)",
                              border: "1px solid rgb(220, 220, 220)",
                              padding: "6px 12px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: procesando === p.id ? "not-allowed" : "pointer",
                            }}
                          >
                            {procesando === p.id ? "..." : p.activo ? "Desactivar" : "Reactivar"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Colaboradores -- solo admin */}
        {esAdmin && (
          <div style={{ ...cardStyle, marginTop: 32 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "rgb(26, 26, 26)", marginBottom: 4 }}>Colaboradores</p>
            <p style={{ fontSize: 12.5, color: "rgb(153, 153, 153)", marginBottom: 14 }}>
              Emails que pueden subir y administrar sus propias pistas, sin ser admin general.
            </p>

            {errorColaborador && (
              <div style={{ background: "rgb(254, 242, 242)", border: "1px solid rgb(252, 165, 165)", color: "rgb(153, 27, 27)", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
                {errorColaborador}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                value={nuevoEmail}
                onChange={(e) => setNuevoEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleAgregarColaborador}
                disabled={!nuevoEmail.trim() || agregandoColaborador}
                style={{
                  background: !nuevoEmail.trim() || agregandoColaborador ? "rgb(204, 204, 204)" : "rgb(83, 74, 183)",
                  color: "#fff",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !nuevoEmail.trim() || agregandoColaborador ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {agregandoColaborador ? "Agregando..." : "Agregar"}
              </button>
            </div>

            {cargandoColaboradores && <CargandoQuiubotInline />}

            {!cargandoColaboradores && colaboradores.length === 0 && (
              <p style={{ fontSize: 13, color: "rgb(153, 153, 153)" }}>Todavía no hay colaboradores.</p>
            )}

            {!cargandoColaboradores && colaboradores.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {colaboradores.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: "1px solid rgb(232, 232, 230)", borderRadius: 10 }}>
                    <span style={{ fontSize: 13, color: "rgb(26, 26, 26)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.email}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <span style={chipStyle(c.activo ? "rgb(220, 252, 231)" : "rgb(243, 244, 246)", c.activo ? "rgb(22, 163, 74)" : "rgb(107, 114, 128)")}>
                        {c.activo ? "Activo" : "Inactivo"}
                      </span>
                      <button
                        onClick={() => handleToggleActivoColaborador(c)}
                        disabled={procesandoColaborador === c.id}
                        style={{
                          background: "rgb(255, 255, 255)",
                          color: "rgb(102, 102, 102)",
                          border: "1px solid rgb(220, 220, 220)",
                          padding: "6px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: procesandoColaborador === c.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {procesandoColaborador === c.id ? "..." : c.activo ? "Desactivar" : "Reactivar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
