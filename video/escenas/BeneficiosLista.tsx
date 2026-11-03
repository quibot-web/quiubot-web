import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { PropsEscena } from "./tipos";

export function BeneficiosLista({ escena, tema }: PropsEscena<"beneficios_lista">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { titulo, items } = escena.params;
  const cuadrosPorItem = Math.max(6, Math.floor((escena.duracion_s * fps * 0.7) / items.length));

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 10%" }}>
      {titulo && <div style={{ fontSize: 40, fontWeight: 700, color: tema.color_texto, marginBottom: 24 }}>{titulo}</div>}
      {items.map((item, i) => {
        const progreso = spring({ frame: frame - i * cuadrosPorItem, fps, config: { damping: 14 } });
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: progreso,
              transform: `translateX(${interpolate(progreso, [0, 1], [-30, 0])}px)`,
              marginBottom: 20,
            }}
          >
            <span style={{ color: tema.color_primario, fontSize: 36 }}>✓</span>
            <span style={{ color: tema.color_texto, fontSize: 36, fontWeight: 600 }}>{item}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
