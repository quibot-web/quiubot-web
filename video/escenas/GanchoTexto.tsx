import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
// Relativo, no "@/..." -- ver el comentario en video/guion.schema.ts.
import { urlRecorteVertical } from "../../app/lib/cloudinaryUrl";
import { colorMasContraste, colorTextoSobre } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import { MediaCelular, MediaTarjeta } from "../capas/TratamientoMedia";
import type { PropsEscena } from "./tipos";

const BLANCO = "#FFFFFF";
// Todas las palabras tienen que haber entrado antes de 0.6s -- el cuadro
// del segundo 1 es la portada del video en el álbum, tiene que verse el
// titular completo y quieto ahí. 0.5s dentro de ese límite da margen.
const SEGUNDOS_LIMITE_ENTRADA = 0.5;

export function GanchoTexto({ escena, tema, medios }: PropsEscena<"gancho_texto">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { texto, palabra_clave, sticker, media_id, tratamiento } = escena.params;
  const media = media_id ? medios[media_id] : undefined;
  // Sin tratamiento explícito (guiones viejos, antes de este campo) se
  // mantiene el comportamiento de siempre: pantalla completa.
  const esCompleta = !tratamiento || tratamiento === "completa";

  const palabras = texto.split(" ");
  const cuadrosPorPalabra = Math.max(2, Math.floor((fps * SEGUNDOS_LIMITE_ENTRADA) / palabras.length));

  // "completa" pinta foto oscurecida de fondo -> texto blanco con sombra.
  // "tarjeta"/"celular" dejan ver el fondo de marca alrededor -> el texto
  // usa el mismo criterio de contraste que las escenas sin media.
  const colorFondoEfectivo = media && esCompleta ? "#000000" : tema.color_primario;
  const colorTextoBase = media && esCompleta ? BLANCO : colorTextoSobre(colorFondoEfectivo);
  // El recuadro de palabra_clave tiene que NOTARSE, no solo leerse: se
  // prueba contra el fondo real y se usa el que mejor contraste dé
  // (nunca el secundario a ciegas -- en paletas donde primario y
  // secundario son parecidos, tipo café, un beige sobre otro casi no
  // se ve).
  const colorChip = colorMasContraste(
    media && esCompleta ? [tema.color_primario, tema.color_secundario] : [tema.color_secundario],
    colorFondoEfectivo,
    colorTextoSobre(colorFondoEfectivo)
  );
  const colorTextoChip = colorTextoSobre(colorChip);

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" />

      {media &&
        (esCompleta ? (
          <AbsoluteFill>
            {media.tipo === "video" ? (
              <OffthreadVideo src={media.url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Img src={urlRecorteVertical(media.url)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 35%, rgba(0,0,0,0.85) 100%)" }} />
          </AbsoluteFill>
        ) : tratamiento === "celular" ? (
          <MediaCelular media={media} tema={tema} anclaje="arriba" />
        ) : (
          <MediaTarjeta media={media} anclaje="arriba" />
        ))}

      {sticker && (
        <div
          style={{
            position: "absolute",
            top: "26%",
            right: "8%",
            background: colorChip,
            color: colorTextoChip,
            padding: "10px 22px",
            borderRadius: 999,
            fontWeight: 800,
            fontSize: 40,
            transform: `scale(${spring({ frame, fps, config: { damping: 10 } })})`,
          }}
        >
          {sticker}
        </div>
      )}

      {/* position:absolute con "bottom" (no padding dentro de un flex de
          toda la pantalla): así el bloque de texto crece hacia ARRIBA
          desde justo encima del 35% inferior inseguro, sin importar
          cuántas líneas ocupe un titular largo. Con tarjeta/celular esta
          misma franja inferior ya está libre (esos tratamientos reservan
          su propio padding), así que no compite por espacio. */}
      <div style={{ position: "absolute", left: "8%", right: "8%", bottom: "36%" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0 16px", rowGap: 4, maxWidth: "100%" }}>
          {palabras.map((palabra, i) => {
            const progreso = spring({ frame: frame - i * cuadrosPorPalabra, fps, config: { damping: 14 } });
            const esClave = palabra.toLowerCase().includes(palabra_clave.toLowerCase());
            return (
              <span
                key={i}
                style={{
                  opacity: progreso,
                  transform: `translateY(${interpolate(progreso, [0, 1], [30, 0])}px)`,
                  fontSize: 136,
                  fontWeight: 800,
                  lineHeight: 1.04,
                  color: esClave ? colorTextoChip : colorTextoBase,
                  background: esClave ? colorChip : "transparent",
                  padding: esClave ? "4px 14px" : 0,
                  borderRadius: esClave ? 12 : 0,
                  textShadow: media && esCompleta && !esClave ? "0 4px 16px rgba(0,0,0,0.5)" : undefined,
                }}
              >
                {palabra}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}
