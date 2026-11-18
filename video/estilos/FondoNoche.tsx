// Fondo del estilo Noche (sistema de estilos, paso 1): casi negro teñido
// del color primario, una luz del color de marca que cambia de lugar en
// cada escena y se mueve despacio, dos capas de luces desenfocadas que se
// desplazan a distinta velocidad (parallax) y viñeta. Todo con
// degradados y transform -- nada de perspective, backdrop-filter ni
// z-index (renderizador del navegador): el orden de las capas es el del
// DOM.
import { AbsoluteFill } from "remotion";
import { hexConAlfa } from "../tema";
import type { PaletaNoche } from "./estilos";

// Dónde cae la luz principal en cada escena (x%, y%), en orden -- así el
// fondo cambia de escena a escena aunque la paleta sea la misma.
const POSICIONES_LUZ: [number, number][] = [
  [50, 30],
  [26, 42],
  [74, 30],
  [50, 46],
  [32, 26],
  [68, 44],
  [50, 36],
];

// Pseudoaleatorio determinístico (mismo resultado en cada render).
function aleatorio(semilla: number): () => number {
  let s = semilla * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

type Destello = { x: number; y: number; radio: number; velocidad: number; fase: number };

function destellos(semilla: number, cantidad: number, radioMin: number, radioMax: number, velocidad: number): Destello[] {
  const r = aleatorio(semilla);
  return Array.from({ length: cantidad }, () => ({
    x: r() * 100,
    y: r() * 100,
    radio: radioMin + r() * (radioMax - radioMin),
    velocidad: velocidad * (0.7 + r() * 0.6),
    fase: r() * Math.PI * 2,
  }));
}

function CapaDestellos({ lista, color, alfa, frame, fps }: { lista: Destello[]; color: string; alfa: number; frame: number; fps: number }) {
  const t = frame / fps;
  return (
    <AbsoluteFill>
      {lista.map((d, i) => {
        // Suben despacio (y de vuelta abajo al salir) y se mecen de lado.
        const y = (((d.y - t * d.velocidad) % 110) + 110) % 110 - 5;
        const x = d.x + Math.sin(t * 0.6 + d.fase) * 1.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: d.radio * 2,
              height: d.radio * 2,
              marginLeft: -d.radio,
              marginTop: -d.radio,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${hexConAlfa(color, alfa)} 0%, ${hexConAlfa(color, 0)} 70%)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

export function FondoNoche({ paleta, indiceEscena, frame, fps }: { paleta: PaletaNoche; indiceEscena: number; frame: number; fps: number }) {
  const [x0, y0] = POSICIONES_LUZ[indiceEscena % POSICIONES_LUZ.length];
  const t = frame / fps;
  const x = x0 + Math.sin(t * 0.5) * 4;
  const y = y0 + Math.cos(t * 0.4) * 3;
  const lejanos = destellos(indiceEscena + 1, 10, 18, 46, 1.2);
  const cercanos = destellos(indiceEscena + 101, 5, 60, 120, 3.2);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${paleta.fondo} 0%, ${paleta.fondoProfundo} 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${x}% ${y}%, ${hexConAlfa(paleta.luz, 0.42)} 0%, ${hexConAlfa(paleta.luz, 0.12)} 28%, ${hexConAlfa(paleta.luz, 0)} 58%)` }} />
      <CapaDestellos lista={lejanos} color={paleta.luz} alfa={0.22} frame={frame} fps={fps} />
      <CapaDestellos lista={cercanos} color={paleta.luz} alfa={0.1} frame={frame} fps={fps} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)" }} />
    </AbsoluteFill>
  );
}
