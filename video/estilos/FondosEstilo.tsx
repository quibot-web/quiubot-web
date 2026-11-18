// Fondos de Color pleno y Foto (sistema de estilos, paso 2). Mismas
// reglas que FondoNoche: cambian en cada escena, se mueven siempre y solo
// usan degradados/transform (nada de perspective, backdrop-filter ni
// z-index -- renderizador del navegador).
import { AbsoluteFill, Img } from "remotion";
import { hexConAlfa, mezclarColoresHex } from "../tema";
import { fondosColorPleno, type PaletaEstilo } from "./estilos";
import { FondoNoche } from "./FondoNoche";

export function fondoColorPlenoDeEscena(colores: { color_primario: string; color_secundario: string }, indiceEscena: number): string {
  const fondos = fondosColorPleno(colores);
  return fondos[indiceEscena % fondos.length];
}

// Color pleno: un color de marca sólido por escena (primario, secundario,
// un tono profundo y uno intermedio, todos ajustados para que el texto
// llegue a 4,5:1) con dos formas grandes que se desplazan a distinta
// velocidad (parallax).
export function FondoColorPleno({ colores, indiceEscena, frame, fps }: { colores: { color_primario: string; color_secundario: string }; indiceEscena: number; frame: number; fps: number }) {
  const fondo = fondoColorPlenoDeEscena(colores, indiceEscena);
  const t = frame / fps;
  const claro = mezclarColoresHex(fondo, "#FFFFFF", 0.14);
  const oscuro = mezclarColoresHex(fondo, "#000000", 0.16);
  const lado = indiceEscena % 2 === 0 ? 1 : -1;
  return (
    <AbsoluteFill style={{ background: fondo }}>
      <div
        style={{
          position: "absolute",
          width: 1300,
          height: 1300,
          borderRadius: "50%",
          background: claro,
          left: lado > 0 ? -520 : 300,
          top: -380,
          transform: `translate(${Math.sin(t * 0.5) * 40 * lado}px, ${t * 14}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: oscuro,
          left: lado > 0 ? 520 : -380,
          top: 1250,
          transform: `translate(${Math.cos(t * 0.7) * 60 * lado}px, ${-t * 30}px)`,
        }}
      />
    </AbsoluteFill>
  );
}

// Foto: la foto real de la marca de borde a borde, con acercamiento lento
// (cada escena con otro encuadre y, si hay varias fotos, otra foto),
// desenfocada y con un velo oscuro teñido de la marca: es la textura de
// fondo, nunca un segundo texto que compita (caso real en la revisión:
// capturas de pantalla con texto detrás del contenido). La foto nítida es
// el layout "foto de borde a borde".
// Sin foto, cae al fondo Noche.
const ENCUADRES: [number, number][] = [
  [50, 40],
  [35, 50],
  [65, 35],
  [50, 60],
  [40, 30],
  [60, 55],
];

export function FondoFoto({ urlsFotos, paleta, indiceEscena, frame, fps, duracionCuadros }: { urlsFotos: string[]; paleta: PaletaEstilo; indiceEscena: number; frame: number; fps: number; duracionCuadros: number }) {
  if (urlsFotos.length === 0) return <FondoNoche paleta={paleta} indiceEscena={indiceEscena} frame={frame} fps={fps} />;
  const url = urlsFotos[indiceEscena % urlsFotos.length];
  const [x, y] = ENCUADRES[indiceEscena % ENCUADRES.length];
  const avance = duracionCuadros > 0 ? Math.min(1, frame / duracionCuadros) : 0;
  const escala = 1.12 + 0.1 * avance;
  return (
    <AbsoluteFill style={{ background: paleta.fondoProfundo, overflow: "hidden" }}>
      <Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${escala})`, transformOrigin: `${x}% ${y}%`, filter: "blur(10px) saturate(1.2)" }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${hexConAlfa(paleta.fondo, 0.72)} 0%, ${hexConAlfa(paleta.fondo, 0.82)} 45%, ${hexConAlfa("#000000", 0.9)} 100%)` }} />
    </AbsoluteFill>
  );
}
