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
import { TAMANO_FUENTE_CONTADOR_GIGANTE } from "./tamanos";

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

// Bug real encontrado comparando cuadro a cuadro con el reel de
// referencia aprobado (16 nov 2026): el visual "contador" standalone
// (video/visuales/index.tsx) usaba ContadorBadge de arriba -- pensado
// como una insignia CHICA (para meterla dentro del encabezado de
// CelularChat, tamaño por defecto 44px) -- a tamano=130 fijo en un
// lienzo de 1080px de ancho, quedaba como un "2" diminuto perdido en
// medio de fondo vacío. Este es el tratamiento GRANDE, mismo criterio
// de escala que el "NumeroGigante" de CelularChat (fontSize 260) pero
// para cuando el número es el protagonista solo de la tarjeta, no de
// un mockup de chat encima.
export function ContadorGigante({ valor, color }: { valor: number; color: string }) {
  return <span style={{ fontSize: TAMANO_FUENTE_CONTADOR_GIGANTE, fontWeight: 900, color, lineHeight: 1 }}>{valor}</span>;
}
