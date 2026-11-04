import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colorMasContraste, colorTextoSobre } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import { ZONA_SEGURA } from "../capas/ZonaSegura";
import type { PropsEscena } from "./tipos";

export function BeneficiosLista({ escena, tema }: PropsEscena<"beneficios_lista">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { titulo, items } = escena.params;
  const cuadrosPorItem = Math.max(6, Math.floor((escena.duracion_s * fps * 0.7) / items.length));
  const colorTexto = colorTextoSobre(tema.color_primario);
  const colorCheck = colorMasContraste([tema.color_secundario, tema.color_primario], tema.color_primario, colorTexto);

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" />
      {/* Centrado en la ZONA SEGURA real (entre los márgenes inseguros de
          arriba y abajo), no en el cuadro completo -- con el margen
          inferior tan grande (35%), centrar en el 100% del cuadro deja
          el bloque más abajo de lo que se ve bien y, si la lista es
          larga, el último ítem puede entrar en la franja insegura. */}
      <AbsoluteFill style={{ justifyContent: "center", padding: `${ZONA_SEGURA.arriba}% 8% ${ZONA_SEGURA.abajo}%` }}>
        {titulo && <div style={{ fontSize: 60, fontWeight: 800, color: colorTexto, marginBottom: 36 }}>{titulo}</div>}
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
                transform: `translateX(${interpolate(progreso, [0, 1], [-30, 0])}px)`,
                marginBottom: 32,
              }}
            >
              <span style={{ color: colorCheck, fontSize: 72, flexShrink: 0 }}>✓</span>
              <span style={{ color: colorTexto, fontSize: 72, fontWeight: 700, lineHeight: 1.08 }}>{item}</span>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
