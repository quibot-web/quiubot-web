import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { PropsEscena } from "./tipos";

export function ProductoHero({ escena, tema, medios }: PropsEscena<"producto_hero">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { media_id, nombre, etiqueta } = escena.params;
  const media = medios[media_id];

  // Ken Burns lento sobre la duración de ESTA escena (no de todo el
  // video) -- useVideoConfig().durationInFrames es el de la composición
  // completa, por eso se recalcula a partir de escena.duracion_s.
  const duracionEscenaCuadros = Math.round(escena.duracion_s * fps);
  const escala = interpolate(frame, [0, Math.max(duracionEscenaCuadros - 1, 1)], [1, 1.08], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: tema.color_fondo }}>
      {media ? (
        media.tipo === "video" ? (
          <OffthreadVideo
            src={media.url}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${escala})` }}
          />
        ) : (
          <Img
            src={media.url}
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${escala})` }}
          />
        )
      ) : (
        // Nunca queda un hueco si falta la pieza: fondo de marca con forma.
        <AbsoluteFill
          style={{ background: `radial-gradient(circle at 30% 30%, ${tema.color_secundario}, ${tema.color_fondo})` }}
        />
      )}
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 8% 20%" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(0,0,0,0.45)",
            borderRadius: 16,
            padding: "14px 20px",
            alignSelf: "flex-start",
          }}
        >
          <span style={{ color: tema.color_primario, fontSize: 30 }}>✓</span>
          <span style={{ color: "#fff", fontSize: 32, fontWeight: 700 }}>{nombre}</span>
        </div>
        {etiqueta && <div style={{ color: "#fff", fontSize: 22, marginTop: 8 }}>{etiqueta}</div>}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
