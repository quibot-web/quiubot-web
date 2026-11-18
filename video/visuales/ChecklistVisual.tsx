// Visual de 2 estados "checklist que se completa" (parte 2d, 18 nov 2026
// -- catálogo de la Fase B). "Antes": 2-3 pasos con la casilla vacía;
// "después": las casillas se marcan una por una (0,25 s entre cada una).
// Sirve para consejos que son una lista corta de cosas a revisar.
//
// La casilla y el chulo se DIBUJAN con CSS (bordes de un div rotado),
// nunca con un glifo ✓/☐: no están en las fuentes cargadas (memoria de
// glifos). Filas en flujo normal con alto natural -- no hay conectores
// vacíos que un flex pueda comprimir a 0.
import { interpolate, spring } from "remotion";
import { COLOR_EXITO_BLOQUE } from "./acento";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";

const SEGUNDOS_ENTRE_MARCAS = 0.25;

function Casilla({ progreso }: { progreso: number }) {
  return (
    <div
      style={{
        position: "relative",
        width: 56,
        height: 56,
        flexShrink: 0,
        borderRadius: 14,
        border: `5px solid ${progreso > 0 ? COLOR_EXITO_BLOQUE : "#bdbdbd"}`,
        background: progreso > 0 ? COLOR_EXITO_BLOQUE : "#fff",
      }}
    >
      {progreso > 0 && (
        <div
          style={{
            position: "absolute",
            left: 15,
            top: 4,
            width: 14,
            height: 28,
            borderRight: "6px solid #fff",
            borderBottom: "6px solid #fff",
            transform: `rotate(45deg) scale(${interpolate(progreso, [0, 1], [0.4, 1])})`,
            opacity: progreso,
          }}
        />
      )}
    </div>
  );
}

export function ChecklistVisual({ frame, fps, cuadroCambia, titulo, items }: { frame: number; fps: number; cuadroCambia: number; titulo?: string; items: string[] }) {
  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: `${TARJETA_ALTURA_PORCENTAJE}%`,
        transform: "translateX(-50%)",
        background: "#fff",
        borderRadius: 32,
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        padding: "26px 36px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 22,
      }}
    >
      {titulo && <div style={{ fontSize: 34, fontWeight: 900, color: "#141414", textTransform: "uppercase", letterSpacing: "0.02em" }}>{titulo}</div>}
      {items.map((item, i) => {
        const cuadroMarca = cuadroCambia + Math.round(i * SEGUNDOS_ENTRE_MARCAS * fps);
        const progreso = frame >= cuadroMarca ? spring({ frame: frame - cuadroMarca, fps, config: { damping: 12 } }) : 0;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Casilla progreso={progreso} />
            <span style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.15, color: progreso > 0 ? "#141414" : "#7a7a7a" }}>{item}</span>
          </div>
        );
      })}
    </div>
  );
}
