import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { BloqueGuion, Guion } from "../guion.schema";

// Bucle persistente para ReelAutomatico.tsx -- NO es capas/Bucle.tsx
// (esa queda intacta, la usan las 6 recetas de siempre sin voz).
//
// Bug real encontrado generando un reel real de punta a punta (16 nov
// 2026, 3ra revisión de staging): capas/Bucle.tsx calcula sus propios
// límites de escena con escena.duracion_s (la estimación de la IA) y,
// para el indicador "contador", espera que la escena de cierre sea
// tipo "lista_numerada" con items -- interpola el paso 1/N, 2/N...
// DENTRO de esa única escena. En consejos_numerados con audio no hay
// una sola escena con los 3 ítems: cada consejo es su propia escena,
// y la línea de tiempo real es la de tiemposRender (audio), no
// duracion_s. "1/3, 2/3, 3/3 en cada escena de consejo" (pedido
// explícito) necesita saber en qué escena ESTÁ el cuadro actual sobre
// la línea de tiempo REAL del video -- que es la de tiemposRender,
// apiladas sin los huecos entre escenas (mismo criterio que
// ReelAutomatico.tsx para ubicar cada Sequence).
export type LimiteEscena = { id: string; bloque: BloqueGuion; inicioCuadro: number; finCuadro: number };

export function calcularLimitesEscenas(guion: Pick<Guion, "escenas" | "tiemposRender" | "fps">): LimiteEscena[] {
  const tiemposRender = guion.tiemposRender ?? [];
  let acumulado = 0;
  return guion.escenas.map((escena) => {
    const tiempo = tiemposRender.find((t) => t.escena_id === escena.id);
    const duracionCuadros = tiempo ? Math.round((tiempo.fin_s - tiempo.inicio_s) * guion.fps) : 0;
    const inicioCuadro = acumulado;
    acumulado += duracionCuadros;
    return { id: escena.id, bloque: escena.bloque, inicioCuadro, finCuadro: acumulado };
  });
}

// null = no mostrar nada en este cuadro (ya se cerró el bucle --
// desde "marca" en adelante no tiene sentido seguir mostrándolo,
// mismo criterio que capas/Bucle.tsx: una vez se llega a la escena
// que cumple la promesa, se oculta).
export function contenidoBucleAudio(frame: number, bucle: Guion["bucle"], limites: LimiteEscena[]): string | null {
  if (bucle.indicador === "ninguno") return null;

  const escenaActual = limites.find((l) => frame >= l.inicioCuadro && frame < l.finCuadro);
  if (!escenaActual) return null;

  const escenasValor = limites.filter((l) => l.bloque === "valor");
  const indiceValor = escenasValor.findIndex((l) => l.id === escenaActual.id);

  if (indiceValor !== -1) {
    return bucle.indicador === "contador" ? `${indiceValor + 1}/${escenasValor.length}` : `👀 ${bucle.texto}`;
  }
  if (escenaActual.bloque === "gancho") {
    return bucle.indicador === "espera_final" ? "👀 espera al final" : `👀 ${bucle.texto}`;
  }
  return null;
}

export function CapaBucleAudio({ guion }: { guion: Guion }) {
  const frame = useCurrentFrame();
  const limites = calcularLimitesEscenas(guion);
  const contenido = contenidoBucleAudio(frame, guion.bucle, limites);
  if (!contenido) return null;

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
