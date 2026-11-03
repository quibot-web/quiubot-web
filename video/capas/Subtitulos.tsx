import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Escena } from "../guion.schema";
import type { TemaGuion } from "../tema";

const PALABRAS_POR_SEGUNDO = 2.8;

// En la Fase 1 no hay voz: el subtítulo ES el copy en pantalla de la
// escena activa, revelado palabra por palabra al ritmo de lectura.
// Posicionado en 62% desde arriba para quedar fuera del 35% inferior de
// la zona segura de Reels/Stories.
export function CapaSubtitulos({ escenas, fps, tema }: { escenas: Escena[]; fps: number; tema: TemaGuion }) {
  const frameGlobal = useCurrentFrame();

  let inicioEscena = 0;
  let activa: Escena | null = null;
  for (const escena of escenas) {
    const duracionCuadros = Math.round(escena.duracion_s * fps);
    if (frameGlobal >= inicioEscena && frameGlobal < inicioEscena + duracionCuadros) {
      activa = escena;
      break;
    }
    inicioEscena += duracionCuadros;
  }

  if (!activa) return null;

  const frameEnEscena = frameGlobal - inicioEscena;
  const { texto, palabra_clave } = activa.subtitulo;
  const palabras = texto.split(" ");
  const palabrasVisibles = Math.min(palabras.length, Math.floor((frameEnEscena / fps) * PALABRAS_POR_SEGUNDO) + 1);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "62%",
          left: "8%",
          right: "8%",
          textAlign: "center",
          fontSize: 34,
          fontWeight: 700,
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
        }}
      >
        {palabras.slice(0, palabrasVisibles).map((palabra, i) => (
          <span
            key={i}
            style={{
              color: palabra.toLowerCase().includes(palabra_clave.toLowerCase()) ? tema.color_primario : tema.color_texto,
              marginRight: 10,
            }}
          >
            {palabra}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}
