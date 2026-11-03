import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { PropsEscena } from "./tipos";

const COLOR_ALERTA = "#FF4D4D";

export function ProblemaDato({ escena, tema }: PropsEscena<"problema_dato">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { variante, titulo, pregunta, valor_desde, valor_hasta, prefijo, sufijo, etiqueta } = escena.params;

  if (variante === "pregunta") {
    const progreso = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 10%" }}>
        <div style={{ fontSize: 60, fontWeight: 800, color: tema.color_texto, textAlign: "center", opacity: progreso }}>
          {pregunta}
        </div>
      </AbsoluteFill>
    );
  }

  const progreso = interpolate(frame, [fps * 0.3, fps * Math.max(escena.duracion_s - 0.5, 0.6)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const valorActual = Math.round(interpolate(progreso, [0, 1], [valor_desde ?? 0, valor_hasta ?? valor_desde ?? 0]));

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontSize: 40, color: tema.color_texto, marginBottom: 12, textAlign: "center" }}>{titulo}</div>
      <div style={{ fontSize: 96, fontWeight: 900, color: COLOR_ALERTA }}>
        {prefijo}
        {valorActual.toLocaleString("es-CO")}
        {sufijo}
      </div>
      {etiqueta && <div style={{ fontSize: 28, color: tema.color_texto, marginTop: 10 }}>{etiqueta}</div>}
    </AbsoluteFill>
  );
}
