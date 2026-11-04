import { AbsoluteFill } from "remotion";
import { COLOR_ALERTA_PRIMARIO, COLOR_ALERTA_SECUNDARIO } from "../tema";
import type { TemaGuion } from "../tema";

export type TonoFondo = "marca" | "alerta";

// El color "efectivo" de fondo de una escena -- lo que colorTextoSobre()
// debe recibir para elegir el texto. "alerta" es fijo (bloque problema);
// "marca" usa el primario del ADN (el degradado va de primario a
// secundario, pero el primario domina la mitad superior, que es donde
// casi siempre va el texto).
export function colorFondoDeTono(tema: TemaGuion, tono: TonoFondo): string {
  return tono === "alerta" ? COLOR_ALERTA_PRIMARIO : tema.color_primario;
}

// Fondo de marca para casi todas las escenas (sección: "usa los colores
// de marca en todas las escenas, con fondo, formas o degradado"):
// degradado primario -> secundario con dos formas circulares para dar
// textura, sin depender de ninguna foto. producto_hero no lo usa (pinta
// la foto o video real); el gancho de recetas de venta tampoco cuando
// hay pieza elegida (usa esa foto de fondo en su lugar).
export function FondoMarca({ tema, tono = "marca" }: { tema: TemaGuion; tono?: TonoFondo }) {
  const colorA = tono === "alerta" ? COLOR_ALERTA_PRIMARIO : tema.color_primario;
  const colorB = tono === "alerta" ? COLOR_ALERTA_SECUNDARIO : tema.color_secundario;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${colorA}, ${colorB})`, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: "50%",
          aspectRatio: "1",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.10)",
          top: "-12%",
          right: "-16%",
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
          left: "-14%",
        }}
      />
    </AbsoluteFill>
  );
}
