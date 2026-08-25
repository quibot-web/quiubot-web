import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import {
  Target, Layers, Image as ImageIcon, Users, Wallet, Sparkles,
  ChevronDown, ChevronRight, Check, ArrowRight, TrendingUp, MapPin, Loader2
} from "lucide-react";

// ---------------------------------------------------------------------------
// DATOS DE EJEMPLO — reemplaza esto con la respuesta real de tu webhook n8n
// (mismo shape que ya está devolviendo tu nodo "Respond to Webhook")
// ---------------------------------------------------------------------------
const ESTRATEGIAS = [
  {
    id: "estrategia_1",
    efectividad: 92,
    campana: {
      nombre: "Venta directa — Deseo y urgencia",
      objetivo_meta: "Ventas (OUTCOME_SALES)",
      tipo_presupuesto: "CBO",
      presupuesto_diario_cop: 60000,
      argumento_estrategico:
        "CBO porque hay dos audiencias sin datos históricos; dejamos que Meta reparta el presupuesto hacia la que mejor convierta en los primeros días.",
    },
    conjuntos: [
      {
        nombre: "Interés amplio · Moda íntima 25–45",
        segmentacion: {
          edad: "25–45",
          genero: "Mujeres",
          ubicacion: "Colombia",
          intereses: ["Lencería", "Moda femenina", "Victoria's Secret"],
        },
        presupuesto_diario_cop: null,
        anuncios: [
          {
            nombre: "Ad 1 · Gancho deseo",
            copy: {
              titulo: "Seducción que no se explica, se siente",
              texto: "Tabú no es solo lencería. Es la versión de ti que solo tú conoces. Colección nueva, edición limitada.",
              cta: "Comprar ahora",
            },
            argumentacion: "Gatillo de deseo y exclusividad (Cialdini: escasez). Apela a identidad, no al producto.",
          },
          {
            nombre: "Ad 2 · Prueba social",
            copy: {
              titulo: "+3.000 mujeres ya lo hicieron suyo",
              texto: "La colección más pedida de Tabú está agotándose. Envío discreto en 24h.",
              cta: "Ver colección",
            },
            argumentacion: "Prueba social + urgencia. Reduce fricción con envío discreto (objeción típica del nicho).",
          },
        ],
      },
      {
        nombre: "Retargeting cálido · Visitaron sitio 14d",
        segmentacion: {
          edad: "22–55",
          genero: "Todos",
          ubicacion: "Colombia",
          intereses: ["Retargeting · Web 14 días"],
        },
        presupuesto_diario_cop: null,
        anuncios: [
          {
            nombre: "Ad 3 · Recordatorio + descuento",
            copy: {
              titulo: "Sigue esperándote",
              texto: "10% off por 24h en lo que ya viste. Sin trucos, sin letra pequeña.",
              cta: "Reclamar descuento",
            },
            argumentacion: "Reciprocidad (Cialdini) + ventana de tiempo corta para forzar decisión.",
          },
        ],
      },
    ],
  },
  {
    id: "estrategia_2",
    efectividad: 78,
    campana: {
      nombre: "Reconocimiento — Construcción de marca",
      objetivo_meta: "Reconocimiento (OUTCOME_AWARENESS)",
      tipo_presupuesto: "ABO",
      presupuesto_diario_cop: 45000,
      argumento_estrategico:
        "ABO porque queremos controlar cuánto se invierte en cada segmento para medir cuál responde mejor antes de escalar con CBO.",
    },
    conjuntos: [
      {
        nombre: "Lookalike 1% · Compradores pasados",
        segmentacion: {
          edad: "25–50",
          genero: "Mujeres",
          ubicacion: "Colombia, principales ciudades",
          intereses: ["Lookalike 1% · Clientes"],
        },
        presupuesto_diario_cop: 45000,
        anuncios: [
          {
            nombre: "Ad 1 · Storytelling de marca",
            copy: {
              titulo: "Cada mujer tiene un lado Tabú",
              texto: "Diseñada por y para mujeres reales. Conoce la historia detrás de la marca.",
              cta: "Conocer más",
            },
            argumentacion: "Construcción de afinidad de marca antes de pedir la venta; prepara retargeting futuro.",
          },
        ],
      },
    ],
  },
];

const fmtCOP = (n) =>
  n == null ? "—" : new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

// Ancho fijo de cada columna del diagrama -- igual al w-96/w-80/w-72 que ya
// usaban las cards en la versión vertical, ahora usados también para
// calcular grid-template-columns.
const ANCHO_CAMPANA = 384;
const ANCHO_CONJUNTO = 320;
const ANCHO_ANUNCIO = 288;
const COLUMN_GAP = 64;
const ROW_GAP = 24;

function CornerMarks({ colorClass }) {
  const base = `absolute w-3 h-3 border-slate-300 ${colorClass}`;
  return (
    <>
      <span className={`${base} top-0 left-0 border-t-2 border-l-2 rounded-tl-sm`} />
      <span className={`${base} top-0 right-0 border-t-2 border-r-2 rounded-tr-sm`} />
      <span className={`${base} bottom-0 left-0 border-b-2 border-l-2 rounded-bl-sm`} />
      <span className={`${base} bottom-0 right-0 border-b-2 border-r-2 rounded-br-sm`} />
    </>
  );
}

function SpecTag({ children }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dashed border-slate-300 text-[11px] text-slate-600 bg-white"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {children}
    </span>
  );
}

function AnuncioCard({ anuncio, cardRef }) {
  return (
    <div ref={cardRef} className="relative w-72 bg-white rounded-lg border border-amber-200 shadow-sm p-4">
      <CornerMarks colorClass="!border-amber-300" />
      <div className="flex items-center gap-2 mb-2">
        <ImageIcon className="w-4 h-4 text-amber-600" />
        <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">{anuncio.nombre}</span>
      </div>
      <p className="text-sm font-medium text-slate-900 leading-snug">{anuncio.copy.titulo}</p>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{anuncio.copy.texto}</p>
      <div className="mt-2">
        <SpecTag>{anuncio.copy.cta}</SpecTag>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 flex gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 italic leading-relaxed">{anuncio.argumentacion}</p>
      </div>
    </div>
  );
}

// Controlado desde afuera (open/onToggle) en vez de manejar su propio estado
// -- el diagrama horizontal necesita saber qué conjuntos están
// colapsados/expandidos para calcular cuántas filas de grid ocupa cada uno.
// Ya NO renderiza sus propios anuncios (eso lo hace DiagramaEstrategia
// directo en la columna 3, para que cada AnuncioCard sea un hijo del grid
// en su propia fila).
function ConjuntoCard({ conjunto, open, onToggle, cardRef }) {
  return (
    <div ref={cardRef} className="relative w-80 bg-white rounded-lg border border-teal-200 shadow-sm p-4">
      <CornerMarks colorClass="!border-teal-300" />
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-teal-600 shrink-0" />
          <span className="text-sm font-medium text-slate-900 truncate">{conjunto.nombre}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <SpecTag><Users className="w-3 h-3" />{conjunto.segmentacion.edad} · {conjunto.segmentacion.genero}</SpecTag>
        <SpecTag><MapPin className="w-3 h-3" />{conjunto.segmentacion.ubicacion}</SpecTag>
        {conjunto.presupuesto_diario_cop && (
          <SpecTag><Wallet className="w-3 h-3" />{fmtCOP(conjunto.presupuesto_diario_cop)}/día</SpecTag>
        )}
      </div>
      <div className="mt-2">
        <p className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">Ideas de ángulo creativo</p>
        <div className="flex flex-wrap gap-1">
          {conjunto.segmentacion.intereses.map((i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700">{i}</span>
          ))}
        </div>
      </div>
      {!open && (
        <p className="text-[10px] text-slate-400 italic mt-2 pt-2 border-t border-slate-100">
          {conjunto.anuncios.length} anuncio{conjunto.anuncios.length !== 1 ? "s" : ""} colapsado{conjunto.anuncios.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function CampanaNode({ campana, cardRef }) {
  return (
    <div ref={cardRef} className="relative w-96 bg-indigo-50 rounded-xl border border-indigo-200 shadow-sm p-5">
      <CornerMarks colorClass="!border-indigo-300" />
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-indigo-600" />
        <span className="text-[11px] font-medium text-indigo-600 uppercase tracking-wide">Campaña</span>
      </div>
      <p className="text-base font-medium text-slate-900 mt-1">{campana.nombre}</p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <SpecTag>{campana.objetivo_meta}</SpecTag>
        <SpecTag>{campana.tipo_presupuesto}</SpecTag>
        {campana.tipo_presupuesto === "CBO" && (
          <SpecTag><Wallet className="w-3 h-3" />{fmtCOP(campana.presupuesto_diario_cop)}/día</SpecTag>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-indigo-100 flex gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 italic leading-relaxed">{campana.argumento_estrategico}</p>
      </div>
    </div>
  );
}

// Reparte los conjuntos/anuncios en filas de grid: cada AnuncioCard visible
// ocupa 1 fila; un conjunto colapsado aporta 1 sola fila "placeholder" (su
// propia card, sin anuncios). Devuelve, por conjunto, el rango de filas que
// ocupa (para el grid-row: span N + align-self:center de su ConjuntoCard).
function calcularFilas(conjuntos, conjuntosAbiertos) {
  let filaActual = 1;
  const conjuntoFilas = [];
  conjuntos.forEach((conjunto, ci) => {
    const abierto = conjuntosAbiertos[ci];
    const anuncios = conjunto.anuncios || [];
    const filaInicio = filaActual;
    if (abierto && anuncios.length > 0) {
      filaActual += anuncios.length;
    } else {
      filaActual += 1;
    }
    conjuntoFilas.push({ filaInicio, filaFin: filaActual - 1 });
  });
  return { conjuntoFilas, totalFilas: Math.max(filaActual - 1, 1) };
}

// Diagrama horizontal: Campaña (col 1) -> Conjuntos (col 2) -> Anuncios
// (col 3), con líneas punteadas conectando cada nivel. La alineación
// vertical (conjunto centrado frente a SUS anuncios) la resuelve el propio
// CSS Grid (grid-row: span N + align-self:center) -- no depende de medir el
// DOM. Las líneas conectoras sí necesitan coordenadas reales (el alto de
// cada card es variable según su contenido), así que se miden con refs +
// getBoundingClientRect en un overlay SVG, recalculado con ResizeObserver.
function DiagramaEstrategia({ estrategia }) {
  const [conjuntosAbiertos, setConjuntosAbiertos] = useState(() => (estrategia.conjuntos || []).map(() => true));

  // Reinicia el colapso (todo abierto) cada vez que cambia la estrategia
  // seleccionada -- no arrastra el estado de una estrategia a otra.
  useEffect(() => {
    setConjuntosAbiertos((estrategia.conjuntos || []).map(() => true));
  }, [estrategia]);

  const toggleConjunto = (idx) => {
    setConjuntosAbiertos((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const contenedorRef = useRef(null); // wrapper relative que crece al alto total del contenido (el que scrollea es su padre)
  const campanaRef = useRef(null);
  const conjuntoRefs = useRef([]);
  const anuncioRefs = useRef([]); // anuncioRefs.current[ci][ai]
  const [lineas, setLineas] = useState([]);

  const recalcularLineas = useCallback(() => {
    const contEl = contenedorRef.current;
    if (!contEl) return;
    const contRect = contEl.getBoundingClientRect();

    // getBoundingClientRect ya es relativo al viewport considerando el
    // scroll de todos los ancestros -- restar contRect da coordenadas
    // relativas al contenedor sin necesidad de sumar scrollTop/scrollLeft
    // a mano.
    const puntoDerecho = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.right - contRect.left, y: r.top - contRect.top + r.height / 2 };
    };
    const puntoIzquierdo = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - contRect.left, y: r.top - contRect.top + r.height / 2 };
    };

    const nuevasLineas = [];
    if (campanaRef.current) {
      const pCampana = puntoDerecho(campanaRef.current);
      conjuntoRefs.current.forEach((el) => {
        if (!el) return;
        const pConjunto = puntoIzquierdo(el);
        nuevasLineas.push({ x1: pCampana.x, y1: pCampana.y, x2: pConjunto.x, y2: pConjunto.y });
      });
    }
    conjuntoRefs.current.forEach((elConjunto, ci) => {
      if (!elConjunto || !conjuntosAbiertos[ci]) return;
      const pConjunto = puntoDerecho(elConjunto);
      (anuncioRefs.current[ci] || []).forEach((elAnuncio) => {
        if (!elAnuncio) return;
        const pAnuncio = puntoIzquierdo(elAnuncio);
        nuevasLineas.push({ x1: pConjunto.x, y1: pConjunto.y, x2: pAnuncio.x, y2: pAnuncio.y });
      });
    });
    setLineas(nuevasLineas);
  }, [conjuntosAbiertos]);

  // Recalcula ANTES del paint (evita el parpadeo de líneas mal ubicadas un
  // frame) cuando cambia la estrategia o se colapsa/expande un conjunto.
  useLayoutEffect(() => {
    recalcularLineas();
  }, [recalcularLineas, estrategia]);

  // Recalcula también si el contenido cambia de alto sin que nuestro propio
  // estado cambie (ej. el navegador re-envuelve texto al redimensionar la
  // ventana).
  useEffect(() => {
    const contEl = contenedorRef.current;
    if (!contEl || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => recalcularLineas());
    ro.observe(contEl);
    window.addEventListener("resize", recalcularLineas);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalcularLineas);
    };
  }, [recalcularLineas]);

  const conjuntos = estrategia.conjuntos || [];
  const { conjuntoFilas, totalFilas } = calcularFilas(conjuntos, conjuntosAbiertos);

  return (
    // Red de seguridad para estrategias con muchos conjuntos/anuncios --
    // scroll VERTICAL contenido (nunca horizontal como flujo principal;
    // overflowX:auto queda solo de escape para pantallas angostas).
    <div style={{ maxHeight: "70vh", overflowY: "auto", overflowX: "auto" }}>
      <div ref={contenedorRef} style={{ position: "relative", padding: 8 }}>
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
          aria-hidden="true"
        >
          {lineas.map((l, i) => {
            const midX = (l.x1 + l.x2) / 2;
            return (
              <path
                key={i}
                d={`M ${l.x1} ${l.y1} C ${midX} ${l.y1}, ${midX} ${l.y2}, ${l.x2} ${l.y2}`}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            );
          })}
        </svg>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${ANCHO_CAMPANA}px ${ANCHO_CONJUNTO}px ${ANCHO_ANUNCIO}px`,
            gridTemplateRows: `repeat(${totalFilas}, auto)`,
            columnGap: COLUMN_GAP,
            rowGap: ROW_GAP,
            position: "relative",
          }}
        >
          <div style={{ gridColumn: 1, gridRow: `1 / ${totalFilas + 1}`, alignSelf: "center", justifySelf: "start" }}>
            <CampanaNode campana={estrategia.campana} cardRef={campanaRef} />
          </div>

          {conjuntos.map((conjunto, ci) => {
            const { filaInicio, filaFin } = conjuntoFilas[ci];
            const abierto = conjuntosAbiertos[ci];
            return (
              <div
                key={conjunto.nombre}
                style={{ gridColumn: 2, gridRow: `${filaInicio} / ${filaFin + 1}`, alignSelf: "center", justifySelf: "start" }}
              >
                <ConjuntoCard
                  conjunto={conjunto}
                  open={abierto}
                  onToggle={() => toggleConjunto(ci)}
                  cardRef={(el) => { conjuntoRefs.current[ci] = el; }}
                />
              </div>
            );
          })}

          {conjuntos.map((conjunto, ci) => {
            if (!conjuntosAbiertos[ci]) return null;
            const { filaInicio } = conjuntoFilas[ci];
            return (conjunto.anuncios || []).map((anuncio, ai) => (
              <div key={`${conjunto.nombre}-${anuncio.nombre}`} style={{ gridColumn: 3, gridRow: filaInicio + ai, alignSelf: "center", justifySelf: "start" }}>
                <AnuncioCard
                  anuncio={anuncio}
                  cardRef={(el) => {
                    if (!anuncioRefs.current[ci]) anuncioRefs.current[ci] = [];
                    anuncioRefs.current[ci][ai] = el;
                  }}
                />
              </div>
            ));
          })}
        </div>
      </div>
    </div>
  );
}

function EstrategiaSelector({ estrategia, selected, onSelect }) {
  const color = estrategia.efectividad >= 85 ? "emerald" : estrategia.efectividad >= 70 ? "amber" : "rose";
  return (
    <button
      onClick={() => onSelect(estrategia.id)}
      className={`relative text-left w-64 rounded-lg border-2 p-4 transition-colors ${
        selected ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      {selected && (
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </span>
      )}
      <div className="flex items-center justify-between">
        <span className={`text-2xl font-medium text-${color}-600`}>{estrategia.efectividad}</span>
        <TrendingUp className={`w-4 h-4 text-${color}-500`} />
      </div>
      <p className="text-xs text-slate-500 mt-0.5">efectividad estimada</p>
      <p className="text-sm font-medium text-slate-900 mt-2 leading-snug">{estrategia.campana.nombre}</p>
      <div className="mt-2">
        <SpecTag>{estrategia.campana.tipo_presupuesto}</SpecTag>
      </div>
    </button>
  );
}

export default function AdBlueprintExplorer({ estrategias = ESTRATEGIAS, onPublish }) {
  const [selectedId, setSelectedId] = useState(estrategias[0]?.id);
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const selected = estrategias.find((e) => e.id === selectedId) ?? estrategias[0];

  if (!selected) return null;

  const handlePublish = async () => {
    setStatus("sending");
    try {
      if (onPublish) {
        await onPublish(selected);
      }
      setStatus("sent");
    } catch (err) {
      console.error("Error al publicar estrategia:", err);
      setStatus("idle");
    }
  };

  return (
    <div className="w-full">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');`}</style>

      <div
        className="w-full rounded-2xl p-6 pb-28 relative"
        style={{
          backgroundColor: "#f8fafc",
          backgroundImage:
            "radial-gradient(circle, #e2e8f0 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      >
        <div className="mb-6">
          <h2 className="text-lg font-medium text-slate-900">Elige tu estrategia</h2>
          <p className="text-sm text-slate-500">La IA propuso {estrategias.length} enfoques distintos para este producto.</p>
        </div>

        <div className="flex flex-wrap gap-3 mb-10">
          {estrategias.map((e) => (
            <EstrategiaSelector key={e.id} estrategia={e} selected={e.id === selectedId} onSelect={setSelectedId} />
          ))}
        </div>

        <DiagramaEstrategia key={selected.id} estrategia={selected} />
      </div>

      <div className="sticky bottom-4 flex justify-center mt-4">
        <div className="bg-white border border-slate-200 shadow-lg rounded-full px-5 py-3 flex items-center gap-4">
          <div className="text-sm">
            <span className="text-slate-500">Estrategia seleccionada: </span>
            <span className="font-medium text-slate-900">{selected.campana.nombre}</span>
          </div>
          <button
            onClick={handlePublish}
            disabled={status !== "idle"}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
          >
            {status === "idle" && <>Usar esta estrategia <ArrowRight className="w-4 h-4" /></>}
            {status === "sending" && <><Loader2 className="w-4 h-4 animate-spin" /> Enviando al administrador...</>}
            {status === "sent" && <><Check className="w-4 h-4" /> Enviada correctamente</>}
          </button>
        </div>
      </div>
    </div>
  );
}
