import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { PropsEscena } from "./tipos";

export function RevelacionMarca({ escena, tema }: PropsEscena<"revelacion_marca">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { frase, mostrar_logo } = escena.params;
  const progreso = spring({ frame, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: `radial-gradient(circle at 50% 40%, ${tema.color_secundario}33, transparent 60%)`,
      }}
    >
      {mostrar_logo && tema.logo_url && (
        <Img src={tema.logo_url} style={{ width: 140, height: 140, objectFit: "contain", opacity: progreso, marginBottom: 20 }} />
      )}
      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color: tema.color_primario,
          textAlign: "center",
          opacity: progreso,
          transform: `translateY(${interpolate(progreso, [0, 1], [20, 0])}px)`,
          padding: "0 10%",
        }}
      >
        {frase}
      </div>
    </AbsoluteFill>
  );
}
