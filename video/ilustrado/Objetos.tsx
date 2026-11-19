// Objetos ilustrados del "mundo" del prototipo (18 nov 2026): SVG con
// degradados y sombras para dar volumen (2.5D). Ronda 2: el feed se ve
// real (ilustraciones variadas, avatar, nombre corto, íconos), el chat
// tiene mensajes de verdad y el fondo tiene piso, horizonte y luz. Nunca
// logos de Meta/Instagram: la interfaz es genérica pero reconocible.
import type { ReactNode } from "react";
import { Img } from "remotion";
import { colorTextoSobre, hexConAlfa, mezclarColoresHex } from "../tema";
import { IconoDobleCheck } from "../iconos";
import { BILLETERA, CELULAR, GRAFICA } from "./mundo";
import { Ilustracion, IconoComentario, IconoCompartir, IconoCorazon, IconoGuardar, type TipoIlustracion } from "./Ilustraciones";

export { CELULAR, PANTALLA, BILLETERA } from "./mundo";

const TINTA = "#1c1c22";
const TINTA_SUAVE = "#5b5b66";
const FUENTE_UI = "Poppins, sans-serif";

// ---------- Fondo: cielo, luz de fondo, horizonte y piso con perspectiva ----------
// En coordenadas de pantalla, con parallax respecto a la cámara: el
// horizonte sube cuando la cámara baja (a la multitud) y el piso se corre
// más lento que el mundo, para dar profundidad.
export function Fondo({ camX, camY, fondo, profundo, luz }: { camX: number; camY: number; fondo: string; profundo: string; luz: string }) {
  const horizonte = Math.max(380, Math.min(1500, 1250 - (camY - 1400) * 0.32));
  const corrimiento = -camX * 0.35;
  const fuga = 540 + corrimiento * 0.15;
  const lineasProfundidad = Array.from({ length: 9 }, (_, i) => horizonte + Math.pow((i + 1) / 9, 2.2) * (1920 + 200 - horizonte));
  const radiales = Array.from({ length: 15 }, (_, i) => (i - 7) * 520 + (((corrimiento % 520) + 520) % 520));
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${profundo} 0%, ${fondo} 100%)` }} />
      {/* Luz de fondo detrás de la escena, sobre el horizonte */}
      <div
        style={{
          position: "absolute",
          left: fuga - 900,
          top: horizonte - 900,
          width: 1800,
          height: 1300,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at 50% 70%, ${hexConAlfa(luz, 0.42)} 0%, ${hexConAlfa(luz, 0.12)} 45%, ${hexConAlfa(luz, 0)} 72%)`,
        }}
      />
      {/* Piso */}
      <div style={{ position: "absolute", left: 0, right: 0, top: horizonte, bottom: 0, background: `linear-gradient(180deg, ${mezclarColoresHex(fondo, luz, 0.18)} 0%, ${profundo} 100%)` }} />
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        {lineasProfundidad.map((y, i) => (
          <line key={`h${i}`} x1={0} x2={1080} y1={y} y2={y} stroke={hexConAlfa(luz, 0.1 + 0.05 * (i / 9))} strokeWidth={2 + i * 0.4} />
        ))}
        {radiales.map((x, i) => (
          <line key={`r${i}`} x1={fuga + (x - fuga) * 0.06} y1={horizonte} x2={fuga + (x - fuga) * 2.2} y2={1920 + 200} stroke={hexConAlfa(luz, 0.1)} strokeWidth={2} />
        ))}
        {/* Línea del horizonte que brilla */}
        <rect x={0} y={horizonte - 2} width={1080} height={4} fill={hexConAlfa(luz, 0.45)} />
      </svg>
    </>
  );
}

// Sombra de contacto sobre el piso (da peso a los objetos).
export function SombraPiso({ cx, y, ancho }: { cx: number; y: number; ancho: number }) {
  return <div style={{ position: "absolute", left: cx - ancho / 2, top: y - ancho * 0.06, width: ancho, height: ancho * 0.12, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 70%)" }} />;
}

// ---------- Celular ----------
export function Celular({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: CELULAR.x,
        top: CELULAR.y,
        width: CELULAR.ancho,
        height: CELULAR.alto,
        borderRadius: 96,
        background: "linear-gradient(145deg, #3a3a44 0%, #16161c 55%, #0b0b10 100%)",
        boxShadow: "0 60px 120px rgba(0,0,0,0.55), inset 0 0 0 3px rgba(255,255,255,0.08)",
        padding: CELULAR.borde,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 70, overflow: "hidden", background: "#ffffff" }}>
        {children}
        {/* Reflejo del vidrio: da volumen sin tapar el contenido. */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 35%)", pointerEvents: "none" }} />
      </div>
      <div style={{ position: "absolute", top: CELULAR.borde + 22, left: "50%", width: 150, height: 34, marginLeft: -75, borderRadius: 20, background: "#0b0b10" }} />
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

const CUENTAS: Record<TipoIlustracion, { nombre: string; texto: string; me_gusta: string; avatar: string }> = {
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
  corazon = 0,
}: {
  tipo: TipoPost;
  indice: number;
  fotoUrl: string;
  // anuncio_apagado: 0 = foto oscura y desaturada, 1 = luminosa y cálida.
  brillo?: number;
  colorMarca: string;
  // 0-1: corazón grande que salta sobre la foto (me gusta).
  corazon?: number;
}) {
  const esAnuncio = tipo === "anuncio" || tipo === "anuncio_apagado";
  const cuenta = esAnuncio ? { nombre: "tu.tienda", texto: "Jarrón artesanal hecho a mano", me_gusta: "12", avatar: colorMarca } : CUENTAS[tipo];
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
            <Img
              src={fotoUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                // Apagada: oscura y casi sin color. Clara: luminosa y cálida.
                filter: apagado ? `brightness(${0.34 + 0.9 * brillo}) saturate(${0.05 + 1.55 * brillo}) sepia(${0.45 * brillo}) contrast(${0.8 + 0.25 * brillo}) blur(${(1 - brillo) * 3}px)` : undefined,
              }}
            />
            {apagado && (
              <>
                <div style={{ position: "absolute", inset: 0, background: `rgba(12,12,22,${0.38 * (1 - brillo)})` }} />
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 30% 25%, rgba(255,220,160,${0.62 * brillo}) 0%, rgba(255,170,90,${0.26 * brillo}) 45%, rgba(255,170,90,0) 75%)` }} />
              </>
            )}
          </>
        ) : (
          <Ilustracion tipo={tipo} />
        )}
        {corazon > 0 && (
          <svg viewBox="0 0 24 24" width={320} height={320} style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) scale(${0.4 + 0.8 * corazon})`, opacity: Math.min(1, corazon * 2), filter: "drop-shadow(0 12px 30px rgba(0,0,0,0.35))" }}>
            <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8 3.3 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.6 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z" fill="#ff3b5c" />
          </svg>
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
        <IconoCorazon tamano={50} relleno={corazon > 0.3 ? "#ff3b5c" : undefined} />
        <IconoComentario tamano={48} />
        <IconoCompartir tamano={48} />
        <div style={{ flex: 1 }} />
        <IconoGuardar tamano={48} />
      </div>
      <div style={{ height: ALTO_PIE, padding: "0 26px", fontSize: 25, whiteSpace: "nowrap", overflow: "hidden" }}>
        <b>{cuenta.me_gusta} Me gusta</b>
        <span style={{ display: "inline-block", width: 18 }} />
        <b>{cuenta.nombre}</b> {cuenta.texto}
      </div>
    </div>
  );
}

export function BarraSuperiorFeed() {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: ALTO_BARRA_FEED, background: "#fff", borderBottom: "2px solid #eee", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 30px 20px", fontFamily: FUENTE_UI }}>
      <span style={{ fontSize: 42, fontWeight: 800, color: TINTA, lineHeight: 1 }}>Inicio</span>
      <div style={{ display: "flex", gap: 26 }}>
        <IconoCorazon tamano={48} />
        <IconoCompartir tamano={46} />
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
        boxShadow: propia ? `0 14px 34px ${hexConAlfa(fondo, 0.45)}` : "0 8px 20px rgba(0,0,0,0.08)",
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
export function Billetera({ inflado }: { inflado: number }) {
  const { x, y, ancho, alto } = BILLETERA;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: ancho, height: alto, transform: `scale(${0.7 + 0.3 * inflado}, ${0.55 + 0.45 * inflado})`, transformOrigin: "50% 100%" }}>
      <svg viewBox="0 0 400 300" width={ancho} height={alto} style={{ overflow: "visible", filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.5))" }}>
        <defs>
          <linearGradient id="cuero" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b26c3e" />
            <stop offset="1" stopColor="#5e3218" />
          </linearGradient>
          <linearGradient id="solapa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cf8752" />
            <stop offset="1" stopColor="#8a4d26" />
          </linearGradient>
        </defs>
        {/* Billetes asomando */}
        <rect x="40" y="10" width="300" height="90" rx="10" fill="#4C9A5B" transform="rotate(-4 190 55)" />
        <rect x="60" y="22" width="300" height="80" rx="10" fill="#5FB06E" transform="rotate(3 210 60)" />
        <rect x="0" y="40" width="400" height="260" rx="40" fill="url(#cuero)" />
        <rect x="18" y="58" width="364" height="224" rx="28" fill="none" stroke="rgba(255,220,180,0.35)" strokeWidth="4" strokeDasharray="12 10" />
        <path d="M0 80 Q0 40 40 40 H360 Q400 40 400 80 V150 H230 Q210 150 210 170 V190 Q210 210 190 210 H0 Z" fill="url(#solapa)" />
        <circle cx="250" cy="180" r="18" fill="#f2c14e" stroke="#9a6b12" strokeWidth="4" />
      </svg>
    </div>
  );
}

export function Moneda({ x, y, rotacion = 0, tamano = 110, opacidad = 1 }: { x: number; y: number; rotacion?: number; tamano?: number; opacidad?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={tamano} height={tamano} style={{ position: "absolute", left: x - tamano / 2, top: y - tamano / 2, transform: `rotate(${rotacion}deg)`, opacity: opacidad, filter: "drop-shadow(0 14px 18px rgba(0,0,0,0.45))" }}>
      <defs>
        <radialGradient id="oro" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff2a8" />
          <stop offset="0.5" stopColor="#f2c14e" />
          <stop offset="1" stopColor="#b07a12" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#oro)" stroke="#8a5c0a" strokeWidth="4" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(138,92,10,0.55)" strokeWidth="3" />
      <text x="50" y="66" textAnchor="middle" fontSize="44" fontWeight="900" fill="#8a5c0a" fontFamily="Poppins, sans-serif">$</text>
    </svg>
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
  colorLuz,
  mirarArriba = 0,
  opacidad = 1,
  variante = 0,
  espejo = false,
  conCelular = false,
}: {
  x: number;
  pies: number;
  escala?: number;
  // 0 = apagada (gris), 1 = iluminada con su color.
  luz?: number;
  colorLuz: string;
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
      <svg viewBox="0 0 140 280" width={140 * escala} height={280 * escala} style={{ overflow: "visible", filter: luz > 0.05 ? `drop-shadow(0 0 ${30 * luz}px ${hexConAlfa(colorLuz, 0.75 * luz)})` : undefined }}>
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
export function Reloj({ cx, cy, tamano, angulo, aparicion }: { cx: number; cy: number; tamano: number; angulo: number; aparicion: number }) {
  return (
    <svg viewBox="0 0 100 100" width={tamano} height={tamano} style={{ position: "absolute", left: cx - tamano / 2, top: cy - tamano / 2, opacity: aparicion, transform: `scale(${0.7 + 0.3 * aparicion})`, filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.45))" }}>
      <circle cx="50" cy="50" r="46" fill="#fff" stroke="#E8460B" strokeWidth="6" />
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => (
        <line key={a} x1="50" y1="10" x2="50" y2="16" stroke="#2a2a33" strokeWidth="3" transform={`rotate(${a} 50 50)`} />
      ))}
      <line x1="50" y1="50" x2="50" y2="26" stroke="#2a2a33" strokeWidth="5" strokeLinecap="round" transform={`rotate(${angulo / 12} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="18" stroke="#E8460B" strokeWidth="4" strokeLinecap="round" transform={`rotate(${angulo} 50 50)`} />
      <circle cx="50" cy="50" r="5" fill="#2a2a33" />
    </svg>
  );
}

// ---------- Gráfica ----------
export function Grafica({ avance, color }: { avance: number; color: string }) {
  const { x, y, ancho, alto } = GRAFICA;
  const alturas = [0.3, 0.45, 0.62, 0.8, 1];
  return (
    <svg viewBox="0 0 500 520" width={ancho} height={alto} preserveAspectRatio="none" style={{ position: "absolute", left: x, top: y, overflow: "visible", opacity: Math.min(1, avance * 3), filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.4))" }}>
      <rect x="0" y="0" width="500" height="520" rx="36" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.22)" strokeWidth="3" />
      {alturas.map((h, i) => {
        const a = 380 * h * Math.max(0, Math.min(1, avance * 1.4 - i * 0.1));
        return <rect key={i} x={40 + i * 88} y={470 - a} width="62" height={a} rx="12" fill={color} opacity={0.6 + i * 0.08} />;
      })}
      <path d="M60 400 L150 340 L240 300 L330 190 L440 90" fill="none" stroke="#4ADE80" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="520" strokeDashoffset={520 * (1 - avance)} />
    </svg>
  );
}
