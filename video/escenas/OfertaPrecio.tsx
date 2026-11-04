import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colorTextoSobre } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import type { PropsEscena } from "./tipos";

export function OfertaPrecio({ escena, tema }: PropsEscena<"oferta_precio">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { precio, precio_antes, nota } = escena.params;
  const progreso = spring({ frame, fps, config: { damping: 12 } });
  const colorTexto = colorTextoSobre(tema.color_secundario);

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            background: tema.color_secundario,
            borderRadius: 28,
            padding: "40px 56px",
            textAlign: "center",
            transform: `scale(${progreso})`,
          }}
        >
          {precio_antes && (
            <div style={{ fontSize: 34, color: colorTexto, textDecoration: "line-through", opacity: 0.7 }}>{precio_antes}</div>
          )}
          <div style={{ fontSize: 88, fontWeight: 900, color: colorTexto }}>{precio}</div>
          {nota && <div style={{ fontSize: 28, color: colorTexto, marginTop: 8 }}>{nota}</div>}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
