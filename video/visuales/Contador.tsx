// Promovido tal cual desde video/fixtures/organico/referencia/visuales/
// Contador.tsx (Fase A, aprobado) -- mismo truco que ya usa
// video/escenas/ProblemaDato.tsx para su número animado:
// Math.round(interpolate(...)).
//
// Regla explícita del usuario: el número que muestra NUNCA es un
// resultado inventado de Quiubot -- quien llama a esto decide si es
// puramente ilustrativo (ej. "nuevos: 0->3" sin afirmar nada real) o
// una cifra real que el usuario dio.
import { interpolate } from "remotion";

// Bug real encontrado con una prueba real en navegador (16 nov 2026):
// interpolate() exige un inputRange ESTRICTAMENTE creciente -- si el
// visual "contador" solo trae 1 evento (el schema lo permite, min 1),
// cuadroInicio === cuadroFin y Remotion tira "inputRange must be
// strictly monotonically increasing but got [0,0]", tumbando el
// render completo. Con un solo evento no hay nada que "interpolar" de
// todos modos: el contador salta directo a "hasta" en cuanto llega
// ese cuadro, nunca sube gradualmente.
export function valorContadorEnFrame(frame: number, cuadroInicio: number, cuadroFin: number, desde: number, hasta: number): number {
  if (cuadroInicio === cuadroFin) {
    return frame >= cuadroInicio ? hasta : desde;
  }
  const progreso = interpolate(frame, [cuadroInicio, cuadroFin], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return Math.round(desde + (hasta - desde) * progreso);
}

export function ContadorBadge({ valor, color, colorTexto, tamano = 44 }: { valor: number; color: string; colorTexto: string; tamano?: number }) {
  return (
    <div
      style={{
        minWidth: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        background: color,
        color: colorTexto,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: tamano * 0.5,
        padding: `0 ${tamano * 0.28}px`,
        boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
      }}
    >
      {valor}
    </div>
  );
}
