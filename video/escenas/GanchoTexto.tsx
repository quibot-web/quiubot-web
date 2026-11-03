import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { PropsEscena } from "./tipos";

export function GanchoTexto({ escena, tema }: PropsEscena<"gancho_texto">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { texto, palabra_clave, sticker } = escena.params;

  const palabras = texto.split(" ");
  // Todas las palabras entran en la primera mitad de la escena -- la
  // segunda mitad queda con el titular completo en pantalla, legible.
  const cuadrosPorPalabra = Math.max(3, Math.floor((escena.duracion_s * fps * 0.5) / palabras.length));

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
      {sticker && (
        <div
          style={{
            position: "absolute",
            top: "16%",
            left: "8%",
            background: tema.color_primario,
            color: tema.color_texto,
            padding: "8px 18px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 28,
            transform: `scale(${spring({ frame, fps, config: { damping: 10 } })})`,
          }}
        >
          {sticker}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 14px", rowGap: 6 }}>
        {palabras.map((palabra, i) => {
          const progreso = spring({ frame: frame - i * cuadrosPorPalabra, fps, config: { damping: 12 } });
          const esClave = palabra.toLowerCase().includes(palabra_clave.toLowerCase());
          return (
            <span
              key={i}
              style={{
                opacity: progreso,
                transform: `translateY(${interpolate(progreso, [0, 1], [40, 0])}px)`,
                fontSize: 72,
                fontWeight: 800,
                lineHeight: 1.1,
                color: esClave ? tema.color_primario : tema.color_texto,
              }}
            >
              {palabra}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
