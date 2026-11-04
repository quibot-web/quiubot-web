import { AbsoluteFill } from "remotion";

// Márgenes inseguros de Reels/Stories (sección 3 del plan, porcentajes
// citados ahí -- confirmar vigencia en la guía de Meta antes de salir de
// la Fase 1a). Exportados porque además de dibujar el overlay de
// depuración, capas/TratamientoMedia.tsx y escenas/BeneficiosLista.tsx
// ahora centran su contenido en la ZONA SEGURA real (lo que queda entre
// estos márgenes), no en el cuadro completo -- un solo lugar con estos
// números, nunca repetidos a mano en cada archivo.
export const ZONA_SEGURA = {
  arriba: 14,
  abajo: 35,
  lados: 6,
} as const;

export const ALTURA_ZONA_SEGURA = 100 - ZONA_SEGURA.arriba - ZONA_SEGURA.abajo;

// Interruptor "ver zona segura" (solo admin, sección 3 del plan).
export function ZonaSegura() {
  const sombra = "rgba(255,0,0,0.25)";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${ZONA_SEGURA.arriba}%`, background: sombra }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${ZONA_SEGURA.abajo}%`, background: sombra }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${ZONA_SEGURA.lados}%`, background: sombra }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: `${ZONA_SEGURA.lados}%`, background: sombra }} />
    </AbsoluteFill>
  );
}
