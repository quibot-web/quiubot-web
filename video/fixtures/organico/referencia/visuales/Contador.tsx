// Visual "contador" (Fase A, pivote visual de contenido orgánico --
// ver /Users/juanshow/.claude/plans/peppy-frolicking-penguin.md).
// Mismo truco que ya usa video/escenas/ProblemaDato.tsx para su número
// animado: Math.round(interpolate(...)). Aquí sale como un componente
// aparte reusable (badge chico) en vez de vivir solo adentro de
// ProblemaDato, para poder ponerlo también dentro de un celular.
//
// Regla explícita del usuario (ajuste al plan, 15 nov 2026): el número
// que muestra NUNCA es un resultado inventado de Quiubot -- quien llama
// a esto decide si es puramente ilustrativo (ej. "nuevos: 0->3" sin
// afirmar nada real) o una cifra real que el usuario dio.
import { interpolate } from "remotion";

export function valorContadorEnFrame(frame: number, cuadroInicio: number, cuadroFin: number, desde: number, hasta: number): number {
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
