// Composición solo para generar public/ilustrado/post-<tipo>.png (ver
// generarPostsFijos.ts): una publicación genérica del feed dibujada en
// HTML con las fuentes del video.
import { AbsoluteFill } from "remotion";
import { familiaDeFuente } from "../fuentes";
import { ALTO_POST, Post } from "./Objetos";
import type { TipoPostFijo } from "./imagenesFijas";

export const ANCHO_POST_FIJO = 700;
export const ALTO_POST_FIJO = ALTO_POST;

export function PostFijo({ tipo }: { tipo: TipoPostFijo }) {
  return (
    <AbsoluteFill style={{ background: "#fff", fontFamily: familiaDeFuente("moderna") }}>
      <Post tipo={tipo} indice={0} fotoUrl="" colorMarca="#000000" comoHtml />
    </AbsoluteFill>
  );
}
