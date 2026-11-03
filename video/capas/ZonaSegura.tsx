import { AbsoluteFill } from "remotion";

// Interruptor "ver zona segura" (solo admin, sección 3 del plan).
// Porcentajes citados en el plan para Reels/Stories -- confirmar
// vigencia en la guía de Meta antes de salir de la Fase 1a.
export function ZonaSegura() {
  const sombra = "rgba(255,0,0,0.25)";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "14%", background: sombra }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: sombra }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "6%", background: sombra }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "6%", background: sombra }} />
    </AbsoluteFill>
  );
}
