import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { PropsEscena } from "./tipos";

export function ListaNumerada({ escena, tema }: PropsEscena<"lista_numerada">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { titulo, items } = escena.params;
  const cuadrosPorItem = Math.max(8, Math.floor((escena.duracion_s * fps) / items.length));
  const indiceActivo = Math.min(items.length - 1, Math.floor(frame / cuadrosPorItem));

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 10%" }}>
      <div style={{ fontSize: 40, fontWeight: 700, color: tema.color_texto, marginBottom: 12 }}>{titulo}</div>
      <div style={{ alignSelf: "flex-end", color: tema.color_primario, fontWeight: 800, fontSize: 26, marginBottom: 20 }}>
        {indiceActivo + 1}/{items.length}
      </div>
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
              transform: `scale(${interpolate(progreso, [0, 1], [0.85, 1])})`,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: tema.color_primario,
                color: tema.color_texto,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <span style={{ color: tema.color_texto, fontSize: 32 }}>{item}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
