// Objetos ilustrados del "mundo" del prototipo (18 nov 2026): SVG con
// degradados y sombras para dar volumen (2.5D), sin texto salvo la
// interfaz mínima del celular ("Patrocinado", "Seguir"). Nunca logos de
// Meta/Instagram: el feed es genérico pero reconocible.
import type { CSSProperties, ReactNode } from "react";
import { Img } from "remotion";
import { hexConAlfa, mezclarColoresHex } from "../tema";

// ---------- Celular ----------
export const CELULAR = { x: 820, y: 550, ancho: 760, alto: 1520, borde: 30 };
export const PANTALLA = { ancho: CELULAR.ancho - CELULAR.borde * 2, alto: CELULAR.alto - CELULAR.borde * 2 };

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

// ---------- Feed genérico ----------
export const ALTO_POST = 920;
export const ALTO_BARRA_FEED = 130;

function Barra({ ancho, alto = 18, color = "#d9d9df", estilo }: { ancho: number | string; alto?: number; color?: string; estilo?: CSSProperties }) {
  return <div style={{ width: ancho, height: alto, borderRadius: alto / 2, background: color, ...estilo }} />;
}

export type TipoPost = "generico" | "anuncio" | "anuncio_apagado";

const FONDOS_GENERICOS = [
  "linear-gradient(160deg, #f6d365 0%, #fda085 100%)",
  "linear-gradient(160deg, #84fab0 0%, #8fd3f4 100%)",
  "linear-gradient(160deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(160deg, #fccb90 0%, #d57eeb 100%)",
];

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
  // anuncio_apagado: 0 = foto oscura y apagada, 1 = clara y nítida.
  brillo?: number;
  colorMarca: string;
  // 0-1: corazón grande que salta sobre la foto (me gusta).
  corazon?: number;
}) {
  const esAnuncio = tipo !== "generico";
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: indice * ALTO_POST, height: ALTO_POST, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, height: 100, padding: "0 28px" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: esAnuncio ? colorMarca : FONDOS_GENERICOS[indice % 4] }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Barra ancho={esAnuncio ? 220 : 180 + (indice % 3) * 30} color="#2a2a33" alto={20} />
          {esAnuncio ? <span style={{ fontSize: 26, fontWeight: 600, color: "#6b6b75", fontFamily: "Poppins, sans-serif" }}>Patrocinado</span> : <Barra ancho={120} alto={14} />}
        </div>
      </div>
      <div style={{ position: "relative", width: "100%", height: 700, overflow: "hidden", background: FONDOS_GENERICOS[indice % 4] }}>
        {esAnuncio && (
          <Img
            src={fotoUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: tipo === "anuncio_apagado" ? `brightness(${0.42 + 0.58 * brillo}) saturate(${0.35 + 0.65 * brillo}) blur(${(1 - brillo) * 3}px)` : undefined,
            }}
          />
        )}
        {!esAnuncio && (
          <>
            <div style={{ position: "absolute", left: "18%", top: "22%", width: "64%", height: "56%", borderRadius: 40, background: "rgba(255,255,255,0.35)" }} />
            <div style={{ position: "absolute", left: "30%", top: "34%", width: "40%", height: "32%", borderRadius: "50%", background: "rgba(255,255,255,0.45)" }} />
          </>
        )}
        {corazon > 0 && (
          <svg viewBox="0 0 24 24" width={320} height={320} style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) scale(${0.4 + 0.8 * corazon})`, opacity: Math.min(1, corazon * 2), filter: "drop-shadow(0 12px 30px rgba(0,0,0,0.35))" }}>
            <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8 3.3 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.6 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z" fill="#ff3b5c" />
          </svg>
        )}
      </div>
      <div style={{ display: "flex", gap: 26, padding: "26px 28px 0" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 46, height: 46, borderRadius: 14, border: "5px solid #2a2a33" }} />
        ))}
      </div>
      <div style={{ padding: "22px 28px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        <Barra ancho="80%" />
        <Barra ancho="55%" />
      </div>
    </div>
  );
}

export function BarraSuperiorFeed() {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: ALTO_BARRA_FEED, background: "#fff", borderBottom: "2px solid #eee", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 30px 22px", zIndex: 0 }}>
      <Barra ancho={170} alto={30} color="#2a2a33" />
      <div style={{ display: "flex", gap: 22 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, border: "5px solid #2a2a33" }} />
        <div style={{ width: 44, height: 44, borderRadius: "50%", border: "5px solid #2a2a33" }} />
      </div>
    </div>
  );
}

// ---------- Chat ----------
export function Burbuja({ propia, ancho, aparicion, color }: { propia?: boolean; ancho: number; aparicion: number; color?: string }) {
  return (
    <div
      style={{
        alignSelf: propia ? "flex-end" : "flex-start",
        width: ancho,
        padding: "26px 30px",
        borderRadius: propia ? "36px 36px 8px 36px" : "36px 36px 36px 8px",
        background: propia ? color ?? "#0F7A3C" : "#ececf1",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        opacity: aparicion,
        transform: `translateY(${(1 - aparicion) * 30}px) scale(${0.9 + 0.1 * aparicion})`,
        transformOrigin: propia ? "100% 100%" : "0% 100%",
        boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
      }}
    >
      <Barra ancho="85%" color={propia ? "rgba(255,255,255,0.85)" : "#9a9aa6"} />
      <Barra ancho="55%" color={propia ? "rgba(255,255,255,0.85)" : "#9a9aa6"} />
    </div>
  );
}

// ---------- Billetera y monedas ----------
export const BILLETERA = { x: 230, y: 1370, ancho: 400, alto: 300 };

export function Billetera({ inflado }: { inflado: number }) {
  return (
    <div style={{ position: "absolute", left: BILLETERA.x, top: BILLETERA.y, width: BILLETERA.ancho, height: BILLETERA.alto, transform: `scale(${0.7 + 0.3 * inflado}, ${0.55 + 0.45 * inflado})`, transformOrigin: "50% 100%" }}>
      <svg viewBox="0 0 400 300" width={400} height={300} style={{ overflow: "visible", filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.5))" }}>
        <defs>
          <linearGradient id="cuero" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a9653a" />
            <stop offset="1" stopColor="#5e3218" />
          </linearGradient>
          <linearGradient id="solapa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c27a4a" />
            <stop offset="1" stopColor="#8a4d26" />
          </linearGradient>
        </defs>
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
export function Persona({ x, y, escala = 1, luz = 0, colorLuz, mirarArriba = 0, opacidad = 1 }: { x: number; y: number; escala?: number; luz?: number; colorLuz: string; mirarArriba?: number; opacidad?: number }) {
  const apagada = "#4b4b5c";
  const cuerpo = mezclarColoresHex(apagada, colorLuz, luz);
  const cabeza = mezclarColoresHex("#5c5c6e", mezclarColoresHex(colorLuz, "#ffffff", 0.35), luz);
  return (
    <div style={{ position: "absolute", left: x - 70 * escala, top: y - 260 * escala, width: 140 * escala, height: 280 * escala, opacity: opacidad }}>
      <svg viewBox="0 0 140 280" width={140 * escala} height={280 * escala} style={{ overflow: "visible", filter: luz > 0.05 ? `drop-shadow(0 0 ${30 * luz}px ${hexConAlfa(colorLuz, 0.7 * luz)})` : undefined }}>
        <ellipse cx="70" cy="272" rx="56" ry="10" fill="rgba(0,0,0,0.35)" />
        <path d="M18 270 Q18 150 70 150 Q122 150 122 270 Z" fill={cuerpo} />
        <circle cx="70" cy={100 - mirarArriba * 6} r="44" fill={cabeza} />
      </svg>
    </div>
  );
}

// ---------- Reloj ----------
export function Reloj({ x, y, tamano, angulo, aparicion }: { x: number; y: number; tamano: number; angulo: number; aparicion: number }) {
  return (
    <svg viewBox="0 0 100 100" width={tamano} height={tamano} style={{ position: "absolute", left: x - tamano / 2, top: y - tamano / 2, opacity: aparicion, transform: `scale(${0.7 + 0.3 * aparicion})`, filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.45))" }}>
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
export function Grafica({ x, y, avance, color }: { x: number; y: number; avance: number; color: string }) {
  const alturas = [0.3, 0.45, 0.62, 0.8, 1];
  return (
    <svg viewBox="0 0 500 520" width={500} height={520} style={{ position: "absolute", left: x, top: y, overflow: "visible", opacity: Math.min(1, avance * 3), filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.4))" }}>
      <rect x="0" y="0" width="500" height="520" rx="36" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
      {alturas.map((h, i) => {
        const alto = 380 * h * Math.max(0, Math.min(1, avance * 1.4 - i * 0.1));
        return <rect key={i} x={40 + i * 88} y={470 - alto} width="62" height={alto} rx="12" fill={color} opacity={0.55 + i * 0.09} />;
      })}
      <path d="M60 400 L150 340 L240 300 L330 190 L440 90" fill="none" stroke="#4ADE80" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="520" strokeDashoffset={520 * (1 - avance)} />
    </svg>
  );
}
