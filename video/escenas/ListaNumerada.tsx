import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colorTextoSobre } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import type { PropsEscena } from "./tipos";

export function ListaNumerada({ escena, tema }: PropsEscena<"lista_numerada">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { titulo, items } = escena.params;
  const cuadrosPorItem = Math.max(8, Math.floor((escena.duracion_s * fps) / items.length));
  const indiceActivo = Math.min(items.length - 1, Math.floor(frame / cuadrosPorItem));
  const colorTexto = colorTextoSobre(tema.color_primario);
  const colorNumero = colorTextoSobre(tema.color_secundario);

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 8%" }}>
        <div style={{ fontSize: 54, fontWeight: 800, color: colorTexto, marginBottom: 16 }}>{titulo}</div>
        <div
          style={{
            alignSelf: "flex-start",
            background: "rgba(0,0,0,0.25)",
            color: colorTexto,
            fontWeight: 800,
            fontSize: 38,
            padding: "6px 20px",
            borderRadius: 999,
            marginBottom: 26,
          }}
        >
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
                gap: 20,
                opacity: progreso,
                transform: `scale(${interpolate(progreso, [0, 1], [0.85, 1])})`,
                marginBottom: 22,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: tema.color_secundario,
                  color: colorNumero,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 30,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <span style={{ color: colorTexto, fontSize: 42, fontWeight: 600 }}>{item}</span>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
