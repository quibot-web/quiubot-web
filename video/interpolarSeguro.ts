import { interpolate } from "remotion";

// interpolate() de Remotion exige un inputRange ESTRICTAMENTE creciente
// -- si dos puntos calculados (a partir de eventos, palabras, segmentos
// de audio, duraciones) coinciden o se invierten, lanza en render real
// "inputRange must be strictly monotonically increasing". Ya pasó 3
// veces con guardas ad hoc distintas cada vez (Contador.tsx,
// CursorClicEventos.tsx, y el fundido de 15ms de CapaVoz.tsx, que a
// 30fps redondea a 0 cuadros y produce el rango degenerado
// [0, 0, fin, fin]) -- este helper es el único punto de defensa: en vez
// de que cada componente nuevo tenga que acordarse de proteger su
// propio rango a mano, CUALQUIER interpolate() con límites calculados
// pasa por acá, y acá se garantiza la propiedad una sola vez.
//
// minPaso son las mismas unidades que inputRange (cuadros para la
// mayoría de los casos; segundos para código que todavía trabaja en
// segundos, como la compactación de pausas -- ahí quien llama debe
// pasar algo como 1/fps en vez del default).
type OpcionesInterpolate = Parameters<typeof interpolate>[3];

// Exportada aparte porque CapaMusicaConDucking.tsx necesita el ARREGLO
// ya corregido (lo devuelve de una función pura que sus propios tests
// revisan), no solo un interpolate() protegido -- antes tenía su
// propia copia de este mismo bucle a mano; ahora las dos pasan por
// acá, una sola implementación.
export function corregirRangoCreciente(inputRange: readonly number[], minPaso: number = 1): number[] {
  const rangoCorregido = [...inputRange];
  for (let i = 1; i < rangoCorregido.length; i++) {
    if (rangoCorregido[i] <= rangoCorregido[i - 1]) {
      rangoCorregido[i] = rangoCorregido[i - 1] + minPaso;
    }
  }
  return rangoCorregido;
}

export function interpolarSeguro(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options?: OpcionesInterpolate,
  minPaso: number = 1
): number {
  return interpolate(input, corregirRangoCreciente(inputRange, minPaso), outputRange as number[], options);
}
