// Objetos ilustrados del "mundo" del prototipo (18 nov 2026): SVG con
// degradados y sombras para dar volumen (2.5D). Ronda 2: el feed se ve
// real (ilustraciones variadas, avatar, nombre corto, íconos), el chat
// tiene mensajes de verdad y el fondo tiene piso, horizonte y luz. Nunca
// logos de Meta/Instagram: la interfaz es genérica pero reconocible.
import type { ReactNode } from "react";
import { colorTextoSobre, hexConAlfa, mezclarColoresHex } from "../tema";
import { IconoDobleCheck } from "../iconos";
import { CELULAR_ISLA } from "./motor/catalogo";
import type { Rect } from "./motor/geometria";
import type { TipoIlustracion } from "./Ilustraciones";
import { ImagenFija, ImagenPostFijo } from "./imagenesFijas";


// Rendimiento (fase 1): nada de filter: drop-shadow ni box-shadow -- el
// renderizador del navegador los dibuja carísimo (medido: 16,9 -> 6,4 s
// por segundo de video al sacarlos junto con lo que queda fuera de
// cámara). Las sombras son formas dentro del mismo SVG (Sombra()).

const TINTA = "#1c1c22";
const TINTA_SUAVE = "#5b5b66";
const FUENTE_UI = "Poppins, sans-serif";

// ---------- Fondo: cielo, luz de fondo, horizonte y piso con perspectiva ----------
// En coordenadas de pantalla. El horizonte va un poco arriba del piso
// donde se paran los objetos y el piso se corre más lento que el mundo
// (parallax), para dar profundidad.
// Rendimiento: el renderizador del navegador convierte cada <svg> en una
// imagen y la reutiliza mientras su contenido no cambie. La cuadrícula
// del piso es un SVG FIJO; se mueve con la posición de su contenedor
// (nunca cambiando sus líneas cuadro a cuadro).
const ANCHO_CUADRICULA = 1080 * 3;
const ALTO_CUADRICULA = 2200;
const PASO_RADIAL = 520;
const CuadriculaPiso = ({ luz }: { luz: string }) => {
  const fuga = ANCHO_CUADRICULA / 2;
  return (
    <svg width={ANCHO_CUADRICULA} height={ALTO_CUADRICULA} style={{ position: "absolute", left: 0, top: 0 }}>
      {Array.from({ length: 9 }, (_, i) => {
        const y = Math.pow((i + 1) / 9, 2.2) * ALTO_CUADRICULA;
        return <line key={`h${i}`} x1={0} x2={ANCHO_CUADRICULA} y1={y} y2={y} stroke={hexConAlfa(luz, 0.1 + 0.05 * (i / 9))} strokeWidth={2 + i * 0.4} />;
      })}
      {Array.from({ length: 21 }, (_, i) => {
        const x = fuga + (i - 10) * PASO_RADIAL;
        return <line key={`r${i}`} x1={fuga + (x - fuga) * 0.06} y1={0} x2={fuga + (x - fuga) * 2.2} y2={ALTO_CUADRICULA} stroke={hexConAlfa(luz, 0.1)} strokeWidth={2} />;
      })}
    </svg>
  );
};

// "horizonte": altura en pantalla de la línea del horizonte.
export function Fondo({ camX, horizonte: h, fondo, profundo, luz, brilloUrl }: { camX: number; horizonte: number; fondo: string; profundo: string; luz: string; brilloUrl: string }) {
  const horizonte = Math.round(Math.max(250, Math.min(1750, h)));
  const corrimiento = (((-camX * 0.35) % PASO_RADIAL) + PASO_RADIAL) % PASO_RADIAL;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${profundo} 0%, ${fondo} 100%)` }} />
      {/* Luz de fondo detrás de la escena, sobre el horizonte (halo horneado en el color de luz) */}
      {brilloUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- dibujo del video
        <img src={brilloUrl} alt="" decoding="sync" style={{ position: "absolute", left: -360, top: horizonte - 1000, width: 1800, height: 1300, opacity: 0.55 }} />
      )}
      {/* Piso */}
      <div style={{ position: "absolute", left: 0, right: 0, top: horizonte, bottom: 0, overflow: "hidden", background: `linear-gradient(180deg, ${mezclarColoresHex(fondo, luz, 0.18)} 0%, ${profundo} 100%)` }}>
        <div style={{ position: "absolute", left: -1080 - PASO_RADIAL + corrimiento, top: 0, width: ANCHO_CUADRICULA, height: ALTO_CUADRICULA }}>
          <CuadriculaPiso luz={luz} />
        </div>
      </div>
      {/* Línea del horizonte que brilla */}
      <div style={{ position: "absolute", left: 0, right: 0, top: horizonte - 2, height: 4, background: hexConAlfa(luz, 0.45) }} />
    </>
  );
}

// Sombra de contacto sobre el piso (da peso a los objetos).
export function SombraPiso({ cx, y, ancho }: { cx: number; y: number; ancho: number }) {
  return <ImagenFija nombre="sombra" ancho={ancho} alto={ancho * 0.12} estilo={{ position: "absolute", left: cx - ancho / 2, top: y - ancho * 0.06 }} />;
}

// ---------- Celular ----------
export function Celular({ children }: { children: ReactNode }) {
  const CELULAR = CELULAR_ISLA;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: CELULAR.ancho,
        height: CELULAR.alto,
        borderRadius: 96,
        background: "linear-gradient(145deg, #3a3a44 0%, #16161c 55%, #0b0b10 100%)",
        border: "3px solid rgba(255,255,255,0.08)",
        boxSizing: "border-box",
        padding: CELULAR.borde - 3,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 70, overflow: "hidden", background: "#ffffff" }}>
        {children}
        {/* Reflejo del vidrio: da volumen sin tapar el contenido. */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 35%)", pointerEvents: "none" }} />
      </div>
      <div style={{ position: "absolute", top: CELULAR.borde + 19, left: "50%", width: 150, height: 34, marginLeft: -75, borderRadius: 20, background: "#0b0b10" }} />
    </div>
  );
}

// ---------- Feed ----------
export const ALTO_POST = 920;
export const ALTO_BARRA_FEED = 130;
const ALTO_CABECERA_POST = 96;
const ALTO_ACCIONES = 84;
const ALTO_PIE = 44;
const ALTO_CTA = 72;
// Altura de la imagen: el resto del post (los anuncios ceden espacio a la barra "Comprar").
const ALTO_IMAGEN = ALTO_POST - ALTO_CABECERA_POST - ALTO_ACCIONES - ALTO_PIE;

export type TipoPost = TipoIlustracion | "anuncio" | "anuncio_apagado";

const CUENTAS: Record<TipoIlustracion, { nombre: string; texto: string; me_gusta: string | null; avatar: string }> = {
  comida: { nombre: "lucia.cocina", texto: "Almuerzo de domingo", me_gusta: "1.248", avatar: "#E2412F" },
  ropa: { nombre: "moda.ana", texto: "Nueva colección", me_gusta: "862", avatar: "#2E8C83" },
  paisaje: { nombre: "andes.viajes", texto: "Atardecer en la sierra", me_gusta: "3.410", avatar: "#8E5B9E" },
  mascota: { nombre: "toby.peludo", texto: "Toby aprendió a posar", me_gusta: "5.022", avatar: "#C98A4B" },
};

function Avatar({ color, letra, tamano = 64 }: { color: string; letra: string; tamano?: number }) {
  return (
    <div style={{ width: tamano, height: tamano, borderRadius: "50%", background: color, color: colorTextoSobre(color), display: "flex", alignItems: "center", justifyContent: "center", fontSize: tamano * 0.46, fontWeight: 800, fontFamily: FUENTE_UI, flexShrink: 0 }}>
      {letra}
    </div>
  );
}

export function Post({
  tipo,
  indice,
  fotoUrl,
  brillo = 1,
  colorMarca,
  nombreTienda = "tu.tienda",
  corazon = 0,
  comoHtml = false,
  fotoApagadaUrl,
  fotoClaraUrl,
}: {
  // Variantes horneadas de la foto (imagenesGeneradas.ts); sin ellas, la foto tal cual.
  fotoApagadaUrl?: string;
  fotoClaraUrl?: string;
  tipo: TipoPost;
  // Solo el generador de PNG: dibuja la publicación genérica completa en HTML.
  comoHtml?: boolean;
  // Nombre de la cuenta en los anuncios (fase 3: el real de la marca).
  nombreTienda?: string;
  indice: number;
  fotoUrl: string;
  // anuncio_apagado: 0 = foto oscura y desaturada, 1 = luminosa y cálida.
  brillo?: number;
  colorMarca: string;
  // 0-1: corazón grande que salta sobre la foto (me gusta).
  corazon?: number;
}) {
  const esAnuncio = tipo === "anuncio" || tipo === "anuncio_apagado";
  // Rendimiento: una publicación genérica (comida, ropa...) no cambia nunca;
  // en el video es UNA imagen (public/ilustrado/post-<tipo>.png, generada
  // desde este mismo HTML con generarPostsFijos.ts) en vez de ~20
  // elementos que el renderizador del navegador recorre en cada cuadro.
  // Si se le da "me gusta", el corazón va encima como capa aparte.
  if (!esAnuncio && !comoHtml) {
    return (
      <div style={{ position: "absolute", left: 0, right: 0, top: indice * ALTO_POST, height: ALTO_POST }}>
        <ImagenPostFijo tipo={tipo} />
        {corazon > 0 && (
          <>
            <div style={{ position: "absolute", left: "50%", top: ALTO_CABECERA_POST + ALTO_IMAGEN / 2 - 160, width: 320, height: 320, marginLeft: -160, transform: `scale(${0.4 + 0.8 * corazon})`, opacity: Math.min(1, corazon * 2) }}>
              <ImagenFija nombre="corazon-grande" ancho={320} alto={320} />
            </div>
            {corazon > 0.3 && <ImagenFija nombre="ico-corazon-lleno" ancho={50} alto={50} estilo={{ position: "absolute", left: 26, top: ALTO_CABECERA_POST + ALTO_IMAGEN + (ALTO_ACCIONES - 50) / 2, background: "#fff" }} />}
          </>
        )}
      </div>
    );
  }
  // En la cuenta de la tienda nada inventado: sin "Me gusta" ni descripción.
  const cuenta = esAnuncio ? { nombre: nombreTienda, texto: "", me_gusta: null, avatar: colorMarca } : CUENTAS[tipo];
  const altoImagen = esAnuncio ? ALTO_IMAGEN - ALTO_CTA : ALTO_IMAGEN;
  const apagado = tipo === "anuncio_apagado";
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: indice * ALTO_POST, height: ALTO_POST, background: "#fff", fontFamily: FUENTE_UI, color: TINTA }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, height: ALTO_CABECERA_POST, padding: "0 26px" }}>
        <Avatar color={cuenta.avatar} letra={cuenta.nombre.slice(0, 1).toUpperCase()} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontSize: 28, fontWeight: 700 }}>{cuenta.nombre}</span>
          {esAnuncio && <span style={{ fontSize: 22, fontWeight: 500, color: TINTA_SUAVE }}>Patrocinado</span>}
        </div>
      </div>
      <div style={{ position: "relative", width: "100%", height: altoImagen, overflow: "hidden", background: "#222" }}>
        {esAnuncio ? (
          <>
            {/* Sin filter (Safari no lo aplica en el renderizador): la foto
                apagada y la clara son dos imágenes horneadas y se cruzan
                con opacidad. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- dibujo del video; precargada en ReelIlustrado */}
            <img alt="" decoding="sync" src={apagado ? fotoClaraUrl ?? fotoUrl : fotoUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            {apagado && brillo < 1 && (
              // eslint-disable-next-line @next/next/no-img-element -- dibujo del video; precargada en ReelIlustrado
              <img alt="" decoding="sync" src={fotoApagadaUrl ?? fotoUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 1 - brillo }} />
            )}
          </>
        ) : (
          <ImagenFija nombre={`ilu-${tipo}`} ancho="100%" alto="100%" estilo={{ objectFit: "cover" }} />
        )}
        {corazon > 0 && (
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 320, height: 320, marginLeft: -160, marginTop: -160, transform: `scale(${0.4 + 0.8 * corazon})`, opacity: Math.min(1, corazon * 2) }}>
            <ImagenFija nombre="corazon-grande" ancho={320} alto={320} />
          </div>
        )}
      </div>
      {esAnuncio && (
        <div style={{ height: ALTO_CTA, background: colorMarca, color: colorTextoSobre(colorMarca), display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px", fontSize: 28, fontWeight: 700 }}>
          <span>Comprar ahora</span>
          <svg viewBox="0 0 24 24" width={34} height={34}>
            <path d="m9 18 6-6-6-6" fill="none" stroke={colorTextoSobre(colorMarca)} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <div style={{ height: ALTO_ACCIONES, display: "flex", alignItems: "center", gap: 28, padding: "0 26px" }}>
        <ImagenFija nombre={corazon > 0.3 ? "ico-corazon-lleno" : "ico-corazon"} ancho={50} alto={50} />
        <ImagenFija nombre="ico-comentario" ancho={48} alto={48} />
        <ImagenFija nombre="ico-compartir" ancho={48} alto={48} />
        <div style={{ flex: 1 }} />
        <ImagenFija nombre="ico-guardar" ancho={48} alto={48} />
      </div>
      <div style={{ height: ALTO_PIE, padding: "0 26px", fontSize: 25, whiteSpace: "nowrap", overflow: "hidden" }}>
        {cuenta.me_gusta && (
          <>
            <b>{cuenta.me_gusta} Me gusta</b>
            <span style={{ display: "inline-block", width: 18 }} />
            <b>{cuenta.nombre}</b> {cuenta.texto}
          </>
        )}
      </div>
    </div>
  );
}

export function BarraSuperiorFeed() {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: ALTO_BARRA_FEED, background: "#fff", borderBottom: "2px solid #eee", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 30px 20px", fontFamily: FUENTE_UI }}>
      <span style={{ fontSize: 42, fontWeight: 800, color: TINTA, lineHeight: 1 }}>Inicio</span>
      <div style={{ display: "flex", gap: 26 }}>
        <ImagenFija nombre="ico-corazon" ancho={48} alto={48} />
        <ImagenFija nombre="ico-compartir" ancho={46} alto={46} />
      </div>
    </div>
  );
}

// ---------- Chat ----------
export function Burbuja({ propia, aparicion, color, hora, leido, children }: { propia?: boolean; aparicion: number; color?: string; hora: string; leido?: boolean; children: ReactNode }) {
  const fondo = propia ? color ?? "#0F7A3C" : "#ECECF1";
  const tinta = colorTextoSobre(fondo);
  return (
    <div
      style={{
        alignSelf: propia ? "flex-end" : "flex-start",
        maxWidth: 560,
        padding: "20px 28px 14px",
        borderRadius: propia ? "36px 36px 8px 36px" : "36px 36px 36px 8px",
        background: fondo,
        color: tinta,
        fontFamily: FUENTE_UI,
        opacity: aparicion,
        transform: `translateY(${(1 - aparicion) * 30}px) scale(${0.9 + 0.1 * aparicion})`,
        transformOrigin: propia ? "100% 100%" : "0% 100%",
        border: propia ? `4px solid ${hexConAlfa("#FFFFFF", 0.35)}` : "2px solid #E2E2E8",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 40, fontWeight: 600, lineHeight: 1.2 }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, fontSize: 22, opacity: 0.85, marginTop: 4 }}>
        <span>{hora}</span>
        {propia && <IconoDobleCheck tamano={30} color={leido ? "#7DD3FC" : tinta} />}
      </div>
    </div>
  );
}

// ---------- Billetera y monedas ----------
export function Billetera({ inflado, rect }: { inflado: number; rect: Rect }) {
  const { x, y, ancho, alto } = rect;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: ancho, height: alto, transform: `scale(${0.7 + 0.3 * inflado}, ${0.55 + 0.45 * inflado})`, transformOrigin: "50% 100%" }}>
      {/* Imagen fija (viewBox 0 -10 400 340): misma escala que antes, 10 unidades de aire arriba. */}
      <ImagenFija nombre="billetera" ancho={ancho} alto={(ancho * 340) / 400} estilo={{ position: "absolute", left: 0, top: (-10 * ancho) / 400 }} />
    </div>
  );
}

export function Moneda({ x, y, rotacion = 0, tamano = 110, opacidad = 1 }: { x: number; y: number; rotacion?: number; tamano?: number; opacidad?: number }) {
  return (
    <div style={{ position: "absolute", left: x - tamano / 2, top: y - tamano / 2, width: tamano, height: tamano, transform: `rotate(${rotacion}deg)`, opacity: opacidad }}>
      <ImagenFija nombre="moneda" ancho={tamano} alto={tamano} />
    </div>
  );
}

// ---------- Personas ----------
const PIELES = ["#E8B48A", "#C68B5E", "#8D5A3B", "#F0C7A0", "#A86F48"];
const PELOS = ["#2A1A10", "#4A2C18", "#1A1A1F", "#7A4A26", "#3A2A20"];
const ROPAS = ["#E2412F", "#2E8C83", "#F7B925", "#5B7BD5", "#D65DB1", "#4C9A5B", "#E8873A"];

export function Persona({
  x,
  pies,
  escala = 1,
  luz = 0,
  mirarArriba = 0,
  opacidad = 1,
  variante = 0,
  espejo = false,
  conCelular = false,
  brilloUrl = "",
}: {
  // Halo horneado en el color de luz (imagenesGeneradas.ts).
  brilloUrl?: string;
  x: number;
  pies: number;
  escala?: number;
  // 0 = apagada (gris), 1 = iluminada con su color.
  luz?: number;
  mirarArriba?: number;
  opacidad?: number;
  variante?: number;
  espejo?: boolean;
  conCelular?: boolean;
}) {
  const gris = "#4b4b5c";
  const ropa = ROPAS[variante % ROPAS.length];
  const cuerpo = mezclarColoresHex(mezclarColoresHex(gris, ropa, 0.18), ropa, luz);
  const piel = mezclarColoresHex("#6a6a7c", PIELES[variante % PIELES.length], 0.25 + 0.75 * luz);
  const pelo = mezclarColoresHex("#3a3a48", PELOS[variante % PELOS.length], 0.4 + 0.6 * luz);
  const sombraRopa = mezclarColoresHex(cuerpo, "#000000", 0.2);
  const cabezaY = 92 - mirarArriba * 8;
  return (
    <div style={{ position: "absolute", left: x - 70 * escala, top: pies - 280 * escala, width: 140 * escala, height: 280 * escala, opacity: opacidad, transform: espejo ? "scaleX(-1)" : undefined }}>
      {luz > 0.05 && brilloUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- dibujo del video
        <img src={brilloUrl} alt="" decoding="sync" style={{ position: "absolute", left: -60 * escala, top: 20 * escala, width: 260 * escala, height: 290 * escala, opacity: 0.75 * luz }} />
      )}
      <svg viewBox="0 0 140 280" width={140 * escala} height={280 * escala} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <ellipse cx="70" cy="274" rx="60" ry="9" fill="rgba(0,0,0,0.4)" />
        {/* Cuerpo con hombros y brazos */}
        <path d="M14 272 Q12 168 46 154 Q70 146 94 154 Q128 168 126 272 Z" fill={cuerpo} />
        <path d="M30 175 Q20 225 26 262" fill="none" stroke={sombraRopa} strokeWidth="6" strokeLinecap="round" />
        <path d="M110 175 Q120 225 114 262" fill="none" stroke={sombraRopa} strokeWidth="6" strokeLinecap="round" />
        <path d="M54 154 Q70 172 86 154" fill={piel} />
        <rect x="60" y="126" width="20" height="30" rx="8" fill={piel} />
        <circle cx="70" cy={cabezaY} r="40" fill={piel} />
        <path d={`M30 ${cabezaY - 2} Q30 ${cabezaY - 46} 70 ${cabezaY - 46} Q110 ${cabezaY - 46} 110 ${cabezaY - 2} Q96 ${cabezaY - 26} 70 ${cabezaY - 24} Q44 ${cabezaY - 26} 30 ${cabezaY - 2} Z`} fill={pelo} />
        {conCelular && (
          <g transform="rotate(-12 96 200)">
            <rect x="82" y="176" width="34" height="58" rx="7" fill="#16161c" />
            <rect x="86" y="182" width="26" height="44" rx="4" fill="#9ad7ff" />
            <circle cx="104" cy="226" r="9" fill={piel} />
          </g>
        )}
      </svg>
    </div>
  );
}

// ---------- Reloj ----------
// Esfera y manecillas son SVG fijos; las manecillas giran con el
// transform de su contenedor (así el renderizador reutiliza la imagen).
export function Reloj({ cx, cy, tamano, angulo, aparicion }: { cx: number; cy: number; tamano: number; angulo: number; aparicion: number }) {
  const manecilla = (nombre: "reloj-corta" | "reloj-larga", giro: number) => (
    <div style={{ position: "absolute", inset: 0, transform: `rotate(${giro}deg)` }}>
      <ImagenFija nombre={nombre} ancho={tamano} alto={tamano} />
    </div>
  );
  return (
    <div style={{ position: "absolute", left: cx - tamano / 2, top: cy - tamano / 2, width: tamano, height: tamano, opacity: aparicion, transform: `scale(${0.7 + 0.3 * aparicion})` }}>
      <ImagenFija nombre="reloj-esfera" ancho={tamano} alto={tamano} estilo={{ position: "absolute", left: 0, top: 0 }} />
      {manecilla("reloj-corta", angulo / 12)}
      {manecilla("reloj-larga", angulo)}
    </div>
  );
}

// ---------- Gráfica ----------
export function Grafica({ avance, color, rect }: { avance: number; color: string; rect: Rect }) {
  const { x, y, ancho, alto } = rect;
  const alturas = [0.3, 0.45, 0.62, 0.8, 1];
  return (
    <svg viewBox="0 0 500 520" width={ancho} height={alto} preserveAspectRatio="none" style={{ position: "absolute", left: x, top: y, overflow: "visible", opacity: 0.35 + 0.65 * Math.min(1, avance * 3) }}>
      <rect x="0" y="0" width="500" height="520" rx="36" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.22)" strokeWidth="3" />
      {alturas.map((h, i) => {
        const a = 380 * h * Math.max(0, Math.min(1, avance * 1.4 - i * 0.1));
        return <rect key={i} x={40 + i * 88} y={470 - a} width="62" height={a} rx="12" fill={color} opacity={0.6 + i * 0.08} />;
      })}
      <path d="M60 400 L150 340 L240 300 L330 190 L440 90" fill="none" stroke="#4ADE80" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="520" strokeDashoffset={520 * (1 - avance)} />
    </svg>
  );
}
