import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colorMasContraste, colorTextoSobre } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import { cuadrosPorItemListaNumerada } from "./tipos";
import type { PropsEscena } from "./tipos";

export function ListaNumerada({ escena, tema, uso, medioDeFondo }: PropsEscena<"lista_numerada">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { titulo, items } = escena.params;
  const cuadrosPorItem = cuadrosPorItemListaNumerada(escena.duracion_s, fps, items.length);
  const colorTexto = colorTextoSobre(tema.color_primario);
  // Mismo criterio que el botón del cta y el recuadro de palabra_clave:
  // el círculo numerado usa el color que mejor contraste dé contra el
  // fondo real, nunca el secundario a ciegas (podía fundirse con el
  // primario en paletas donde los dos tonos son parecidos).
  const colorCirculo = colorMasContraste([tema.color_secundario, tema.color_primario], tema.color_primario, colorTexto);
  const colorNumero = colorTextoSobre(colorCirculo);

  // Esta escena ya NO dibuja su propio "X/Y" -- ese contador vive solo
  // en la capa global del bucle (capas/Bucle.tsx) cuando
  // bucle.indicador es "contador", para no mostrar dos contadores a la
  // vez ("error de contador doble").

  const esOrganico = uso === "organico";

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque={escena.bloque} organico={esOrganico} medioDeFondo={medioDeFondo} />
      {esOrganico ? (
        <ListaUnItemPorPantalla items={items} titulo={titulo} frame={frame} cuadrosPorItem={cuadrosPorItem} colorTexto={colorTexto} colorCirculo={colorCirculo} colorNumero={colorNumero} />
      ) : (
        <AbsoluteFill style={{ justifyContent: "center", padding: "0 8%" }}>
          <div style={{ fontSize: 60, fontWeight: 800, color: colorTexto, marginBottom: 36 }}>{titulo}</div>
          {items.map((item, i) => {
            const progreso = spring({ frame: frame - i * cuadrosPorItem, fps, config: { damping: 14 } });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  opacity: progreso,
                  transform: `scale(${interpolate(progreso, [0, 1], [0.85, 1])})`,
                  marginBottom: 28,
                }}
              >
                <div
                  style={{
                    width: 86,
                    height: 86,
                    borderRadius: "50%",
                    background: colorCirculo,
                    color: colorNumero,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 42,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <span style={{ color: colorTexto, fontSize: 64, fontWeight: 700, lineHeight: 1.08 }}>{item}</span>
              </div>
            );
          })}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

// "Un consejo por pantalla" (contenido orgánico, revisión de calidad):
// en vez de una lista chica que se acumula arriba, cada item ocupa la
// pantalla con letra grande y entra uno a la vez -- mismo cuadro por
// item que ya usa capas/Bucle.tsx para el contador "X/Y", así el chip
// de arriba sigue sincronizado con el item que de verdad se ve acá.
function ListaUnItemPorPantalla({
  items,
  titulo,
  frame,
  cuadrosPorItem,
  colorTexto,
  colorCirculo,
  colorNumero,
}: {
  items: string[];
  titulo: string;
  frame: number;
  cuadrosPorItem: number;
  colorTexto: string;
  colorCirculo: string;
  colorNumero: string;
}) {
  const { fps } = useVideoConfig();
  const indiceActivo = Math.min(items.length - 1, Math.floor(frame / cuadrosPorItem));
  const frameEnItem = frame - indiceActivo * cuadrosPorItem;
  const progreso = spring({ frame: frameEnItem, fps, config: { damping: 14 } });
  // Sale un poco antes de que termine su tramo, para no cortar en seco
  // justo cuando entra el siguiente.
  const salida = interpolate(frameEnItem, [cuadrosPorItem - 10, cuadrosPorItem], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacidad = Math.min(progreso, salida);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 10%", textAlign: "center" }}>
      <div style={{ fontSize: 34, fontWeight: 700, color: colorTexto, opacity: 0.85, marginBottom: 48 }}>{titulo}</div>
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: colorCirculo,
          color: colorNumero,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 58,
          marginBottom: 40,
          opacity: opacidad,
          transform: `scale(${interpolate(progreso, [0, 1], [0.8, 1])})`,
        }}
      >
        {indiceActivo + 1}
      </div>
      <span
        style={{
          color: colorTexto,
          fontSize: 92,
          fontWeight: 800,
          lineHeight: 1.08,
          opacity: opacidad,
          transform: `translateY(${interpolate(progreso, [0, 1], [24, 0])}px)`,
        }}
      >
        {items[indiceActivo]}
      </span>
    </AbsoluteFill>
  );
}
