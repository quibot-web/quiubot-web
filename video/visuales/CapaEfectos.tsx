import { Sequence } from "remotion";
import { Audio } from "@remotion/media";

// Fase B v2.0 (docs/diseno/plan_contenido_organico_fase_b_v2.md,
// punto 7). Efectos puntuales (clic, pop) en cuadros específicos --
// mapeo fijo visual.tipo->categoría de sonido, SIEMPRE por código,
// nunca elegido por la IA (mismo criterio que la música). La
// biblioteca real con infraestructura tipo pistas_musicales
// (tabla efectos_sonido, licencia_url, admin) es Fase B v2.1 -- hoy
// "efectos" puede llegar vacío (sin licencia real todavía, mismo caso
// que la música: "sin audio con licencia es mejor que uno sin
// derechos"), y el reel se ve y suena bien igual, solo sin esos pops.
export type EfectoSonido = { cuadro: number; url: string };

export function CapaEfectos({ efectos }: { efectos: EfectoSonido[] }) {
  return (
    <>
      {efectos.map((efecto, i) => (
        // <Sequence from=...> es la forma real de "empezar a reproducir
        // en este cuadro" en Remotion -- startFrom recorta el AUDIO
        // FUENTE, no retrasa cuándo arranca en la composición, así que
        // no sirve para esto.
        <Sequence key={i} from={efecto.cuadro}>
          <Audio src={efecto.url} volume={0.6} />
        </Sequence>
      ))}
    </>
  );
}
