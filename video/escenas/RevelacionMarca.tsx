import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colorTextoSobre } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import type { PropsEscena } from "./tipos";

export function RevelacionMarca({ escena, tema }: PropsEscena<"revelacion_marca">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { frase, mostrar_logo } = escena.params;
  const progreso = spring({ frame, fps, config: { damping: 12 } });
  const colorTexto = colorTextoSobre(tema.color_primario);

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 8%" }}>
        {mostrar_logo && tema.logo_url && (
          <Img src={tema.logo_url} style={{ width: 160, height: 160, objectFit: "contain", opacity: progreso, marginBottom: 26 }} />
        )}
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: colorTexto,
            opacity: progreso,
            transform: `translateY(${interpolate(progreso, [0, 1], [20, 0])}px)`,
            lineHeight: 1.08,
          }}
        >
          {frase}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
