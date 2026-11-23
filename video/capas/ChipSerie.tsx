// "Parte 1 de 2" al inicio de cada reel de una serie (24 nov 2026): se
// ve los primeros 2,5 s, arriba (debajo de lo que tapa Instagram).
import { useCurrentFrame } from "remotion";

export const CUADROS_CHIP_SERIE = 75;

export function textoSerie(serie: { parte: number; total: number }): string {
  return `Parte ${serie.parte} de ${serie.total}`;
}

export function ChipSerie({ serie, top = "15%" }: { serie: { parte: number; total: number } | undefined; top?: string }) {
  const frame = useCurrentFrame();
  if (!serie || frame >= CUADROS_CHIP_SERIE) return null;
  const opacidad = Math.min(1, (CUADROS_CHIP_SERIE - frame) / 10);
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: opacidad }}>
      <div style={{ padding: "12px 28px", borderRadius: 999, background: "rgba(10,10,18,0.86)", color: "#fff", fontSize: 40, fontWeight: 800, letterSpacing: 1 }}>{textoSerie(serie)}</div>
    </div>
  );
}
