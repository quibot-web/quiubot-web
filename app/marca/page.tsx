"use client";
import { useState, useRef, useEffect } from "react";
import { Upload, X, Check, Sparkles, Loader2 } from "lucide-react";
import EscenaParticulasADN3D from "@/app/components/EscenaParticulasADN3D";

const MIN_IMAGENES = 3;
const MAX_IMAGENES = 5;
const COLOR_ACTIVO = "#534AB7";
const COLOR_CLARO = "#7F77DD";

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

// Ambiente decorativo claro, tipo "esfera suave": un halo circular difuso
// detrás del contenido, con unos pocos puntos flotando dentro — la misma
// idea visual que ya usas en otros loaders de la app, adaptada al morado
// de marca. Los puntos se generan solo en el cliente para no causar
// diferencias de hidratación.
function GlowAmbienteADN() {
  const [puntos, setPuntos] = useState<{ x: number; y: number; r: number; o: number }[] | null>(null);

  useEffect(() => {
    const n = 16;
    const nuevos = Array.from({ length: n }, () => {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * 0.42;
      return {
        x: 50 + Math.cos(ang) * dist * 100,
        y: 50 + Math.sin(ang) * dist * 100,
        r: 1.5 + Math.random() * 3,
        o: 0.15 + Math.random() * 0.35,
      };
    });
    setPuntos(nuevos);
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 820, height: 820, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(127,119,221,0.16) 0%, rgba(127,119,221,0.07) 45%, rgba(127,119,221,0) 72%)",
        }}
      />
      {puntos && puntos.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.r * 2, height: p.r * 2,
            borderRadius: "50%",
            background: "#7F77DD",
            opacity: p.o,
          }}
        />
      ))}
    </div>
  );
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
  const [puntosSuspensivos, setPuntosSuspensivos] = useState(".");

  // Todas las categorías ya quedaron marcadas, pero el backend puede seguir
  // trabajando varios segundos más (la API real no termina exactamente
  // cuando termina la animación de 750ms por categoría). Sin esto, el
  // checklist se ve "congelado" en ese tramo — psicológicamente da la
  // sensación de que el sistema se colgó, no de que sigue trabajando.
  // Ciclamos los puntos suspensivos como único indicador que sigue vivo.
  useEffect(() => {
    if (!analizando || faseAnimacion < CATEGORIAS.length) return;
    const secuencia = [".", "..", "..."];
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % secuencia.length;
      setPuntosSuspensivos(secuencia[i]);
    }, 450);
    return () => clearInterval(id);
  }, [analizando, faseAnimacion]);

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

      {!construyendoOListo && (
        <div style={{ flex: 1, padding: "2.5rem 1.5rem" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
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
          </div>
        </div>
      )}

      {construyendoOListo && (
        // OJO: alignItems pasó de "center" a "stretch" en toda esta cadena
        // (fila principal -> fila de 1200px -> fila interna) para que la
        // altura real disponible (flex:1 de la columna raíz) llegue hasta
        // el wrapper de la escena 3D. Con "center" los hijos solo tomaban
        // el alto de su contenido y la escena se quedaba pequeña/cortada.
        // Los minHeight:0 evitan el bug clásico de flexbox donde un item
        // con contenido "alto" (el canvas) empuja a sus padres a crecer
        // más allá del alto disponible en vez de recibir el alto que le
        // corresponde.
        <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
          <GlowAmbienteADN />
          <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, width: "100%", minHeight: 0, display: "flex", gap: 40, alignItems: "center", justifyContent: "center" }}>
            <div className="adn-fila-visual" style={{ display: "flex", gap: 40, alignItems: "center", justifyContent: "center", width: "100%", minHeight: 0 }}>
              {analizando ? (
                <div className="adn-anim-wrap" style={{ flex: "0 1 480px", minWidth: 300 }}>
                  <EscenaParticulasADN3D faseActual={faseAnimacion} />
                </div>
              ) : (
                <svg width="100%" viewBox="0 0 220 440" style={{ flexShrink: 0, maxWidth: 240, height: "auto", margin: "0 auto", alignSelf: "center", display: "block" }}>
                  <defs>
                    <filter id="glowADN" x="-60%" y="-60%" width="220%" height="220%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path d={trazoHebra(0)} fill="none" stroke={COLOR_ACTIVO} strokeWidth={2.5} opacity={0.55} filter="url(#glowADN)" />
                  <path d={trazoHebra(Math.PI)} fill="none" stroke={COLOR_ACTIVO} strokeWidth={2.5} opacity={0.55} filter="url(#glowADN)" />
                  {nodeYs.map((y, i) => {
                    const xa = xEnY(y, 0);
                    const xb = xEnY(y, Math.PI);
                    const seleccionado = nodoSeleccionado === i;
                    return (
                      <g key={i} filter="url(#glowADN)">
                        <line x1={xa} y1={y} x2={xb} y2={y} stroke={COLOR_CLARO} strokeWidth={2.5} opacity={0.6} />
                        <circle
                          cx={xa} cy={y}
                          r={seleccionado ? 13 : 9}
                          fill={COLOR_ACTIVO}
                          stroke="#fff"
                          strokeWidth={seleccionado ? 4 : 2.5}
                          style={{ cursor: "pointer", transition: "all .3s cubic-bezier(.34,1.56,.64,1)" }}
                          onClick={() => setNodoSeleccionado(i)}
                        />
                      </g>
                    );
                  })}
                </svg>
              )}

              <div style={{ flex: "1 1 320px", minWidth: 280, maxWidth: 420, alignSelf: "center" }}>
                {analizando && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
                      {faseAnimacion >= CATEGORIAS.length && (
                        <Loader2 size={12} color={COLOR_ACTIVO} strokeWidth={2.5} className="adn-spin" />
                      )}
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: COLOR_ACTIVO, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {faseAnimacion < CATEGORIAS.length
                          ? "Analizando tu ADN de marca"
                          : `Sintetizando el ADN completo${puntosSuspensivos}`}
                      </span>
                    </div>
                    <div
                      className={faseAnimacion >= CATEGORIAS.length ? "adn-checklist-vivo" : undefined}
                      style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 18, borderRadius: 14 }}
                    >
                      {CATEGORIAS.map((cat, i) => {
                        const completada = i < faseAnimacion || faseAnimacion >= CATEGORIAS.length;
                        const actual = i === faseAnimacion && faseAnimacion < CATEGORIAS.length;
                        const visible = completada || actual;
                        const sintetizando = faseAnimacion >= CATEGORIAS.length;
                        return (
                          <div
                            key={cat.key}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              opacity: visible ? 1 : 0.3,
                              transform: visible ? "translateX(0)" : "translateX(-8px)",
                              transition: "opacity .45s ease, transform .45s ease",
                            }}
                          >
                            <span
                              style={{
                                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: completada ? COLOR_ACTIVO : "#fff",
                                border: `1.5px solid ${visible ? COLOR_ACTIVO : "#ddd"}`,
                                transition: "background .3s ease, border-color .3s ease",
                                animation: sintetizando ? `adn-ola 2.4s ease-in-out ${i * 0.12}s infinite` : undefined,
                              }}
                            >
                              {completada && <Check size={11} color="#fff" strokeWidth={3} />}
                              {actual && (
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLOR_ACTIVO, animation: "adn-pulse 1s ease-in-out infinite" }} />
                              )}
                            </span>
                            <span style={{ fontSize: 13, color: completada ? "#1a1a1a" : actual ? COLOR_ACTIVO : "#999", fontWeight: actual ? 600 : 500 }}>
                              {cat.titulo}
                            </span>
                          </div>
                        );
                      })}
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
                    <div style={{ background: "#F3F2FE", borderRadius: 14, padding: 16, marginBottom: 16 }}>
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
                    <div style={{ background: "#F3F2FE", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
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
          </div>
        </div>
      )}

      <style>{`
        @keyframes adn-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }

        /* Spinner del ícono junto a "Sintetizando el ADN completo..." */
        @keyframes adn-spin { to { transform: rotate(360deg); } }
        .adn-spin { animation: adn-spin 0.9s linear infinite; }

        /* Brillo que respira alrededor del checklist ya completo — la
           señal principal de "sigue trabajando", sin volver a mover ni
           re-marcar ningún ítem (eso ya está confirmado y no debe dar
           marcha atrás visualmente). */
        @keyframes adn-respirar {
          0%, 100% { box-shadow: 0 0 0 0 rgba(83,74,183,0); }
          50% { box-shadow: 0 0 28px 6px rgba(83,74,183,0.14); }
        }
        .adn-checklist-vivo { animation: adn-respirar 2.6s ease-in-out infinite; }

        /* Ola muy sutil que recorre los círculos ya marcados, uno tras
           otro (delay escalonado por índice) — da sensación de revisión
           continua sin sugerir que algo quedó incompleto. */
        @keyframes adn-ola { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }

        /* Lado a lado siempre que haya espacio: la hélice/animación a un
           lado, el texto al otro, sin que el texto se caiga hacia abajo.
           Solo en pantallas angostas (celular/tablet) se permite apilar. */
        .adn-fila-visual { flex-wrap: nowrap; }
        @media (max-width: 860px) {
          .adn-fila-visual { flex-wrap: wrap; }
        }

        /* Altura fija (en vh, con techo) en vez de "estirarse hasta donde
           alcance" — así la fila completa siempre cabe en el viewport sin
           forzar scroll, sin importar el alto de la ventana. */
        .adn-anim-wrap { height: min(58vh, 520px); }
        @media (max-width: 860px) {
          .adn-anim-wrap { height: 42vh; }
        }
      `}</style>
    </div>
  );
}