import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colorTextoSobre, contrasteHex } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import type { PropsEscena } from "./tipos";

const UMBRAL_ACENTO = 4.5;

export function ObjecionRespuesta({ escena, tema }: PropsEscena<"objecion_respuesta">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { objecion, respuesta } = escena.params;
  const mitad = (escena.duracion_s * fps) / 2;
  const mostrarRespuesta = frame > mitad;
  const colorTexto = colorTextoSobre(tema.color_primario);
  // La respuesta usa el secundario como acento si se lee bien contra el
  // fondo; si no, cae al mismo color de texto que la objeción.
  const colorRespuesta = contrasteHex(tema.color_secundario, tema.color_primario) >= UMBRAL_ACENTO ? tema.color_secundario : colorTexto;
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
            fontSize: 62,
            fontWeight: 700,
            color: colorTexto,
            opacity: mostrarRespuesta ? 0.45 : 1,
            lineHeight: 1.08,
          }}
        >
          {objecion}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "50%",
              height: 5,
              background: colorTexto,
              width: `${tachado}%`,
              transform: "translateY(-50%)",
            }}
          />
        </div>
        {mostrarRespuesta && (
          <div
            style={{
              fontSize: 66,
              fontWeight: 800,
              color: colorRespuesta,
              marginTop: 32,
              lineHeight: 1.08,
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
