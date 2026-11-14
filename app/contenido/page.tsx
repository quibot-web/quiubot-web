"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RECETAS_ORGANICAS_INFO, ESTADOS_INFO, labelReceta, lunesDeLaSemana, type PublicacionOrganica } from "@/app/lib/contenido";
import { hoyBogota, fechaBogota } from "@/app/lib/fechaBogota";
import type { RecetaOrganicaId } from "@/video/guion.schema";

type Paso = "cargando" | "sin-acceso" | "calendario";

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function sumarDias(fechaYMD: string, dias: number): string {
  const [a, m, d] = fechaYMD.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function formatoDiaCorto(fechaYMD: string): string {
  const [, m, d] = fechaYMD.split("-");
  return `${d}/${m}`;
}

export default function ContenidoPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("cargando");
  const [semana, setSemana] = useState<string>("");
  const [piezas, setPiezas] = useState<PublicacionOrganica[]>([]);
  const [cargandoSemana, setCargandoSemana] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cargarSemana = useCallback(async (lunes: string) => {
    setCargandoSemana(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/contenido?semana=${lunes}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudo cargar el calendario.");
        return;
      }
      setSemana(data.semana);
      setPiezas(data.piezas || []);
    } catch {
      setErrorMsg("No se pudo cargar el calendario.");
    } finally {
      setCargandoSemana(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const rolRes = await fetch("/api/usuario/rol");
        const rolData = await rolRes.json();
        if (rolData.rol !== "admin") {
          setPaso("sin-acceso");
          return;
        }
        const lunesHoy = lunesDeLaSemana(hoyBogota());
        await cargarSemana(lunesHoy);
        setPaso("calendario");
      } catch {
        setPaso("sin-acceso");
      }
    })();
  }, [cargarSemana]);

  if (paso === "cargando") {
    return <PantallaCentro texto="Cargando…" />;
  }

  if (paso === "sin-acceso") {
    return <PantallaCentro texto="No tienes acceso a esta sección." />;
  }

  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(semana, i));

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "24px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>Contenido orgánico</h1>
            <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
              Semana del {formatoDiaCorto(dias[0])} al {formatoDiaCorto(dias[6])}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => cargarSemana(sumarDias(semana, -7))} style={botonSecundario} disabled={cargandoSemana}>
              ← Semana anterior
            </button>
            <button type="button" onClick={() => cargarSemana(lunesDeLaSemana(hoyBogota()))} style={botonSecundario} disabled={cargandoSemana}>
              Hoy
            </button>
            <button type="button" onClick={() => cargarSemana(sumarDias(semana, 7))} style={botonSecundario} disabled={cargandoSemana}>
              Semana siguiente →
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <button type="button" style={botonPrimario} onClick={() => setMostrarFormulario(true)}>
            ＋ Agregar reel
          </button>
          <button type="button" style={{ ...botonSecundario, opacity: 0.6, cursor: "not-allowed" }} disabled title="Disponible pronto -- el Director todavía no arma el calendario solo.">
            Pedir propuesta al Director (próximamente)
          </button>
        </div>

        {errorMsg && <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>{errorMsg}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(140px, 1fr))", gap: 12, overflowX: "auto" }}>
          {dias.map((fecha, i) => {
            const esHoy = fecha === hoyBogota();
            const piezasDelDia = piezas.filter((p) => fechaBogota(new Date(p.programada_para)) === fecha);
            return (
              <div
                key={fecha}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: esHoy ? "2px solid #534AB7" : "1px solid #e5e5e5",
                  padding: 12,
                  minHeight: 180,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: esHoy ? "#534AB7" : "#666", marginBottom: 10 }}>
                  {DIAS_SEMANA[i]} {formatoDiaCorto(fecha)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {piezasDelDia.length === 0 && <div style={{ fontSize: 12, color: "#bbb" }}>Sin piezas</div>}
                  {piezasDelDia.map((p) => (
                    <TarjetaPieza key={p.id} pieza={p} onClick={() => router.push(`/contenido/${p.id}`)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {mostrarFormulario && (
        <FormularioAgregarReel
          semana={semana}
          onCerrar={() => setMostrarFormulario(false)}
          onCreado={() => {
            setMostrarFormulario(false);
            cargarSemana(semana);
          }}
        />
      )}
    </div>
  );
}

function TarjetaPieza({ pieza, onClick }: { pieza: PublicacionOrganica; onClick: () => void }) {
  const estadoInfo = ESTADOS_INFO[pieza.estado];
  const hora = new Date(pieza.programada_para).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
  return (
    <div onClick={onClick} style={{ borderRadius: 10, border: "1px solid #eee", padding: "8px 10px", background: "#fafafa", cursor: "pointer" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>{labelReceta(pieza.receta_organica)}</div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{hora}</div>
      <div style={{ display: "inline-block", marginTop: 6, fontSize: 10, fontWeight: 700, color: "#fff", background: estadoInfo.color, borderRadius: 999, padding: "2px 8px" }}>
        {estadoInfo.label}
      </div>
      {pieza.receta_organica === "serie_partes" && !pieza.continua_de_id && (
        <div style={{ fontSize: 10, color: "#C8893F", marginTop: 4, fontWeight: 600 }}>⚠ La parte 1 promete una parte 2</div>
      )}
    </div>
  );
}

function FormularioAgregarReel({ semana, onCerrar, onCreado }: { semana: string; onCerrar: () => void; onCreado: () => void }) {
  const [receta, setReceta] = useState<RecetaOrganicaId>(RECETAS_ORGANICAS_INFO[0].id);
  const [fecha, setFecha] = useState(semana);
  const [hora, setHora] = useState("12:00");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const programada_para = `${fecha}T${hora}:00-05:00`;
      const res = await fetch("/api/contenido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receta_organica: receta, programada_para }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear el reel.");
        return;
      }
      onCreado();
    } catch {
      setError("No se pudo crear el reel.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "min(420px, 90vw)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 16px", color: "#1a1a1a" }}>Agregar reel</h2>

        <label style={etiquetaCampo}>Receta</label>
        <select value={receta} onChange={(e) => setReceta(e.target.value as RecetaOrganicaId)} style={campo}>
          {RECETAS_ORGANICAS_INFO.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>

        <label style={etiquetaCampo}>Fecha</label>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={campo} />

        <label style={etiquetaCampo}>Hora</label>
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={campo} />

        {error && <p style={{ color: "#b91c1c", fontSize: 12, margin: "8px 0 0" }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onCerrar} style={{ ...botonSecundario, flex: 1 }}>
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando} style={{ ...botonPrimario, flex: 1 }}>
            {guardando ? "Guardando…" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PantallaCentro({ texto }: { texto: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", color: "#666" }}>
      {texto}
    </div>
  );
}

const botonPrimario: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#534AB7",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const botonSecundario: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #534AB7",
  background: "#fff",
  color: "#534AB7",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const etiquetaCampo: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "#444", margin: "12px 0 4px" };

const campo: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 14,
  fontFamily: "inherit",
};
