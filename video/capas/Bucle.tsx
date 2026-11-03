import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Guion } from "../guion.schema";

// Esquina superior izquierda (CapaLogo ocupa la derecha). El tramo activo
// va de bucle.abre_en a bucle.cierra_en (sección 3B del plan).
export function CapaBucle({ guion }: { guion: Guion }) {
  const frame = useCurrentFrame();
  const { bucle, escenas, fps } = guion;

  if (bucle.indicador === "ninguno") return null;

  const ids = escenas.map((e) => e.id);
  const indiceAbre = ids.indexOf(bucle.abre_en);
  const indiceCierra = ids.indexOf(bucle.cierra_en);
  if (indiceAbre === -1 || indiceCierra === -1) return null;

  let inicioCuadro = 0;
  for (let i = 0; i < indiceAbre; i++) inicioCuadro += Math.round(escenas[i].duracion_s * fps);
  let finCuadro = inicioCuadro;
  for (let i = indiceAbre; i <= indiceCierra; i++) finCuadro += Math.round(escenas[i].duracion_s * fps);

  if (frame < inicioCuadro || frame >= finCuadro) return null;

  let contenido: string;
  if (bucle.indicador === "espera_final") {
    contenido = "👀 espera al final";
  } else {
    // "contador": el total de pasos lo da la escena de lista_numerada que
    // cierra el bucle -- el zod ya lo exige (ver guion.schema.ts), así que
    // siempre existe cuando indicador es "contador".
    const escenaCierre = escenas[indiceCierra];
    const total = escenaCierre.tipo === "lista_numerada" ? escenaCierre.params.items.length : 1;
    const progreso = (frame - inicioCuadro) / Math.max(finCuadro - inicioCuadro, 1);
    const paso = Math.min(total, Math.floor(progreso * total) + 1);
    contenido = `${paso}/${total}`;
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "16%",
          left: "8%",
          background: "rgba(0,0,0,0.5)",
          color: "#fff",
          borderRadius: 999,
          padding: "6px 16px",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {contenido}
      </div>
    </AbsoluteFill>
  );
}
