"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShoppingBag, Target, Camera, Sparkles, Check, Shirt, Smartphone, UtensilsCrossed, Plane, Briefcase, Palmtree, Video, Watch, Bot, FolderOpen, Dna, X, ShoppingCart, Tag, DollarSign, CheckCircle2, MessageCircle, Phone, Send, Megaphone, Eye, Heart, Star, RefreshCw, Repeat, Users, MousePointerClick, TrendingUp, Zap, Globe } from "lucide-react";
import AdBlueprintExplorer from "@/app/components/AdBlueprintExplorer";
import TutorialVideo from "@/app/components/TutorialVideo";
import TourGuiado from "@/app/components/TourGuiado";
import ProgresoPasos from "@/app/components/ProgresoPasos";
import EsperaCreativos from "@/app/components/EsperaCreativos";

function IconoWhatsApp() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ display: "inline-block" }}>
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        fill="#fff"
        d="M23.47 8.52A9.86 9.86 0 0 0 16.06 5.5c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.33 4.95L6 25.5l5.28-1.39a9.9 9.9 0 0 0 4.78 1.22h.01c5.46 0 9.9-4.44 9.9-9.9a9.85 9.85 0 0 0-2.5-6.91zm-7.41 15.24h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.13.82.84-3.05-.2-.31a8.23 8.23 0 0 1-1.26-4.39c0-4.55 3.7-8.25 8.26-8.25a8.2 8.2 0 0 1 5.84 2.42 8.2 8.2 0 0 1 2.42 5.84c0 4.56-3.71 8.25-8.27 8.25zm4.53-6.18c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31s-.87.85-.87 2.08.89 2.41 1.01 2.58c.13.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28z"
      />
    </svg>
  );
}

const MIN_IMAGENES_PRODUCTO = 1;
const MAX_IMAGENES_PRODUCTO = 3;

const OBJETIVOS = [
  { id: "venta_directa_web", label: "Venta Directa", icon: "🛒", desc: "Ventas inmediatas en tu sitio web.", meta_objective: "OUTCOME_SALES", destino: "sitio_web" },
  { id: "venta_directa_whatsapp", label: "Venta Directa (WhatsApp)", icon: <IconoWhatsApp />, desc: "Ventas por conversación directa en WhatsApp.", meta_objective: "OUTCOME_ENGAGEMENT", destino: "whatsapp" },
  { id: "reconocimiento", label: "Reconocimiento", icon: "📢", desc: "Más personas conocerán tu marca.", meta_objective: "OUTCOME_AWARENESS", destino: "pagina" },
  { id: "retargeting", label: "Retargeting", icon: "🔄", desc: "Impacta a quienes ya te conocen.", meta_objective: "OUTCOME_TRAFFIC", destino: "sitio_web" },
  { id: "leads", label: "Generación de Leads", icon: "🎯", desc: "Captura contactos interesados en tu producto.", meta_objective: "OUTCOME_LEADS", destino: "formulario" },
  { id: "trafico_mensajes", label: "Tráfico", icon: "🌐", desc: "Lleva más visitas nuevas a tu sitio web.", meta_objective: "OUTCOME_TRAFFIC", destino: "sitio_web" },
];

// Tema visual por objetivo -- color de acento + set de iconos tematicos
// que se dispersan de fondo cuando el usuario selecciona esa tarjeta
// (mismo mosaico de POSICIONES_MOSAICO que ya usa el Paso 1, reutilizado
// aqui con otro set de iconos y color por objetivo).
const TEMA_OBJETIVO: Record<string, { color: string; colorClaro: string; iconos: any[] }> = {
  venta_directa_web: { color: "#16A34A", colorClaro: "#DCFCE7", iconos: [ShoppingCart, Tag, DollarSign, CheckCircle2] },
  venta_directa_whatsapp: { color: "#25D366", colorClaro: "#DCFCE7", iconos: [MessageCircle, Phone, Send, CheckCircle2] },
  reconocimiento: { color: "#F97316", colorClaro: "#FFEDD5", iconos: [Megaphone, Eye, Heart, Star] },
  retargeting: { color: "#2563EB", colorClaro: "#DBEAFE", iconos: [RefreshCw, Target, Repeat, Users] },
  leads: { color: "#D97706", colorClaro: "#FEF3C7", iconos: [Target, Users, Send, CheckCircle2] },
  trafico_mensajes: { color: "#0891B2", colorClaro: "#CFFAFE", iconos: [MousePointerClick, TrendingUp, Zap, Globe] },
};

// Redimensiona y comprime la imagen SOLO cuando hace falta -- fotos de
// celular modernas pueden pesar varios MB, y en base64 eso crece un 33%
// mas, lo cual puede chocar contra limites de tamano de body (Next.js,
// n8n) o de localStorage (usado para guardar el progreso del wizard) y
// terminar produciendo un base64 truncado/invalido en OpenAI. Pero si la
// imagen ya es liviana y de tamano razonable, se manda tal cual: convertir
// todo a JPEG siempre le quitaria la transparencia a un PNG (ej. un
// producto recortado con fondo transparente), y seria trabajo innecesario
// para algo que ya esta bien.
const LADO_MAXIMO_IMAGEN = 1600;
const CALIDAD_JPEG = 0.85;
const PESO_MAXIMO_SIN_COMPRIMIR = 800 * 1024; // 800KB

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function comprimirSiHaceFalta(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const yaEsLiviana = file.size <= PESO_MAXIMO_SIN_COMPRIMIR && img.width <= LADO_MAXIMO_IMAGEN && img.height <= LADO_MAXIMO_IMAGEN;
      if (yaEsLiviana) {
        URL.revokeObjectURL(url);
        fileToBase64(file).then(resolve).catch(reject);
        return;
      }
      let { width, height } = img;
      if (width > LADO_MAXIMO_IMAGEN || height > LADO_MAXIMO_IMAGEN) {
        const escala = LADO_MAXIMO_IMAGEN / Math.max(width, height);
        width = Math.round(width * escala);
        height = Math.round(height * escala);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("No se pudo procesar la imagen"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", CALIDAD_JPEG));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer esa imagen"));
    };
    img.src = url;
  });
}

// Consulta /api/creativos-jobs/[id] cada 5s hasta que el job quede "listo" o "error".
// Se usa tanto para generar todos los creativos como para regenerar uno solo,
// y también para retomar un job desde el link de una notificación.
// El proceso real puede tardar entre segundos y ~15 minutos según cuántos
// anuncios haya que generar, así que onProgress reporta el avance real
// (cuántos anuncios ya están listos, de cuántos en total) en cada consulta,
// en vez de simular un tiempo fijo.
type ProgresoJob = { creativos: any[]; total_creativos: number | null; estado: string };

async function pollJobHasta(
  jobId: string,
  onProgress?: (data: ProgresoJob) => void,
  maxMs = 20 * 60 * 1000
): Promise<any[]> {
  const inicio = Date.now();
  while (Date.now() - inicio < maxMs) {
    const res = await fetch(`/api/creativos-jobs/${jobId}`);
    const data = await res.json().catch(() => ({}));
    onProgress?.({
      creativos: data.creativos || [],
      total_creativos: data.total_creativos ?? null,
      estado: data.estado,
    });
    if (data.estado === "listo") {
      return data.creativos || [];
    }
    if (data.estado === "error") {
      throw new Error(data.error_mensaje || "La generación de creativos falló.");
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("La generación de creativos está tardando más de lo esperado. Intenta de nuevo en unos minutos.");
}

function ErrorConAccion({ mensaje, titulo, accionTexto, accionUrl }: { mensaje: string; titulo?: string | null; accionTexto?: string | null; accionUrl?: string | null }) {
  const tieneLinkOpenAI = mensaje.includes("platform.openai.com");
  return (
    <div style={{ color: "#991b1b", fontSize: 13 }}>
      {titulo && <div style={{ fontWeight: 700, marginBottom: 4 }}>{titulo}</div>}
      <div>{mensaje}</div>
      {tieneLinkOpenAI && (
        <div style={{ marginTop: 6 }}>
          <a
            href="https://platform.openai.com/settings/organization/billing/overview"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#7F77DD", fontWeight: 600 }}
          >
            Ir a recargar saldo
          </a>
        </div>
      )}
      {accionTexto && accionUrl && (
        <a
          href={accionUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, background: "#534AB7", color: "#fff", textDecoration: "none", padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}
        >
          {accionTexto} →
        </a>
      )}
    </div>
  );
}

// Logo real de Meta (mismo CDN que usa Integraciones), con texto de
// respaldo si el ícono no carga -- nunca deja un ícono roto en pantalla.
function LogoMetaInline({ size = 18 }: { size?: number }) {
  const [fallo, setFallo] = useState(false);
  if (fallo) return <span style={{ fontWeight: 800 }}>Meta</span>;
  return (
    <img
      src="https://cdn.simpleicons.org/meta/ffffff"
      alt="Meta"
      width={size}
      height={size}
      style={{ display: "block" }}
      onError={() => setFallo(true)}
    />
  );
}

// Link directo a la campaña específica en Meta Ads Manager (no solo al
// dashboard genérico) -- esto es la prueba social más fuerte: el usuario
// puede verificar él mismo, en la fuente oficial, que su campaña sí quedó
// publicada, en vez de solo confiar en el texto de Quiubot.
function linkMetaAdsManager(campaignId: string | null, adAccountId: string | null) {
  if (!campaignId) return "https://adsmanager.facebook.com/adsmanager";
  const params = new URLSearchParams();
  if (adAccountId) params.set("act", adAccountId.replace(/^act_/, ""));
  params.set("selected_campaign_ids", campaignId);
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?${params.toString()}`;
}

type TipoContenido = "producto" | "servicio";

type EstrategiaStep =
  | "tipo"
  | "imagen"
  | "objetivo"
  | "presupuesto"
  | "resultado"
  | "fuente"
  | "album-selector"
  | "analisis"
  | "creativos";

// Mapa de número de paso visible para el usuario (1 a 6), independiente
// del nombre interno de cada step.
const NUMERO_DE_PASO: Record<EstrategiaStep, number> = {
  tipo: 1,
  imagen: 2,
  objetivo: 3,
  presupuesto: 4,
  resultado: 5,
  fuente: 6,
  "album-selector": 6,
  analisis: 6,
  creativos: 6,
};

// Cada paso del wizard tiene su propio video tutorial (ver
// app/lib/seccionesTutoriales.ts, grupo "Motor de Estrategia"). Los pasos
// 6.x (fuente/album-selector/analisis/creativos) comparten el mismo video
// del paso 6, ya que visualmente son sub-pantallas del mismo paso.
// El paso 2 es especial: el video cambia según si se eligió "producto" o
// "servicio" en el paso 1, porque las instrucciones son distintas (subir
// una foto de producto vs. subir una pieza ya diseñada con contexto extra).
const SECCION_TUTORIAL_POR_PASO: Record<Exclude<EstrategiaStep, "imagen">, string> = {
  tipo: "motor-estrategia-paso1",
  objetivo: "motor-estrategia-paso3",
  presupuesto: "motor-estrategia-paso4",
  resultado: "motor-estrategia-paso5",
  fuente: "motor-estrategia-paso6",
  "album-selector": "motor-estrategia-paso6",
  analisis: "motor-estrategia-paso6",
  creativos: "motor-estrategia-paso6",
};

function seccionTutorialActual(step: EstrategiaStep, tipoContenido: TipoContenido | null): string {
  if (step === "imagen") {
    return tipoContenido === "servicio" ? "motor-estrategia-paso2-servicio" : "motor-estrategia-paso2-producto";
  }
  return SECCION_TUTORIAL_POR_PASO[step];
}

// Contenido fijo de cada tarjeta del selector de tipo — se separa en un
// objeto para no repetir textos/íconos entre el render y la lógica de estilos.
const TARJETAS_TIPO: Record<
  TipoContenido,
  {
    etiqueta: string;
    icono: typeof ShoppingBag;
    titulo: string;
    descripcion: string;
    chips: { icono: typeof ShoppingBag; label: string }[];
    iconoPreview: typeof Camera;
    beneficio: string;
    headlineEjemplo: string;
    ctaEjemplo: string;
  }
> = {
  producto: {
    etiqueta: "TIPO_01",
    icono: ShoppingBag,
    titulo: "Producto físico",
    descripcion: "Ropa, tecnología, cosméticos, alimentos. Sube la foto y la convertimos en anuncios.",
    chips: [
      { icono: Shirt, label: "Ropa" },
      { icono: Smartphone, label: "Tecnología" },
      { icono: Watch, label: "Accesorios" },
      { icono: UtensilsCrossed, label: "Comida" },
    ],
    iconoPreview: Camera,
    beneficio: "Una sola foto es suficiente",
    headlineEjemplo: "Descúbrelo antes de que se agote",
    ctaEjemplo: "Comprar ahora",
  },
  servicio: {
    etiqueta: "TIPO_02",
    icono: Target,
    titulo: "Servicio o infoproducto",
    descripcion: "Viajes, cursos, consultorías. Sube tu pieza ya diseñada y generamos los ángulos.",
    chips: [
      { icono: Plane, label: "Viajes" },
      { icono: Palmtree, label: "Playas" },
      { icono: Briefcase, label: "Profesiones" },
      { icono: Video, label: "Influencer" },
    ],
    iconoPreview: Sparkles,
    beneficio: "Genera varios ángulos por ti",
    headlineEjemplo: "Vive la experiencia completa",
    ctaEjemplo: "Reservar ahora",
  },
};

// Trazo vectorial del logo de Quiubot (círculo con apertura + diagonal),
// para poder usarlo como marca de agua en cualquier color según el fondo.
function LogoQuiubotMark({ color, opacity, size }: { color: string; opacity: number; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ opacity }} aria-hidden="true">
      <circle cx="50" cy="45" r="30" fill="none" stroke={color} strokeWidth="10" strokeDasharray="160 30" />
      <line x1="68" y1="63" x2="85" y2="80" stroke={color} strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}

// Posiciones fijas del mosaico de íconos de fondo — mismo layout para ambas
// tarjetas, solo cambia el set de íconos (data.chips) y el color.
const POSICIONES_MOSAICO = [
  { top: "6%", left: "8%", size: 18, rot: -12, idx: 0 },
  { top: "4%", left: "38%", size: 22, rot: 8, idx: 1 },
  { top: "10%", left: "68%", size: 16, rot: -6, idx: 2 },
  { top: "28%", left: "20%", size: 20, rot: 10, idx: 3 },
  { top: "24%", left: "82%", size: 18, rot: -8, idx: 0 },
  { top: "48%", left: "6%", size: 16, rot: 6, idx: 1 },
  { top: "44%", left: "50%", size: 22, rot: -10, idx: 2 },
  { top: "62%", left: "74%", size: 18, rot: 8, idx: 3 },
  { top: "68%", left: "30%", size: 16, rot: -6, idx: 0 },
  { top: "84%", left: "10%", size: 20, rot: 10, idx: 1 },
  { top: "80%", left: "56%", size: 18, rot: -8, idx: 2 },
  { top: "92%", left: "84%", size: 16, rot: 6, idx: 3 },
];
// Tarjeta seleccionable del Paso 1 (Producto vs Servicio), con estados de
// hover, selección y foco por teclado. Vive fuera del componente principal
// porque no depende de ningún estado que no reciba por props.
function TarjetaTipoContenido({
  tipo,
  seleccionado,
  algunaSeleccionada,
  enHover,
  onSelect,
  onHoverChange,
}: {
  tipo: TipoContenido;
  seleccionado: boolean;
  algunaSeleccionada: boolean;
  enHover: boolean;
  onSelect: () => void;
  onHoverChange: (activo: boolean) => void;
}) {
  const data = TARJETAS_TIPO[tipo];
  const colorActivo = "#534AB7";
  const colorActivoClaro = "#7F77DD";
  const fondoActivo = "#F3F2FE";
  const esServicio = tipo === "servicio";

  const colorTexto = seleccionado ? colorActivo : "#1a1a1a";
  const colorBorde = seleccionado ? colorActivo : enHover ? "#bbb" : "#e8e8e6";
  // Cuando ya hay una elección hecha, la tarjeta no elegida retrocede visualmente
  // (como en un selector de personaje/skin), a menos que el mouse esté encima —
  // así sigue siendo fácil cambiar de opinión sin perder la sensación de "modo activado".
  const atenuada = algunaSeleccionada && !seleccionado && !enHover;

  const Icono = data.icono;
  const IconoPreview = data.iconoPreview;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className="quiubot-card-tipo"
      style={{
        cursor: "pointer",
        borderRadius: 16,
        border: `2px solid ${colorBorde}`,
        background: seleccionado ? fondoActivo : "#fff",
        padding: "1.25rem",
        position: "relative",
        overflow: "hidden",
        transition: "border-color .18s ease, background-color .18s ease, transform .12s ease, opacity .18s ease",
        transform: enHover && !seleccionado ? "scale(1.008)" : seleccionado ? "scale(1.01)" : "scale(1)",
        opacity: atenuada ? 0.5 : 1,
        outline: "none",
      }}
    >
      {esServicio ? (
        <span
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            fontFamily: "ui-monospace, monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "#fff",
            background: colorActivo,
            padding: "2px 8px",
            borderRadius: 8,
          }}
        >
          NUEVO
        </span>
      ) : (
        <span
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            fontFamily: "ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.04em",
            color: "#999",
          }}
        >
          {data.etiqueta}
        </span>
      )}

      {/* Insignia de check, escondida hasta que la tarjeta está seleccionada */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 14,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: colorActivo,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: seleccionado ? "scale(1)" : "scale(0)",
          opacity: seleccionado ? 1 : 0,
          transition: "transform .16s cubic-bezier(.34,1.56,.64,1), opacity .16s ease",
        }}
      >
        <Check size={12} color="#fff" strokeWidth={3} aria-hidden="true" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: esServicio ? colorActivo : fondoActivo,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icono size={22} color={esServicio ? "#fff" : colorActivo} strokeWidth={2} aria-hidden="true" />
        </div>
        <p style={{ fontWeight: 600, fontSize: 16, margin: 0, color: colorTexto, transition: "color .18s ease" }}>{data.titulo}</p>
      </div>

      <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5, margin: "0 0 12px" }}>{data.descripcion}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {data.chips.map((chip, i) => {
          const IconoChip = chip.icono;
          return (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: esServicio ? "#fff" : fondoActivo,
                border: esServicio ? `1px solid ${fondoActivo === "#F3F2FE" ? "#E4E1FA" : "#eee"}` : "none",
                borderRadius: 20,
                padding: "4px 10px 4px 8px",
              }}
            >
              <IconoChip size={12} color={colorActivo} strokeWidth={2} aria-hidden="true" />
              <span style={{ fontSize: 11, color: colorActivo, fontWeight: 500 }}>{chip.label}</span>
            </span>
          );
        })}
      </div>

      {/* Mosaico de fondo: íconos de categoría dispersos + logo de marca como
          marca de agua, tono sobre tono, cubriendo toda la tarjeta. Se dibuja
          antes que el contenido y con pointerEvents:none para no interferir
          con los clics ni con la lectura del texto encima. */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: -1 }}>
        {POSICIONES_MOSAICO.map((pos, i) => {
          const IconoMosaico = data.chips[pos.idx % data.chips.length].icono;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                transform: `rotate(${pos.rot}deg)`,
                opacity: 0.2,
              }}
            >
              <IconoMosaico size={pos.size} color={colorActivo} strokeWidth={2} />
            </div>
          );
        })}
        <div style={{ position: "absolute", right: -30, bottom: -30 }}>
          <LogoQuiubotMark color={colorActivo} opacity={0.16} size={150} />
        </div>
      </div>

      <div style={{ background: fondoActivo, borderRadius: 10, padding: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <IconoPreview size={16} color={colorActivoClaro} strokeWidth={2} aria-hidden="true" />
        <span style={{ fontSize: 11, color: colorActivo, fontWeight: 500 }}>{data.beneficio}</span>
      </div>
    </div>
  );
}

// Tarjeta del Paso 3 (elegir objetivo publicitario). Al seleccionarla, se
// activa un mosaico de iconos tematicos de fondo (color y set de iconos
// segun TEMA_OBJETIVO) mas un resplandor de color a juego -- mismo efecto
// "vivo" que ya usa TarjetaTipoContenido en el Paso 1, con su propio tema
// por objetivo en vez de un solo color fijo. El icono principal (emoji o
// el componente de WhatsApp) se mantiene igual que antes; la logica de
// bloqueo por plan / "proximamente" tampoco cambia, solo la capa visual.
function TarjetaObjetivo({
  opt,
  seleccionado,
  clicable,
  grisDelTodo,
  bloqueadoPorPlan,
  etiqueta,
  soloVisualParaAdmin,
  onSelect,
}: {
  opt: { id: string; label: string; icon: React.ReactNode; desc: string };
  seleccionado: boolean;
  clicable: boolean;
  grisDelTodo: boolean;
  bloqueadoPorPlan: boolean;
  etiqueta: string | null;
  soloVisualParaAdmin: boolean;
  onSelect: () => void;
}) {
  const tema = TEMA_OBJETIVO[opt.id] || { color: "#534AB7", colorClaro: "#F3F2FE", iconos: [ShoppingBag, Target, Sparkles, Check] };
  const esWhatsapp = opt.id === "venta_directa_whatsapp";

  return (
    <div
      onClick={onSelect}
      style={{
        position: "relative",
        padding: "1.5rem",
        borderRadius: 16,
        border: seleccionado ? `2px solid ${tema.color}` : "1px solid #e8e8e6",
        background: seleccionado ? tema.colorClaro : "#fff",
        cursor: clicable ? "pointer" : bloqueadoPorPlan ? "pointer" : "not-allowed",
        textAlign: "center",
        overflow: "hidden",
        opacity: grisDelTodo ? 0.45 : 1,
        filter: grisDelTodo ? "grayscale(1)" : "none",
        transform: seleccionado ? "scale(1.015)" : "scale(1)",
        boxShadow: seleccionado ? `0 10px 26px -10px ${tema.color}88` : "none",
        transition: "border-color .18s ease, background-color .18s ease, transform .15s ease, box-shadow .2s ease, opacity .18s ease",
      }}
    >
      {/* Mosaico de iconos tematicos + marca de agua, solo visible cuando
          esta seleccionada -- es el "fondo epico" pedido, sin estorbar la
          lectura del texto encima. */}
      {seleccionado && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {POSICIONES_MOSAICO.map((pos, i) => {
            const IconoMosaico = tema.iconos[pos.idx % tema.iconos.length];
            return (
              <div key={i} style={{ position: "absolute", top: pos.top, left: pos.left, transform: `rotate(${pos.rot}deg)`, opacity: 0.18 }}>
                <IconoMosaico size={pos.size} color={tema.color} strokeWidth={2} />
              </div>
            );
          })}
          <div style={{ position: "absolute", right: -26, bottom: -26 }}>
            <LogoQuiubotMark color={tema.color} opacity={0.12} size={110} />
          </div>
        </div>
      )}

      {etiqueta && (
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 1,
            background: bloqueadoPorPlan ? "#fff" : soloVisualParaAdmin ? "#fef3c7" : "#e5e7eb",
            color: bloqueadoPorPlan ? tema.color : soloVisualParaAdmin ? "#92400e" : "#666",
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 10,
          }}
        >
          {etiqueta}
        </span>
      )}

      {/* Insignia de check, igual que en el Paso 1 -- aparece con resorte al seleccionar */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 1,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: tema.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: seleccionado ? "scale(1)" : "scale(0)",
          opacity: seleccionado ? 1 : 0,
          transition: "transform .16s cubic-bezier(.34,1.56,.64,1), opacity .16s ease",
        }}
      >
        <Check size={12} color="#fff" strokeWidth={3} aria-hidden="true" />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {esWhatsapp ? (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>{opt.icon}</div>
        ) : (
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              margin: "0 auto 10px",
              background: seleccionado ? tema.color : tema.colorClaro,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: seleccionado ? `0 6px 16px -5px ${tema.color}99` : "none",
              transition: "background-color .18s ease",
            }}
          >
            {opt.icon}
          </div>
        )}
        <div style={{ fontWeight: 600, marginBottom: 8, color: seleccionado ? tema.color : "#1a1a1a", transition: "color .18s ease" }}>{opt.label}</div>
        <div style={{ fontSize: 12, color: "#666" }}>{opt.desc}</div>
        {bloqueadoPorPlan && (
          <div style={{ fontSize: 11, color: tema.color, fontWeight: 600, marginTop: 8 }}>Mejorar plan →</div>
        )}
      </div>
    </div>
  );
}

function EstrategiaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // null = todavía cargando, true/false = ya sabemos si tiene ADN de marca.
  // El Motor de Estrategia usa esos datos para generar campañas y creativos
  // "hechos a la medida" en vez de genéricos -- por eso es un requisito
  // previo, no un simple detalle opcional.
  const [tieneAdn, setTieneAdn] = useState<boolean | null>(null);
  const [step, setStep] = useState<EstrategiaStep>("tipo");
  const [tipoContenido, setTipoContenido] = useState<TipoContenido | null>(null);
  const [hoverTipo, setHoverTipo] = useState<TipoContenido | null>(null);
  const [descripcionServicio, setDescripcionServicio] = useState<string>("");
  const [imagenesBase64, setImagenesBase64] = useState<string[]>([]);
  const [objetivo, setObjetivo] = useState<typeof OBJETIVOS[number] | null>(null);
  const [presupuestoDiario, setPresupuestoDiario] = useState<number>(50000);
  const [cargandoEstrategia, setCargandoEstrategia] = useState(false);
  const [cargandoCreativos, setCargandoCreativos] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [publicado, setPublicado] = useState(false);
  const [metaCampaignId, setMetaCampaignId] = useState<string | null>(null);
  const [metaAdAccountId, setMetaAdAccountId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorTitulo, setErrorTitulo] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<{ texto: string; url: string } | null>(null);
  const [estrategiaSeleccionada, setEstrategiaSeleccionada] = useState<any | null>(null);
  const [estrategiasGeneradas, setEstrategiasGeneradas] = useState<any[] | null>(null);
  const [descripcionVisual, setDescripcionVisual] = useState<string>("");
  const [imagenesBase64Persistidas, setImagenesBase64Persistidas] = useState<string[]>([]);
  const [creativos, setCreativos] = useState<any[] | null>(null);
  const [progresoCreativos, setProgresoCreativos] = useState<{ completados: number; total: number | null; parciales: any[] }>({
    completados: 0,
    total: null,
    parciales: [],
  });
  const [regenerandoIndices, setRegenerandoIndices] = useState<Record<number, boolean>>({});
  const [imagenAmpliada, setImagenAmpliada] = useState<string | null>(null);

  const [fuenteCreativos, setFuenteCreativos] = useState<"ia" | "album" | null>(null);
  const [analisisResultado, setAnalisisResultado] = useState<{ score: number; detalle: any[] } | null>(null);
  const [analizandoAlbum, setAnalizandoAlbum] = useState(false);

  const [albumItems, setAlbumItems] = useState<{ url_imagen: string; tipo: string; public_id: string }[]>([]);
  const [cargandoAlbum, setCargandoAlbum] = useState(false);
  // Un "hueco" por cada anuncio que recomendó la estrategia (con su copy
  // real: título, texto, cta) -- el usuario no elige libremente cuántos
  // creativos usar, elige QUÉ imagen de su álbum va en cada hueco recomendado.
  const [angulosRecomendados, setAngulosRecomendados] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<({ url_imagen: string; tipo: string; public_id: string } | null)[]>([]);
  const [slotEligiendo, setSlotEligiendo] = useState<number | null>(null);

  const [objetivosActivos, setObjetivosActivos] = useState<string[] | null>(null);
  const [esAdminObjetivos, setEsAdminObjetivos] = useState(false);
  const [planUsuario, setPlanUsuario] = useState<string>("arranque");
  const [planMinimoPorId, setPlanMinimoPorId] = useState<Record<string, string>>({});
  const [tutorialListo, setTutorialListo] = useState(false);

  // Se pone en true apenas se restaura (o se confirma que NO hay nada que
  // restaurar) el progreso guardado -- evita que el useEffect de guardado
  // automatico sobreescriba el progreso real con el estado inicial vacio
  // durante el primer render.
  const [progresoListo, setProgresoListo] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const LLAVE_PROGRESO = "quiubot_estrategia_progreso";

  // Pasos que tiene sentido restaurar automaticamente: los que dependen
  // solo de elecciones del usuario (texto, imagenes, presupuesto). Los
  // pasos posteriores (resultado en adelante) dependen de respuestas
  // generadas por IA que tambien se guardan, pero si por alguna razon
  // faltara algo, es mas seguro devolver al usuario al paso mas cercano
  // que si tiene todo lo necesario, en vez de a una pantalla rota.
  function pasoRestaurable(data: any): EstrategiaStep {
    if (data.creativos && data.estrategiaSeleccionada && data.fuenteCreativos) return "creativos";
    if (data.estrategiaSeleccionada && data.fuenteCreativos === "album" && data.angulosRecomendados) return "album-selector";
    if (data.estrategiaSeleccionada) return "fuente";
    if (data.estrategiasGeneradas) return "resultado";
    if (data.objetivo && data.presupuestoDiario) return "presupuesto";
    if (data.tipoContenido && data.imagenesBase64?.length) return "objetivo";
    if (data.tipoContenido) return "imagen";
    return "tipo";
  }

  // Restaura el progreso guardado (si existe) apenas se monta la pagina,
  // ANTES que el efecto de recuperacion de job por notificacion (ese tiene
  // prioridad si el usuario llego con ?job= en la URL, ya que ese es un
  // caso mas especifico). Se corre una sola vez.
  useEffect(() => {
    if (searchParams.get("job")) {
      // Si llego por notificacion, ese flujo especifico maneja su propia
      // restauracion -- no pisamos nada aqui.
      setProgresoListo(true);
      return;
    }
    try {
      const guardado = localStorage.getItem(LLAVE_PROGRESO);
      if (guardado) {
        const data = JSON.parse(guardado);
        if (data.tipoContenido) setTipoContenido(data.tipoContenido);
        if (data.descripcionServicio) setDescripcionServicio(data.descripcionServicio);
        if (data.imagenesBase64) setImagenesBase64(data.imagenesBase64);
        if (data.objetivo) setObjetivo(data.objetivo);
        if (data.presupuestoDiario) setPresupuestoDiario(data.presupuestoDiario);
        if (data.estrategiasGeneradas) setEstrategiasGeneradas(data.estrategiasGeneradas);
        if (data.estrategiaSeleccionada) setEstrategiaSeleccionada(data.estrategiaSeleccionada);
        if (data.descripcionVisual) setDescripcionVisual(data.descripcionVisual);
        if (data.fuenteCreativos) setFuenteCreativos(data.fuenteCreativos);
        if (data.angulosRecomendados) setAngulosRecomendados(data.angulosRecomendados);
        if (data.creativos) setCreativos(data.creativos);
        if (data.analisisResultado) setAnalisisResultado(data.analisisResultado);
        setStep(pasoRestaurable(data));
      }
    } catch {}
    setProgresoListo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guarda automaticamente cada vez que cambia algo relevante del wizard --
  // asi, sin importar el motivo por el que se cierre la seccion (refresh,
  // se cerro el navegador, se fue la luz), la proxima vez que entre a
  // /estrategia retoma exactamente donde iba. Solo empieza a guardar
  // despues de que la restauracion inicial ya termino (progresoListo),
  // para no sobreescribir un progreso real con el estado vacio del primer
  // render.
  useEffect(() => {
    if (!progresoListo) return;
    if (publicado) return; // ya se publico, no hay nada que retomar
    try {
      localStorage.setItem(
        LLAVE_PROGRESO,
        JSON.stringify({
          tipoContenido,
          descripcionServicio,
          imagenesBase64,
          objetivo,
          presupuestoDiario,
          estrategiasGeneradas,
          estrategiaSeleccionada,
          descripcionVisual,
          fuenteCreativos,
          angulosRecomendados,
          creativos,
          analisisResultado,
        })
      );
    } catch {}
  }, [
    progresoListo,
    publicado,
    tipoContenido,
    descripcionServicio,
    imagenesBase64,
    objetivo,
    presupuestoDiario,
    estrategiasGeneradas,
    estrategiaSeleccionada,
    descripcionVisual,
    fuenteCreativos,
    angulosRecomendados,
    creativos,
    analisisResultado,
  ]);

  function limpiarProgresoGuardado() {
    try {
      localStorage.removeItem(LLAVE_PROGRESO);
    } catch {}
  }

  function handleCancelarYSalir() {
    if (!confirm("¿Seguro que quieres salir? Se cancelará esta estrategia y volverás al inicio.")) return;
    limpiarProgresoGuardado();
    router.push("/");
  }

  // Requisito previo: sin ADN de marca sintetizado, no se puede usar el
  // Motor de Estrategia -- se verifica apenas se monta la página, antes
  // de dejar avanzar cualquier otra cosa.
  useEffect(() => {
    fetch("/api/marca-adn")
      .then((r) => r.json())
      .then((data) => setTieneAdn(!!data.tieneAdn))
      .catch(() => setTieneAdn(false));

    // Cuenta publicitaria de Meta -- solo se usa para armar el link directo
    // a la campaña en Ads Manager una vez publicada, no bloquea nada si
    // Meta todavía no está conectado (el link cae a un fallback genérico).
    fetch("/api/meta/estado")
      .then((r) => r.json())
      .then((data) => setMetaAdAccountId(data?.cuentaPublicitaria || null))
      .catch(() => setMetaAdAccountId(null));
  }, []);

  // Si el usuario llega desde la notificación "creativos_listos" (?job=<id>),
  // retoma el polling en vez de arrancar el wizard desde el paso 1.
  useEffect(() => {
    const jobId = searchParams.get("job");
    if (!jobId) return;

    const descGuardada = localStorage.getItem("quiubot_descripcion_visual_producto");
    if (descGuardada) setDescripcionVisual(descGuardada);
    const imgsGuardadas = localStorage.getItem("quiubot_imagenes_producto_base64");
    if (imgsGuardadas) {
      try {
        setImagenesBase64Persistidas(JSON.parse(imgsGuardadas));
      } catch {}
    }

    // La estrategia seleccionada también vive solo en memoria -- sin esto,
    // al volver por la notificación (que recarga la página desde cero) se
    // pierde, y "Publicar estrategia en Meta" falla con "Falta la
    // estrategia a publicar" aunque los creativos sí se vean bien.
    const estrategiaGuardada = localStorage.getItem("quiubot_estrategia_seleccionada");
    if (estrategiaGuardada) {
      try {
        setEstrategiaSeleccionada(JSON.parse(estrategiaGuardada));
      } catch {}
    }

    setFuenteCreativos("ia");
    setCargandoCreativos(true);
    setStep("creativos");
    setErrorMsg(null);

    pollJobHasta(jobId, (p) => setProgresoCreativos({ completados: p.creativos.length, total: p.total_creativos, parciales: p.creativos }))
      .then((creativosListos) => {
        localStorage.removeItem("quiubot_job_creativos_activo");

        // Si este job era la regeneración de un solo anuncio (no un lote completo nuevo),
        // restauramos el lote guardado y solo reemplazamos esa posición.
        const idxGuardado = localStorage.getItem("quiubot_job_regenerar_idx");
        const loteGuardado = localStorage.getItem("quiubot_creativos_lote");
        if (idxGuardado !== null && loteGuardado) {
          try {
            const loteBase = JSON.parse(loteGuardado);
            const idx = parseInt(idxGuardado, 10);
            if (creativosListos[0]) {
              loteBase[idx] = creativosListos[0];
            }
            setCreativos(loteBase);
          } catch {
            setCreativos(creativosListos);
          } finally {
            localStorage.removeItem("quiubot_creativos_lote");
            localStorage.removeItem("quiubot_job_regenerar_idx");
          }
        } else {
          setCreativos(creativosListos);
        }
      })
      .catch((e: any) => {
        localStorage.removeItem("quiubot_job_creativos_activo");
        localStorage.removeItem("quiubot_creativos_lote");
        localStorage.removeItem("quiubot_job_regenerar_idx");
        setErrorMsg(e?.message || "No se pudo recuperar el estado de la generación.");
        setCreativos([]);
      })
      .finally(() => setCargandoCreativos(false));

    // limpia el ?job= de la URL para que un refresh no repita el polling
    router.replace("/estrategia");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/objetivos-activos")
      .then((r) => r.json())
      .then((data) => {
        setObjetivosActivos(data.activos ?? []);
        setEsAdminObjetivos(!!data.esAdmin);
        setPlanUsuario(data.planUsuario || "arranque");
        setPlanMinimoPorId(data.planMinimoPorId || {});
      })
      .catch(() => setObjetivosActivos([]));
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || imagenesBase64.length >= MAX_IMAGENES_PRODUCTO) return;
    if (fileRef.current) fileRef.current.value = "";
    try {
      const base64 = await comprimirSiHaceFalta(file);
      setImagenesBase64((prev) => [...prev, base64]);
    } catch {
      setErrorMsg("No se pudo leer esa imagen. Intenta con otro archivo.");
    }
  };

  const handleQuitarImagen = (idx: number) => {
    setImagenesBase64((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGenerarEstrategia = async () => {
    if (imagenesBase64.length < MIN_IMAGENES_PRODUCTO || !objetivo || presupuestoDiario < 20000 || !tipoContenido) return;
    setCargandoEstrategia(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/generar-estrategia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagenes_base64: imagenesBase64,
          objetivo,
          presupuesto_diario_cop: presupuestoDiario,
          tipo_contenido: tipoContenido,
          descripcion_servicio: tipoContenido === "servicio" ? descripcionServicio : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setErrorMsg(data.error || "No se pudo generar la estrategia. Intenta de nuevo.");
        return;
      }
      setEstrategiasGeneradas(data.campanas || []);
      setDescripcionVisual(data.descripcion_visual_producto || "");
      try { localStorage.setItem("quiubot_descripcion_visual_producto", data.descripcion_visual_producto || ""); } catch {}
      setStep("resultado");
    } catch (e) {
      setErrorMsg("No se pudo conectar con el servidor.");
    } finally {
      setCargandoEstrategia(false);
    }
  };

  const handleSeleccionarEstrategia = (estrategia: any) => {
    setEstrategiaSeleccionada(estrategia);
    // Persistimos la estrategia elegida: la generación de creativos con IA
    // puede tardar varios minutos, así que es normal que el usuario salga
    // de la página y vuelva por la notificación "creativos listos". Sin
    // esto, al volver se pierde el estado (vive solo en memoria) y
    // "Publicar estrategia en Meta" falla más adelante.
    try {
      localStorage.setItem("quiubot_estrategia_seleccionada", JSON.stringify(estrategia));
    } catch {}
    setStep("fuente");
  };

  const handleGenerarConIA = async () => {
    setFuenteCreativos("ia");
    setAnalisisResultado(null);
    setCargandoCreativos(true);
    setStep("creativos");
    setErrorMsg(null);
    setProgresoCreativos({ completados: 0, total: null, parciales: [] });
    // Un lote completo nuevo nunca es una regeneración parcial — limpiamos cualquier
    // marca vieja de "regenerando el índice X" que pudiera haber quedado de antes.
    localStorage.removeItem("quiubot_creativos_lote");
    localStorage.removeItem("quiubot_job_regenerar_idx");
    try {
      const imagenesParaEnviar = imagenesBase64.length > 0 ? imagenesBase64 : imagenesBase64Persistidas;
      if (imagenesBase64.length > 0) {
        try {
          localStorage.setItem("quiubot_imagenes_producto_base64", JSON.stringify(imagenesBase64));
          setImagenesBase64Persistidas(imagenesBase64);
        } catch {}
      }
      const res = await fetch("/api/crear-creativos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estrategia: estrategiaSeleccionada,
          descripcion_visual_producto: descripcionVisual,
          imagenes_producto_base64: imagenesParaEnviar,
          tipo_contenido: tipoContenido,
          descripcion_servicio: tipoContenido === "servicio" ? descripcionServicio : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.job_id) {
        setErrorMsg(data.error || "No se pudieron generar los creativos.");
        setCreativos([]);
        return;
      }
      localStorage.setItem("quiubot_job_creativos_activo", data.job_id);
      const creativosListos = await pollJobHasta(data.job_id, (p) =>
        setProgresoCreativos({ completados: p.creativos.length, total: p.total_creativos, parciales: p.creativos })
      );
      localStorage.removeItem("quiubot_job_creativos_activo");
      setCreativos(creativosListos);
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo conectar con el servidor.");
      setCreativos([]);
    } finally {
      setCargandoCreativos(false);
    }
  };

  // Regenera un solo anuncio, manteniendo su posición en la lista
  const handleRegenerarUno = async (idx: number) => {
    const creativo = creativos?.[idx];
    if (!creativo) return;
    setRegenerandoIndices((prev) => ({ ...prev, [idx]: true }));
    setErrorMsg(null);
    try {
      const imagenesParaEnviar = imagenesBase64.length > 0 ? imagenesBase64 : imagenesBase64Persistidas;
      const estrategiaMini = {
        ...estrategiaSeleccionada,
        conjuntos: [
          {
            nombre: creativo.conjunto_nombre,
            anuncios: [
              {
                nombre: creativo.anuncio_nombre,
                copy: { titulo: creativo.titulo, texto: creativo.texto, cta: creativo.cta },
                argumentacion: creativo.argumentacion,
              },
            ],
          },
        ],
      };
      const res = await fetch("/api/crear-creativos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estrategia: estrategiaMini,
          descripcion_visual_producto: descripcionVisual,
          imagenes_producto_base64: imagenesParaEnviar,
          tipo_contenido: tipoContenido,
          descripcion_servicio: tipoContenido === "servicio" ? descripcionServicio : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.job_id) {
        setErrorMsg(data.error || "No se pudo regenerar este anuncio.");
        return;
      }
      // Guardamos el lote completo + qué índice se está regenerando, para que si el
      // usuario sale y vuelve por la notificación, se pueda reemplazar solo esa posición
      // en vez de perder los demás creativos del lote.
      try {
        localStorage.setItem("quiubot_job_creativos_activo", data.job_id);
        localStorage.setItem("quiubot_creativos_lote", JSON.stringify(creativos));
        localStorage.setItem("quiubot_job_regenerar_idx", String(idx));
      } catch {}
      const creativosListos = await pollJobHasta(data.job_id);
      localStorage.removeItem("quiubot_job_creativos_activo");
      if (!creativosListos[0]) {
        setErrorMsg("No se pudo regenerar este anuncio.");
        return;
      }
      setCreativos((prev) => {
        if (!prev) return prev;
        const nuevos = [...prev];
        nuevos[idx] = creativosListos[0];
        return nuevos;
      });
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo conectar con el servidor.");
    } finally {
      setRegenerandoIndices((prev) => ({ ...prev, [idx]: false }));
    }
  };

  // Quita el creativo de esta campaña (el archivo ya quedó guardado en tu álbum permanentemente)
  const handleEliminarCreativo = (idx: number) => {
    setCreativos((prev) => prev?.filter((_, i) => i !== idx) ?? null);
  };

  const handleUsarAlbum = async () => {
    setFuenteCreativos("album");
    setCargandoAlbum(true);
    setStep("album-selector");

    // Aplanamos los anuncios que recomendó la estrategia -- exactamente uno
    // por conjunto/anuncio, con su copy real. Este número es el que manda:
    // el usuario no puede seleccionar más ni menos huecos que estos.
    const angulos: any[] = [];
    for (const conjunto of estrategiaSeleccionada?.conjuntos || []) {
      for (const anuncio of conjunto.anuncios || []) {
        angulos.push({
          conjunto_nombre: conjunto.nombre,
          anuncio_nombre: anuncio.nombre,
          titulo: anuncio.copy?.titulo || "",
          texto: anuncio.copy?.texto || "",
          cta: anuncio.copy?.cta || "Comprar ahora",
          argumentacion: anuncio.argumentacion || "",
        });
      }
    }
    setAngulosRecomendados(angulos);
    setAsignaciones(new Array(angulos.length).fill(null));

    try {
      const res = await fetch("/api/album");
      const data = await res.json();
      setAlbumItems(data.imagenes ?? []);
    } catch (e) {
      setErrorMsg("No se pudo cargar tu álbum.");
    } finally {
      setCargandoAlbum(false);
    }
  };

  const abrirPickerParaSlot = (idx: number) => setSlotEligiendo(idx);
  const cerrarPicker = () => setSlotEligiendo(null);

  const elegirImagenParaSlot = (item: { url_imagen: string; tipo: string; public_id: string }) => {
    if (slotEligiendo === null) return;
    setAsignaciones((prev) => {
      const nuevo = [...prev];
      nuevo[slotEligiendo] = item;
      return nuevo;
    });
    setSlotEligiendo(null);
  };

  const quitarAsignacion = (idx: number) => {
    setAsignaciones((prev) => {
      const nuevo = [...prev];
      nuevo[idx] = null;
      return nuevo;
    });
  };

  const handleConfirmarSeleccionAlbum = async () => {
    if (asignaciones.some((a) => !a)) return; // guarda extra, el botón ya está deshabilitado en ese caso

    const nuevosCreativos = angulosRecomendados.map((ang, i) => {
      const it = asignaciones[i]!;
      return {
        id: it.public_id || `album_${i}`,
        tipo: it.tipo,
        url_imagen: it.url_imagen,
        titulo: ang.titulo,
        texto: ang.texto,
        cta: ang.cta,
        conjunto_nombre: ang.conjunto_nombre,
        anuncio_nombre: ang.anuncio_nombre,
        argumentacion: ang.argumentacion,
      };
    });
    setCreativos(nuevosCreativos);
    setAnalisisResultado(null);
    setErrorMsg(null);
    setAnalizandoAlbum(true);
    setStep("analisis");
    try {
      const res = await fetch("/api/analizar-creativos-album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estrategia: estrategiaSeleccionada,
          creativos_album: nuevosCreativos,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setErrorMsg(data.error || "No se pudieron analizar tus creativos. Intenta de nuevo.");
        setStep("album-selector");
        return;
      }
      setAnalisisResultado({ score: data.score, detalle: data.detalle || [] });
    } catch (e) {
      setErrorMsg("No se pudo conectar con el servidor.");
      setStep("album-selector");
    } finally {
      setAnalizandoAlbum(false);
    }
  };

  const actualizarCreativo = (idx: number, campo: string, valor: string) => {
    setCreativos((prev) => prev?.map((c, i) => (i === idx ? { ...c, [campo]: valor } : c)) ?? null);
  };

  const handlePublicarEnMeta = async () => {
    setPublicando(true);
    setErrorMsg(null);
    setErrorTitulo(null);
    setErrorAccion(null);
    try {
      const efectividadFinal = fuenteCreativos === "album" ? analisisResultado?.score : estrategiaSeleccionada?.efectividad;
      const res = await fetch("/api/publicar-estrategia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estrategia: estrategiaSeleccionada,
          creativos,
          fuente_creativos: fuenteCreativos,
          efectividad_final: efectividadFinal,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudo publicar la estrategia en Meta.");
        setErrorTitulo(data.error_titulo || null);
        if (data.error_accion_texto && data.error_accion_url) {
          setErrorAccion({ texto: data.error_accion_texto, url: data.error_accion_url });
        }
        return;
      }
      setMetaCampaignId(data.meta_campaign_id || null);
      setPublicado(true);
      // Ya se publicó -- limpiamos el estado persistido (el de retomar un
      // job por notificacion, y el progreso general del wizard) para que
      // la próxima vez que se entre a /estrategia empiece una campaña
      // nueva desde cero, no arrastre esta ya publicada.
      try {
        localStorage.removeItem("quiubot_estrategia_seleccionada");
      } catch {}
      limpiarProgresoGuardado();
    } catch (e) {
      setErrorMsg("No se pudo conectar con el servidor.");
    } finally {
      setPublicando(false);
    }
  };

  const scoreParaMostrar =
    fuenteCreativos === "album" ? analisisResultado?.score ?? estrategiaSeleccionada?.efectividad : estrategiaSeleccionada?.efectividad;

  const algunaRegenerando = Object.values(regenerandoIndices).some(Boolean);

  // Mientras se confirma si tiene ADN de marca, no mostramos ni el wizard
  // ni el bloqueo -- evita el parpadeo de "bloqueado" por una fracción de
  // segundo a alguien que sí puede usarlo.
  if (tieneAdn === null) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9f9f8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#999", fontSize: 14 }}>Cargando...</p>
      </div>
    );
  }

  if (tieneAdn === false) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 20, border: "1px solid #e8e8e6", padding: "2.5rem 2rem", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F3F2FE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
            <Dna size={28} color="#534AB7" strokeWidth={2} aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px" }}>
            Primero, sintetiza el ADN de tu marca
          </h1>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 24px" }}>
            El Motor de Estrategia usa tu ADN de marca (paleta, tipografía, tono, estilo visual) para que cada
            campaña y cada creativo se sientan hechos por ti — no genéricos. Es un paso único de unos minutos, y
            después queda listo para siempre.
          </p>
          <a
            href="/marca"
            style={{ display: "block", width: "100%", padding: "13px", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", boxSizing: "border-box" }}
          >
            Sintetizar mi ADN de marca
          </a>
          <button
            onClick={() => router.push("/")}
            style={{ display: "block", width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #e8e8e6", background: "#fff", color: "#666", fontSize: 13, fontWeight: 600, marginTop: 10, cursor: "pointer" }}
          >
            Volver al panel principal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#1a1a1a" }}>Motor de Estrategia Publicitaria</h1>
          <div style={{ display: "flex", gap: 6 }}>
            <TutorialVideo seccion={seccionTutorialActual(step, tipoContenido)} onListo={() => setTutorialListo(true)} />
            <TourGuiado
              seccion="motor-estrategia"
              listo={tutorialListo}
              pasos={[
                { selector: '[data-tour="estrategia-tipo"]', titulo: "Empieza eligiendo qué vas a promocionar", texto: "Producto físico o servicio/infoproducto — la estrategia se adapta según tu elección." },
                { selector: '[data-tour="estrategia-upload"]', titulo: "Sube tus imágenes", texto: "De 1 a 3 fotos — para producto, distintos ángulos del mismo producto; para servicio, distintas piezas que ayuden a entenderlo. Es todo lo que necesitas para arrancar." },
                { selector: '[data-tour="estrategia-siguiente"]', titulo: "Avanza paso a paso", texto: "Objetivo, presupuesto, y en segundos tienes la estrategia completa lista." },
              ]}
            />
            <button
              onClick={handleCancelarYSalir}
              title="Cancela esta estrategia y vuelve al panel principal"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#fff", border: "1px solid #f0c9c9", color: "#b3261e",
                padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <X size={14} strokeWidth={2.5} aria-hidden="true" />
              Cancelar y salir
            </button>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#999", marginBottom: "2rem" }}>
          Paso {NUMERO_DE_PASO[step]} de 6
        </p>

        {step === "tipo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} data-tour="estrategia-tipo">
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px" }}>1. ¿Qué vas a promocionar?</p>
              <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
                {tipoContenido ? "Puedes cambiar de opción antes de continuar." : "Elige una opción para continuar."}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
              <TarjetaTipoContenido
                tipo="producto"
                seleccionado={tipoContenido === "producto"}
                algunaSeleccionada={tipoContenido !== null}
                enHover={hoverTipo === "producto"}
                onSelect={() => setTipoContenido("producto")}
                onHoverChange={(activo) => setHoverTipo(activo ? "producto" : null)}
              />
              <TarjetaTipoContenido
                tipo="servicio"
                seleccionado={tipoContenido === "servicio"}
                algunaSeleccionada={tipoContenido !== null}
                enHover={hoverTipo === "servicio"}
                onSelect={() => setTipoContenido("servicio")}
                onHoverChange={(activo) => setHoverTipo(activo ? "servicio" : null)}
              />
            </div>

            {/* Vista previa del anuncio — reacciona al hover (exploración sin compromiso)
                y a la selección (vista "bloqueada" con más peso visual). Mostrar el
                resultado concreto antes de decidir reduce la incertidumbre de elegir. */}
            {(() => {
              const tipoAMostrar = tipoContenido ?? hoverTipo;
              if (!tipoAMostrar) {
                return (
                  <p style={{ fontSize: 12, color: "#bbb", textAlign: "center", margin: 0 }}>
                    Pasa el mouse sobre una opción para ver cómo se vería tu anuncio
                  </p>
                );
              }
              const data = TARJETAS_TIPO[tipoAMostrar];
              const bloqueado = tipoContenido === tipoAMostrar;
              const esServicioPreview = tipoAMostrar === "servicio";
              const IconoGrande = data.icono;
              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    background: bloqueado ? "#F3F2FE" : "#fff",
                    border: bloqueado ? "1.5px solid #E4E1FA" : "1.5px dashed #ddd",
                    borderRadius: 14,
                    padding: "14px 16px",
                    animation: "quiubot-banner-in .2s ease",
                  }}
                >
                  {/* Mini mockup de publicación */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 10, padding: 8, boxShadow: "0 0 0 1px #eee" }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 8,
                        background: esServicioPreview ? "#534AB7" : "#F3F2FE",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconoGrande size={24} color={esServicioPreview ? "#fff" : "#534AB7"} strokeWidth={2} aria-hidden="true" />
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#333", maxWidth: 150, lineHeight: 1.3 }}>{data.headlineEjemplo}</p>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff", color: "#1a1a1a", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 4, border: "1px solid #ccc" }}>
                        {data.ctaEjemplo}
                      </span>
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: bloqueado ? "#534AB7" : "#666" }}>
                      {bloqueado ? `Modo ${data.titulo} activado` : `Así se vería tu anuncio de ${data.titulo.toLowerCase()}`}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: bloqueado ? "#534AB7" : "#999" }}>
                      {bloqueado ? "Ejemplo ilustrativo — puedes cambiar de opción arriba cuando quieras." : "Haz clic en la tarjeta para elegir este modo."}
                    </p>
                  </div>
                </div>
              );
            })()}

            <button
              onClick={() => setStep("imagen")}
              disabled={!tipoContenido}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: !tipoContenido ? "#eee" : "#534AB7",
                color: !tipoContenido ? "#aaa" : "#fff",
                border: "none",
                padding: "16px",
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 600,
                cursor: !tipoContenido ? "not-allowed" : "pointer",
                transition: "background-color .18s ease, color .18s ease",
              }}
            >
              {tipoContenido && (() => {
                const IconoBtn = TARJETAS_TIPO[tipoContenido].icono;
                return <IconoBtn size={18} strokeWidth={2} aria-hidden="true" />;
              })()}
              {!tipoContenido
                ? "Selecciona una opción para continuar"
                : tipoContenido === "producto"
                ? "Continuar con producto físico"
                : "Continuar con servicio o infoproducto"}
            </button>
          </div>
        )}

        {step === "imagen" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <button onClick={() => setStep("tipo")} style={{ background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13, padding: 0, alignSelf: "flex-start" }}>
              ← Cambiar tipo
            </button>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>
              2. {tipoContenido === "servicio" ? "Sube la pieza gráfica de tu servicio" : "Sube fotos de tu producto"}
            </p>
            <p style={{ fontSize: 13, color: "#666", marginTop: -12 }}>
              {tipoContenido === "servicio"
                ? "Sube de 1 a 3 piezas ya diseñadas (por ti o con otro editor/IA) que muestren la información de tu servicio: destino, precio, fecha, beneficio principal, etc. Si subes varias, cada una debe aportar algo distinto para entender mejor tu servicio."
                : "Sube de 1 a 3 fotos de tu producto — si subes varias, que sean ángulos distintos del mismo producto (frente, detalle, en uso, empaque, etc.) para que la IA lo entienda mejor."}
            </p>

            <div data-tour="estrategia-upload" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
              {imagenesBase64.map((src, idx) => (
                <div key={idx} style={{ position: "relative", aspectRatio: "1" }}>
                  <img src={src} alt={`Imagen ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12, border: "1px solid #e0e0e0" }} />
                  <button
                    onClick={() => handleQuitarImagen(idx)}
                    title="Quitar"
                    style={{ position: "absolute", top: -6, right: -6, width: 24, height: 24, borderRadius: "50%", background: "#1a1a1a", color: "#fff", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
              {imagenesBase64.length < MAX_IMAGENES_PRODUCTO && (
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{ aspectRatio: "1", border: "1.5px dashed #7F77DD", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fcfcff", gap: 6 }}
                >
                  <Camera size={22} color="#534AB7" strokeWidth={2} aria-hidden="true" />
                  <span style={{ fontSize: 11, color: "#534AB7", fontWeight: 500, textAlign: "center", padding: "0 8px" }}>
                    {imagenesBase64.length === 0
                      ? (tipoContenido === "servicio" ? "Subir pieza gráfica" : "Subir foto del producto")
                      : "Subir otra"}
                  </span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
            </div>

            <p style={{ fontSize: 12, color: "#999", marginTop: -12 }}>
              {imagenesBase64.length}/{MAX_IMAGENES_PRODUCTO} subidas · mínimo {MIN_IMAGENES_PRODUCTO}
            </p>

            {tipoContenido === "servicio" && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", display: "block", marginBottom: 6 }}>
                  ¿Quieres darnos más contexto? <span style={{ fontWeight: 400, color: "#999" }}>(opcional)</span>
                </label>
                <textarea
                  className="quiubot-textarea-servicio"
                  value={descripcionServicio}
                  onChange={(e) => {
                    setDescripcionServicio(e.target.value.slice(0, 500));
                    // Auto-crece con el contenido en vez de mostrar scroll interno
                    // desde el principio -- mucho más natural mientras se escribe.
                    // Al llegar al tope (200px) sí aparece scroll, para que un
                    // texto muy largo no empuje el resto de la página hacia abajo.
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                  }}
                  onFocus={(e) => {
                    // Al volver a hacer foco, recupera el alto que le
                    // corresponde según el contenido actual (pudo haberse
                    // "achicado" por el onBlur de la última vez).
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                  }}
                  onBlur={(e) => {
                    // Mientras no se está editando, se reduce a un tamaño
                    // compacto -- ocupa menos espacio en la página y dedica
                    // el cuadro grande solo al momento de escribir.
                    e.target.style.height = "42px";
                  }}
                  placeholder='Ej: "Paquete todo incluido a Cartagena, 4 noches, incluye vuelos"'
                  maxLength={500}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1.5px solid #e0e0e0", background: "#fcfcff", fontSize: 13, color: "#1a1a1a", resize: "none", height: 42, maxHeight: 200, overflowY: "auto", fontFamily: "inherit", boxSizing: "border-box", outline: "none", transition: "height .18s ease, border-color .15s ease, box-shadow .15s ease" }}
                />
                <div style={{ fontSize: 11, color: "#999", textAlign: "right", marginTop: 4 }}>{descripcionServicio.length}/500</div>
              </div>
            )}

            <button data-tour="estrategia-siguiente" onClick={() => setStep("objetivo")} disabled={imagenesBase64.length < MIN_IMAGENES_PRODUCTO} style={{ background: imagenesBase64.length < MIN_IMAGENES_PRODUCTO ? "#ccc" : "#534AB7", color: "#fff", border: "none", padding: "16px", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: imagenesBase64.length < MIN_IMAGENES_PRODUCTO ? "not-allowed" : "pointer" }}>
              Siguiente paso
            </button>
          </div>
        )}

        {step === "objetivo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>3. Selecciona tu objetivo publicitario</p>
            {objetivosActivos === null && <p style={{ fontSize: 13, color: "#999" }}>Cargando objetivos disponibles...</p>}
            {objetivosActivos !== null && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                {OBJETIVOS.map((opt) => {
                  const estaActivo = objetivosActivos.includes(opt.id);
                  const planRequerido = planMinimoPorId[opt.id] || "arranque";
                  const ORDEN_PLANES = ["arranque", "crecimiento", "escala"];
                  const planAlcanza = ORDEN_PLANES.indexOf(planUsuario) >= ORDEN_PLANES.indexOf(planRequerido);
                  const soloVisualParaAdmin = esAdminObjetivos && !estaActivo;
                  const bloqueadoPorPlan = estaActivo && !planAlcanza && !esAdminObjetivos;
                  const clicable = (estaActivo && planAlcanza) || esAdminObjetivos;
                  const grisDelTodo = !estaActivo || bloqueadoPorPlan;

                  let etiqueta: string | null = null;
                  if (!estaActivo) etiqueta = soloVisualParaAdmin ? "Solo tú lo ves" : "Próximamente";
                  else if (bloqueadoPorPlan) etiqueta = `Plan ${planRequerido === "crecimiento" ? "Crecimiento" : "Escala"}`;

                  return (
                    <TarjetaObjetivo
                      key={opt.id}
                      opt={opt}
                      seleccionado={objetivo?.id === opt.id}
                      clicable={clicable}
                      grisDelTodo={grisDelTodo}
                      bloqueadoPorPlan={bloqueadoPorPlan}
                      etiqueta={etiqueta}
                      soloVisualParaAdmin={soloVisualParaAdmin}
                      onSelect={() => {
                        if (clicable) setObjetivo(opt);
                        else if (bloqueadoPorPlan) router.push("/pricing");
                      }}
                    />
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep("imagen")} style={{ padding: "16px 32px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>Atrás</button>
              <button onClick={() => setStep("presupuesto")} disabled={!objetivo} style={{ flex: 1, background: !objetivo ? "#aaa" : "#534AB7", color: "#fff", border: "none", padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: !objetivo ? "not-allowed" : "pointer" }}>
                Siguiente →
              </button>
            </div>
            {errorMsg && <ErrorConAccion mensaje={errorMsg} />}
          </div>
        )}

        {step === "presupuesto" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <button onClick={() => setStep("objetivo")} style={{ background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13, padding: 0, alignSelf: "flex-start" }}>
              ← Cambiar objetivo
            </button>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>4. ¿Cuál es tu presupuesto diario?</p>
            <p style={{ fontSize: 13, color: "#666", marginTop: -8 }}>La IA diseñará la mejor estructura de campaña posible para este monto exacto.</p>
            <div style={{ background: "#fff", border: "2px solid #e0e0e0", borderRadius: 14, padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 600, color: "#666" }}>$</span>
                <input type="number" min={20000} step={5000} value={presupuestoDiario} onChange={(e) => setPresupuestoDiario(Number(e.target.value))} style={{ flex: 1, border: "none", outline: "none", fontSize: 24, fontWeight: 700, color: "#1a1a1a", fontFamily: "inherit" }} />
                <span style={{ fontSize: 14, color: "#999" }}>COP / día</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                {[30000, 50000, 100000, 150000].map((monto) => (
                  <button key={monto} onClick={() => setPresupuestoDiario(monto)} style={{ padding: "8px 14px", borderRadius: 20, border: presupuestoDiario === monto ? "2px solid #534AB7" : "1px solid #e0e0e0", background: presupuestoDiario === monto ? "#f3f2fe" : "#fff", color: presupuestoDiario === monto ? "#534AB7" : "#666", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    ${monto.toLocaleString("es-CO")}
                  </button>
                ))}
              </div>
              {presupuestoDiario < 20000 && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#fee2e2", borderRadius: 10, fontSize: 13, color: "#991b1b" }}>
                  El mínimo recomendado es $20.000 COP/día — por debajo de esto, la campaña no suele salir de la fase de aprendizaje de Meta.
                </div>
              )}
              {presupuestoDiario >= 500000 && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef3c7", borderRadius: 10, fontSize: 13, color: "#92400e" }}>
                  Presupuestos altos sin historial previo pueden no optimizarse de inmediato. Considera empezar más bajo y escalar.
                </div>
              )}
            </div>
            {cargandoEstrategia && (
              <ProgresoPasos
                activo={cargandoEstrategia}
                duracionEstimadaMs={24000}
                tituloEnCurso="Diseñando tu estrategia"
                pasos={[
                  "Leyendo tu producto y tu marca",
                  "Aplicando las reglas del playbook de Meta Ads",
                  "Diseñando la segmentación de público",
                  "Redactando el copy de cada anuncio",
                  "Calculando la efectividad estimada",
                ]}
              />
            )}
            {!cargandoEstrategia && (
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("objetivo")} style={{ padding: "16px 32px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>Atrás</button>
                <button onClick={handleGenerarEstrategia} disabled={presupuestoDiario < 20000} style={{ flex: 1, background: presupuestoDiario < 20000 ? "#aaa" : "#534AB7", color: "#fff", border: "none", padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: presupuestoDiario < 20000 ? "not-allowed" : "pointer" }}>
                  🚀 Generar Estrategia
                </button>
              </div>
            )}
            {errorMsg && <ErrorConAccion mensaje={errorMsg} />}
          </div>
        )}

        {step === "resultado" && (
          <div>
            <button onClick={() => setStep("presupuesto")} style={{ marginBottom: 16, background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13 }}>
              ← Cambiar presupuesto
            </button>
            <AdBlueprintExplorer estrategias={estrategiasGeneradas ?? undefined} onPublish={handleSeleccionarEstrategia} />
          </div>
        )}

        {step === "fuente" && (
          <div>
            <button onClick={() => setStep("resultado")} style={{ marginBottom: 16, background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13 }}>
              ← Volver a estrategias
            </button>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 16 }}>5. ¿Cómo quieres tus creativos?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div onClick={handleGenerarConIA} style={{ padding: "2rem", borderRadius: 16, border: "1px solid #e8e8e6", background: "#fff", cursor: "pointer", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F3F2FE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Bot size={26} color="#534AB7" strokeWidth={2} aria-hidden="true" />
                </div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Generar con IA</div>
                <div style={{ fontSize: 12, color: "#666" }}>Crea imágenes y copys nuevos automáticamente según tu estrategia.</div>
              </div>
              <div onClick={handleUsarAlbum} style={{ padding: "2rem", borderRadius: 16, border: "1px solid #e8e8e6", background: "#fff", cursor: "pointer", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F3F2FE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <FolderOpen size={26} color="#534AB7" strokeWidth={2} aria-hidden="true" />
                </div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Usar mis creativos del álbum</div>
                <div style={{ fontSize: 12, color: "#666" }}>Elige imágenes o videos que ya subiste. El sistema evaluará si encajan con la estrategia.</div>
              </div>
            </div>
          </div>
        )}

        {step === "album-selector" && (
          <div>
            <button onClick={() => setStep("fuente")} style={{ marginBottom: 16, background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13 }}>
              ← Atrás
            </button>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>
              Usa tus creativos para los {angulosRecomendados.length} anuncio{angulosRecomendados.length !== 1 ? "s" : ""} que recomendó la estrategia
            </p>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
              Cada anuncio ya tiene su copy listo — solo elige qué imagen de tu álbum va en cada uno.
            </p>

            {cargandoAlbum && <p style={{ color: "#666", fontSize: 13 }}>Cargando álbum...</p>}
            {!cargandoAlbum && albumItems.length === 0 && (
              <p style={{ color: "#666", fontSize: 13 }}>
                Aún no tienes imágenes ni videos en tu álbum. Sube contenido desde la sección "Álbum Creativos" en el panel principal.
              </p>
            )}
            {!cargandoAlbum && albumItems.length > 0 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 20 }}>
                  {angulosRecomendados.map((ang, idx) => {
                    const asignado = asignaciones[idx];
                    return (
                      <div key={idx} style={{ background: "#fff", border: asignado ? "1px solid #e8e8e6" : "1.5px dashed #d9d4f7", borderRadius: 12, overflow: "hidden" }}>
                        {asignado ? (
                          <div style={{ position: "relative" }}>
                            {asignado.tipo === "video" ? (
                              <video src={asignado.url_imagen} style={{ width: "100%", height: 160, objectFit: "cover", background: "#000", display: "block" }} muted />
                            ) : (
                              <img src={asignado.url_imagen} alt="" style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                            )}
                            <button
                              onClick={() => quitarAsignacion(idx)}
                              title="Quitar imagen"
                              style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => abrirPickerParaSlot(idx)}
                            style={{ height: 160, background: "#fcfcff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}
                          >
                            <FolderOpen size={24} color="#7F77DD" strokeWidth={2} aria-hidden="true" />
                            <span style={{ fontSize: 12.5, color: "#534AB7", fontWeight: 600 }}>Elegir imagen de tu álbum</span>
                          </div>
                        )}

                        <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ fontSize: 10, color: "#999", fontFamily: "ui-monospace, monospace", textTransform: "uppercase", letterSpacing: 0.4 }}>
                            {ang.conjunto_nombre}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>{ang.titulo}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>{ang.texto}</div>
                          <span style={{ display: "inline-block", background: "#f3f2fe", color: "#534AB7", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, width: "fit-content" }}>{ang.cta}</span>
                          {asignado && (
                            <button
                              onClick={() => abrirPickerParaSlot(idx)}
                              style={{ marginTop: 4, background: "#fff", border: "1px solid #e0e0e0", color: "#534AB7", fontSize: 12, fontWeight: 600, padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                            >
                              Cambiar imagen
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handleConfirmarSeleccionAlbum}
                  disabled={asignaciones.some((a) => !a) || analizandoAlbum}
                  style={{
                    width: "100%",
                    background: (asignaciones.some((a) => !a) || analizandoAlbum) ? "#ccc" : "#534AB7",
                    color: "#fff", border: "none", padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 600,
                    cursor: (asignaciones.some((a) => !a) || analizandoAlbum) ? "not-allowed" : "pointer",
                  }}
                >
                  {analizandoAlbum
                    ? "Analizando..."
                    : asignaciones.some((a) => !a)
                    ? `Falta asignar imagen a ${asignaciones.filter((a) => !a).length} anuncio${asignaciones.filter((a) => !a).length !== 1 ? "s" : ""}`
                    : `Analizar ${angulosRecomendados.length} creativo${angulosRecomendados.length !== 1 ? "s" : ""}`}
                </button>
              </>
            )}

            {/* Modal selector: elegir qué imagen del álbum va en el hueco actual */}
            {slotEligiendo !== null && (
              <div
                onClick={cerrarPicker}
                style={{ position: "fixed", inset: 0, background: "rgba(23,21,43,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "80vh", overflowY: "auto", padding: "1.5rem" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>
                      Elige la imagen para "{angulosRecomendados[slotEligiendo]?.titulo}"
                    </p>
                    <button onClick={cerrarPicker} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 16 }}>✕</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                    {albumItems.map((item, i) => {
                      const itemId = item.public_id || item.url_imagen;
                      return (
                        <div
                          key={itemId || i}
                          onClick={() => elegirImagenParaSlot(item)}
                          style={{
                            position: "relative", borderRadius: 8, overflow: "hidden",
                            cursor: "pointer",
                            border: "1px solid #e8e8e6",
                          }}
                        >
                          {item.tipo === "video" ? (
                            <video src={item.url_imagen} style={{ width: "100%", height: 90, objectFit: "cover", background: "#000", display: "block" }} muted />
                          ) : (
                            <img src={item.url_imagen} alt="" style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "analisis" && (
          <div>
            <button
              onClick={() => !analizandoAlbum && setStep("album-selector")}
              disabled={analizandoAlbum}
              style={{ marginBottom: 16, background: "none", border: "none", color: analizandoAlbum ? "#bbb" : "#7F77DD", cursor: analizandoAlbum ? "not-allowed" : "pointer", fontSize: 13 }}
            >
              ← Ajustar selección
            </button>

            {analizandoAlbum && (
              <ProgresoPasos
                activo={analizandoAlbum}
                duracionEstimadaMs={8000 * Math.max(1, creativos?.length || 1)}
                tituloEnCurso="Analizando tus creativos contra la estrategia"
                pasos={[
                  "Comparando cada imagen con los ángulos que recomendó la IA",
                  "Evaluando qué tan bien encaja cada una, con honestidad",
                  "Recalculando la efectividad real de tu campaña",
                ]}
              />
            )}

            {!analizandoAlbum && analisisResultado && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "2rem", background: "#fff", padding: "2rem", borderRadius: 16, border: "1px solid #e8e8e6", marginBottom: 20 }}>
                  <div style={{ position: "relative", width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: `conic-gradient(#534AB7 ${analisisResultado.score}%, #f0f0f0 0)` }}>
                    <div style={{ background: "#fff", width: 85, height: 85, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>{analisisResultado.score}%</div>
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 16 }}>Efectividad estimada con tus creativos</h2>
                    <p style={{ color: "#666", fontSize: 13, margin: "4px 0 0" }}>
                      Estrategia original: {estrategiaSeleccionada?.efectividad}% · Recalculada con IA analizando tus imágenes reales: {analisisResultado.score}%
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>Detalle por creativo</p>
                <p style={{ fontSize: 12, color: "#999", marginBottom: 10 }}>
                  Este análisis es una guía, no una garantía — la decisión final de usar cada creativo es tuya.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {analisisResultado.detalle.map((d, i) => (
                    <div key={`${d.id || "x"}-${i}`} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#fff", border: "1px solid #e8e8e6", borderRadius: 10, padding: 12 }}>
                      {d.tipo === "video" ? (
                        <video src={d.url_imagen} style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", background: "#000", flexShrink: 0 }} muted />
                      ) : (
                        <img src={d.url_imagen} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: d.cumple ? "#15803d" : "#b45309" }}>
                          {d.cumple ? "✅ Cumple con la estrategia" : "⚠️ No es ideal para esta estrategia"}
                          {d.cumple_score != null && ` · ${d.cumple_score}%`}
                        </div>
                        {d.angulo_elegido && (
                          <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>Ángulo más cercano: {d.angulo_elegido}</div>
                        )}
                        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{d.comentario}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setStep("creativos")} style={{ width: "100%", background: "#534AB7", color: "#fff", border: "none", padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
                  Continuar y editar copys →
                </button>
              </>
            )}
          </div>
        )}

        {step === "creativos" && (
          <div>
            <button
              onClick={() => !algunaRegenerando && setStep(fuenteCreativos === "album" ? "analisis" : "fuente")}
              disabled={algunaRegenerando}
              title={algunaRegenerando ? "Espera a que termine de regenerar el anuncio" : undefined}
              style={{ marginBottom: 16, background: "none", border: "none", color: algunaRegenerando ? "#bbb" : "#7F77DD", cursor: algunaRegenerando ? "not-allowed" : "pointer", fontSize: 13 }}
            >
              {fuenteCreativos === "album" ? "← Volver al análisis" : "← Cambiar fuente de creativos"}
            </button>
            {algunaRegenerando && (
              <p style={{ fontSize: 12, color: "#999", marginTop: -12, marginBottom: 16 }}>
                Espera a que termine de regenerar el anuncio antes de salir o publicar, para no perder el progreso.
              </p>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>6. Creativos de tu campaña</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {scoreParaMostrar != null && (
                  <span style={{ background: "#f3f2fe", color: "#534AB7", fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 20 }}>
                    Efectividad estimada: {scoreParaMostrar}%
                  </span>
                )}
                {fuenteCreativos === "ia" && !cargandoCreativos && creativos && creativos.length > 0 && (
                  <button
                    onClick={handleGenerarConIA}
                    style={{ background: "#fff", border: "1px solid #e0e0e0", color: "#534AB7", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 20, cursor: "pointer" }}
                  >
                    🔄 Regenerar todos
                  </button>
                )}
              </div>
            </div>

            {cargandoCreativos && (
              <EsperaCreativos
                completados={progresoCreativos.completados}
                total={progresoCreativos.total}
                creativosListos={progresoCreativos.parciales}
              />
            )}

            {!cargandoCreativos && creativos && creativos.length === 0 && (
              <p style={{ color: "#666", fontSize: 13 }}>No quedan creativos en esta campaña. Genera de nuevo o vuelve a elegir la fuente.</p>
            )}

            {!cargandoCreativos && creativos && creativos.length > 0 && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                  {creativos.map((c, idx) => {
                    const regenerando = !!regenerandoIndices[idx];
                    return (
                      <div key={`${c.public_id || c.id || "x"}-${idx}`} style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 12, overflow: "hidden", position: "relative" }}>
                        {/* Botón eliminar */}
                        <button
                          onClick={() => handleEliminarCreativo(idx)}
                          title="Quitar de esta campaña"
                          style={{ position: "absolute", top: 8, right: 8, zIndex: 2, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          ✕
                        </button>

                        {/* Imagen completa, sin recortar, con vista ampliada al hacer clic */}
                        {c.url_imagen ? (
                          c.tipo === "video" ? (
                            <video src={c.url_imagen} controls style={{ width: "100%", maxHeight: 320, objectFit: "contain", background: "#f3f2fe", display: "block" }} />
                          ) : (
                            <div
                              onClick={() => setImagenAmpliada(c.url_imagen)}
                              style={{ width: "100%", background: "#f3f2fe", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-in", position: "relative" }}
                            >
                              <img src={c.url_imagen} alt="" style={{ width: "100%", maxHeight: 320, objectFit: "contain", opacity: regenerando ? 0.4 : 1, display: "block" }} />
                              {regenerando && (
                                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <div className="spinner-estrategia" style={{ width: 28, height: 28, borderWidth: 3 }}></div>
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          <div style={{ height: 160, background: "#f3f2fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🖼️</div>
                        )}

                        <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 8 }}>
                          {fuenteCreativos === "album" ? (
                            <>
                              <input placeholder="Título del anuncio" value={c.titulo} onChange={(e) => actualizarCreativo(idx, "titulo", e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #e0e0e0", fontSize: 13, fontWeight: 600 }} />
                              <textarea placeholder="Texto / descripción" value={c.texto} onChange={(e) => actualizarCreativo(idx, "texto", e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #e0e0e0", fontSize: 12, resize: "none", minHeight: 50 }} />
                              <input placeholder="Texto del botón (CTA)" value={c.cta} onChange={(e) => actualizarCreativo(idx, "cta", e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #e0e0e0", fontSize: 12 }} />
                            </>
                          ) : (
                            <>
                              <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>{c.titulo}</div>
                              <div style={{ fontSize: 12, color: "#666" }}>{c.texto}</div>
                              <span style={{ display: "inline-block", background: "#f3f2fe", color: "#534AB7", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, width: "fit-content" }}>{c.cta}</span>
                              <button
                                onClick={() => handleRegenerarUno(idx)}
                                disabled={regenerando}
                                style={{ marginTop: 6, background: "#fff", border: "1px solid #e0e0e0", color: "#534AB7", fontSize: 12, fontWeight: 600, padding: "8px 10px", borderRadius: 8, cursor: regenerando ? "not-allowed" : "pointer" }}
                              >
                                {regenerando ? "Regenerando..." : "🔄 Regenerar este anuncio"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 24 }}>
                  {publicando ? (
                    <ProgresoPasos
                      activo={publicando}
                      duracionEstimadaMs={16000}
                      tituloEnCurso="Publicando tu campaña"
                      pasos={[
                        "Creando la campaña en Meta",
                        "Armando los conjuntos de anuncios",
                        "Subiendo tus creativos",
                        "Activando los anuncios",
                      ]}
                    />
                  ) : publicado ? (
                    <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 12, padding: "1.25rem", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={22} color="#fff" strokeWidth={3} aria-hidden="true" />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#15803D" }}>Campaña publicada en Meta</div>
                        <div style={{ fontSize: 12.5, color: "#3f6d54", marginTop: 2 }}>
                          Ya está creada directamente en tu cuenta de Meta Ads Manager, en pausa para que la revises antes de activarla.
                        </div>
                      </div>
                      <a
                        href={linkMetaAdsManager(metaCampaignId, metaAdAccountId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1877F2", color: "#fff", textDecoration: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, marginTop: 4 }}
                      >
                        <LogoMetaInline size={16} />
                        Ver campaña en Meta Ads Manager
                      </a>
                    </div>
                  ) : (
                    <button
                      onClick={handlePublicarEnMeta}
                      disabled={algunaRegenerando}
                      style={{ width: "100%", background: algunaRegenerando ? "#aaa" : "#534AB7", color: "#fff", border: "none", padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: algunaRegenerando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
                    >
                      {algunaRegenerando ? (
                        "⏳ Espera a que termine la regeneración"
                      ) : (
                        <>
                          <LogoMetaInline size={18} />
                          Publicar estrategia en Meta
                        </>
                      )}
                    </button>
                  )}
                  {errorMsg && <ErrorConAccion mensaje={errorMsg} titulo={errorTitulo} accionTexto={errorAccion?.texto} accionUrl={errorAccion?.url} />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de vista ampliada de imagen */}
      {imagenAmpliada && (
        <div
          onClick={() => setImagenAmpliada(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", padding: "2rem" }}
        >
          <img src={imagenAmpliada} alt="Vista ampliada" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />
        </div>
      )}

      <style>{`
        .spinner-estrategia { border: 4px solid #f3f3f3; border-top: 4px solid #534AB7; border-radius: 50%; width: 40px; height: 40px; animation: spin-estrategia 1s linear infinite; }
        @keyframes spin-estrategia { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes quiubot-pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
        @keyframes quiubot-banner-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .quiubot-card-tipo:focus-visible { box-shadow: 0 0 0 3px rgba(83, 74, 183, 0.3); }
        .quiubot-textarea-servicio:focus { border-color: #7F77DD !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(83, 74, 183, 0.12); }
        .quiubot-textarea-servicio::placeholder { color: #aaa; }
      `}</style>
    </div>
  );
}

export default function EstrategiaPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#f9f9f8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#999", fontSize: 14 }}>Cargando...</p>
      </div>
    }>
      <EstrategiaContent />
    </Suspense>
  );
}