// Layout "palabra gigante" (sistema de estilos): la idea del gancho en
// pantalla en letra realmente grande -- máximo 4 palabras (texto_gigante,
// límites en textoGigante.ts), aunque la narración diga la frase
// completa. También es la portada del reel (cuadro 0 ya legible). En el
// momento del cambio (~45% de la narración del gancho, entre 1 y 2 s) el
// texto sube y se va, y entra el visual del problema.
//
// Va FUERA de la cámara (el acercamiento no lo recorta contra los
// bordes), centrado en la zona segura entre el letrero de arriba y los
// subtítulos. Colores según el estilo (los decide quien lo usa).
import { AbsoluteFill, interpolate, spring } from "remotion";
import { measureText } from "@remotion/layout-utils";
import { hexConAlfa } from "../tema";
import { PROTAGONISTA_ALTURA_PORCENTAJE, PROTAGONISTA_TOP_PORCENTAJE } from "../visuales/geometria";
import { ajustarTextoGigante, indicesPalabraClave } from "./textoGigante";

// 83% (no el 88% de la zona segura): la entrada arranca con escala 1,06 y
// el texto no puede tocar los bordes ni en el cuadro 0.
const ANCHO_PX = 1080 * 0.83;
const ALTO_STICKER_PX = 80;
const ALTO_PX = (PROTAGONISTA_ALTURA_PORCENTAJE / 100) * 1920 - ALTO_STICKER_PX;

export type ColoresPalabraGigante = {
  texto: string;
  clave: string;
  brillo: string | null;
  stickerFondo: string;
  stickerTexto: string;
  // Color pleno: sombra dura en vez de brillo.
  sombraDura: boolean;
};

export function PalabraGigante({
  texto,
  palabraClave,
  sticker,
  familia,
  colores,
  frame,
  fps,
  cuadroSalida,
}: {
  texto: string;
  palabraClave: string;
  sticker?: string;
  familia: string;
  colores: ColoresPalabraGigante;
  frame: number;
  fps: number;
  cuadroSalida: number;
}) {
  const textoMayus = texto.toLocaleUpperCase("es");
  const medir = (t: string, tamano: number) => measureText({ text: t, fontFamily: familia, fontSize: tamano, fontWeight: "900" }).width;
  // 2 líneas a 140-260px; si algo no cabe (no debería, por los límites
  // del campo), hasta 3 líneas antes de bajar del mínimo.
  const opciones = { ancho: ANCHO_PX, alto: ALTO_PX, tamanoMin: 140, tamanoMax: 260, interlineado: 1.0 };
  const ajuste2 = ajustarTextoGigante(textoMayus, medir, { ...opciones, maxLineas: 2 });
  const cabeEn2 = ajuste2.lineas.length <= 2 && ajuste2.lineas.every((l) => medir(l, ajuste2.tamano) <= ANCHO_PX);
  const { tamano, lineas } = cabeEn2 ? ajuste2 : ajustarTextoGigante(textoMayus, medir, { ...opciones, tamanoMin: 96, maxLineas: 3 });
  const todas = textoMayus.split(/\s+/).filter(Boolean);
  const resaltadas = indicesPalabraClave(todas, palabraClave);
  const inicioDeLinea = lineas.reduce<number[]>((acc, _l, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + lineas[i - 1].split(" ").length);
    return acc;
  }, []);

  // Entrada con golpe: arranca apenas más grande y asienta (visible desde
  // el cuadro 0). Salida: sube y se desvanece en ~0,3 s.
  const entrada = spring({ frame, fps, config: { damping: 11, stiffness: 150 } });
  const escalaEntrada = interpolate(entrada, [0, 1], [1.06, 1]);
  const salida = frame >= cuadroSalida ? spring({ frame: frame - cuadroSalida, fps, config: { damping: 18, stiffness: 160 } }) : 0;
  const sombra = colores.sombraDura ? `8px 8px 0 ${hexConAlfa("#000000", 0.25)}` : `0 8px 40px ${hexConAlfa("#000000", 0.6)}`;

  return (
    <AbsoluteFill style={{ opacity: 1 - salida, transform: `translateY(${-140 * salida}px) scale(${escalaEntrada})`, transformOrigin: "50% 37%" }}>
      <div
        style={{
          position: "absolute",
          top: `${PROTAGONISTA_TOP_PORCENTAJE}%`,
          height: `${PROTAGONISTA_ALTURA_PORCENTAJE}%`,
          left: "6%",
          width: "88%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        {sticker && (
          <div style={{ background: colores.stickerFondo, color: colores.stickerTexto, fontSize: 44, fontWeight: 900, padding: "6px 24px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {sticker}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {lineas.map((linea, l) => (
            <div key={l} style={{ fontSize: tamano, fontWeight: 900, lineHeight: 1.0, whiteSpace: "nowrap", textAlign: "center", textShadow: sombra }}>
              {linea.split(" ").map((palabra, p) => {
                const clave = resaltadas.has(inicioDeLinea[l] + p);
                return (
                  <span key={p} style={{ color: clave ? colores.clave : colores.texto, textShadow: clave && colores.brillo ? `0 0 40px ${hexConAlfa(colores.brillo, 0.55)}` : undefined }}>
                    {p > 0 ? " " : ""}
                    {palabra}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}
