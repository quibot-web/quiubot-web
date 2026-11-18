import { AbsoluteFill, useCurrentFrame } from "remotion";
import { fitText } from "@remotion/layout-utils";
import type { BloqueGuion, Guion } from "../guion.schema";
import { familiaDeFuenteSinCargar, TAMANO_FUENTE_CHIP_BUCLE } from "./tamanos";
import { IconoOjos } from "../iconos";

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
    return bucle.indicador === "contador" ? `${indiceValor + 1}/${escenasValor.length}` : `${MARCA_OJOS}${bucle.texto}`;
  }
  if (escenaActual.bloque === "gancho") {
    return bucle.indicador === "espera_final" ? `${MARCA_OJOS}espera al final` : `${MARCA_OJOS}${bucle.texto}`;
  }
  return null;
}

// Ronda L (revisión real en staging): "3 ajustes antes de cambiar tu
// anuncio" (38 caracteres, dentro del límite viejo de 60 de
// bucle.texto) se partía en 2 líneas -- sin whiteSpace:"nowrap" el chip
// crecía hacia abajo y su 2da línea se montaba sobre la tarjeta
// (empieza en TARJETA_TOP_PORCENTAJE, ~22%). Mismo criterio ya probado
// en BotonEstado.tsx: medir el ancho real del texto con fitText() y
// encoger la fuente si hace falta, nunca confiar en que el límite de
// caracteres del guion (ya bajado a 32 en guion.schema.ts) alcance
// solo. maxWidth:80% del cuadro de 1080 -- "left:8%" deja el resto
// como margen derecho real.
const ANCHO_CHIP_PX = 1080 * 0.8;
const PADDING_HORIZONTAL_CHIP_PX = 26;

// El 👀 del chip NO se pinta como emoji (no está en nuestras fuentes; en
// un computador sin fuente de emoji sale un cuadro blanco): el texto
// lógico lo conserva como marca (los tests y capas/Bucle.tsx lo usan
// igual), y al pintar se cambia por IconoOjos.
export const MARCA_OJOS = "\u{1F440} ";
const ANCHO_OJOS_EN_EM = 1.7;

function calcularFuenteChipQueCabe(texto: string, familia: string, conOjos: boolean): number {
  const anchoDisponible = ANCHO_CHIP_PX - PADDING_HORIZONTAL_CHIP_PX * 2;
  const { fontSize } = fitText({ text: texto, withinWidth: anchoDisponible, fontFamily: familia, fontWeight: 800 });
  const fuente = conOjos ? anchoDisponible / (anchoDisponible / fontSize + ANCHO_OJOS_EN_EM) : fontSize;
  return Math.min(TAMANO_FUENTE_CHIP_BUCLE, Math.floor(fuente));
}

export function CapaBucleAudio({ guion }: { guion: Guion }) {
  const frame = useCurrentFrame();
  const limites = calcularLimitesEscenas(guion);
  const contenido = contenidoBucleAudio(frame, guion.bucle, limites);
  if (!contenido) return null;

  const conOjos = contenido.startsWith(MARCA_OJOS);
  const texto = conOjos ? contenido.slice(MARCA_OJOS.length) : contenido;
  const fontSize = calcularFuenteChipQueCabe(texto, familiaDeFuenteSinCargar(guion.tema.fuente), conOjos);

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
          padding: `10px ${PADDING_HORIZONTAL_CHIP_PX}px`,
          fontSize,
          fontWeight: 800,
          maxWidth: "80%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {conOjos && <IconoOjos tamano={Math.round(fontSize * 1.05)} estilo={{ marginRight: fontSize * 0.3, verticalAlign: "-0.15em" }} />}
        {texto}
      </div>
    </AbsoluteFill>
  );
}
