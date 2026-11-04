import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Guion } from "../guion.schema";
import { cuadrosPorItemListaNumerada } from "../escenas/tipos";

// Esquina superior izquierda (CapaLogo ocupa la derecha).
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

  const escenaCierre = escenas[indiceCierra];
  let inicioEscenaCierre = inicioCuadro;
  for (let i = indiceAbre; i < indiceCierra; i++) inicioEscenaCierre += Math.round(escenas[i].duracion_s * fps);
  const finEscenaCierre = inicioEscenaCierre + Math.round(escenaCierre.duracion_s * fps);

  // "espera al final" deja de tener sentido apenas se llega a la escena
  // que cumple la promesa (sea esa escena el pago -- producto, oferta --
  // o directo el cta): se oculta DESDE que esa escena empieza, nunca
  // sigue metida en el cta. "contador" sí se queda hasta el final de esa
  // misma escena: ahí es donde de verdad cuenta 1/3, 2/3, 3/3.
  const finCuadro = bucle.indicador === "espera_final" ? inicioEscenaCierre : finEscenaCierre;

  if (frame < inicioCuadro || frame >= finCuadro) return null;

  let contenido: string;
  if (bucle.indicador === "espera_final") {
    contenido = "👀 espera al final";
  } else if (frame < inicioEscenaCierre) {
    // Antes de llegar a la lista que cuenta, el chip muestra la
    // promesa en sí ("👀 3 trucos para que tu café dure más"), no un
    // "0/3" que todavía no significa nada.
    contenido = `👀 ${bucle.texto}`;
  } else {
    // El zod ya exige que la escena de cierre sea lista_numerada cuando
    // indicador es "contador" (ver guion.schema.ts), así que siempre
    // existe -- y el paso usa EXACTAMENTE la misma fórmula que
    // ListaNumerada.tsx para no desincronizarse del ítem que se ve.
    const total = escenaCierre.tipo === "lista_numerada" ? escenaCierre.params.items.length : 1;
    const cuadrosPorItem = cuadrosPorItemListaNumerada(escenaCierre.duracion_s, fps, total);
    const frameEnEscena = frame - inicioEscenaCierre;
    const paso = Math.min(total, Math.floor(frameEnEscena / cuadrosPorItem) + 1);
    contenido = `${paso}/${total}`;
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "16%",
          left: "8%",
          background: "#111111",
          color: "#FFD43B",
          borderRadius: 999,
          padding: "10px 26px",
          fontSize: 40,
          fontWeight: 800,
          maxWidth: "80%",
        }}
      >
        {contenido}
      </div>
    </AbsoluteFill>
  );
}
