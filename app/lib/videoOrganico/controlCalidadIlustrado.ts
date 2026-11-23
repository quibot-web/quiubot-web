// Control de calidad por visión del REEL ILUSTRADO (staging 23 nov 2026).
// El de los reels con estilo revisa texto superpuesto en general; en el
// ilustrado, el texto de la interfaz del celular (nombres, "Me gusta",
// encabezados) es decorado. Este revisa lo que importa, sin quedar
// permisivo:
// - pantalla realmente vacía (un chat sin mensajes SÍ es vacía);
// - lo que la voz nombra se ve y es grande (a cada cuadro se le dice qué
//   debería verse);
// - nada cortado;
// - subtítulo legible y sin tapar lo nombrado;
// - nunca una foto con texto o una captura como foto de producto.
// Una respuesta incompleta del modelo cuenta como problema.
// El QC completo por acción es la fase 5. Puro: corre en el navegador y en el servidor.
import { escenaEnCamara, prepararReel } from "@/video/ilustrado/motor/preparar";
import { CATALOGO, ESCENA_VISIBLE, MICRO } from "@/video/ilustrado/motor/catalogo";
import type { PlanIlustrado } from "@/video/ilustrado/motor/plan";
import type { TiemposIlustrado } from "@/video/ilustrado/tiempoIlustrado";

export type MomentoQC = { etiqueta: string; segundo: number; esperado: string };

// Inicio (0,1 s) + una toma con la cámara quieta por cada tercio del reel.
export function momentosControlIlustrado(tiempos: TiemposIlustrado, plan: PlanIlustrado, fps = 30): MomentoQC[] {
  const reel = prepararReel(tiempos, plan, fps);
  const total = reel.linea.duracionCuadros;
  const puntos = [...reel.camara].sort((a, b) => a.cuadro - b.cuadro);
  const llegadas = [0, ...reel.tomas.slice(1).map((_, i) => puntos[2 + 2 * i].cuadro)];
  const salidas = [...reel.tomas.slice(1).map((_, i) => puntos[1 + 2 * i].cuadro), total - 1];
  const ventanas = reel.tomas.map((t, i) => ({ i, desde: llegadas[i], hasta: salidas[i], medio: Math.round((llegadas[i] + salidas[i]) / 2) }));
  // Lo que el reel MUESTRA en ese cuadro (misma función que el render):
  // la escena en cámara y la última acción de ESA escena (staging, pieza
  // 67d87ce8: se usaba la última acción del plan aunque fuera de otra
  // pantalla, y se esperaba un perfil donde se veía el feed).
  const queSeVe = (cuadro: number) => {
    const escena = escenaEnCamara(reel, cuadro);
    if (!escena) return "la escena del reel";
    const accion = [...reel.disparos].reverse().find((d) => d.escena === escena && d.cuadro <= cuadro && d.accion !== MICRO);
    const def = accion ? (CATALOGO[escena].acciones as Record<string, { descripcion: string }>)[accion.accion] : null;
    return def ? `${ESCENA_VISIBLE[escena]}; en ese momento: ${def.descripcion}` : ESCENA_VISIBLE[escena];
  };
  const momentos: MomentoQC[] = [{ etiqueta: "inicio", segundo: 0.1, esperado: queSeVe(3) }];
  for (let tercio = 0; tercio < 3; tercio++) {
    const [a, b] = [(total * tercio) / 3, (total * (tercio + 1)) / 3];
    const candidata = ventanas
      .filter((v) => v.medio >= a && v.medio < b && v.hasta - v.desde >= 10)
      .sort((x, y) => y.hasta - y.desde - (x.hasta - x.desde))[0];
    if (candidata) momentos.push({ etiqueta: `toma ${tercio + 1}`, segundo: candidata.medio / fps, esperado: queSeVe(candidata.medio) });
  }
  return momentos;
}

export function promptControlIlustrado(momentos: Pick<MomentoQC, "etiqueta" | "esperado">[]): string {
  return `Revisas cuadros de un REEL ILUSTRADO vertical (9:16) de Instagram: objetos ilustrados grandes (un celular con su app, una billetera, personas, un reloj, una gráfica) y una cámara que se mueve por ellos. Arriba hay un SUBTÍTULO corto: texto blanco (una palabra resaltada en color) sobre una píldora oscura. Cada cuadro llega etiquetado, con lo que DEBERÍA verse en él:
${momentos.map((m) => `- ${m.etiqueta}: ${m.esperado}`).join("\n")}

Para CADA cuadro responde con estos campos (true = hay problema, salvo los dos de "lo_nombrado"):
- pantalla_vacia: más del 40% del cuadro no tiene ningún objeto ni contenido. Un celular con la interfaz de una app llena de contenido NO está vacío, pero una pantalla de app casi en blanco (por ejemplo un chat SIN ningún mensaje, o un feed sin publicaciones) SÍ cuenta como vacía. El fondo oscuro con piso y luz alrededor de un objeto grande no cuenta como vacío.
- lo_nombrado_visible: true si lo que DEBERÍA verse en ese cuadro se ve y se reconoce.
- lo_nombrado_grande: true si eso ocupa al menos la mitad del ancho o del alto del cuadro.
- objeto_cortado: el objeto principal está cortado por el borde de forma que no se reconoce (un celular que se sale un poco por abajo NO es un error).
- subtitulo_ilegible: el subtítulo de arriba no se puede leer (cortado, tapado, contraste bajo o letras encimadas).
- subtitulo_tapa_lo_nombrado: el subtítulo cubre lo que DEBERÍA verse (no cuenta si solo cubre texto decorativo de la app, como un nombre de cuenta, un encabezado o "Me gusta").
- foto_con_texto: la foto de producto dentro de una publicación o anuncio es una captura de pantalla, un afiche o una imagen con texto. Las ilustraciones de otras publicaciones (comida, ropa, paisaje, mascota) y una tarjeta con solo una inicial NO cuentan.
- nota: una frase corta en español con lo que viste.

Sé estricto con lo que SÍ es un error real, pero no marques el texto decorativo de la app tapado por el subtítulo.
Responde ÚNICAMENTE este JSON, un objeto por cuadro, en el mismo orden:
{"hallazgos":[{"cuadro":"<etiqueta>","pantalla_vacia":false,"lo_nombrado_visible":true,"lo_nombrado_grande":true,"objeto_cortado":false,"subtitulo_ilegible":false,"subtitulo_tapa_lo_nombrado":false,"foto_con_texto":false,"nota":"..."}]}`;
}

export type HallazgoIlustrado = {
  cuadro: string;
  pantalla_vacia: boolean;
  lo_nombrado_visible: boolean;
  lo_nombrado_grande: boolean;
  objeto_cortado: boolean;
  subtitulo_ilegible: boolean;
  subtitulo_tapa_lo_nombrado: boolean;
  foto_con_texto: boolean;
  nota: string;
};

const CAMPOS: (keyof HallazgoIlustrado)[] = ["pantalla_vacia", "lo_nombrado_visible", "lo_nombrado_grande", "objeto_cortado", "subtitulo_ilegible", "subtitulo_tapa_lo_nombrado", "foto_con_texto"];

// Problemas por cuadro, en español. Estricto: un cuadro que falta o un
// campo que no es booleano es un problema (nunca se aprueba por omisión).
export function erroresQCIlustrado(hallazgos: unknown, etiquetas: string[]): string[] {
  const lista = Array.isArray(hallazgos) ? (hallazgos as Partial<HallazgoIlustrado>[]) : [];
  const errores: string[] = [];
  etiquetas.forEach((etiqueta, i) => {
    const h = lista.find((x) => x?.cuadro === etiqueta) ?? lista[i];
    const nota = typeof h?.nota === "string" ? h.nota : "";
    if (!h || CAMPOS.some((c) => typeof h[c] !== "boolean")) {
      errores.push(`El control de calidad (visión) no pudo revisar bien el cuadro "${etiqueta}" (respuesta incompleta).`);
      return;
    }
    const problemas = [
      h.pantalla_vacia && "pantalla vacía",
      !h.lo_nombrado_visible && "no se ve lo que nombra la voz",
      h.lo_nombrado_visible && !h.lo_nombrado_grande && "lo que nombra la voz se ve chico",
      h.objeto_cortado && "objeto principal cortado",
      h.subtitulo_ilegible && "subtítulo ilegible",
      h.subtitulo_tapa_lo_nombrado && "el subtítulo tapa lo que nombra la voz",
      h.foto_con_texto && "foto con texto o captura usada como producto",
    ].filter(Boolean);
    if (problemas.length > 0) errores.push(`El control de calidad (visión) encontró en el cuadro "${etiqueta}": ${problemas.join(", ")}. ${nota}`.trim());
  });
  return errores;
}
