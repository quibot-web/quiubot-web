"use client";
import { useState, useRef, useEffect } from "react";
import { Upload, X, Check, Sparkles, Loader2, ChevronDown } from "lucide-react";
import EscenaParticulasADN3D from "@/app/components/EscenaParticulasADN3D";
import TutorialVideo from "@/app/components/TutorialVideo";
import TourGuiado from "@/app/components/TourGuiado";
import CargandoQuiubot from "@/app/components/CargandoQuiubot";
import { comprimirSiHaceFalta, esArchivoDeImagen } from "@/app/lib/imagenes";
import { PAISES_COBERTURA, BanderaPais, SelectorPais } from "@/app/components/SelectorPais";

const MIN_IMAGENES = 3;
const MAX_IMAGENES = 5;
// Respaldo cuando el ADN no tiene colores de marca usables (muy viejo, o
// paleta_color con hex inválido) -- el morado de siempre de Quiubot.
const COLOR_ACTIVO_DEFECTO = "#534AB7";
const COLOR_CLARO_DEFECTO = "#7F77DD";

// Tokens de los 3 módulos -- elegidos para buen contraste tanto en el
// círculo numerado (texto blanco sobre "color") como en el fondo del
// panel abierto (texto oscuro sobre "fondo", bien clareado).
type NumeroModulo = 1 | 2 | 3;
const TOKENS_MODULO: Record<NumeroModulo, { color: string; claro: string; fondo: string }> = {
  1: { color: "#534AB7", claro: "#7F77DD", fondo: "#F3F2FE" }, // ADN de marca
  2: { color: "#2563EB", claro: "#5B8DEF", fondo: "#EFF4FE" }, // Dónde vendes
  3: { color: "#D97706", claro: "#F0A94E", fondo: "#FFF8E6" }, // Lo que deben saber
};

// El análisis corre en segundo plano (trabajos_ia, ver
// app/lib/adnMarcaJobs.ts) -- esto deja al cliente salir de /marca y
// volver sin perder el progreso. Mismo patrón que quiubot_video_job_activo
// en /video, sin respaldo tipo /ultimo (si se pierde el localStorage, el
// cliente simplemente vuelve a subir sus fotos -- bajo costo, no hace
// falta la vuelta extra por otro dispositivo).
const LLAVE_ADN_JOB = "quiubot_adn_job_activo";

async function pollAdnJobHasta(jobId: string, maxMs = 10 * 60 * 1000): Promise<{ adn_marca: Record<string, any>; adn_resumen: string }> {
  const inicio = Date.now();
  while (Date.now() - inicio < maxMs) {
    const res = await fetch(`/api/marca-adn-jobs/${jobId}`);
    const data = await res.json().catch(() => ({}));
    if (data.estado === "lista") {
      return data.resultado;
    }
    if (data.estado === "fallida") {
      throw new Error(data.error || "No se pudo analizar tu ADN de marca.");
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error("El análisis está tardando más de lo esperado. Intenta de nuevo en unos minutos.");
}

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

// Valida que de verdad sea un hex usable como color CSS -- nunca se
// confía a ciegas en lo que venga de adn_marca (podría faltar, venir
// vacío, o un día llegar algo que no sea un hex de verdad).
function esHexValido(v: any): v is string {
  return typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}

// Contraste WCAG de un hex contra un fondo claro (la espiral siempre
// vive sobre superficies casi blancas: blanco de la fila resumen, o el
// lavanda clarísimo del panel abierto) -- un umbral bajo (1.3) alcanza
// para descartar colores casi invisibles (blanco, beige claro) sin ser
// tan estricto como el 4.5 que pide WCAG para texto, que no aplica acá
// (es un trazo decorativo con glow, no texto legible).
const FONDO_CONTRASTE_ESPIRAL = "#ffffff";
const UMBRAL_CONTRASTE_ESPIRAL = 1.3;

function hexARgb(hex: string): [number, number, number] {
  let limpio = hex.replace("#", "");
  if (limpio.length === 3) limpio = limpio.split("").map((c) => c + c).join("");
  const num = parseInt(limpio, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function luminanciaRelativa(hex: string): number {
  const [r, g, b] = hexARgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrasteHex(hex1: string, hex2: string): number {
  const l1 = luminanciaRelativa(hex1);
  const l2 = luminanciaRelativa(hex2);
  const [claro, oscuro] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (claro + 0.05) / (oscuro + 0.05);
}

// Primer candidato (en orden de preferencia) con suficiente contraste
// contra un fondo casi blanco; si ninguno sirve, el respaldo que se le pase.
function elegirColorConContraste(candidatos: (string | null)[], respaldo: string): string {
  for (const c of candidatos) {
    if (esHexValido(c) && contrasteHex(c, FONDO_CONTRASTE_ESPIRAL) >= UMBRAL_CONTRASTE_ESPIRAL) return c;
  }
  return respaldo;
}

// Primera frase de un texto largo (hasta el primer ". "), recortada con
// "…" si de todos modos queda muy larga -- usado como respaldo de
// frase_corta cuando el ADN es viejo y no la trae.
function primeraFrase(texto: string, maxChars = 140): string {
  const limpio = (texto || "").trim();
  if (!limpio) return "";
  const punto = limpio.indexOf(". ");
  const candidata = punto > 0 && punto < maxChars ? limpio.slice(0, punto + 1) : limpio;
  return candidata.length > maxChars ? candidata.slice(0, maxChars - 1).trimEnd() + "…" : candidata;
}

function capitalizarPrimera(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function recortar(texto: string, maxChars: number): string {
  const limpio = (texto || "").trim();
  return limpio.length > maxChars ? limpio.slice(0, maxChars - 1).trimEnd() + "…" : limpio;
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

// Espiral 2D chica, decorativa, en los colores de marca (con respaldo al
// morado) -- usada en la fila resumen de un módulo colapsado. "transicion"
// activa la misma animación morado -> colores de marca que la espiral
// grande de 7 puntos, para que ambas cambien juntas.
function MiniEspiral({ colorA, colorB, tamano = 24, transicion = false }: { colorA: string; colorB: string; tamano?: number; transicion?: boolean }) {
  return (
    <svg width={tamano} height={tamano * 1.7} viewBox="0 0 220 440" style={{ flexShrink: 0 }}>
      <path
        d="M130,30 Q175,120 130,220 Q85,320 130,410"
        fill="none"
        strokeWidth={16}
        opacity={0.9}
        className={transicion ? "adn-espiral-transicion" : undefined}
        style={{ stroke: colorA }}
      />
      <path
        d="M130,30 Q85,120 130,220 Q175,320 130,410"
        fill="none"
        strokeWidth={16}
        opacity={0.9}
        className={transicion ? "adn-espiral-transicion" : undefined}
        style={{ stroke: colorB }}
      />
    </svg>
  );
}

type CiudadSeleccionada = { nombre: string; key?: string; region?: string };
type ResultadoBusquedaCiudad = { key: string; name: string; region: string | null };

// Buscador de ciudades reales de Meta (/api/marca/buscar-ciudades) con
// debounce -- reemplaza el input de texto libre de antes: ahora cada
// ciudad elegida trae el código exacto de Meta (key), así
// publicar_estrategia no tiene que adivinarlo a partir del nombre. Las
// pastillas "viejas" (de antes de este buscador, solo texto, sin key) se
// muestran en gris con un aviso para que el usuario las vuelva a elegir.
function SelectorCiudadesConBusqueda({
  pais,
  ciudades,
  onChange,
}: {
  pais: string;
  ciudades: CiudadSeleccionada[];
  onChange: (nuevas: CiudadSeleccionada[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusquedaCiudad[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrarSiAfuera = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrarSiAfuera);
    return () => document.removeEventListener("mousedown", cerrarSiAfuera);
  }, [abierto]);

  // Debounce de 350ms -- mismo patrón que cualquier buscador en vivo,
  // evita una llamada a Meta por cada tecla.
  useEffect(() => {
    const limpio = query.trim();
    if (limpio.length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const idTimeout = setTimeout(() => {
      fetch(`/api/marca/buscar-ciudades?country_code=${pais}&q=${encodeURIComponent(limpio)}`)
        .then((r) => r.json())
        .then((data) => setResultados(data.ciudades || []))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 350);
    return () => clearTimeout(idTimeout);
  }, [query, pais]);

  const agregarCiudad = (r: ResultadoBusquedaCiudad) => {
    const yaExiste = ciudades.some((c) => (c.key && c.key === r.key) || c.nombre.toLowerCase() === r.name.toLowerCase());
    if (!yaExiste) onChange([...ciudades, { nombre: r.name, key: r.key, region: r.region || undefined }]);
    setQuery("");
    setResultados([]);
    setAbierto(false);
  };

  const quitarCiudad = (idx: number) => {
    onChange(ciudades.filter((_, i) => i !== idx));
  };

  return (
    <div>
      {ciudades.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {ciudades.map((ciudad, idx) => {
            const esVieja = !ciudad.key;
            return (
              <span
                key={`${ciudad.nombre}-${idx}`}
                title={esVieja ? "Guardada antes del buscador -- vuelve a elegirla de la lista para que la segmentación sea exacta" : undefined}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: esVieja ? "#f3f4f6" : "#fff", color: esVieja ? "#666" : "#2563EB",
                  fontSize: 12.5, fontWeight: 600, padding: "4px 6px 4px 10px", borderRadius: 20,
                  border: esVieja ? "1px solid #e0e0e0" : "1px solid #BFD3FA",
                }}
              >
                {ciudad.nombre}
                {ciudad.region && <span style={{ fontWeight: 400, opacity: 0.75 }}>· {ciudad.region}</span>}
                {esVieja && <span style={{ fontWeight: 400, fontStyle: "italic" }}>(vuelve a elegirla)</span>}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); quitarCiudad(idx); }}
                  title={`Quitar ${ciudad.nombre}`}
                  style={{
                    width: 16, height: 16, borderRadius: "50%", border: "none",
                    background: esVieja ? "#999" : "#2563EB", color: "#fff",
                    fontSize: 10, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div ref={wrapRef} style={{ position: "relative" }}>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          placeholder="Escribe el nombre de una ciudad..."
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
        />
        {abierto && query.trim().length >= 2 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 220, overflowY: "auto", padding: 4 }}>
            {buscando ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 8px", fontSize: 12.5, color: "#999" }}>
                <Loader2 size={14} className="adn-spin" /> Buscando...
              </div>
            ) : resultados.length === 0 ? (
              <div style={{ padding: "10px 8px", fontSize: 12.5, color: "#999" }}>Sin resultados.</div>
            ) : (
              resultados.map((r) => (
                <div
                  key={r.key}
                  onClick={() => agregarCiudad(r)}
                  style={{ padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, color: "#1a1a1a" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f9f9f8"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {r.name}
                  {r.region && <span style={{ color: "#999" }}> · {r.region}</span>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Contenido del módulo 2 ("Dónde vendes") -- país y ciudades viven en el
// padre (MarcaPage), no acá, para que la fila resumen del módulo pueda
// mostrarlos aunque el panel esté cerrado. Este componente es solo el
// formulario de edición, igual al que había antes en CoberturaCiudades.
function PanelCobertura({
  pais,
  ciudades,
  onPaisChange,
  onCiudadesChange,
}: {
  pais: string;
  ciudades: CiudadSeleccionada[];
  onPaisChange: (codigo: string) => void;
  onCiudadesChange: (nuevas: CiudadSeleccionada[]) => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const handleGuardar = async () => {
    setGuardando(true);
    setGuardado(false);
    try {
      await fetch("/api/marca/cobertura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ciudades_cobertura: ciudades.map((c) => c.nombre),
          pais_cobertura: pais,
          // Solo las que sí tienen código de Meta -- las viejas (sin key)
          // quedan afuera de este array a propósito.
          ciudades_cobertura_meta: ciudades
            .filter((c) => c.key)
            .map((c) => ({ key: c.key, name: c.nombre, region: c.region || null })),
        }),
      });
      setGuardado(true);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 12.5, color: "#666", margin: "0 0 14px" }}>
        Elige el país. Si además agregas ciudades, tus campañas se limitan solo a esas ciudades — si no agregas ninguna, se segmentan a nivel nacional en ese país.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>País</label>
          <SelectorPais
            valor={pais}
            onChange={(codigo) => {
              onPaisChange(codigo);
              onCiudadesChange([]); // cambiar de país invalida las ciudades elegidas en el país anterior
              setGuardado(false);
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>
            Ciudades <span style={{ fontWeight: 400, color: "#999" }}>(opcional — sin ninguna = todo el país)</span>
          </label>
          <SelectorCiudadesConBusqueda
            pais={pais}
            ciudades={ciudades}
            onChange={(nuevas) => { onCiudadesChange(nuevas); setGuardado(false); }}
          />
          <p style={{ fontSize: 11, color: "#999", margin: "6px 0 0" }}>
            Escribe el nombre de una ciudad y elige una de la lista. Repite para cada ciudad. Haz clic en la ✕ de una pastilla para quitarla.
          </p>
        </div>
        <button
          onClick={handleGuardar}
          disabled={guardando}
          style={{
            background: guardado ? "#10b981" : "#2563EB",
            color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: guardando ? "not-allowed" : "pointer", alignSelf: "flex-start", marginTop: 4,
          }}
        >
          {guardando ? "Guardando..." : guardado ? "✓ Guardado" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

const TOPE_INFO_ADICIONAL = 800;
const EJEMPLOS_INFO_ADICIONAL = ["Envío a todo el país", "Garantía de 6 meses", "Pago contraentrega", "Distribuidor autorizado"];

// Contenido del módulo 3 ("Lo que deben saber") -- el valor vive en el
// padre (igual que pais/ciudades de PanelCobertura), para que la fila
// resumen pueda mostrar un preview aunque el panel esté cerrado. Suma
// los chips de ejemplo (nuevo -- antes no existían) que agregan texto al
// textarea con un toque, en vez de solo sugerirlo como placeholder.
function PanelInfoAdicional({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (nuevo: string) => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const handleGuardar = async () => {
    setGuardando(true);
    setGuardado(false);
    try {
      await fetch("/api/marca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ info_adicional: valor }),
      });
      setGuardado(true);
    } finally {
      setGuardando(false);
    }
  };

  const agregarEjemplo = (ejemplo: string) => {
    const limpio = valor.trim();
    const nuevo = limpio ? `${limpio}, ${ejemplo.toLowerCase()}` : ejemplo;
    onChange(nuevo.slice(0, TOPE_INFO_ADICIONAL));
    setGuardado(false);
  };

  return (
    <div>
      <p style={{ fontSize: 12.5, color: "#666", margin: "0 0 12px" }}>
        Envíos, garantías, formas de pago, lo que te distingue de la competencia -- cualquier dato que la IA deba tener en cuenta al escribir tus anuncios, sin importar qué producto o servicio promociones.
      </p>
      <textarea
        value={valor}
        onChange={(e) => { onChange(e.target.value.slice(0, TOPE_INFO_ADICIONAL)); setGuardado(false); }}
        placeholder="Ej.: envío a todo Colombia, garantía de 6 meses, pago contraentrega, distribuidores autorizados"
        maxLength={TOPE_INFO_ADICIONAL}
        rows={3}
        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1.5px solid #e0e0e0", background: "#fff", fontSize: 13, color: "#1a1a1a", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
      />
      <div style={{ fontSize: 11, color: "#999", textAlign: "right", margin: "4px 0 10px" }}>{valor.length}/{TOPE_INFO_ADICIONAL}</div>

      <p style={{ fontSize: 11.5, color: "#999", margin: "0 0 8px" }}>Toca un ejemplo para agregarlo:</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {EJEMPLOS_INFO_ADICIONAL.map((ejemplo) => (
          <button
            key={ejemplo}
            onClick={() => agregarEjemplo(ejemplo)}
            style={{ fontSize: 12, fontWeight: 600, background: "#fff", border: "1px solid #D97706", color: "#D97706", padding: "6px 11px", borderRadius: 99, cursor: "pointer" }}
          >
            + {ejemplo}
          </button>
        ))}
      </div>

      <button
        onClick={handleGuardar}
        disabled={guardando}
        style={{
          background: guardado ? "#10b981" : "#D97706",
          color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8,
          fontSize: 13, fontWeight: 600, cursor: guardando ? "not-allowed" : "pointer", alignSelf: "flex-start",
        }}
      >
        {guardando ? "Guardando..." : guardado ? "✓ Guardado" : "Guardar"}
      </button>
    </div>
  );
}

// Cáscara compartida por los 3 módulos: número, estado ("Listo"/"Falta"),
// resumen visual de una línea, y el panel de abajo (solo uno abierto a
// la vez, lo decide el padre).
function ModuloColapsable({
  numero,
  titulo,
  listo,
  resumenVisual,
  abierto,
  onToggle,
  children,
}: {
  numero: NumeroModulo;
  titulo: string;
  listo: boolean;
  resumenVisual: React.ReactNode;
  abierto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const t = TOKENS_MODULO[numero];
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${abierto ? t.color : "#e8e8e6"}`, borderRadius: 16, marginBottom: 14, overflow: "hidden", transition: "border-color .15s" }}>
      <button
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
      >
        <span style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, background: abierto ? t.color : t.fondo, color: abierto ? "#fff" : t.color }}>
          {numero}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <b style={{ fontSize: 15, color: "#1a1a1a" }}>{titulo}</b>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: listo ? "#E7F7F1" : "#FEF2F2", color: listo ? "#0B7A5C" : "#991B1B", whiteSpace: "nowrap" }}>
              {listo ? "Listo" : "Falta"}
            </span>
          </span>
          <span style={{ fontSize: 12.5, color: "#666", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {resumenVisual}
          </span>
        </span>
        <ChevronDown size={18} style={{ color: abierto ? t.color : "#999", transform: abierto ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
      </button>
      {abierto && (
        <div style={{ borderTop: "1px solid #e8e8e6", padding: "20px 18px 22px", background: t.fondo }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function MarcaPage() {
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [tieneAdn, setTieneAdn] = useState(false);
  const [adn, setAdn] = useState<Record<string, any> | null>(null);
  const [resumen, setResumen] = useState<string>("");
  const [tutorialListo, setTutorialListo] = useState(false);

  // Cuál de los 3 módulos está abierto -- null = ninguno (todo completo).
  const [moduloAbierto, setModuloAbierto] = useState<NumeroModulo | null>(1);

  // Módulo 2 -- vive acá (no dentro de PanelCobertura) para que la fila
  // resumen pueda mostrar país/ciudades aunque el panel esté cerrado.
  const [paisCobertura, setPaisCobertura] = useState("CO");
  const [ciudadesCobertura, setCiudadesCobertura] = useState<CiudadSeleccionada[]>([]);

  // Módulo 3 -- mismo motivo que el módulo 2.
  const [infoAdicionalValor, setInfoAdicionalValor] = useState("");

  // Solo para elegir el texto del botón del aviso final ("primera" vs
  // "nueva" estrategia) -- null mientras no se ha consultado todavía.
  const [tieneCampanasPublicadas, setTieneCampanasPublicadas] = useState<boolean | null>(null);

  // Transición morado -> colores de marca en la espiral, SOLO justo
  // después de terminar un análisis en esta misma sesión (ver
  // ejecutarAnalisis y el retomo de un job guardado) -- por defecto en
  // "true" (ya en colores de marca) para que una carga normal de la
  // página, con un ADN ya existente, nunca anime nada.
  const [espiralEnColoresDeMarca, setEspiralEnColoresDeMarca] = useState(true);
  const [espiralConTransicion, setEspiralConTransicion] = useState(false);

  const [paso, setPaso] = useState<"elegir_fuente" | "imagenes" | "meta" | "web">("elegir_fuente");
  // true = mostrar el selector de fuentes aunque ya haya un ADN (botón
  // "Volver a analizar") -- si no hay ADN todavía, el selector se
  // muestra igual sin que haga falta esto (ver mostrarFlujoAnalisis).
  const [mostrandoSelectorFuentes, setMostrandoSelectorFuentes] = useState(false);
  const [verDetalleTodas, setVerDetalleTodas] = useState(false);

  const [metaInfo, setMetaInfo] = useState<{ conectado: boolean; disponible: boolean; candidatos: { id: string; url: string; tipo: "post" | "creativo"; creado_en: string }[] } | null>(null);
  const [cargandoMeta, setCargandoMeta] = useState(false);
  const [seleccionMeta, setSeleccionMeta] = useState<string[]>([]);

  const [sitioWebValor, setSitioWebValor] = useState("");
  const [sitioWebGuardado, setSitioWebGuardado] = useState<string | null>(null);
  const sitioWebPrellenadoRef = useRef(false);

  const [imagenes, setImagenes] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [arrastrandoImagenes, setArrastrandoImagenes] = useState(false);
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

  // Carga inicial de los 3 módulos en un solo golpe (mismos 3 endpoints
  // de siempre: marca-adn, marca, marca/cobertura -- ninguno nuevo) para
  // poder decidir, con los 3 datos ya en mano, cuál módulo abrir de
  // entrada: el primero que falte (módulo 2 nunca "falta", ver abajo).
  // Si hay un análisis en curso (localStorage), eso manda por encima de
  // esa decisión -- el módulo 1 se abre igual, mostrando el progreso.
  useEffect(() => {
    let jobGuardado: string | null = null;
    try {
      jobGuardado = localStorage.getItem(LLAVE_ADN_JOB);
    } catch {}

    const cargarDatosIniciales = async () => {
      const [adnData, marcaData, coberturaData] = await Promise.all([
        fetch("/api/marca-adn").then((r) => r.json()).catch(() => ({})),
        fetch("/api/marca").then((r) => r.json()).catch(() => ({})),
        fetch("/api/marca/cobertura").then((r) => r.json()).catch(() => ({})),
      ]);

      if (adnData.tieneAdn) {
        setTieneAdn(true);
        setAdn(adnData.adn_marca);
        setResumen(adnData.adn_resumen || "");
      }
      setSitioWebGuardado(marcaData?.sitio_web || null);
      setInfoAdicionalValor(marcaData?.info_adicional || "");

      const nombres: string[] = coberturaData.ciudades_cobertura || [];
      // ciudades_cobertura_meta sigue el mismo orden que ciudades_cobertura,
      // pero es un subconjunto (solo las que tienen código de Meta) -- se
      // reconstruye por nombre, sin asumir que las dos listas tengan el
      // mismo largo ni estén alineadas por índice.
      const metaDisponible: { key: string; name: string; region: string | null }[] = [
        ...(coberturaData.ciudades_cobertura_meta || []),
      ];
      const reconstruidas: CiudadSeleccionada[] = nombres.map((nombre) => {
        const idx = metaDisponible.findIndex((m) => m.name.toLowerCase() === nombre.toLowerCase());
        if (idx === -1) return { nombre }; // vieja, guardada antes del buscador -- sin key
        const [m] = metaDisponible.splice(idx, 1);
        return { nombre: m.name, key: m.key, region: m.region || undefined };
      });
      setCiudadesCobertura(reconstruidas);
      setPaisCobertura(coberturaData.pais_cobertura || "CO");

      if (!jobGuardado) {
        const modulo1Listo = !!adnData.tieneAdn;
        const modulo3Listo = !!(marcaData?.info_adicional && marcaData.info_adicional.trim());
        setModuloAbierto(!modulo1Listo ? 1 : !modulo3Listo ? 3 : null);
      }

      setCargandoInicial(false);
    };

    cargarDatosIniciales();

    // Si el cliente salió de /marca con un análisis en curso y volvió,
    // retoma el polling de ese mismo job en vez de mostrarle el selector
    // de fuentes de cero -- no hay forma de saber en qué categoría iba,
    // así que salta directo al estado "sigue trabajando".
    if (jobGuardado) {
      setModuloAbierto(1);
      setAnalizando(true);
      setErrorMsg(null);
      setFaseAnimacion(CATEGORIAS.length);

      pollAdnJobHasta(jobGuardado)
        .then((data) => {
          try {
            localStorage.removeItem(LLAVE_ADN_JOB);
          } catch {}
          setAdn(data.adn_marca);
          setResumen(data.adn_resumen || "");
          setTieneAdn(true);
          setMostrandoSelectorFuentes(false);
          dispararTransicionEspiral();
        })
        .catch((e: any) => {
          try {
            localStorage.removeItem(LLAVE_ADN_JOB);
          } catch {}
          setErrorMsg(e?.message || "No se pudo conectar con el servidor.");
          setFaseAnimacion(-1);
        })
        .finally(() => setAnalizando(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paso === "web" && !sitioWebPrellenadoRef.current && sitioWebGuardado) {
      setSitioWebValor(sitioWebGuardado);
      sitioWebPrellenadoRef.current = true;
    }
  }, [paso, sitioWebGuardado]);

  // Candidatas de Meta (publicaciones + anuncios anteriores, ver GET
  // /api/marca-adn/fuente-meta) -- se piden recién cuando el cliente
  // llega al selector de fuente (no en cada carga de la página), y solo
  // una vez por sesión.
  useEffect(() => {
    if (paso !== "elegir_fuente" || metaInfo !== null || cargandoMeta) return;
    setCargandoMeta(true);
    fetch("/api/marca-adn/fuente-meta")
      .then((r) => r.json())
      .then((data) =>
        setMetaInfo({ conectado: !!data.conectado, disponible: !!data.disponible, candidatos: data.candidatos || [] })
      )
      .catch(() => setMetaInfo({ conectado: false, disponible: false, candidatos: [] }))
      .finally(() => setCargandoMeta(false));
  }, [paso, metaInfo, cargandoMeta]);

  // Admite elegir (o soltar) varias imágenes a la vez, igual que en
  // /estrategia -- se agregan en el orden en que llegaron, hasta donde
  // alcance el cupo. No se comprime acá (se guarda el File crudo, igual
  // que antes, para que la vista previa siga siendo la imagen real) --
  // se comprime recién al analizar (ver handleAnalizar), que es donde
  // antes se convertía a base64 sin comprimir.
  const handleFiles = (archivos: File[]) => {
    if (archivos.length === 0 || imagenes.length >= MAX_IMAGENES) return;
    if (fileRef.current) fileRef.current.value = "";

    const cupoLibre = MAX_IMAGENES - imagenes.length;
    const imagenesValidas = archivos.filter(esArchivoDeImagen);
    const noImagenes = archivos.length - imagenesValidas.length;
    const candidatos = imagenesValidas.slice(0, cupoLibre);
    const descartadosPorCupo = imagenesValidas.length - candidatos.length;

    if (candidatos.length > 0) {
      setImagenes((prev) => [...prev, ...candidatos]);
      setPreviews((prev) => [...prev, ...candidatos.map((f) => URL.createObjectURL(f))]);
    }

    const avisos: string[] = [];
    if (descartadosPorCupo > 0) {
      avisos.push(`Solo se agregaron ${candidatos.length} de ${imagenesValidas.length} imágenes: el máximo es ${MAX_IMAGENES}.`);
    }
    if (noImagenes > 0) {
      avisos.push(`${noImagenes} archivo${noImagenes !== 1 ? "s" : ""} no se pudo${noImagenes !== 1 ? "ieron" : ""} agregar: no es una imagen válida.`);
    }
    setErrorMsg(avisos.length > 0 ? avisos.join(" ") : null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files || []));
  };

  const handleDropImagenes = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastrandoImagenes(false);
    handleFiles(Array.from(e.dataTransfer.files || []));
  };

  const handleQuitar = (idx: number) => {
    setImagenes((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  // Dispara la transición morado -> colores de marca de la espiral --
  // se llama justo al terminar un análisis (recién hecho o retomado tras
  // volver a la página con uno en curso), nunca en una carga normal con
  // un ADN que ya existía de antes. El primer timeout fuerza un render
  // en morado antes de pasar a los colores de marca (si no, React
  // agruparía los dos cambios de estado en uno solo y no habría nada
  // que transicionar); el segundo apaga la clase de transición para no
  // dejarla puesta para siempre.
  const dispararTransicionEspiral = () => {
    setEspiralEnColoresDeMarca(false);
    setEspiralConTransicion(true);
    setTimeout(() => setEspiralEnColoresDeMarca(true), 60);
    setTimeout(() => setEspiralConTransicion(false), 1800);
  };

  // Compartido entre las tres fuentes -- lo único que cambia entre
  // "imagenes", "meta" y "web" es qué va en el body de POST /api/marca-adn
  // (construirBody corre DESPUÉS de entrar en "analizando", igual que antes
  // con la compresión de imágenes, para que la animación ya esté corriendo
  // mientras se prepara lo que sea que haya que preparar).
  const ejecutarAnalisis = async (construirBody: () => Promise<Record<string, any>>) => {
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
      const bodyPost = await construirBody();
      const res = await fetch("/api/marca-adn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPost),
      });
      const dataInicial = await res.json().catch(() => ({}));
      if (!res.ok || !dataInicial.job_id) {
        setErrorMsg(dataInicial.error || "No se pudo analizar tu ADN de marca. Intenta de nuevo.");
        setFaseAnimacion(-1);
        return;
      }

      try {
        localStorage.setItem(LLAVE_ADN_JOB, dataInicial.job_id);
      } catch {}

      const [data] = await Promise.all([pollAdnJobHasta(dataInicial.job_id), avanzarAnimacion]);

      try {
        localStorage.removeItem(LLAVE_ADN_JOB);
      } catch {}
      setAdn(data.adn_marca);
      setResumen(data.adn_resumen || "");
      setTieneAdn(true);
      setMostrandoSelectorFuentes(false);
      setNodoSeleccionado(null);
      setVerDetalleTodas(false);
      dispararTransicionEspiral();
    } catch (e: any) {
      try {
        localStorage.removeItem(LLAVE_ADN_JOB);
      } catch {}
      setErrorMsg(e?.message || "No se pudo conectar con el servidor.");
      setFaseAnimacion(-1);
    } finally {
      setAnalizando(false);
    }
  };

  const handleAnalizar = async () => {
    if (imagenes.length < MIN_IMAGENES) return;
    // Se comprime recién acá (no al agregarlas) -- antes se mandaban los
    // archivos crudos del celular sin redimensionar, con riesgo real de
    // reventar el límite de tamaño del body del proxy con varias fotos
    // de varios MB cada una.
    await ejecutarAnalisis(async () => ({
      fuente: "imagenes",
      imagenes_base64: await Promise.all(imagenes.map(comprimirSiHaceFalta)),
    }));
  };

  const handleToggleCandidatoMeta = (id: string) => {
    setSeleccionMeta((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_IMAGENES) return prev;
      return [...prev, id];
    });
  };

  const handleAnalizarMeta = async () => {
    if (seleccionMeta.length < MIN_IMAGENES || !metaInfo) return;
    await ejecutarAnalisis(async () => ({
      fuente: "meta",
      imagenes_urls: seleccionMeta
        .map((id) => metaInfo.candidatos.find((c) => c.id === id)?.url)
        .filter((url): url is string => !!url),
    }));
  };

  const handleAnalizarWeb = async () => {
    const url = sitioWebValor.trim();
    if (!url || !/^https?:\/\/.+/i.test(url)) {
      setErrorMsg("Escribe un link válido de tu sitio web (con https://).");
      return;
    }
    await ejecutarAnalisis(async () => ({ fuente: "web", url }));
  };

  const handleVolverAAnalizar = () => {
    setMostrandoSelectorFuentes(true);
    setPaso("elegir_fuente");
    setErrorMsg(null);
    setNodoSeleccionado(null);
    setVerDetalleTodas(false);
  };

  // Solo se consulta cuando de verdad hace falta (los 3 módulos ya
  // completos) -- para la mayoría de cargas de la página (todavía
  // armando la marca) esto ni se pide. Reusa /api/campanas (ya existe,
  // la misma que lista /campanas) en vez de sumar un endpoint nuevo
  // solo para esta pregunta de sí/no.
  const modulo1ListoParaAviso = tieneAdn && !!adn;
  const modulo3ListoParaAviso = !!infoAdicionalValor.trim();
  useEffect(() => {
    if (!modulo1ListoParaAviso || !modulo3ListoParaAviso || tieneCampanasPublicadas !== null) return;
    fetch("/api/campanas")
      .then((r) => r.json())
      .then((data) => setTieneCampanasPublicadas((data.campanas || []).length > 0))
      .catch(() => setTieneCampanasPublicadas(false));
  }, [modulo1ListoParaAviso, modulo3ListoParaAviso, tieneCampanasPublicadas]);

  if (cargandoInicial) {
    return <CargandoQuiubot mensaje="Cargando tu marca" />;
  }

  const nodeYs = posicionesNodos(CATEGORIAS.length);

  // --- Módulo 1: ADN de marca -------------------------------------
  const modulo1Listo = tieneAdn && !!adn;
  const mostrarFlujoFuentes = !tieneAdn || mostrandoSelectorFuentes;
  const mostrandoHeliceFinal = tieneAdn && !!adn && !analizando && !mostrarFlujoFuentes;

  const paletaColor = (adn?.paleta_color as Record<string, any>) || {};
  const tipografiaCat = (adn?.tipografia as Record<string, any>) || {};
  const tonoEmocional = (adn?.tono_emocional as Record<string, any>) || {};
  const tratamientoVisual = (adn?.tratamiento_visual as Record<string, any>) || {};

  const colorPrimarioMarca = esHexValido(paletaColor.color_primario_hex) ? paletaColor.color_primario_hex : null;
  const colorSecundarioMarca = esHexValido(paletaColor.color_secundario_hex) ? paletaColor.color_secundario_hex : null;
  const primerAcento = Array.isArray(paletaColor.colores_acento_hex) && esHexValido(paletaColor.colores_acento_hex[0])
    ? paletaColor.colores_acento_hex[0]
    : null;

  // Las espirales (chica y la de 7 puntos) usan los colores de la marca
  // -- primario para una hebra, secundario para la otra. Si alguno
  // tiene muy poco contraste contra un fondo casi blanco (blanco o
  // beige, por ejemplo), cae al acento o al otro color de la marca
  // antes de caer al morado de siempre. Mientras se analiza, la espiral
  // 3D sigue siempre en morado (no cambia con esto).
  const colorEspiralDeMarcaA = elegirColorConContraste([colorPrimarioMarca, primerAcento, colorSecundarioMarca], COLOR_ACTIVO_DEFECTO);
  const colorEspiralDeMarcaB = elegirColorConContraste([colorSecundarioMarca, primerAcento, colorPrimarioMarca], COLOR_CLARO_DEFECTO);
  // Justo después de terminar un análisis, arranca en morado y pasa a
  // los colores de marca con una transición de 1.5s (ver ejecutarAnalisis
  // y el efecto de retomo) -- al volver a la página ya aparece directo
  // en los colores de marca, sin animar nada.
  const colorEspiralA = espiralEnColoresDeMarca ? colorEspiralDeMarcaA : COLOR_ACTIVO_DEFECTO;
  const colorEspiralB = espiralEnColoresDeMarca ? colorEspiralDeMarcaB : COLOR_CLARO_DEFECTO;

  const sensaciones: string[] = Array.isArray(tonoEmocional.sensaciones_principales) ? tonoEmocional.sensaciones_principales : [];
  const tituloAdn: string = (adn as any)?.titular || (sensaciones.length > 0 ? capitalizarPrimera(sensaciones.slice(0, 2).join(" y ")) : primeraFrase(resumen));
  const fraseCortaAdn: string = (adn as any)?.frase_corta || primeraFrase(resumen);

  const swatchesColores = [colorPrimarioMarca, colorSecundarioMarca, primerAcento].filter(Boolean) as string[];

  const rasgoTipografia = recortar(tipografiaCat.estilo || "", 46);
  const rasgoSensaciones = sensaciones.length > 0 ? capitalizarPrimera(sensaciones.slice(0, 2).join(", ")) : "";
  const rasgoFotos = [tratamientoVisual.nivel_pulido_fotografico, tratamientoVisual.iluminacion]
    .filter(Boolean)
    .map((t: string) => recortar(t, 28))
    .join(" · ");

  // --- Módulo 2: Dónde vendes --------------------------------------
  const nombrePaisCobertura = PAISES_COBERTURA.find((p) => p.codigo === paisCobertura)?.nombre || paisCobertura;

  // --- Módulo 3: Lo que deben saber ---------------------------------
  const modulo3Listo = !!infoAdicionalValor.trim();

  const toggleModulo = (n: NumeroModulo) => {
    setModuloAbierto((actual) => (actual === n ? null : n));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e6", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ fontSize: 18, fontWeight: 700, textDecoration: "none", color: "#1a1a1a" }}>
          quiu<span style={{ color: "#7F77DD" }}>bot</span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 13, color: "#999" }}>Mi marca</div>
          <TutorialVideo seccion="mi-marca" onListo={() => setTutorialListo(true)} />
          <TourGuiado
            seccion="mi-marca"
            listo={tutorialListo}
            pasos={[
              { selector: '[data-tour="marca-subir"]', titulo: "Sube tus mejores creativos", texto: "Elige entre 4 y 8 piezas ya publicadas con las que estés conforme — colores, tipografía, tono. Entre más representativas, mejor sale tu ADN." },
              { selector: '[data-tour="marca-analizar"]', titulo: "Analiza y listo", texto: "Con el mínimo de imágenes subidas, dale clic aquí. El sistema arma tu ADN de marca una sola vez — después lo usan automáticamente el Motor de Estrategia y la generación de creativos." },
            ]}
          />
        </div>
      </div>

      <div style={{ flex: 1, padding: "2rem 1.5rem 4rem" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ marginBottom: "1.5rem" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px" }}>Mi marca</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 99, background: "#ece9f9", overflow: "hidden", display: "flex", gap: 3 }}>
                {[1, 2, 3].map((n) => {
                  const completo = n === 1 ? modulo1Listo : n === 2 ? true : modulo3Listo;
                  return (
                    <i
                      key={n}
                      style={{ flex: 1, display: "block", borderRadius: 99, background: completo ? "linear-gradient(90deg, #7F77DD, #534AB7)" : "#e2ddf6" }}
                    />
                  );
                })}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#666", whiteSpace: "nowrap" }}>
                {(modulo1Listo ? 1 : 0) + 1 + (modulo3Listo ? 1 : 0)} de 3 completos
              </div>
            </div>
          </div>

          {/* MÓDULO 1: ADN DE MARCA */}
          <ModuloColapsable
            numero={1}
            titulo="ADN de marca"
            listo={modulo1Listo}
            resumenVisual={
              modulo1Listo ? (
                <>
                  <MiniEspiral colorA={colorEspiralA} colorB={colorEspiralB} tamano={18} transicion={espiralConTransicion} />
                  <span>{recortar(tituloAdn, 64)}</span>
                </>
              ) : (
                <span>Elige de dónde sacamos los colores, la tipografía y el tono de tus anuncios.</span>
              )
            }
            abierto={moduloAbierto === 1}
            onToggle={() => toggleModulo(1)}
          >
            {analizando ? (
              <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                <div style={{ flex: "0 1 260px", minWidth: 220, height: 320 }}>
                  <EscenaParticulasADN3D faseActual={faseAnimacion} />
                </div>
                <div style={{ flex: "1 1 280px", minWidth: 240 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
                    {faseAnimacion >= CATEGORIAS.length && (
                      <Loader2 size={12} color="#534AB7" strokeWidth={2.5} className="adn-spin" />
                    )}
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#534AB7", textTransform: "uppercase", letterSpacing: 0.5 }}>
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
                              background: completada ? "#534AB7" : "#fff",
                              border: `1.5px solid ${visible ? "#534AB7" : "#ddd"}`,
                              transition: "background .3s ease, border-color .3s ease",
                              animation: sintetizando ? `adn-ola 2.4s ease-in-out ${i * 0.12}s infinite` : undefined,
                            }}
                          >
                            {completada && <Check size={11} color="#fff" strokeWidth={3} />}
                            {actual && (
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#534AB7", animation: "adn-pulse 1s ease-in-out infinite" }} />
                            )}
                          </span>
                          <span style={{ fontSize: 13, color: completada ? "#1a1a1a" : actual ? "#534AB7" : "#999", fontWeight: actual ? 600 : 500 }}>
                            {cat.titulo}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 13, color: "#999" }}>Esto puede tardar unos segundos. No cierres esta pestaña.</p>
                </div>
              </div>
            ) : mostrarFlujoFuentes ? (
              <>
                {tieneAdn && (
                  <button
                    onClick={() => { setMostrandoSelectorFuentes(false); setErrorMsg(null); }}
                    style={{ background: "none", border: "none", color: "#534AB7", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16 }}
                  >
                    ← Cancelar
                  </button>
                )}

                {paso === "elegir_fuente" && (
                  <>
                    <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px" }}>
                      El sistema analiza {MIN_IMAGENES} a {MAX_IMAGENES} piezas reales con las que estés conforme — colores, tipografía, composición, tono — para generar creativos nuevos que se sientan hechos por ti.
                    </p>

                    {errorMsg && (
                      <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
                        {errorMsg}
                      </div>
                    )}

                    <div data-tour="marca-subir" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {metaInfo?.conectado && (
                        <button
                          onClick={() => metaInfo.disponible && setPaso("meta")}
                          disabled={!metaInfo.disponible}
                          style={{
                            textAlign: "left", display: "flex", flexDirection: "column", gap: 4,
                            background: metaInfo.disponible ? "#fff" : "#f7f7f6",
                            border: `1.5px solid ${metaInfo.disponible ? "#534AB7" : "#e0e0e0"}`,
                            borderRadius: 14, padding: "16px 18px", cursor: metaInfo.disponible ? "pointer" : "not-allowed",
                          }}
                        >
                          <span style={{ fontSize: 15, fontWeight: 600, color: metaInfo.disponible ? "#1a1a1a" : "#999" }}>
                            Usar lo que ya publiqué en Meta
                          </span>
                          <span style={{ fontSize: 12.5, color: "#666" }}>
                            {metaInfo.disponible
                              ? `Elige entre tus publicaciones y anuncios más recientes (encontramos ${metaInfo.candidatos.length}).`
                              : `Tus anuncios en Meta repiten pocas imágenes distintas (encontramos ${metaInfo.candidatos.length}). Prueba con tu sitio web o sube imágenes.`}
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => setPaso("imagenes")}
                        style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 4, background: "#fff", border: "1.5px solid #534AB7", borderRadius: 14, padding: "16px 18px", cursor: "pointer" }}
                      >
                        <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>Subir imágenes</span>
                        <span style={{ fontSize: 12.5, color: "#666" }}>
                          Sube directamente {MIN_IMAGENES} a {MAX_IMAGENES} creativos desde tu computador.
                        </span>
                      </button>

                      <button
                        onClick={() => setPaso("web")}
                        style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 4, background: "#fff", border: "1.5px solid #534AB7", borderRadius: 14, padding: "16px 18px", cursor: "pointer" }}
                      >
                        <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>Pegar el link de mi sitio web</span>
                        <span style={{ fontSize: 12.5, color: "#666" }}>Analiza el logo, los colores, las tipografías y los textos de tu sitio.</span>
                      </button>
                    </div>
                  </>
                )}

                {paso === "imagenes" && (
                  <>
                    <button
                      onClick={() => setPaso("elegir_fuente")}
                      style={{ background: "none", border: "none", color: "#534AB7", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16 }}
                    >
                      ← Elegir otra fuente
                    </button>

                    <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px" }}>
                      Sube entre {MIN_IMAGENES} y {MAX_IMAGENES} piezas reales que ya usaste y con las que estés conforme. Esta parte es de solo lectura: no hay nada que editar acá, solo mira cómo se construye tu ADN.
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10, marginBottom: 16 }}>
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
                          onDragOver={(e) => { e.preventDefault(); setArrastrandoImagenes(true); }}
                          onDragLeave={() => setArrastrandoImagenes(false)}
                          onDrop={handleDropImagenes}
                          style={{
                            aspectRatio: "1", borderRadius: 12,
                            border: arrastrandoImagenes ? "1.5px dashed #534AB7" : "1.5px dashed #7F77DD",
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", background: arrastrandoImagenes ? "#fff" : "#fcfcff", gap: 6,
                          }}
                        >
                          <Upload size={22} color="#534AB7" strokeWidth={2} />
                          <span style={{ fontSize: 11, color: "#534AB7", fontWeight: 500, textAlign: "center", padding: "0 8px" }}>
                            {arrastrandoImagenes ? "Suelta tus imágenes aquí" : "Subir creativo"}
                          </span>
                        </div>
                      )}
                      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFile} />
                    </div>

                    <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
                      {imagenes.length}/{MAX_IMAGENES} subidos · mínimo {MIN_IMAGENES} para analizar
                    </p>

                    {errorMsg && (
                      <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
                        {errorMsg}
                      </div>
                    )}

                    <button
                      data-tour="marca-analizar"
                      onClick={handleAnalizar}
                      disabled={imagenes.length < MIN_IMAGENES}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        background: imagenes.length < MIN_IMAGENES ? "#eee" : "#534AB7",
                        color: imagenes.length < MIN_IMAGENES ? "#aaa" : "#fff",
                        border: "none", padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 600,
                        cursor: imagenes.length < MIN_IMAGENES ? "not-allowed" : "pointer",
                      }}
                    >
                      <Sparkles size={17} strokeWidth={2} />
                      Analizar mis creativos
                    </button>
                  </>
                )}

                {paso === "meta" && (
                  <>
                    <button
                      onClick={() => setPaso("elegir_fuente")}
                      style={{ background: "none", border: "none", color: "#534AB7", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16 }}
                    >
                      ← Elegir otra fuente
                    </button>

                    <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px" }}>
                      Mostramos lo más reciente de tus publicaciones y anuncios anteriores. Elige entre {MIN_IMAGENES} y {MAX_IMAGENES}.
                    </p>

                    <div style={{ background: "#fff", border: "1px solid #F3D99A", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#8A6416", marginBottom: 14 }}>
                      Elige solo piezas de tu marca. Si ves anuncios de otras marcas, no los selecciones.
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10, marginBottom: 16 }}>
                      {(metaInfo?.candidatos || []).map((candidato) => {
                        const seleccionado = seleccionMeta.includes(candidato.id);
                        return (
                          <div
                            key={candidato.id}
                            onClick={() => handleToggleCandidatoMeta(candidato.id)}
                            style={{ position: "relative", aspectRatio: "1", cursor: "pointer" }}
                          >
                            <img
                              src={candidato.url}
                              alt="Candidata de Meta"
                              style={{
                                width: "100%", height: "100%", objectFit: "cover", borderRadius: 12,
                                border: seleccionado ? "2.5px solid #534AB7" : "1px solid #e0e0e0",
                                opacity: seleccionado ? 1 : 0.85,
                              }}
                            />
                            {seleccionado && (
                              <span style={{ position: "absolute", top: -6, right: -6, width: 24, height: 24, borderRadius: "50%", background: "#534AB7", color: "#fff", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Check size={12} strokeWidth={3} />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
                      {seleccionMeta.length}/{MAX_IMAGENES} elegidas · mínimo {MIN_IMAGENES} para analizar
                    </p>

                    {errorMsg && (
                      <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
                        {errorMsg}
                      </div>
                    )}

                    <button
                      onClick={handleAnalizarMeta}
                      disabled={seleccionMeta.length < MIN_IMAGENES}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        background: seleccionMeta.length < MIN_IMAGENES ? "#eee" : "#534AB7",
                        color: seleccionMeta.length < MIN_IMAGENES ? "#aaa" : "#fff",
                        border: "none", padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 600,
                        cursor: seleccionMeta.length < MIN_IMAGENES ? "not-allowed" : "pointer",
                      }}
                    >
                      <Sparkles size={17} strokeWidth={2} />
                      Analizar mis creativos
                    </button>
                  </>
                )}

                {paso === "web" && (
                  <>
                    <button
                      onClick={() => setPaso("elegir_fuente")}
                      style={{ background: "none", border: "none", color: "#534AB7", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16 }}
                    >
                      ← Elegir otra fuente
                    </button>

                    <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px" }}>
                      El sistema lee tu sitio para sacar el logo, los colores, las tipografías y los textos.
                    </p>

                    <input
                      value={sitioWebValor}
                      onChange={(e) => setSitioWebValor(e.target.value)}
                      placeholder="https://tu-sitio.com"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box", marginBottom: 16 }}
                    />

                    {errorMsg && (
                      <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
                        {errorMsg}
                      </div>
                    )}

                    <button
                      onClick={handleAnalizarWeb}
                      disabled={!sitioWebValor.trim()}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        background: !sitioWebValor.trim() ? "#eee" : "#534AB7",
                        color: !sitioWebValor.trim() ? "#aaa" : "#fff",
                        border: "none", padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 600,
                        cursor: !sitioWebValor.trim() ? "not-allowed" : "pointer",
                      }}
                    >
                      <Sparkles size={17} strokeWidth={2} />
                      Analizar mi sitio
                    </button>
                  </>
                )}
              </>
            ) : (
              mostrandoHeliceFinal && adn && (
                <div>
                  <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                    <svg width={110} viewBox="0 0 220 440" style={{ flexShrink: 0 }}>
                      <defs>
                        <filter id="glowADN" x="-60%" y="-60%" width="220%" height="220%">
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <path
                        d={trazoHebra(0)}
                        fill="none"
                        strokeWidth={2.5}
                        opacity={0.55}
                        filter="url(#glowADN)"
                        className={espiralConTransicion ? "adn-espiral-transicion" : undefined}
                        style={{ stroke: colorEspiralA }}
                      />
                      <path
                        d={trazoHebra(Math.PI)}
                        fill="none"
                        strokeWidth={2.5}
                        opacity={0.55}
                        filter="url(#glowADN)"
                        className={espiralConTransicion ? "adn-espiral-transicion" : undefined}
                        style={{ stroke: colorEspiralA }}
                      />
                      {nodeYs.map((y, i) => {
                        const xa = xEnY(y, 0);
                        const xb = xEnY(y, Math.PI);
                        const seleccionado = nodoSeleccionado === i;
                        return (
                          <g key={i} filter="url(#glowADN)">
                            <line
                              x1={xa} y1={y} x2={xb} y2={y}
                              strokeWidth={2.5} opacity={0.6}
                              className={espiralConTransicion ? "adn-espiral-transicion" : undefined}
                              style={{ stroke: colorEspiralB }}
                            />
                            <circle
                              cx={xa} cy={y}
                              r={seleccionado ? 13 : 9}
                              stroke="#fff"
                              strokeWidth={seleccionado ? 4 : 2.5}
                              className={espiralConTransicion ? "adn-espiral-transicion" : undefined}
                              style={{
                                fill: colorEspiralA,
                                cursor: "pointer",
                                transition: espiralConTransicion
                                  ? "r .3s cubic-bezier(.34,1.56,.64,1), stroke-width .3s cubic-bezier(.34,1.56,.64,1), fill 1.5s ease"
                                  : "all .3s cubic-bezier(.34,1.56,.64,1)",
                              }}
                              onClick={() => { setNodoSeleccionado(i); setVerDetalleTodas(false); }}
                            />
                          </g>
                        );
                      })}
                    </svg>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {nodoSeleccionado !== null ? (
                        <div>
                          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "#534AB7" }}>
                            FRAGMENTO {String(nodoSeleccionado + 1).padStart(2, "0")}/07
                          </span>
                          <p style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", margin: "4px 0 12px" }}>
                            {CATEGORIAS[nodoSeleccionado].titulo}
                          </p>
                          <div style={{ background: "#fff", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 9, marginBottom: 14 }}>
                            {Object.entries(adn[CATEGORIAS[nodoSeleccionado].key] || {}).map(([campo, valor]) => (
                              <div key={campo} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                                <span style={{ fontSize: 11.5, color: "#666", flexShrink: 0, minWidth: 110 }}>{ETIQUETAS[campo] || campo}</span>
                                {campo === "colores_acento_hex" || campo === "color_primario_hex" || campo === "color_secundario_hex" ? (
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                    {(Array.isArray(valor) ? valor : [valor]).filter(Boolean).map((hex: string, i: number) => (
                                      <span key={i} title={hex} style={{ width: 16, height: 16, borderRadius: 4, background: hex, border: "1px solid rgba(0,0,0,0.08)", display: "inline-block" }} />
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 12.5, color: "#3C3489", fontWeight: 500, textAlign: "right" }}>{formatearValor(valor)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                          <button onClick={() => setNodoSeleccionado(null)} style={{ width: "100%", background: "#fff", border: "1px solid #e0e0e0", color: "#534AB7", padding: "9px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            Volver al resumen
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px" }}>{tituloAdn}</p>
                          {fraseCortaAdn && fraseCortaAdn !== tituloAdn && (
                            <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px" }}>{fraseCortaAdn}</p>
                          )}

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 }}>
                            {swatchesColores.length > 0 && (
                              <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 10, padding: "9px 11px" }}>
                                <span style={{ fontSize: 10.5, color: "#999", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 5 }}>Colores</span>
                                <div style={{ display: "flex", gap: 4 }}>
                                  {swatchesColores.map((hex, i) => (
                                    <span key={i} style={{ width: 16, height: 16, borderRadius: 4, background: hex, border: "1px solid rgba(0,0,0,0.08)", display: "inline-block" }} />
                                  ))}
                                </div>
                              </div>
                            )}
                            {rasgoTipografia && (
                              <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 10, padding: "9px 11px" }}>
                                <span style={{ fontSize: 10.5, color: "#999", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 3 }}>Tipografía</span>
                                <span style={{ fontSize: 12.5, color: "#1a1a1a", fontWeight: 500 }}>{rasgoTipografia}</span>
                              </div>
                            )}
                            {rasgoSensaciones && (
                              <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 10, padding: "9px 11px" }}>
                                <span style={{ fontSize: 10.5, color: "#999", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 3 }}>Cómo se siente</span>
                                <span style={{ fontSize: 12.5, color: "#1a1a1a", fontWeight: 500 }}>{rasgoSensaciones}</span>
                              </div>
                            )}
                            {rasgoFotos && (
                              <div style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 10, padding: "9px 11px" }}>
                                <span style={{ fontSize: 10.5, color: "#999", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 3 }}>Fotos</span>
                                <span style={{ fontSize: 12.5, color: "#1a1a1a", fontWeight: 500 }}>{rasgoFotos}</span>
                              </div>
                            )}
                          </div>

                          <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setVerDetalleTodas((v) => !v)} style={{ flex: 1, background: "#fff", border: "1px solid #e0e0e0", color: "#666", padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                              {verDetalleTodas ? "Ocultar detalle" : "Ver detalle"}
                            </button>
                            <button onClick={handleVolverAAnalizar} style={{ flex: 1, background: "#534AB7", color: "#fff", border: "none", padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                              Volver a analizar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {verDetalleTodas && nodoSeleccionado === null && (
                    <div style={{ marginTop: 18, borderTop: "1px dashed #ddd", paddingTop: 18 }}>
                      {CATEGORIAS.map((cat) => (
                        <div key={cat.key} style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                          <b style={{ fontSize: 12.5, display: "block", marginBottom: 7, color: "#534AB7" }}>{cat.titulo}</b>
                          {Object.entries(adn[cat.key] || {}).map(([campo, valor]) => (
                            <div key={campo} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "3px 0", color: "#666" }}>
                              <span>{ETIQUETAS[campo] || campo}</span>
                              {campo === "colores_acento_hex" || campo === "color_primario_hex" || campo === "color_secundario_hex" ? (
                                <div style={{ display: "flex", gap: 4 }}>
                                  {(Array.isArray(valor) ? valor : [valor]).filter(Boolean).map((hex: string, i: number) => (
                                    <span key={i} title={hex} style={{ width: 14, height: 14, borderRadius: 3, background: hex, border: "1px solid rgba(0,0,0,0.08)", display: "inline-block" }} />
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: "#1a1a1a", fontWeight: 500, textAlign: "right" }}>{formatearValor(valor)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </ModuloColapsable>

          {/* MÓDULO 2: DÓNDE VENDES */}
          <ModuloColapsable
            numero={2}
            titulo="Dónde vendes"
            listo={true}
            resumenVisual={
              <>
                <BanderaPais codigo={paisCobertura} tamano={16} />
                <span>{nombrePaisCobertura}</span>
                {ciudadesCobertura.length === 0 ? (
                  <span>· Todo {nombrePaisCobertura}</span>
                ) : (
                  <>
                    {ciudadesCobertura.slice(0, 3).map((c, i) => (
                      <span key={i} style={{ background: "#fff", border: "1px solid #BFD3FA", color: "#2563EB", fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>
                        {c.nombre}
                      </span>
                    ))}
                    {ciudadesCobertura.length > 3 && <span>+{ciudadesCobertura.length - 3}</span>}
                  </>
                )}
              </>
            }
            abierto={moduloAbierto === 2}
            onToggle={() => toggleModulo(2)}
          >
            <PanelCobertura
              pais={paisCobertura}
              ciudades={ciudadesCobertura}
              onPaisChange={setPaisCobertura}
              onCiudadesChange={setCiudadesCobertura}
            />
          </ModuloColapsable>

          {/* MÓDULO 3: LO QUE DEBEN SABER */}
          <ModuloColapsable
            numero={3}
            titulo="Lo que deben saber"
            listo={modulo3Listo}
            resumenVisual={
              <span>
                {modulo3Listo ? recortar(infoAdicionalValor, 72) : "Envíos, garantías, formas de pago -- lo que distingue tu negocio."}
              </span>
            }
            abierto={moduloAbierto === 3}
            onToggle={() => toggleModulo(3)}
          >
            <PanelInfoAdicional valor={infoAdicionalValor} onChange={setInfoAdicionalValor} />
          </ModuloColapsable>

          {modulo1Listo && modulo3Listo && (
            <div style={{ background: "#F3F2FE", border: "1.5px solid #534AB7", borderRadius: 16, padding: "20px 22px", textAlign: "center", marginTop: 6 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px" }}>¡Tu marca está lista!</p>
              <p style={{ fontSize: 13, color: "#666", margin: "0 0 16px" }}>
                Con tu ADN, tu cobertura y lo que deben saber tus clientes, ya tenemos todo para armar tus anuncios.
              </p>
              <a
                href="/estrategia"
                style={{ display: "inline-block", background: "#534AB7", color: "#fff", padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
              >
                {tieneCampanasPublicadas ? "Crear una nueva estrategia" : "Crear mi primera estrategia"}
              </a>
            </div>
          )}
        </div>
      </div>

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

        /* Transición morado -> colores de marca de la espiral, solo
           justo después de terminar un análisis (ver
           dispararTransicionEspiral) -- al volver a la página con un
           ADN que ya existía, esta clase nunca se aplica. */
        .adn-espiral-transicion { transition: stroke 1.5s ease, fill 1.5s ease; }
        @media (prefers-reduced-motion: reduce) {
          .adn-espiral-transicion { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
