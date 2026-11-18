// Íconos dibujados (SVG), nunca texto ni emoji. El render corre en el
// navegador de cada cliente (@remotion/web-renderer): un glifo que no
// está en nuestras 4 fuentes (video/fuentes.ts) depende de que ESE
// computador tenga una fuente de respaldo que lo cubra -- si no la
// tiene (Windows sin la fuente, Linux sin emoji), sale un cuadro blanco.
// Caso que lo motivó (18 nov 2026): "✗" en conexion_whatsapp y "✓✓" en
// respuesta_lenta, que desde la parte 2e pueden ir en el gancho, que es
// la portada del reel. Auditoría: el cmap de las fuentes cargadas no
// tiene ✓ ✗ ni ningún emoji -- todo lo fijo de los componentes que caía
// en eso usa ahora estos íconos.
//
// Todos reciben "tamano" en píxeles (el alto; el ancho sale del
// viewBox) y se alinean como un bloque inline (verticalAlign middle),
// para poder ir al lado de un texto sin romper su línea.
import type { CSSProperties } from "react";

type PropsIcono = { tamano: number; color?: string; estilo?: CSSProperties };

function estiloBase(estilo?: CSSProperties): CSSProperties {
  return { display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...estilo };
}

export function IconoCheck({ tamano, color = "currentColor", estilo }: PropsIcono) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" style={estiloBase(estilo)} aria-hidden>
      <path d="M4 12.5 L9.5 18 L20 6.5" fill="none" stroke={color} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoCruz({ tamano, color = "currentColor", estilo }: PropsIcono) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" style={estiloBase(estilo)} aria-hidden>
      <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
    </svg>
  );
}

// "Visto" de WhatsApp: dos chulos corridos.
export function IconoDobleCheck({ tamano, color = "currentColor", estilo }: PropsIcono) {
  return (
    <svg width={tamano * (30 / 24)} height={tamano} viewBox="0 0 30 24" style={estiloBase(estilo)} aria-hidden>
      <path d="M2 13 L7 18 L17 6.5 M12.5 16.5 L14 18 L24.5 6.5" fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Reemplazo de ❌ / ✔️: cuadro de color con la marca blanca encima.
export function IconoMarca({ tipo, tamano, colorMal = "#E0301E", colorBien = "#1E8E3E", estilo }: { tipo: "mal" | "bien"; tamano: number; colorMal?: string; colorBien?: string; estilo?: CSSProperties }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" style={estiloBase(estilo)} aria-hidden>
      <rect x={1} y={1} width={22} height={22} rx={6} fill={tipo === "mal" ? colorMal : colorBien} />
      {tipo === "mal" ? (
        <path d="M8 8 L16 16 M16 8 L8 16" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
      ) : (
        <path d="M6.5 12.5 L10.5 16.5 L17.5 8" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

// Mano que señala hacia arriba (reemplazo de 👆, el cursor de los
// clics). Mismo truco de siempre para que las piezas se vean como UNA
// silueta: primero todas con borde grueso, después todas sin borde
// encima -- así no quedan líneas internas entre dedo y palma.
const PIEZAS_MANO = (
  <>
    <rect x={25} y={3} width={13} height={38} rx={6.5} />
    <rect x={37} y={26} width={11} height={18} rx={5.5} />
    <rect x={46} y={29} width={10} height={17} rx={5} />
    <rect x={18} y={34} width={38} height={27} rx={12} />
    <rect x={8} y={33} width={11} height={22} rx={5.5} transform="rotate(-28 13.5 44)" />
  </>
);
export function IconoMano({ tamano, color = "#FFC83D", colorBorde = "#4A3200", estilo }: { tamano: number; color?: string; colorBorde?: string; estilo?: CSSProperties }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 64 64" style={estiloBase(estilo)} aria-hidden>
      <g fill={colorBorde} stroke={colorBorde} strokeWidth={5} strokeLinejoin="round">
        {PIEZAS_MANO}
      </g>
      <g fill={color}>{PIEZAS_MANO}</g>
    </svg>
  );
}

export function IconoReloj({ tamano, color = "currentColor", estilo }: PropsIcono) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" style={estiloBase(estilo)} aria-hidden>
      <circle cx={12} cy={12} r={10} fill="#fff" stroke={color} strokeWidth={2.4} />
      <path d="M12 6.5 V12 L16 14.5" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Burbuja de chat (reemplazo de 💬).
export function IconoBurbuja({ tamano, color = "currentColor", estilo }: PropsIcono) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" style={estiloBase(estilo)} aria-hidden>
      <path d="M5 3.5 H19 A3 3 0 0 1 22 6.5 V14.5 A3 3 0 0 1 19 17.5 H10 L5 21.5 V17.5 A3 3 0 0 1 2 14.5 V6.5 A3 3 0 0 1 5 3.5 Z" fill={color} />
      <circle cx={7.5} cy={10.5} r={1.5} fill="#fff" />
      <circle cx={12} cy={10.5} r={1.5} fill="#fff" />
      <circle cx={16.5} cy={10.5} r={1.5} fill="#fff" />
    </svg>
  );
}

// Foto genérica: marco, montaña y sol (reemplazo de 🖼️).
export function IconoImagen({ tamano, color = "currentColor", estilo }: PropsIcono) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" style={estiloBase(estilo)} aria-hidden>
      <rect x={2.5} y={4} width={19} height={16} rx={2.5} fill="none" stroke={color} strokeWidth={2} />
      <circle cx={8.5} cy={9.5} r={2} fill={color} />
      <path d="M4 18.5 L9.5 13 L13 16 L16 12.5 L20 18.5 Z" fill={color} />
    </svg>
  );
}

// Dos ojos mirando hacia un lado (reemplazo de 👀 en el chip del bucle).
export function IconoOjos({ tamano, estilo }: { tamano: number; estilo?: CSSProperties }) {
  return (
    <svg width={tamano * (32 / 24)} height={tamano} viewBox="0 0 32 24" style={estiloBase(estilo)} aria-hidden>
      <ellipse cx={9} cy={12} rx={7.5} ry={10.5} fill="#fff" />
      <ellipse cx={23} cy={12} rx={7.5} ry={10.5} fill="#fff" />
      <circle cx={10.5} cy={13.5} r={3.4} fill="#222" />
      <circle cx={24.5} cy={13.5} r={3.4} fill="#222" />
      <circle cx={11.6} cy={12.3} r={1.1} fill="#fff" />
      <circle cx={25.6} cy={12.3} r={1.1} fill="#fff" />
    </svg>
  );
}

// Silueta de perfil (reemplazo de 👤 cuando la marca no tiene logo).
export function IconoPersona({ tamano, color = "currentColor", estilo }: PropsIcono) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" style={estiloBase(estilo)} aria-hidden>
      <circle cx={12} cy={8} r={4.5} fill={color} />
      <path d="M3.5 21.5 C3.5 15.8 7.3 13.5 12 13.5 C16.7 13.5 20.5 15.8 20.5 21.5 Z" fill={color} />
    </svg>
  );
}

// Megáfono (ícono por defecto de anuncio_boton/conexion_whatsapp cuando
// el guion no trae "icono" -- antes era el emoji 📣).
export function IconoMegafono({ tamano, color = "#fff", estilo }: PropsIcono) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" style={estiloBase(estilo)} aria-hidden>
      <path d="M3 10 H7 L17 4.5 V19.5 L7 14 H3 Z" fill={color} strokeLinejoin="round" />
      <path d="M7.5 14.5 L9.5 20 H12 L10.5 15" fill={color} />
      <path d="M19.5 9 Q21.5 12 19.5 15" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}
