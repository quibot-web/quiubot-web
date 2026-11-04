import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colorMasContraste, colorTextoSobre } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import type { PropsEscena } from "./tipos";

export function BeneficiosLista({ escena, tema }: PropsEscena<"beneficios_lista">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { titulo, items } = escena.params;
  const cuadrosPorItem = Math.max(6, Math.floor((escena.duracion_s * fps * 0.7) / items.length));
  const colorTexto = colorTextoSobre(tema.color_primario);
  const colorCheck = colorMasContraste([tema.color_secundario, tema.color_primario], tema.color_primario, colorTexto);

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 8%" }}>
        {titulo && <div style={{ fontSize: 60, fontWeight: 800, color: colorTexto, marginBottom: 36 }}>{titulo}</div>}
        {items.map((item, i) => {
          const progreso = spring({ frame: frame - i * cuadrosPorItem, fps, config: { damping: 14 } });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                opacity: progreso,
                transform: `translateX(${interpolate(progreso, [0, 1], [-30, 0])}px)`,
                marginBottom: 32,
              }}
            >
              <span style={{ color: colorCheck, fontSize: 68, flexShrink: 0 }}>✓</span>
              <span style={{ color: colorTexto, fontSize: 68, fontWeight: 700, lineHeight: 1.08 }}>{item}</span>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
