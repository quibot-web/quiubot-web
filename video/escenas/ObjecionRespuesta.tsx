import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { PropsEscena } from "./tipos";

const COLOR_TACHON = "#FF4D4D";

export function ObjecionRespuesta({ escena, tema }: PropsEscena<"objecion_respuesta">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { objecion, respuesta } = escena.params;
  const mitad = (escena.duracion_s * fps) / 2;
  const mostrarRespuesta = frame > mitad;
  const tachado = interpolate(frame, [mitad * 0.3, mitad * 0.8], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 10%" }}>
      <div
        style={{
          position: "relative",
          fontSize: 44,
          fontWeight: 700,
          color: tema.color_texto,
          textAlign: "center",
          opacity: mostrarRespuesta ? 0.4 : 1,
        }}
      >
        {objecion}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            height: 4,
            background: COLOR_TACHON,
            width: `${tachado}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
      {mostrarRespuesta && (
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: tema.color_primario,
            textAlign: "center",
            marginTop: 24,
            opacity: interpolate(frame, [mitad, mitad + fps * 0.5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {respuesta}
        </div>
      )}
    </AbsoluteFill>
  );
}
