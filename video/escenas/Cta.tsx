import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { PropsEscena } from "./tipos";

const COLOR_WHATSAPP = "#25D366";

export function Cta({ escena, tema }: PropsEscena<"cta">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { accion, texto_boton, mensajes, usuario, subtexto } = escena.params;
  const progreso = spring({ frame, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 10%" }}>
      {accion === "whatsapp" && mensajes && mensajes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, alignSelf: "flex-start" }}>
          {mensajes.map((m, i) => (
            <div
              key={i}
              style={{
                background: COLOR_WHATSAPP,
                color: "#fff",
                borderRadius: "16px 16px 16px 2px",
                padding: "10px 16px",
                fontSize: 22,
                opacity: spring({ frame: frame - i * 6, fps, config: { damping: 14 } }),
              }}
            >
              {m}
            </div>
          ))}
        </div>
      )}
      {accion === "seguir" && usuario && (
        <div style={{ fontSize: 30, color: tema.color_texto, marginBottom: 16, opacity: progreso }}>{usuario}</div>
      )}
      <div
        style={{
          background: tema.color_primario,
          color: tema.color_texto,
          borderRadius: 999,
          padding: "20px 40px",
          fontSize: 32,
          fontWeight: 800,
          transform: `scale(${progreso})`,
        }}
      >
        {texto_boton}
      </div>
      {subtexto && <div style={{ fontSize: 22, color: tema.color_texto, marginTop: 14, opacity: progreso }}>{subtexto}</div>}
    </AbsoluteFill>
  );
}
