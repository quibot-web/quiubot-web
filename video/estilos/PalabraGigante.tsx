// Layout "palabra gigante" (sistema de estilos, paso 1): el texto del
// gancho a pantalla completa, con la palabra clave en la luz de la marca
// -- también es la portada del reel (cuadro 0 ya legible, nada entra
// desde opacidad 0). En el momento del cambio (~45% de la narración del
// gancho) el texto sube y se va, y entra el visual del problema.
import { AbsoluteFill, interpolate, spring } from "remotion";
import { measureText } from "@remotion/layout-utils";
import { colorTextoSobre, hexConAlfa } from "../tema";
import type { PaletaNoche } from "./estilos";
import { ajustarTextoGigante, indicesPalabraClave } from "./textoGigante";

// 80% del ancho (no el 88% de la zona segura): la cámara acerca hasta
// ~10% (acercamiento + golpe) y el texto no puede tocar los bordes. Alto:
// de 22% a ~50%, antes de la franja de subtítulos (54%), con la etiqueta.
const ANCHO_PX = 1080 * 0.8;
const ALTO_PX = 1920 * 0.22;
const TOP_PORCENTAJE = 22;

export function PalabraGigante({
  texto,
  palabraClave,
  sticker,
  familia,
  paleta,
  frame,
  fps,
  cuadroSalida,
}: {
  texto: string;
  palabraClave: string;
  sticker?: string;
  familia: string;
  paleta: PaletaNoche;
  frame: number;
  fps: number;
  cuadroSalida: number;
}) {
  const textoMayus = texto.toLocaleUpperCase("es");
  const medir = (t: string, tamano: number) => measureText({ text: t, fontFamily: familia, fontSize: tamano, fontWeight: "900" }).width;
  const { tamano, lineas } = ajustarTextoGigante(textoMayus, medir, { ancho: ANCHO_PX, alto: ALTO_PX, maxLineas: 4, tamanoMin: 64, tamanoMax: 160, interlineado: 1.02 });
  const todas = textoMayus.split(/\s+/).filter(Boolean);
  const resaltadas = indicesPalabraClave(todas, palabraClave);

  // Entrada con golpe: arranca un poco grande y asienta (visible desde el
  // cuadro 0). Salida: sube y se desvanece en ~0,3 s.
  const entrada = spring({ frame, fps, config: { damping: 11, stiffness: 150 } });
  const escalaEntrada = interpolate(entrada, [0, 1], [1.06, 1]);
  const salida = frame >= cuadroSalida ? spring({ frame: frame - cuadroSalida, fps, config: { damping: 18, stiffness: 160 } }) : 0;

  // Índice (en el texto completo) de la primera palabra de cada línea.
  const inicioDeLinea = lineas.reduce<number[]>((acc, _l, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + lineas[i - 1].split(" ").length);
    return acc;
  }, []);
  return (
    <AbsoluteFill
      style={{
        opacity: 1 - salida,
        transform: `translateY(${-140 * salida}px) scale(${escalaEntrada})`,
        transformOrigin: "50% 36%",
      }}
    >
      <div style={{ position: "absolute", top: `${TOP_PORCENTAJE}%`, left: "6%", width: "88%", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        {sticker && (
          <div style={{ background: paleta.luz, color: colorTextoSobre(paleta.luz), fontSize: 42, fontWeight: 900, padding: "6px 22px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {sticker}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {lineas.map((linea, l) => (
            <div key={l} style={{ fontSize: tamano, fontWeight: 900, lineHeight: 1.02, whiteSpace: "nowrap", textAlign: "center", textShadow: `0 8px 40px ${hexConAlfa("#000000", 0.6)}` }}>
              {linea.split(" ").map((palabra, p) => {
                const clave = resaltadas.has(inicioDeLinea[l] + p);
                return (
                  <span key={p} style={{ color: clave ? paleta.luz : paleta.texto, textShadow: clave ? `0 0 36px ${hexConAlfa(paleta.luz, 0.55)}` : undefined }}>
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
