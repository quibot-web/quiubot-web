import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FondoMarca } from "../capas/FondoMarca";
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
    <AbsoluteFill>
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
        // Nunca queda un hueco si falta la pieza: fondo de marca.
        <FondoMarca tema={tema} tono="marca" />
      )}
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.78) 100%)" }} />

      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 8% 24%" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(0,0,0,0.5)",
            borderRadius: 18,
            padding: "16px 24px",
            alignSelf: "flex-start",
          }}
        >
          <span style={{ color: tema.color_primario, fontSize: 36 }}>✓</span>
          <span style={{ color: "#fff", fontSize: 40, fontWeight: 700 }}>{nombre}</span>
        </div>
        {etiqueta && <div style={{ color: "#fff", fontSize: 26, marginTop: 10 }}>{etiqueta}</div>}

        {/* Única escena que muestra subtítulo (sección "sin subtítulo
            duplicado"): cuando el producto ocupa toda la pantalla, no
            hay ningún otro texto que lo reemplace. */}
        {escena.subtitulo && (
          <div style={{ color: "#fff", fontSize: 32, fontWeight: 600, marginTop: 18, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
            {escena.subtitulo.texto}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
