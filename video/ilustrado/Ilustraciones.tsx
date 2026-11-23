// Ilustraciones de las publicaciones del feed (ronda 2 del prototipo,
// 18 nov 2026): el feed debe verse real, no como bloques de color. Comida,
// ropa, paisaje y mascota dibujados en SVG plano, sin texto. Íconos de la
// interfaz (me gusta, comentar, compartir, guardar, saludo, rayo) también
// dibujados -- nunca emoji ni logos de Meta.
import type { CSSProperties } from "react";

export type TipoIlustracion = "comida" | "ropa" | "paisaje" | "mascota";

export function Ilustracion({ tipo, estilo, ancho = "100%", alto = "100%" }: { tipo: TipoIlustracion; estilo?: CSSProperties; ancho?: number | string; alto?: number | string }) {
  return (
    <svg viewBox="0 0 700 700" width={ancho} height={alto} preserveAspectRatio="xMidYMid slice" style={{ display: "block", ...estilo }}>
      {tipo === "comida" && <Comida />}
      {tipo === "ropa" && <Ropa />}
      {tipo === "paisaje" && <Paisaje />}
      {tipo === "mascota" && <Mascota />}
    </svg>
  );
}

function Comida() {
  return (
    <>
      <rect width="700" height="700" fill="#C98B55" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x="0" y={i * 120 + 40} width="700" height="6" fill="#B07443" />
      ))}
      <ellipse cx="350" cy="380" rx="262" ry="250" fill="rgba(60,30,10,0.25)" />
      <circle cx="340" cy="360" r="250" fill="#FAFAF7" />
      <circle cx="340" cy="360" r="200" fill="#F1EFE8" />
      {/* Ensalada: hojas, tomates, huevo, aguacate */}
      {[
        [270, 290, 70, "#5FA84A"],
        [400, 280, 64, "#78BE5A"],
        [300, 420, 72, "#4E9440"],
        [420, 420, 60, "#6DB352"],
        [350, 350, 60, "#86C96A"],
      ].map(([x, y, r, c], i) => (
        <circle key={i} cx={x as number} cy={y as number} r={r as number} fill={c as string} />
      ))}
      {[
        [250, 360],
        [440, 340],
        [360, 460],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="40" fill="#E2412F" />
          <circle cx={x} cy={y} r="26" fill="#F46B55" />
        </g>
      ))}
      <ellipse cx="350" cy="270" rx="58" ry="44" fill="#FFFFFF" />
      <circle cx="350" cy="270" r="26" fill="#F7B925" />
      <ellipse cx="405" cy="390" rx="46" ry="34" fill="#B6D46A" stroke="#4E7A2A" strokeWidth="8" />
      {/* Tenedor */}
      <rect x="610" y="170" width="18" height="380" rx="9" fill="#C9CCD3" />
      <rect x="596" y="130" width="46" height="70" rx="10" fill="#C9CCD3" />
      {/* Taza de café */}
      <circle cx="90" cy="610" r="92" fill="#FAFAF7" />
      <circle cx="90" cy="610" r="70" fill="#6B3E22" />
      <circle cx="74" cy="594" r="18" fill="#8A5634" />
    </>
  );
}

function Ropa() {
  return (
    <>
      <rect width="700" height="700" fill="#F3DCCB" />
      <rect x="0" y="560" width="700" height="140" fill="#E8C8B2" />
      <rect x="40" y="96" width="620" height="14" rx="7" fill="#7A5A44" />
      {/* Camiseta mostaza */}
      <path d="M250 110 L250 150" stroke="#7A5A44" strokeWidth="8" />
      <path d="M200 175 Q250 140 300 175" fill="none" stroke="#7A5A44" strokeWidth="8" />
      <path d="M150 200 L215 170 Q250 200 285 170 L350 200 L325 280 L300 270 L300 520 L200 520 L200 270 L175 280 Z" fill="#E8A92E" />
      <path d="M215 170 Q250 200 285 170" fill="none" stroke="#C88A1A" strokeWidth="8" />
      {/* Vestido verde azulado */}
      <path d="M470 110 L470 150" stroke="#7A5A44" strokeWidth="8" />
      <path d="M420 175 Q470 140 520 175" fill="none" stroke="#7A5A44" strokeWidth="8" />
      <path d="M430 175 L510 175 L520 300 L580 560 L360 560 L420 300 Z" fill="#2E8C83" />
      <path d="M420 300 L520 300" stroke="#1F6B64" strokeWidth="10" />
      {/* Bolso */}
      <rect x="560" y="430" width="110" height="100" rx="18" fill="#B8553E" />
      <path d="M580 430 Q615 370 650 430" fill="none" stroke="#8C3E2C" strokeWidth="10" />
    </>
  );
}

function Paisaje() {
  return (
    <>
      <defs>
        <linearGradient id="ilu-cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF9A6B" />
          <stop offset="0.55" stopColor="#FFC98B" />
          <stop offset="1" stopColor="#FFE3B0" />
        </linearGradient>
      </defs>
      <rect width="700" height="700" fill="url(#ilu-cielo)" />
      <circle cx="470" cy="250" r="80" fill="#FFF3D1" />
      <polygon points="-20,470 160,230 300,420 420,280 720,520 720,700 -20,700" fill="#8E5B9E" />
      <polygon points="-20,520 120,390 260,500 400,370 560,480 720,420 720,700 -20,700" fill="#6A3F7C" />
      <rect x="0" y="540" width="700" height="160" fill="#4F8FB3" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={380 + i * 20 - i * i * 6} y={570 + i * 28} width={180 - i * 30} height="8" rx="4" fill="#FFF3D1" opacity={0.7 - i * 0.12} />
      ))}
      <polygon points="80,560 110,470 140,560" fill="#2F5A3A" />
      <polygon points="130,560 165,450 200,560" fill="#25492F" />
    </>
  );
}

function Mascota() {
  return (
    <>
      <rect width="700" height="700" fill="#BFE6D6" />
      <circle cx="560" cy="140" r="60" fill="#A6D9C4" />
      <circle cx="120" cy="560" r="90" fill="#A6D9C4" />
      {/* Perro */}
      <ellipse cx="350" cy="640" rx="210" ry="120" fill="#C98A4B" />
      <ellipse cx="200" cy="300" rx="70" ry="140" fill="#7A4A26" transform="rotate(18 200 300)" />
      <ellipse cx="500" cy="300" rx="70" ry="140" fill="#7A4A26" transform="rotate(-18 500 300)" />
      <ellipse cx="350" cy="350" rx="170" ry="180" fill="#D99A58" />
      <ellipse cx="350" cy="430" rx="100" ry="80" fill="#F2D2A9" />
      <circle cx="285" cy="320" r="22" fill="#2A1A10" />
      <circle cx="415" cy="320" r="22" fill="#2A1A10" />
      <circle cx="292" cy="312" r="7" fill="#FFFFFF" />
      <circle cx="422" cy="312" r="7" fill="#FFFFFF" />
      <ellipse cx="350" cy="395" rx="38" ry="26" fill="#2A1A10" />
      <path d="M350 420 L350 445" stroke="#2A1A10" strokeWidth="6" />
      <path d="M320 448 Q350 470 380 448" fill="none" stroke="#2A1A10" strokeWidth="6" strokeLinecap="round" />
      <path d="M335 455 Q350 520 365 455 Z" fill="#F07A8C" />
      <rect x="250" y="515" width="200" height="30" rx="15" fill="#E2412F" />
      <circle cx="350" cy="560" r="22" fill="#F7B925" />
    </>
  );
}

// ---------- íconos ----------
type PropsIcono = { tamano: number; color?: string; relleno?: string; estilo?: CSSProperties };
const trazo = (color: string) => ({ fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export function IconoCorazon({ tamano, color = "#1c1c22", relleno, estilo }: PropsIcono) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} style={estilo}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" {...trazo(relleno ?? color)} fill={relleno ?? "none"} />
    </svg>
  );
}

export function IconoComentario({ tamano, color = "#1c1c22", estilo }: PropsIcono) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} style={estilo}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" {...trazo(color)} />
    </svg>
  );
}

export function IconoCompartir({ tamano, color = "#1c1c22", estilo }: PropsIcono) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} style={estilo}>
      <path d="M14.5 21.7a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.63l-19 6.5a.5.5 0 0 0-.02.93l7.93 3.18a2 2 0 0 1 1.11 1.11z" {...trazo(color)} />
      <path d="m21.85 2.15-10.94 10.94" {...trazo(color)} />
    </svg>
  );
}

export function IconoGuardar({ tamano, color = "#1c1c22", estilo }: PropsIcono) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} style={estilo}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" {...trazo(color)} />
    </svg>
  );
}

export function IconoSaludo({ tamano, estilo }: { tamano: number; estilo?: CSSProperties }) {
  // Mano abierta saludando (en vez del emoji del sistema).
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} style={estilo}>
      <path d="M18 11V6a2 2 0 0 0-4 0v4V4a2 2 0 0 0-4 0v6.5V6a2 2 0 0 0-4 0v8l-1.6-1.6a2 2 0 0 0-2.83 2.82l3.6 3.6C6.67 20.3 8.3 21.5 12 21.5h2a8 8 0 0 0 8-8v-5a2 2 0 1 0-4 0v2.5Z" fill="#FFC83D" stroke="#8A5A00" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2.5 6.5c.4-1.6 1.4-2.8 2.8-3.6M20.5 1.8c1 .6 1.7 1.5 2 2.6" fill="none" stroke="#8A5A00" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconoRayo({ tamano, color = "#FFC83D", estilo }: PropsIcono) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} style={estilo}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" fill={color} />
    </svg>
  );
}

export function IconoAtras({ tamano, color = "#1c1c22", estilo }: PropsIcono) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} style={estilo}>
      <path d="m15 18-6-6 6-6" {...trazo(color)} strokeWidth={2.6} />
    </svg>
  );
}

export function IconoBolsa({ tamano, color, estilo }: { tamano: number; color: string; estilo?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} style={estilo}>
      <path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z" fill={color} />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}
