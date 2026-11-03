import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { PropsEscena } from "./tipos";

export function OfertaPrecio({ escena, tema }: PropsEscena<"oferta_precio">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { precio, precio_antes, nota } = escena.params;
  const progreso = spring({ frame, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          background: tema.color_primario,
          borderRadius: 24,
          padding: "32px 48px",
          textAlign: "center",
          transform: `scale(${progreso})`,
        }}
      >
        {precio_antes && (
          <div style={{ fontSize: 28, color: tema.color_texto, textDecoration: "line-through", opacity: 0.7 }}>
            {precio_antes}
          </div>
        )}
        <div style={{ fontSize: 64, fontWeight: 900, color: tema.color_texto }}>{precio}</div>
        {nota && <div style={{ fontSize: 22, color: tema.color_texto, marginTop: 6 }}>{nota}</div>}
      </div>
    </AbsoluteFill>
  );
}
