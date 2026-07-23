"use client";
import { useState, useRef, useEffect } from "react";
import { Upload, X, Check, Sparkles } from "lucide-react";
import EscenaParticulasADN3D from "@/app/components/EscenaParticulasADN3D";

const MIN_IMAGENES = 3;
const MAX_IMAGENES = 5;
const COLOR_ACTIVO = "#534AB7";
const COLOR_CLARO = "#7F77DD";
const FONDO_ACTIVO = "#F3F2FE";

type CategoriaKey =
  | "paleta_color"
  | "tipografia"
  | "composicion"
  | "tratamiento_visual"
  | "tono_emocional"
  | "elementos_recurrentes"
  | "estilo_comunicacion";

const CATEGORIAS: { key: CategoriaKey; titulo: string }[] = [
  { key: "paleta_color", titulo: "Paleta de color" },
  { key: "tipografia", titulo: "Tipografía" },
  { key: "composicion", titulo: "Composición y encuadre" },
  { key: "tratamiento_visual", titulo: "Tratamiento visual" },
  { key: "tono_emocional", titulo: "Tono emocional y percepción" },
  { key: "elementos_recurrentes", titulo: "Elementos recurrentes" },
  { key: "estilo_comunicacion", titulo: "Estilo de comunicación" },
];

const ETIQUETAS: Record<string, string> = {
  color_primario_hex: "Color primario",
  color_secundario_hex: "Color secundario",
  colores_acento_hex: "Colores de acento",
  temperatura: "Temperatura",
  nivel_saturacion: "Saturación",
  nivel_contraste: "Contraste",
  rol_funcional_colores: "Rol de cada color",
  relacion_cromatica: "Relación cromática",
  uso_blanco_negro_puro: "Blanco/negro puro",
  estilo: "Estilo",
  peso_titulos: "Peso en títulos",
  peso_cuerpo: "Peso en cuerpo de texto",
  uso_mayusculas: "Mayúsculas/minúsculas",
  tracking: "Espaciado (tracking)",
  interlineado: "Interlineado",
  niveles_jerarquia: "Niveles de jerarquía",
  alineacion_dominante: "Alineación dominante",
  usa_italicas: "Usa itálicas",
  porcentaje_encuadre_elemento_principal: "% del encuadre",
  punto_focal: "Punto focal",
  espacio_negativo: "Espacio negativo",
  simetria: "Simetría",
  direccion_lectura: "Dirección de lectura",
  capas_profundidad: "Capas de profundidad",
  formato_dominante: "Formato dominante",
  iluminacion: "Iluminación",
  direccion_luz: "Dirección de luz",
  manejo_sombras: "Manejo de sombras",
  filtro_edicion: "Filtro / edición",
  profundidad_de_campo: "Profundidad de campo",
  nivel_pulido_fotografico: "Nivel de pulido",
  sensaciones_principales: "Sensaciones que transmite",
  nivel_pulido_percibido: "Pulido percibido",
  formalidad: "Formalidad",
  publico_inferido: "Público inferido",
  motivos_iconografia: "Motivos / iconografía",
  marcos_bordes_patrones: "Marcos, bordes y patrones",
  firma_visual: "Firma visual",
  hay_texto_visible: "¿Hay texto visible?",
  tono_mensaje: "Tono del mensaje",
  longitud_titulares: "Longitud de titulares",
  usa_preguntas_retoricas: "Usa preguntas retóricas",
  persona_gramatical: "Persona gramatical",
  usa_urgencia_escasez: "Usa urgencia/escasez",
};

function formatearValor(v: any): string {
  if (v === null || v === undefined) return "No determinado";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

// Geometría de la hélice — usada tanto por el canvas de partículas (durante
// el análisis) como por el SVG final interactivo (después).
const HELICE = { cx: 130, amp: 45, top: 30, bottom: 410, turns: 2.5, w: 260, h: 440 };
function xEnY(y: number, fase: number) {
  const t = (y - HELICE.top) / (HELICE.bottom - HELICE.top);
  return HELICE.cx + HELICE.amp * Math.sin(t * HELICE.turns * Math.PI * 2 + fase);
}
function trazoHebra(fase: number): string {
  let d = "";
  for (let y = HELICE.top; y <= HELICE.bottom; y += 6) {
    const x = xEnY(y, fase);
    d += (y === HELICE.top ? "M" : "L") + x.toFixed(1) + "," + y;
  }
  return d;
}
function posicionesNodos(n: number) {
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    ys.push(HELICE.top + (HELICE.bottom - HELICE.top) * (i / (n - 1)));
  }
  return ys;
}

export default function MarcaPage() {
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [tieneAdn, setTieneAdn] = useState(false);
  const [adn, setAdn] = useState<Record<string, any> | null>(null);
  const [resumen, setResumen] = useState<string>("");

  const [imagenes, setImagenes] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [analizando, setAnalizando] = useState(false);
  const [faseAnimacion, setFaseAnimacion] = useState(-1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nodoSeleccionado, setNodoSeleccionado] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/marca-adn")
      .then((r) => r.json())
      .then((data) => {
        if (data.tieneAdn) {
          setTieneAdn(true);
          setAdn(data.adn_marca);
          setResumen(data.adn_resumen || "");
        }
      })
      .finally(() => setCargandoInicial(false));
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || imagenes.length >= MAX_IMAGENES) return;
    setImagenes((prev) => [...prev, file]);
    setPreviews((prev) => [...prev, URL.createObjectURL(file)]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleQuitar = (idx: number) => {
    setImagenes((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const handleAnalizar = async () => {
    if (imagenes.length < MIN_IMAGENES) return;
    setAnalizando(true);
    setErrorMsg(null);
    setFaseAnimacion(0);

    const avanzarAnimacion = new Promise<void>((resolve) => {
      let i = 0;
      const intervalo = setInterval(() => {
        i++;
        setFaseAnimacion(i);
        if (i >= CATEGORIAS.length) {
          clearInterval(intervalo);
          resolve();
        }
      }, 750);
    });

    try {
      const imagenesBase64 = await Promise.all(imagenes.map(fileToBase64));
      const [res] = await Promise.all([
        fetch("/api/marca-adn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagenes_base64: imagenesBase64 }),
        }),
        avanzarAnimacion,
      ]);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setErrorMsg(data.error || "No se pudo analizar tu ADN de marca. Intenta de nuevo.");
        setFaseAnimacion(-1);
        return;
      }
      setAdn(data.adn_marca);
      setResumen(data.adn_resumen || "");
      setTieneAdn(true);
    } catch (e) {
      setErrorMsg("No se pudo conectar con el servidor.");
      setFaseAnimacion(-1);
    } finally {
      setAnalizando(false);
    }
  };

  const handleVolverAAnalizar = () => {
    setTieneAdn(false);
    setAdn(null);
    setResumen("");
    setImagenes([]);
    setPreviews([]);
    setFaseAnimacion(-1);
    setNodoSeleccionado(null);
  };

  if (cargandoInicial) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", color: "#999" }}>
        Cargando...
      </div>
    );
  }

  const nodeYs = posicionesNodos(CATEGORIAS.length);
  const mostrandoHeliceFinal = tieneAdn && adn && !analizando;
  const construyendoOListo = analizando || mostrandoHeliceFinal;

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e6", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ fontSize: 18, fontWeight: 700, textDecoration: "none", color: "#1a1a1a" }}>
          quiu<span style={{ color: "#7F77DD" }}>bot</span>
        </a>
        <div style={{ fontSize: 13, color: "#999" }}>ADN de marca</div>
      </div>

      <div style={{ flex: 1, padding: "2.5rem 1.5rem" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {!construyendoOListo && (
            <>
              <div style={{ marginBottom: "2rem" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#7F77DD", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                  ADN de marca
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 8, lineHeight: 1.3 }}>
                  Sube tus mejores creativos ya publicados
                </h1>
                <p style={{ fontSize: 14, color: "#666", lineHeight: 1.5 }}>
                  El sistema analiza {MIN_IMAGENES} a {MAX_IMAGENES} piezas reales que ya usaste y con las que estás conforme — colores, tipografía, composición, tono — para poder generar creativos nuevos que se sientan hechos por ti. Esta pantalla es solo de lectura: no hay nada que editar, solo mira cómo se construye tu ADN.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
                {previews.map((src, idx) => (
                  <div key={idx} style={{ position: "relative", aspectRatio: "1" }}>
                    <img src={src} alt={`Creativo ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12, border: "1px solid #e0e0e0" }} />
                    <button
                      onClick={() => handleQuitar(idx)}
                      title="Quitar"
                      style={{ position: "absolute", top: -6, right: -6, width: 24, height: 24, borderRadius: "50%", background: "#1a1a1a", color: "#fff", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </div>
                ))}
                {imagenes.length < MAX_IMAGENES && (
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{ aspectRatio: "1", borderRadius: 12, border: "1.5px dashed #7F77DD", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fcfcff", gap: 6 }}
                  >
                    <Upload size={22} color="#534AB7" strokeWidth={2} />
                    <span style={{ fontSize: 11, color: "#534AB7", fontWeight: 500, textAlign: "center", padding: "0 8px" }}>Subir creativo</span>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
              </div>

              <p style={{ fontSize: 12, color: "#999", marginBottom: 20 }}>
                {imagenes.length}/{MAX_IMAGENES} subidos · mínimo {MIN_IMAGENES} para analizar
              </p>

              {errorMsg && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleAnalizar}
                disabled={imagenes.length < MIN_IMAGENES}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: imagenes.length < MIN_IMAGENES ? "#eee" : "#534AB7",
                  color: imagenes.length < MIN_IMAGENES ? "#aaa" : "#fff",
                  border: "none",
                  padding: "14px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: imagenes.length < MIN_IMAGENES ? "not-allowed" : "pointer",
                }}
              >
                <Sparkles size={17} strokeWidth={2} />
                Analizar mis creativos
              </button>
            </>
          )}

          {construyendoOListo && (
            <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
              {analizando ? (
                <EscenaParticulasADN3D faseActual={faseAnimacion} />
              ) : (
                <svg width="220" height="440" viewBox="0 0 220 440" style={{ flexShrink: 0, margin: "0 auto" }}>
                  <path d={trazoHebra(0)} fill="none" stroke="#EEEDFE" strokeWidth={3} />
                  <path d={trazoHebra(Math.PI)} fill="none" stroke="#EEEDFE" strokeWidth={3} />
                  {nodeYs.map((y, i) => {
                    const xa = xEnY(y, 0);
                    const xb = xEnY(y, Math.PI);
                    const seleccionado = nodoSeleccionado === i;
                    return (
                      <g key={i}>
                        <line x1={xa} y1={y} x2={xb} y2={y} stroke="#CECBF6" strokeWidth={3} />
                        <circle
                          cx={xa} cy={y}
                          r={seleccionado ? 13 : 9}
                          fill={COLOR_ACTIVO}
                          stroke="#fff"
                          strokeWidth={seleccionado ? 4 : 3}
                          style={{ cursor: "pointer", transition: "all .3s cubic-bezier(.34,1.56,.64,1)" }}
                          onClick={() => setNodoSeleccionado(i)}
                        />
                      </g>
                    );
                  })}
                </svg>
              )}

              <div style={{ flex: 1, minWidth: 280 }}>
                {analizando && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLOR_CLARO, animation: "adn-pulse 1s ease-in-out infinite" }} />
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: COLOR_ACTIVO }}>
                        {faseAnimacion < CATEGORIAS.length
                          ? `Analizando ${CATEGORIAS[Math.min(faseAnimacion, CATEGORIAS.length - 1)].titulo.toLowerCase()}...`
                          : "Sintetizando el ADN completo..."}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#999" }}>Esto puede tardar unos segundos. No cierres esta pestaña.</p>
                  </div>
                )}

                {mostrandoHeliceFinal && nodoSeleccionado === null && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Check size={14} color={COLOR_ACTIVO} strokeWidth={3} />
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: COLOR_ACTIVO }}>ADN DE MARCA COMPLETO</span>
                    </div>
                    <div style={{ background: FONDO_ACTIVO, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                      <p style={{ fontSize: 13, color: "#3C3489", lineHeight: 1.6, margin: 0 }}>{resumen}</p>
                    </div>
                    <p style={{ fontSize: 13, color: "#999", marginBottom: 20 }}>
                      Haz clic en cualquier punto de la hélice para ver ese fragmento en detalle.
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={handleVolverAAnalizar} style={{ flex: 1, background: "#fff", border: "1px solid #e0e0e0", color: "#666", padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        Volver a analizar
                      </button>
                      <a href="/" style={{ flex: 1, textAlign: "center", background: COLOR_ACTIVO, color: "#fff", padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                        Continuar al panel
                      </a>
                    </div>
                  </div>
                )}

                {mostrandoHeliceFinal && nodoSeleccionado !== null && adn && (
                  <div>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: COLOR_ACTIVO }}>
                      FRAGMENTO {String(nodoSeleccionado + 1).padStart(2, "0")}/07
                    </span>
                    <p style={{ fontSize: 17, fontWeight: 600, color: "#1a1a1a", margin: "4px 0 14px" }}>
                      {CATEGORIAS[nodoSeleccionado].titulo}
                    </p>
                    <div style={{ background: FONDO_ACTIVO, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                      {Object.entries(adn[CATEGORIAS[nodoSeleccionado].key] || {}).map(([campo, valor]) => (
                        <div key={campo} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 12, color: "#666", flexShrink: 0, minWidth: 130 }}>{ETIQUETAS[campo] || campo}</span>
                          {campo === "colores_acento_hex" || campo === "color_primario_hex" || campo === "color_secundario_hex" ? (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {(Array.isArray(valor) ? valor : [valor]).filter(Boolean).map((hex: string, i: number) => (
                                <span key={i} title={hex} style={{ width: 18, height: 18, borderRadius: 5, background: hex, border: "1px solid rgba(0,0,0,0.08)", display: "inline-block" }} />
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: 13, color: "#3C3489", fontWeight: 500, textAlign: "right" }}>{formatearValor(valor)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setNodoSeleccionado(null)} style={{ width: "100%", background: "#fff", border: "1px solid #e0e0e0", color: COLOR_ACTIVO, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Ver toda la hélice
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes adn-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
      `}</style>
    </div>
  );
}