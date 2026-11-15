import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colorTextoSobre, respiracion } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import type { PropsEscena } from "./tipos";

export function RevelacionMarca({ escena, tema, uso, medioDeFondo }: PropsEscena<"revelacion_marca">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { frase, mostrar_logo } = escena.params;
  const progreso = spring({ frame, fps, config: { damping: 12 } });
  const colorTexto = colorTextoSobre(tema.color_primario);
  // "La de marca... tiene animación continua" (revisión de calidad):
  // apenas terminaba de entrar, quedaba quieta el resto de la escena.
  const escalaRespiracion = uso === "organico" ? respiracion(frame, fps) : 1;

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque={escena.bloque} organico={uso === "organico"} medioDeFondo={medioDeFondo} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 8%" }}>
        {mostrar_logo && tema.logo_url && (
          <Img src={tema.logo_url} style={{ width: 160, height: 160, objectFit: "contain", opacity: progreso, marginBottom: 26, transform: `scale(${escalaRespiracion})` }} />
        )}
        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            color: colorTexto,
            opacity: progreso,
            transform: `translateY(${interpolate(progreso, [0, 1], [20, 0])}px) scale(${escalaRespiracion})`,
            lineHeight: 1.08,
          }}
        >
          {frase}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
