import { AbsoluteFill, useCurrentFrame } from "remotion";
import { colorTextoSobre, contrasteSuficiente, type TemaGuion } from "../tema";
import { familiaDeFuente } from "../fuentes";
import { TAMANO_FUENTE_SUBTITULOS } from "./tamanos";
import { quitarGlifosFueraDeFuentes } from "../glifos";

// Fase B v2.0 (docs/diseno/plan_contenido_organico_fase_b_v2.md,
// punto 5). Palabra por palabra, dentro de zona segura (14%-65%,
// video/capas/ZonaSegura.tsx) -- franja FIJA al pie (54%-65%),
// reservada exclusivamente para esto. "Cerca del límite inferior para
// no chocar con el visual" (la idea original) no alcanzaba: el visual
// (CelularChat con colorNumeroGigante, p.ej.) se centraba en su propia
// tarjeta y esa tarjeta llegaba hasta el mismo 65%, superponiéndose de
// verdad (visto en los cuadros del spike de ReelAutomatico). Ahora la
// tarjeta/zona visual termina en 51% (video/visuales/geometria.ts) y
// esta franja es la única que vive en 54%-65% -- ningún visual debe
// invadirla.
//
// Resaltado SIN depender del color de texto: toda la narración va en
// blanco sobre un fondo oscuro sólido (ya verificado, blanco pasa
// contrasteSuficiente contra cualquier negro semitransparente denso),
// y la palabra activa gana una cápsula de fondo con el color primario
// de la marca -- su texto se resuelve con colorTextoSobre(), que ya
// elige blanco u oscuro según cuál pase mejor contra ESE color
// puntual. contrasteSuficiente() se llama explícito como segunda
// verificación (nunca confiar en "debería andar bien" sin medirlo).
//
// Tiempo en CUADROS relativos a la escena (no segundos, no absolutos
// del reel completo) -- quien arma la Composicion ya resuelve esa
// resta (el Sequence de la escena hace que useCurrentFrame() empiece
// en 0 para esa escena, mismo criterio que el resto de video/escenas/).
export type PalabraEnCuadros = { texto: string; inicioCuadro: number; finCuadro: number };

const COLOR_FONDO_SUBTITULO = "rgba(0,0,0,0.65)";
const COLOR_TEXTO_NORMAL = "#fff";

// Bug real reportado (revisión de staging, 16 nov 2026): antes se
// mostraban TODAS las palabras de la narración de la escena a la vez
// (hasta 16, por el prompt) -- con una narración larga, eso se veía
// como "una franja oscura con letra diminuta" porque el texto tenía
// que envolver a 3-4 líneas para caber. "2 líneas como máximo" exige
// mostrar solo un TRAMO a la vez (como TikTok/Reels reales), no todo
// el párrafo -- se reparte en páginas de 4 palabras (conservador: a
// 44px, 4 palabras normales caben sobradas en 2 líneas incluso si
// alguna es larga) y se muestra la página que contiene la palabra
// activa.
const PALABRAS_POR_PAGINA = 4;

function construirPaginas(palabras: PalabraEnCuadros[]): PalabraEnCuadros[][] {
  const paginas: PalabraEnCuadros[][] = [];
  for (let i = 0; i < palabras.length; i += PALABRAS_POR_PAGINA) {
    paginas.push(palabras.slice(i, i + PALABRAS_POR_PAGINA));
  }
  return paginas;
}

// La página que corresponde al cuadro actual: la última cuya primera
// palabra ya empezó a sonar -- antes de que la primera palabra de la
// escena empiece, se queda en la página 0 (nunca una pantalla vacía
// mientras el visual ya apareció).
function paginaDeCuadro(paginas: PalabraEnCuadros[][], frame: number): PalabraEnCuadros[] {
  for (let i = paginas.length - 1; i >= 0; i--) {
    if (paginas[i][0] && frame >= paginas[i][0].inicioCuadro) return paginas[i];
  }
  return paginas[0] ?? [];
}

export function SubtitulosSincronizados({ palabras, tema }: { palabras: PalabraEnCuadros[]; tema: TemaGuion }) {
  const frame = useCurrentFrame();
  const colorTextoActivo = colorTextoSobre(tema.color_primario);

  // Segunda verificación explícita (nunca confiar en que
  // colorTextoSobre() alcanzó el umbral sin medirlo de nuevo acá,
  // mismo criterio que el resto del molde) -- si por algún motivo el
  // color primario de la marca no deja un contraste suficiente con
  // NINGUNO de los 2 candidatos (caso extremo, colores casi iguales),
  // la cápsula cae a un fondo oscuro genérico en vez de arriesgar
  // texto illegible.
  const capsulaActivaOk = contrasteSuficiente(colorTextoActivo, tema.color_primario);
  const colorCapsulaActiva = capsulaActivaOk ? tema.color_primario : "#15120A";
  const colorTextoEnCapsula = capsulaActivaOk ? colorTextoActivo : "#fff";

  if (palabras.length === 0) return null;
  const paginas = construirPaginas(palabras);
  const palabrasVisibles = paginaDeCuadro(paginas, frame);

  return (
    <AbsoluteFill
      style={{
        top: "54%",
        height: "11%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 6%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0.4em",
          background: COLOR_FONDO_SUBTITULO,
          borderRadius: 16,
          padding: "14px 22px",
          fontFamily: familiaDeFuente(tema.fuente),
          fontSize: TAMANO_FUENTE_SUBTITULOS,
          fontWeight: 800,
          lineHeight: 1.2,
        }}
      >
        {palabrasVisibles.map((palabra, i) => {
          const activa = frame >= palabra.inicioCuadro && frame < palabra.finCuadro;
          return (
            <span
              key={i}
              style={{
                color: activa ? colorTextoEnCapsula : COLOR_TEXTO_NORMAL,
                background: activa ? colorCapsulaActiva : "transparent",
                borderRadius: activa ? 8 : 0,
                padding: activa ? "0 0.2em" : 0,
              }}
            >
              {quitarGlifosFueraDeFuentes(palabra.texto)}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
