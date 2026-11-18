// Control "cambio visual cada 2 s" (sistema de estilos, paso 3 --
// principio de retención fijo). En cada escena se calculan los instantes
// en que algo cambia de verdad (el corte de escena, los eventos del
// visual, la salida de la palabra gigante, cada casilla del checklist) y,
// si queda un tramo de más de 2 s sin cambio, se agregan golpes de cámara
// en el inicio de una palabra de la narración (el cambio cae con la voz).
// Así el principio se cumple por construcción, sin regenerar voz ni guion.
// Función pura: la usa EscenaConEstilo (ReelAutomatico) y los tests.
export const MAX_SEGUNDOS_SIN_CAMBIO = 2;

export function tramoMasLargoSinCambio(cambios: number[], duracion: number): number {
  const puntos = [...new Set([0, ...cambios.filter((c) => c > 0 && c < duracion), duracion])].sort((a, b) => a - b);
  let maximo = 0;
  for (let i = 1; i < puntos.length; i++) maximo = Math.max(maximo, puntos[i] - puntos[i - 1]);
  return maximo;
}

// Golpes extra (en cuadros) para que ningún tramo pase de maxCuadros.
// Prefiere el inicio de una palabra entre el 40% y el 100% del máximo
// después del último cambio (lo más cerca posible del 80%); si no hay
// ninguna, el golpe cae justo en el máximo.
export function golpesDeRelleno(cambios: number[], duracion: number, iniciosPalabras: number[], maxCuadros: number): number[] {
  const puntos = [...new Set([0, ...cambios.filter((c) => c > 0 && c < duracion), duracion])].sort((a, b) => a - b);
  const extra: number[] = [];
  for (let i = 1; i < puntos.length; i++) {
    let desde = puntos[i - 1];
    const hasta = puntos[i];
    while (hasta - desde > maxCuadros) {
      const objetivo = desde + maxCuadros * 0.8;
      const candidatas = iniciosPalabras.filter((p) => p > desde + maxCuadros * 0.4 && p <= desde + maxCuadros && p < hasta);
      const elegido = candidatas.length > 0 ? candidatas.reduce((a, b) => (Math.abs(b - objetivo) < Math.abs(a - objetivo) ? b : a)) : desde + maxCuadros;
      extra.push(Math.round(elegido));
      desde = elegido;
    }
  }
  return extra;
}
