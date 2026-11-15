import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { COLOR_ALERTA_PRIMARIO, COLOR_ALERTA_SECUNDARIO, mezclarColoresHex } from "../tema";
import type { TemaGuion } from "../tema";
import type { BloqueGuion } from "../guion.schema";
import type { MediaResuelto } from "../escenas/tipos";
// Relativo, no "@/..." -- ver el comentario en video/guion.schema.ts.
import { urlFondoDifuminado, urlFondoDifuminadoVideo } from "../../app/lib/cloudinaryUrl";

export type TonoFondo = "marca" | "alerta";

// El color "efectivo" de fondo de una escena -- lo que colorTextoSobre()
// debe recibir para elegir el texto. "alerta" es fijo (bloque problema);
// "marca" usa el primario del ADN (el degradado va de primario a
// secundario, pero el primario domina la mitad superior, que es donde
// casi siempre va el texto). Si hay arco de color (bloque + organico),
// el color efectivo ya viene mezclado -- por eso recibe el mismo
// bloque/organico que FondoMarca, nunca se recalcula aparte.
export function colorFondoDeTono(tema: TemaGuion, tono: TonoFondo, bloque?: BloqueGuion, organico?: boolean): string {
  if (tono === "alerta") return COLOR_ALERTA_PRIMARIO;
  if (organico && bloque) return mezclarColoresHex(tema.color_primario, tema.color_secundario, posicionNarrativaDeBloque(bloque) * 0.5);
  return tema.color_primario;
}

// Dónde cae cada bloque en el arco narrativo (0=gancho, 1=cierre) --
// pedido explícito ("el fondo cambia de tono entre bloques: gancho,
// desarrollo, cierre"). Los bloques que no son de contenido orgánico
// (problema/oferta, solo anuncios) quedan igual por si alguna vez se
// reusa, pero esto solo se activa con organico=true.
const POSICION_NARRATIVA_BLOQUE: Record<BloqueGuion, number> = {
  gancho: 0,
  problema: 0.15,
  producto: 0.4,
  valor: 0.4,
  beneficio: 0.55,
  objecion: 0.55,
  oferta: 0.75,
  marca: 0.85,
  cta: 1,
};

function posicionNarrativaDeBloque(bloque: BloqueGuion): number {
  return POSICION_NARRATIVA_BLOQUE[bloque] ?? 0.5;
}

// Fondo de marca para casi todas las escenas (sección: "usa los colores
// de marca en todas las escenas, con fondo, formas o degradado"):
// degradado primario -> secundario con dos formas circulares para dar
// textura, sin depender de ninguna foto. producto_hero no lo usa (pinta
// la foto o video real); el gancho de recetas de venta tampoco cuando
// hay pieza elegida (usa esa foto de fondo en su lugar).
//
// Tres mejoras pedidas tras revisión de calidad (se siente vacío):
// - "movimiento siempre": las dos formas circulares ya no quedan
//   quietas -- derivan lento todo el tiempo, sin importar bloque ni
//   receta (es una mejora segura, no cambia nada funcional, por eso no
//   está detrás de "organico").
// - "arco de color" (organico=true): el degradado se inclina hacia el
//   secundario a medida que avanza el bloque narrativo.
// - "imagen siempre" (organico=true + medioDeFondo): si la pieza tiene
//   fotos/video del álbum, se usan de fondo oscurecido en vez del
//   degradado -- el degradado por bloque queda como un tinte encima,
//   para que la marca siga sintiéndose consistente.
export function FondoMarca({
  tema,
  tono = "marca",
  bloque,
  organico = false,
  medioDeFondo,
}: {
  tema: TemaGuion;
  tono?: TonoFondo;
  bloque?: BloqueGuion;
  organico?: boolean;
  medioDeFondo?: MediaResuelto | null;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progreso = posicionNarrativaDeBloque(bloque ?? "gancho");

  const colorA = tono === "alerta" ? COLOR_ALERTA_PRIMARIO : organico ? mezclarColoresHex(tema.color_primario, tema.color_secundario, progreso * 0.5) : tema.color_primario;
  const colorB = tono === "alerta" ? COLOR_ALERTA_SECUNDARIO : organico ? mezclarColoresHex(tema.color_secundario, tema.color_primario, progreso * 0.3) : tema.color_secundario;

  // Deriva lenta, nunca más de ~6% del cuadro -- sutil, nunca marea.
  const derivaX = interpolate(frame, [0, Math.max(durationInFrames, 1)], [0, 6], { extrapolateRight: "clamp" });
  const derivaRotacion = interpolate(frame, [0, Math.max(durationInFrames, 1)], [0, 10], { extrapolateRight: "clamp" });

  const mediaUrl = medioDeFondo
    ? medioDeFondo.tipo === "video"
      ? urlFondoDifuminadoVideo(medioDeFondo.url, 480)
      : urlFondoDifuminado(medioDeFondo.url, 480)
    : null;

  return (
    <AbsoluteFill style={{ background: mediaUrl ? "#000" : `linear-gradient(160deg, ${colorA}, ${colorB})`, overflow: "hidden" }}>
      {mediaUrl &&
        (medioDeFondo!.tipo === "video" ? (
          <Video src={mediaUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.5)", transform: "scale(1.3)" }} />
        ) : (
          <Img src={mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.5)", transform: "scale(1.3)" }} />
        ))}
      {mediaUrl && organico && (
        // Tinte de marca encima de la foto -- "imagen siempre" no debe
        // sentirse como una foto suelta, sigue siendo la marca.
        <AbsoluteFill style={{ background: `linear-gradient(160deg, ${colorA}66, ${colorB}33)` }} />
      )}
      <div
        style={{
          position: "absolute",
          width: "50%",
          aspectRatio: "1",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.10)",
          top: "-12%",
          right: `${-16 + derivaX}%`,
          transform: `rotate(${derivaRotacion}deg)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "36%",
          aspectRatio: "1",
          borderRadius: "50%",
          background: "rgba(0,0,0,0.14)",
          bottom: "-8%",
          left: `${-14 + derivaX}%`,
          transform: `rotate(${-derivaRotacion}deg)`,
        }}
      />
    </AbsoluteFill>
  );
}
