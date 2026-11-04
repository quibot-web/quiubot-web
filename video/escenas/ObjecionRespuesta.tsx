import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colorMasContraste, colorTextoSobre } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import type { PropsEscena } from "./tipos";

export function ObjecionRespuesta({ escena, tema }: PropsEscena<"objecion_respuesta">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { objecion, respuesta } = escena.params;
  const mitad = (escena.duracion_s * fps) / 2;
  const mostrarRespuesta = frame > mitad;
  const colorTexto = colorTextoSobre(tema.color_primario);
  const colorRespuesta = colorMasContraste([tema.color_secundario], tema.color_primario, colorTexto);
  const tachado = interpolate(frame, [mitad * 0.3, mitad * 0.8], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 8%" }}>
        <div
          style={{
            position: "relative",
            fontSize: 100,
            fontWeight: 700,
            color: colorTexto,
            opacity: mostrarRespuesta ? 0.45 : 1,
            lineHeight: 1.06,
          }}
        >
          {objecion}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "50%",
              height: 7,
              background: colorTexto,
              width: `${tachado}%`,
              transform: "translateY(-50%)",
            }}
          />
        </div>
        {mostrarRespuesta && (
          <div
            style={{
              fontSize: 100,
              fontWeight: 800,
              color: colorRespuesta,
              marginTop: 40,
              lineHeight: 1.06,
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
    </AbsoluteFill>
  );
}
