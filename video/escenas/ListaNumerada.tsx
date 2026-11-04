import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colorMasContraste, colorTextoSobre } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import { cuadrosPorItemListaNumerada } from "./tipos";
import type { PropsEscena } from "./tipos";

export function ListaNumerada({ escena, tema }: PropsEscena<"lista_numerada">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { titulo, items } = escena.params;
  const cuadrosPorItem = cuadrosPorItemListaNumerada(escena.duracion_s, fps, items.length);
  const colorTexto = colorTextoSobre(tema.color_primario);
  // Mismo criterio que el botón del cta y el recuadro de palabra_clave:
  // el círculo numerado usa el color que mejor contraste dé contra el
  // fondo real, nunca el secundario a ciegas (podía fundirse con el
  // primario en paletas donde los dos tonos son parecidos).
  const colorCirculo = colorMasContraste([tema.color_secundario, tema.color_primario], tema.color_primario, colorTexto);
  const colorNumero = colorTextoSobre(colorCirculo);

  // Esta escena ya NO dibuja su propio "X/Y" -- ese contador vive solo
  // en la capa global del bucle (capas/Bucle.tsx) cuando
  // bucle.indicador es "contador", para no mostrar dos contadores a la
  // vez ("error de contador doble").

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 8%" }}>
        <div style={{ fontSize: 60, fontWeight: 800, color: colorTexto, marginBottom: 36 }}>{titulo}</div>
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
                transform: `scale(${interpolate(progreso, [0, 1], [0.85, 1])})`,
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  width: 86,
                  height: 86,
                  borderRadius: "50%",
                  background: colorCirculo,
                  color: colorNumero,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 42,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <span style={{ color: colorTexto, fontSize: 64, fontWeight: 700, lineHeight: 1.08 }}>{item}</span>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
