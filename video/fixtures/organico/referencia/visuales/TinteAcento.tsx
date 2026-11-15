// "El fondo puede inclinarse un poco hacia cada tono" (pedido explícito,
// v3): un tinte plano semitransparente encima de FondoMarca, nunca
// mix-blend-mode (no soportado por @remotion/web-renderer -- ver la
// investigación de compatibilidad del plan) -- solo opacity, que sí
// está confirmado funcionando en todo este proyecto.
import { AbsoluteFill } from "remotion";
import { mezclarColoresHex } from "../../../../tema";
import { COLOR_ALERTA, COLOR_EXITO } from "./acento";

// progreso 0 = tinte de alerta completo, 1 = tinte de éxito completo.
export function TinteAcento({ progreso }: { progreso: number }) {
  const color = mezclarColoresHex(COLOR_ALERTA, COLOR_EXITO, progreso);
  return <AbsoluteFill style={{ background: color, opacity: 0.16, pointerEvents: "none" }} />;
}
