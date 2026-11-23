// Cuadros de un tramo de voz dentro del Sequence de su escena, redondeados
// SIEMPRE a favor de la voz (23 nov 2026): el recorte de la fuente
// (trimBefore) va al cuadro ANTERIOR al inicio del tramo y la duración
// llega al cuadro SIGUIENTE a su fin. Antes se usaba Math.round y un tramo
// podía arrancar hasta medio cuadro (17 ms) tarde, encima del ataque de la
// palabra. El Sequence se adelanta lo mismo que se adelantó el recorte, así
// que la voz sigue cayendo donde dicen los tiempos compactados (error
// < medio cuadro). Lo que entra de más es silencio: compactarPausas deja
// siempre >= 120 ms de silencio medido en cada borde de corte.
export type TramoDeVoz = { original: { inicio_s: number; fin_s: number }; compactado: { inicio_s: number; fin_s: number } };

const EPS = 1e-6;

export function cuadrosDeTramo(tramo: TramoDeVoz, inicioEscena_s: number, fps: number): { desde: number; duracion: number; trimBefore: number; trimAfter: number } {
  const inicioFuente = tramo.original.inicio_s * fps;
  const trimBefore = Math.max(0, Math.floor(inicioFuente + EPS));
  const adelanto = inicioFuente - trimBefore; // [0, 1) cuadro
  let desde = Math.round((tramo.compactado.inicio_s - inicioEscena_s) * fps - adelanto);
  let recorte = trimBefore;
  // El Sequence no puede empezar antes del cuadro 0 de su escena: en ese
  // caso se recorta un cuadro más de la fuente (silencio del margen de
  // 120 ms), nunca se deja la voz adelantada.
  if (desde <= 0) {
    recorte -= desde;
    desde = 0;
  }
  const hasta = Math.ceil((tramo.compactado.fin_s - inicioEscena_s) * fps - EPS);
  const duracion = Math.max(0, hasta - desde);
  return { desde, duracion, trimBefore: recorte, trimAfter: recorte + duracion };
}
