import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colorTextoSobre, COLOR_ALERTA_PRIMARIO } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import type { PropsEscena } from "./tipos";

// Único bloque con tono fijo de alerta, no de marca (sección 3 del plan).
const COLOR_TEXTO = colorTextoSobre(COLOR_ALERTA_PRIMARIO);

export function ProblemaDato({ escena, tema }: PropsEscena<"problema_dato">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { variante, titulo, pregunta, valor_desde, valor_hasta, prefijo, sufijo, etiqueta } = escena.params;

  if (variante === "pregunta") {
    const progreso = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill>
        <FondoMarca tema={tema} tono="alerta" />
        <AbsoluteFill style={{ justifyContent: "center", padding: "0 8%" }}>
          <div style={{ fontSize: 108, fontWeight: 800, color: COLOR_TEXTO, textAlign: "left", opacity: progreso, lineHeight: 1.08 }}>
            {pregunta}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const progreso = interpolate(frame, [fps * 0.3, fps * Math.max(escena.duracion_s - 0.5, 0.6)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const valorActual = Math.round(interpolate(progreso, [0, 1], [valor_desde ?? 0, valor_hasta ?? valor_desde ?? 0]));

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="alerta" />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 8%" }}>
        <div style={{ fontSize: 48, color: COLOR_TEXTO, marginBottom: 16, textAlign: "left", fontWeight: 700 }}>{titulo}</div>
        <div style={{ fontSize: 130, fontWeight: 900, color: COLOR_TEXTO, lineHeight: 1 }}>
          {prefijo}
          {valorActual.toLocaleString("es-CO")}
          {sufijo}
        </div>
        {etiqueta && <div style={{ fontSize: 34, color: COLOR_TEXTO, marginTop: 14, opacity: 0.85 }}>{etiqueta}</div>}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
