import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
// Relativo, no "@/..." -- ver el comentario en video/guion.schema.ts.
import { urlRecorteVertical, urlVideoCompatible } from "../../app/lib/cloudinaryUrl";
import { FondoMarca } from "../capas/FondoMarca";
import { MediaCelular, MediaTarjeta } from "../capas/TratamientoMedia";
import { colorTextoSobre } from "../tema";
import type { PropsEscena } from "./tipos";

export function ProductoHero({ escena, tema, medios, analisisPiezas }: PropsEscena<"producto_hero">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { media_id, nombre, etiqueta, tratamiento } = escena.params;
  const media = medios[media_id];
  const esCompleta = tratamiento === "completa";

  // Ken Burns lento sobre la duración de ESTA escena (no de todo el
  // video) -- useVideoConfig().durationInFrames es el de la composición
  // completa, por eso se recalcula a partir de escena.duracion_s. El
  // origen del zoom se sesga hacia recuadro_producto (el centro del
  // producto detectado) en vez de siempre el centro del cuadro.
  const duracionEscenaCuadros = Math.round(escena.duracion_s * fps);
  const escala = interpolate(frame, [0, Math.max(duracionEscenaCuadros - 1, 1)], [1, 1.08], {
    extrapolateRight: "clamp",
  });
  const recuadro = analisisPiezas?.[media_id]?.recuadro_producto;
  const origenX = recuadro ? recuadro.x + recuadro.width / 2 : 50;
  const origenY = recuadro ? recuadro.y + recuadro.height / 2 : 50;

  // "completa" y "tarjeta" tienen la foto (oscurecida) detrás de TODO el
  // cuadro, incluida la franja de la leyenda -- texto blanco. Solo
  // "celular" deja ver el FondoMarca real detrás de la leyenda (el
  // teléfono no cubre todo el ancho), así que ahí sí aplica el mismo
  // contraste que las escenas sin media.
  const fondoLeyendaOscuro = !!media && tratamiento !== "celular";
  const colorTexto = fondoLeyendaOscuro ? "#FFFFFF" : colorTextoSobre(tema.color_primario);

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" />

      {media &&
        (esCompleta ? (
          <>
            {media.tipo === "video" ? (
              <Video
                src={urlVideoCompatible(media.url, 1080)}
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${escala})`, transformOrigin: `${origenX}% ${origenY}%` }}
              />
            ) : (
              <Img
                src={urlRecorteVertical(media.url)}
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${escala})`, transformOrigin: `${origenX}% ${origenY}%` }}
              />
            )}
            <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.78) 100%)" }} />
          </>
        ) : tratamiento === "celular" ? (
          <MediaCelular media={media} tema={tema} />
        ) : (
          <MediaTarjeta media={media} />
        ))}

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
          <span style={{ color: colorTexto, fontSize: 40, fontWeight: 700 }}>{nombre}</span>
        </div>
        {etiqueta && <div style={{ color: colorTexto, fontSize: 26, marginTop: 10 }}>{etiqueta}</div>}

        {/* Única escena que muestra subtítulo (sección "sin subtítulo
            duplicado"): cuando el producto ocupa toda la pantalla, no
            hay ningún otro texto que lo reemplace. */}
        {escena.subtitulo && (
          <div style={{ color: colorTexto, fontSize: 32, fontWeight: 600, marginTop: 18, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
            {escena.subtitulo.texto}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
