"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import CargandoQuiubot from "@/app/components/CargandoQuiubot";
import SelectorAlbum, { type ItemAlbum } from "@/app/components/SelectorAlbum";
import { OBJETIVOS_INFO } from "@/app/lib/objetivosInfo";
import type { AnalisisPieza } from "@/app/lib/analisisPieza";
import { GuionSchema, type Guion, type ObjetivoVideo, type Escena } from "@/video/guion.schema";
import type { MediosResueltos } from "@/video/escenas/tipos";
import { RECETAS } from "@/video/recetas";
import EditorEscena from "./EditorEscena";

const VistaPrevia = dynamic(() => import("./VistaPrevia"), { ssr: false });

type Paso = "cargando" | "sin-acceso" | "sin-adn" | "brief" | "generando" | "revision";

interface Intento {
  errores: string[];
  crudo: unknown;
}

interface Pista {
  id: string;
  mood: string;
  nombre: string | null;
  licencia_url: string | null;
}

const OBJETIVOS_VIDEO_IDS = new Set(Object.keys(RECETAS));

function tarjetaEstilo(seleccionado: boolean): React.CSSProperties {
  return {
    padding: "14px 12px",
    borderRadius: 12,
    border: seleccionado ? "2px solid #534AB7" : "1px solid #e5e5e5",
    background: seleccionado ? "#F3F2FE" : "#fff",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  };
}

export default function VideoNuevoPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("cargando");

  // --- brief ---
  const [objetivoId, setObjetivoId] = useState<ObjetivoVideo | null>(null);
  const [productoServicio, setProductoServicio] = useState("");
  const [datosProducto, setDatosProducto] = useState("");
  const [duracionS, setDuracionS] = useState<number>(10);
  const [usuarioCta, setUsuarioCta] = useState("");
  const [pistaId, setPistaId] = useState<string | null>(null);
  const [pistas, setPistas] = useState<Pista[]>([]);
  const [medios, setMedios] = useState<MediosResueltos>({});
  const [analisisPorPieza, setAnalisisPorPieza] = useState<Record<string, AnalisisPieza>>({});
  const [analizando, setAnalizando] = useState<string | null>(null);
  const [selectorContexto, setSelectorContexto] = useState<null | "brief" | number>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- resultado ---
  const [guion, setGuion] = useState<Guion | null>(null);
  const [pistaUrl, setPistaUrl] = useState<string | null>(null);
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [duracionMs, setDuracionMs] = useState<number | null>(null);
  const [mostrarDebug, setMostrarDebug] = useState(false);
  const [mostrarZonaSegura, setMostrarZonaSegura] = useState(false);
  const [modoAvanzado, setModoAvanzado] = useState(false);
  const [jsonTexto, setJsonTexto] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const receta = objetivoId ? RECETAS[objetivoId] : null;

  useEffect(() => {
    (async () => {
      try {
        const rolRes = await fetch("/api/usuario/rol");
        const rolData = await rolRes.json();
        if (rolData.rol !== "admin") {
          setPaso("sin-acceso");
          return;
        }
        const adnRes = await fetch("/api/marca-adn");
        const adnData = await adnRes.json();
        if (!adnData?.tieneAdn) {
          setPaso("sin-adn");
          return;
        }
        const musicaRes = await fetch("/api/admin/musica");
        const musicaData = await musicaRes.json().catch(() => ({ pistas: [] }));
        setPistas((musicaData.pistas || []).filter((p: { activo: boolean }) => p.activo));
        setPaso("brief");
      } catch {
        setPaso("sin-acceso");
      }
    })();
  }, []);

  function elegirObjetivo(id: ObjetivoVideo) {
    setObjetivoId(id);
    const r = RECETAS[id];
    setDuracionS(Math.round((r.duracionMinS + r.duracionMaxS) / 2));
  }

  function alternarModoAvanzado() {
    setModoAvanzado((previo) => {
      if (!previo && guion) setJsonTexto(JSON.stringify(guion, null, 2));
      return !previo;
    });
  }

  async function generar() {
    if (!objetivoId || !productoServicio.trim()) {
      setErrorMsg("Falta el objetivo o el producto/servicio.");
      return;
    }
    if (receta?.requiereUsuarioEnCta && !usuarioCta.trim()) {
      setErrorMsg("Falta el @usuario de la cuenta para este objetivo.");
      return;
    }
    setErrorMsg(null);
    setPaso("generando");
    try {
      const res = await fetch("/api/video/guion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objetivo_id: objetivoId,
          producto_servicio: productoServicio,
          datos_producto: datosProducto,
          duracion_s: duracionS,
          media_ids: Object.keys(medios),
          pista_id: pistaId,
          usuario_cta: usuarioCta || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setIntentos(data.intentos || []);
      setDuracionMs(typeof data.duracion_ms === "number" ? data.duracion_ms : null);

      if (!res.ok || !data.guion) {
        setErrorMsg(data.error || "No se pudo generar el guion.");
        setMostrarDebug(true);
        setPaso("brief");
        return;
      }

      setGuion(data.guion);
      setMedios((prev) => ({ ...prev, ...(data.medios || {}) }));
      setPistaUrl(data.pista_url || null);
      setModoAvanzado(false);
      setPaso("revision");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "No se pudo conectar con el servidor.");
      setPaso("brief");
    }
  }

  function cambiarEscena(indice: number, nueva: Escena) {
    if (!guion) return;
    const nuevasEscenas = [...guion.escenas];
    nuevasEscenas[indice] = nueva;
    setGuion({ ...guion, escenas: nuevasEscenas });
  }

  function elegirPiezaDesdeSelector(item: ItemAlbum) {
    if (!item.id) return;
    const id = item.id;
    const tipo: "imagen" | "video" = item.tipo === "video" ? "video" : "imagen";
    setMedios((prev) => ({ ...prev, [id]: { url: item.url_imagen, tipo } }));

    if (typeof selectorContexto === "number" && guion) {
      const escena = guion.escenas[selectorContexto];
      if (escena.tipo === "producto_hero" || escena.tipo === "gancho_texto") {
        cambiarEscena(selectorContexto, { ...escena, params: { ...escena.params, media_id: id } } as Escena);
      }
    }
    setSelectorContexto(null);

    // Imagen con texto, "al elegir piezas" (no solo al generar el guion):
    // se pide una sola vez por pieza -- si ya está en album_creativos.analisis
    // la ruta responde con en_cache:true sin volver a pagarlo.
    if (tipo === "imagen" && !analisisPorPieza[id]) {
      setAnalizando(id);
      fetch("/api/video/analizar-pieza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_id: id }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.analisis) setAnalisisPorPieza((prev) => ({ ...prev, [id]: data.analisis }));
        })
        .catch(() => {})
        .finally(() => setAnalizando((actual) => (actual === id ? null : actual)));
    }
  }

  function aplicarJson() {
    try {
      const parseado = JSON.parse(jsonTexto);
      const resultado = GuionSchema.safeParse(parseado);
      if (!resultado.success) {
        setJsonError(resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · "));
        return;
      }
      setGuion(resultado.data);
      setJsonError(null);
    } catch {
      setJsonError("No es un JSON válido.");
    }
  }

  function descargarJson() {
    if (!guion) return;
    const blob = new Blob([JSON.stringify(guion, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "guion.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const piezasElegidas = useMemo(() => Object.entries(medios), [medios]);

  if (paso === "cargando") return <CargandoQuiubot mensaje="Cargando" />;

  if (paso === "sin-acceso") {
    return (
      <PantallaAviso
        titulo="Video con código — solo admin por ahora"
        texto="Todavía estamos puliendo esta función. Vuelve pronto."
        boton="Volver al panel"
        onClick={() => router.push("/")}
      />
    );
  }

  if (paso === "sin-adn") {
    return (
      <PantallaAviso
        titulo="Genera primero el ADN de tu marca"
        texto="El guion del video usa los colores y el tono de tu marca -- genera tu ADN en Mi marca antes de crear un video."
        boton="Ir a Mi marca"
        onClick={() => router.push("/marca")}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#1a1a1a" }}>Video de anuncio con código</h1>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
          Fase 1a -- solo admin.{" "}
          <a href="/video/kling" style={{ color: "#534AB7" }}>
            Flujo anterior (Kling)
          </a>
        </p>

        {errorMsg && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
            {errorMsg}
          </div>
        )}

        {(paso === "brief" || paso === "generando") && (
          <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#1a1a1a" }}>1. Objetivo de la campaña</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 20 }}>
              {OBJETIVOS_INFO.filter((o) => OBJETIVOS_VIDEO_IDS.has(o.id)).map((o) => (
                <button key={o.id} type="button" style={tarjetaEstilo(objetivoId === o.id)} onClick={() => elegirObjetivo(o.id as ObjetivoVideo)}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "#1a1a1a" }}>{o.label}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{o.desc}</div>
                </button>
              ))}
            </div>

            {receta && (
              <div style={{ fontSize: 12, color: "#534AB7", background: "#F3F2FE", borderRadius: 8, padding: "8px 12px", marginBottom: 20 }}>
                {receta.enfoque}
              </div>
            )}

            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#1a1a1a" }}>2. Producto o servicio</h2>
            <textarea
              value={productoServicio}
              onChange={(e) => setProductoServicio(e.target.value)}
              placeholder="Qué vendes o qué servicio ofreces"
              rows={2}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, marginBottom: 16, fontFamily: "inherit" }}
            />

            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#1a1a1a" }}>3. Qué destacar</h2>
            <textarea
              value={datosProducto}
              onChange={(e) => setDatosProducto(e.target.value)}
              placeholder="Precio, envíos, garantía, diferenciales reales -- la IA nunca inventa datos que no vengan aquí"
              rows={2}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, marginBottom: 16, fontFamily: "inherit" }}
            />

            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#1a1a1a" }}>4. Piezas del álbum (hasta 3)</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {piezasElegidas.map(([id, pieza]) => {
                const analisis = analisisPorPieza[id];
                return (
                  <div key={id} style={{ position: "relative", width: 72 }}>
                    {pieza.tipo === "video" ? (
                      <video src={pieza.url} style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover", display: "block" }} muted />
                    ) : (
                      <img src={pieza.url} alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover", display: "block" }} />
                    )}
                    <button
                      type="button"
                      onClick={() => setMedios((prev) => { const copia = { ...prev }; delete copia[id]; return copia; })}
                      style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#b91c1c", color: "#fff", border: "none", fontSize: 12, cursor: "pointer" }}
                    >
                      ×
                    </button>
                    {pieza.tipo === "imagen" && (
                      <div style={{ marginTop: 4, textAlign: "center" }}>
                        {analizando === id ? (
                          <span style={{ fontSize: 10, color: "#888" }}>analizando…</span>
                        ) : analisis ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 999,
                              background: analisis.tiene_texto ? "#fef3c7" : "#dcfce7",
                              color: analisis.tiene_texto ? "#92400e" : "#166534",
                            }}
                          >
                            {analisis.tiene_texto ? "con texto" : "foto limpia"}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
              {piezasElegidas.length < 3 && (
                <button
                  type="button"
                  onClick={() => setSelectorContexto("brief")}
                  style={{ width: 72, height: 72, borderRadius: 8, border: "1px dashed #bbb", background: "#fafafa", cursor: "pointer", fontSize: 22, color: "#888" }}
                >
                  +
                </button>
              )}
            </div>
            {piezasElegidas.some(([id, p]) => p.tipo === "imagen" && analisisPorPieza[id]?.tiene_texto) && (
              <p style={{ fontSize: 12, color: "#92400e", background: "#fef3c7", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
                Para videos más profesionales, sube fotos del producto sin texto.
              </p>
            )}
            <div style={{ marginBottom: 20 }} />

            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#1a1a1a" }}>5. Duración{receta ? ` (${receta.duracionMinS}-${receta.duracionMaxS}s)` : ""}</h2>
            <input
              type="number"
              value={duracionS}
              min={receta?.duracionMinS ?? 4}
              max={receta?.duracionMaxS ?? 25}
              onChange={(e) => setDuracionS(Number(e.target.value))}
              style={{ width: 100, padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, marginBottom: 20 }}
            />

            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#1a1a1a" }}>6. Música</h2>
            <select
              value={pistaId || ""}
              onChange={(e) => setPistaId(e.target.value || null)}
              style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, marginBottom: 20 }}
            >
              <option value="">Sin música</option>
              {pistas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre || p.id.slice(0, 8)} ({p.mood}){!p.licencia_url ? " -- solo pruebas" : ""}
                </option>
              ))}
            </select>

            {objetivoId === "seguidores_instagram" && (
              <>
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#1a1a1a" }}>7. @usuario de Instagram</h2>
                <input
                  value={usuarioCta}
                  onChange={(e) => setUsuarioCta(e.target.value)}
                  placeholder="@tu_cuenta"
                  style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, marginBottom: 20 }}
                />
              </>
            )}

            <button
              type="button"
              disabled={paso === "generando"}
              onClick={generar}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                border: "none",
                background: paso === "generando" ? "#aaa" : "#534AB7",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: paso === "generando" ? "default" : "pointer",
              }}
            >
              {paso === "generando" ? "Generando guion…" : "Generar guion"}
            </button>

            {paso === "generando" && <p style={{ fontSize: 12, color: "#888", marginTop: 10 }}>Puede tardar hasta un minuto.</p>}
          </div>
        )}

        {paso === "revision" && guion && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <button type="button" onClick={generar} style={botonSecundario}>
                  Regenerar guion
                </button>
                <button type="button" onClick={descargarJson} style={botonSecundario}>
                  Descargar guion.json
                </button>
                <button type="button" onClick={alternarModoAvanzado} style={botonSecundario}>
                  {modoAvanzado ? "Editor por escena" : "Modo avanzado (JSON)"}
                </button>
                <button type="button" onClick={() => setPaso("brief")} style={botonSecundario}>
                  ← Volver al brief
                </button>
              </div>

              {duracionMs !== null && (
                <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>Generado en {(duracionMs / 1000).toFixed(1)}s.</p>
              )}

              {!modoAvanzado && (
                <div>
                  {guion.escenas.map((escena, i) => {
                    const mediaId =
                      escena.tipo === "gancho_texto" || escena.tipo === "producto_hero" ? escena.params.media_id : undefined;
                    return (
                      <EditorEscena
                        key={escena.id}
                        escena={escena}
                        piezas={piezasElegidas.map(([id, p]) => ({ id, url_imagen: p.url, tipo: p.tipo }))}
                        tieneTextoPieza={mediaId ? analisisPorPieza[mediaId]?.tiene_texto : undefined}
                        onCambiar={(nueva) => cambiarEscena(i, nueva)}
                        onElegirPieza={() => setSelectorContexto(i)}
                      />
                    );
                  })}
                </div>
              )}

              {modoAvanzado && (
                <div>
                  <textarea
                    value={jsonTexto}
                    onChange={(e) => setJsonTexto(e.target.value)}
                    rows={28}
                    style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: 12, borderRadius: 8, border: "1px solid #ddd" }}
                  />
                  {jsonError && <p style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>{jsonError}</p>}
                  <button type="button" onClick={aplicarJson} style={{ ...botonSecundario, marginTop: 8 }}>
                    Aplicar JSON
                  </button>
                </div>
              )}

              <PanelDebug intentos={intentos} mostrar={mostrarDebug} onToggle={() => setMostrarDebug((v) => !v)} />
            </div>

            <div style={{ position: "sticky", top: 24 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 10, color: "#1a1a1a" }}>
                <input type="checkbox" checked={mostrarZonaSegura} onChange={(e) => setMostrarZonaSegura(e.target.checked)} />
                Ver zona segura
              </label>
              <VistaPrevia guion={guion} medios={medios} pistaUrl={pistaUrl} mostrarZonaSegura={mostrarZonaSegura} />
            </div>
          </div>
        )}

        {paso === "brief" && intentos.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <PanelDebug intentos={intentos} mostrar={mostrarDebug} onToggle={() => setMostrarDebug((v) => !v)} />
          </div>
        )}
      </div>

      {selectorContexto !== null && (
        <SelectorAlbum titulo="Elige una pieza del álbum" onElegir={elegirPiezaDesdeSelector} onCerrar={() => setSelectorContexto(null)} />
      )}
    </div>
  );
}

const botonSecundario: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #534AB7",
  background: "#fff",
  color: "#534AB7",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

function PantallaAviso({ titulo, texto, boton, onClick }: { titulo: string; texto: string; boton: string; onClick: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 20, border: "1px solid #e8e8e6", padding: "2.5rem 2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px" }}>{titulo}</h1>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 24px" }}>{texto}</p>
        <button
          onClick={onClick}
          style={{ display: "block", width: "100%", padding: "13px", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}
        >
          {boton}
        </button>
      </div>
    </div>
  );
}

// Admin-only, para ajustar el prompt sin abrir logs (sección pedida por
// Juan José para el paso 5, donde la IA se prueba en vivo por primera
// vez): cada intento con sus motivos de rechazo y el JSON crudo que
// devolvió el modelo, sea el guion final válido o no.
function PanelDebug({ intentos, mostrar, onToggle }: { intentos: Intento[]; mostrar: boolean; onToggle: () => void }) {
  if (intentos.length === 0) return null;
  return (
    <div style={{ marginTop: 16, border: "1px solid #e5e5e5", borderRadius: 10, overflow: "hidden" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "#f5f5f5", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#1a1a1a" }}
      >
        {mostrar ? "▾" : "▸"} Detalle de generación ({intentos.length} intento{intentos.length > 1 ? "s" : ""})
      </button>
      {mostrar && (
        <div style={{ padding: 14 }}>
          {intentos.map((intento, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#1a1a1a" }}>
                Intento {i + 1} -- {intento.errores.length === 0 ? "sin motivos de rechazo" : `${intento.errores.length} motivo(s)`}
              </div>
              {intento.errores.length > 0 && (
                <ul style={{ fontSize: 12, color: "#b91c1c", margin: "0 0 8px", paddingLeft: 18 }}>
                  {intento.errores.map((e, j) => (
                    <li key={j}>{e}</li>
                  ))}
                </ul>
              )}
              <pre style={{ fontSize: 11, background: "#f5f5f5", padding: 10, borderRadius: 6, overflowX: "auto", maxHeight: 240, color: "#1a1a1a" }}>
                {JSON.stringify(intento.crudo, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
