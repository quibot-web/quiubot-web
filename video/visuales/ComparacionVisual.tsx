// Visual de 2 estados "comparación ✗/✓" (parte 2c, 18 nov 2026 --
// catálogo de la Fase B, adelantado para que los consejos no dependan
// de 3 visuales con el consejo escrito en el dibujo). Dos tarjetas de
// texto: "antes" solo se ve la del error (centrada), "después" sube y
// se apaga, y entra la tarjeta de lo correcto debajo. Sirve para
// cualquier consejo del tipo "así no / así sí".
//
// Marcas dibujadas (IconoMarca, video/iconos.tsx), nunca texto ni emoji:
// ✗ ✓ ❌ ✔️ no están en las fuentes cargadas y dependen de una fuente de
// respaldo que el computador del cliente puede no tener.
// Las dos tarjetas son position:absolute dentro del cajón de siempre
// (TARJETA_TOP/ALTURA) -- nunca un flex que pueda encoger una a 0.
import { interpolate, spring } from "remotion";
import { COLOR_ALERTA, COLOR_EXITO, COLOR_EXITO_BLOQUE } from "./acento";
import { IconoMarca } from "../iconos";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";

const ALTO_TARJETA_PORCENTAJE = 46;
const SEPARACION_PORCENTAJE = 100 - ALTO_TARJETA_PORCENTAJE * 2;
// Cuánto baja la tarjeta del error (en % de SU PROPIO alto) para quedar
// centrada en el cajón mientras la otra no existe.
const DESPLAZAMIENTO_CENTRADO = ((ALTO_TARJETA_PORCENTAJE + SEPARACION_PORCENTAJE) / 2 / ALTO_TARJETA_PORCENTAJE) * 100;

function Tarjeta({ marca, etiqueta, texto, color, colorEtiqueta, estilo }: { marca: "mal" | "bien"; etiqueta: string; texto: string; color: string; colorEtiqueta: string; estilo: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: `${ALTO_TARJETA_PORCENTAJE}%`,
        background: "#fff",
        borderRadius: 28,
        border: `5px solid ${color}`,
        boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        padding: "18px 28px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 8,
        ...estilo,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <IconoMarca tipo={marca} tamano={36} />
        <span style={{ fontSize: 26, fontWeight: 800, color: colorEtiqueta, textTransform: "uppercase", letterSpacing: "0.03em" }}>{etiqueta}</span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: "#141414", lineHeight: 1.18 }}>{texto}</div>
    </div>
  );
}

export function ComparacionVisual({
  frame,
  fps,
  cuadroCambia,
  textoMal,
  textoBien,
  etiquetaMal = "Así no",
  etiquetaBien = "Así sí",
}: {
  frame: number;
  fps: number;
  cuadroCambia: number;
  textoMal: string;
  textoBien: string;
  etiquetaMal?: string;
  etiquetaBien?: string;
}) {
  const progreso = frame >= cuadroCambia ? spring({ frame: frame - cuadroCambia, fps, config: { damping: 15 } }) : 0;

  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: `${TARJETA_ALTURA_PORCENTAJE}%`,
        transform: "translateX(-50%)",
      }}
    >
      <Tarjeta
        marca="mal"
        etiqueta={etiquetaMal}
        texto={textoMal}
        color={COLOR_ALERTA}
        colorEtiqueta={COLOR_ALERTA}
        estilo={{
          top: 0,
          transform: `translateY(${interpolate(progreso, [0, 1], [DESPLAZAMIENTO_CENTRADO, 0])}%) scale(${interpolate(progreso, [0, 1], [1, 0.96])})`,
          opacity: interpolate(progreso, [0, 1], [1, 0.55]),
        }}
      />
      <Tarjeta
        marca="bien"
        etiqueta={etiquetaBien}
        texto={textoBien}
        color={COLOR_EXITO}
        colorEtiqueta={COLOR_EXITO_BLOQUE}
        estilo={{
          bottom: 0,
          opacity: progreso,
          transform: `translateY(${interpolate(progreso, [0, 1], [30, 0])}px)`,
        }}
      />
    </div>
  );
}
