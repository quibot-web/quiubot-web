// Adaptado de video/fixtures/organico/referencia/visuales/
// CursorClicGenerico.tsx (Fase A, aprobado) -- la técnica visual es
// idéntica (mismo cursor 👆, misma trayectoria/escala de "clic"), pero
// esa versión calculaba su propio cuadroClic como 60% de
// duracionCuadros (una escena de duración fija). Acá el clic cae en un
// cuadro EXPLÍCITO, resuelto por video/visuales/index.tsx desde
// visual.eventos (palabra -> tiempo real de generarVoz()), porque la
// Fase B v2.0 ya no tiene una "duración de escena" fija de la que
// adivinar un 60%.
import { spring } from "remotion";
import { interpolarSeguro } from "../interpolarSeguro";

// Bug real encontrado con una prueba real en navegador (16 nov 2026):
// interpolate() exige un eje de entrada ESTRICTAMENTE creciente --
// cuadroAparece y cuadroClic vienen de palabras DISTINTAS (visual.eventos,
// video/visuales/index.tsx), pero esas palabras pueden redondear al
// MISMO cuadro si quedan muy cerca en el audio real (los tiempos de
// generarVoz() son en segundos, Math.round() a cuadros) -- ahí
// Remotion tiraba "inputRange must be strictly monotonically
// increasing" y tumbaba el render entero.
//
// La guarda de abajo NO es solo anti-crash: con el mismo cuadro para
// "aparece" y "clic" no hay nada que interpolar, el cursor ya llegó en
// cuanto aparece -- es comportamiento real, probado en
// CursorClicEventos.test.ts. Se mantiene tal cual; interpolarSeguro()
// cubre el branch normal (y el fundido de opacidad de abajo) como red
// de seguridad adicional. Función pura aparte (no solo inline) para
// poder probarla sin montar el componente.
export function calcularLlegadaCursor(frame: number, cuadroAparece: number, cuadroClic: number): number {
  if (cuadroAparece === cuadroClic) return frame >= cuadroAparece ? 1 : 0;
  return interpolarSeguro(frame, [cuadroAparece, cuadroClic], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

export function CursorClicEventos({ frame, fps, cuadroAparece, cuadroClic }: { frame: number; fps: number; cuadroAparece: number; cuadroClic: number }) {
  const llegada = calcularLlegadaCursor(frame, cuadroAparece, cuadroClic);
  const clic = spring({ frame: frame - cuadroClic, fps, config: { damping: 6, mass: 0.4 } });
  const escalaCursor = 1 - Math.sin(Math.min(clic, 1) * Math.PI) * 0.3;
  return (
    <div
      style={{
        position: "absolute",
        fontSize: 104,
        right: `${interpolarSeguro(llegada, [0, 1], [-34, 4])}%`,
        bottom: `${interpolarSeguro(llegada, [0, 1], [-70, -22])}%`,
        transform: `scale(${escalaCursor}) rotate(-20deg)`,
        opacity: interpolarSeguro(frame, [cuadroAparece, cuadroAparece + fps * 0.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))",
      }}
    >
      👆
    </div>
  );
}
