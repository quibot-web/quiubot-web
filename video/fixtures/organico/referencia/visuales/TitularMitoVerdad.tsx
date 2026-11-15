// Titular con la estructura "mito -> verdad" visible, v3 (ajuste
// explícito del usuario): texto GRANDE (como los titulares del Reel 1),
// en BLANCO sobre un recuadro de color SÓLIDO -- naranja con la frase
// tachada para el mito, verde para la verdad -- nunca texto de color
// directo sobre el fondo morado/azul (el contraste real no alcanzaba:
// ver COLOR_ALERTA_BLOQUE/COLOR_EXITO_BLOQUE en acento.ts, verificado
// con contrasteSuficiente() de video/tema.ts). Usa el MISMO cuadroCorte
// que el visual de la escena -- nunca deja el mito como título mientras
// se muestra el arreglo.
import { interpolate, spring, useVideoConfig, useCurrentFrame } from "remotion";
import { COLOR_ALERTA_BLOQUE, COLOR_EXITO_BLOQUE } from "./acento";

function Sello({ texto }: { texto: string }) {
  return (
    <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", opacity: 0.8, letterSpacing: 2, marginBottom: 8 }}>{texto}</div>
  );
}

// Mismo criterio que calcularFuenteBoton en video/escenas/Cta.tsx: una
// frase larga a tamaño fijo podía crecer a 3-4 líneas y el recuadro
// chocaba con la tarjeta de abajo (se vio en un render real con "Una
// foto real y clara de tu producto vende más") -- con frases cortas
// (hasta ~26 car.) se queda en el tamaño grande normal.
function calcularFuenteFrase(texto: string): number {
  if (texto.length <= 26) return 46;
  if (texto.length <= 38) return 38;
  return 32;
}

export function TitularMitoVerdad({
  mito,
  verdad,
  cuadroCorte,
}: {
  mito: string;
  verdad: string;
  cuadroCorte: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const esVerdad = frame >= cuadroCorte;
  const progresoEntrada = spring({ frame, fps, config: { damping: 14 } });
  // Un "pop" chico justo en el cambio, para que el salto mito->verdad se
  // sienta (no un corte seco de texto).
  const progresoCambio = spring({ frame: frame - cuadroCorte, fps, config: { damping: 13 } });
  const fontSize = calcularFuenteFrase(esVerdad ? verdad : mito);

  return (
    <div
      style={{
        position: "absolute",
        top: "9%",
        left: "50%",
        transform: `translateX(-50%) translateY(${interpolate(progresoEntrada, [0, 1], [16, 0])}px) scale(${esVerdad ? interpolate(progresoCambio, [0, 1], [0.92, 1]) : 1})`,
        opacity: progresoEntrada,
        maxWidth: "88%",
        background: esVerdad ? COLOR_EXITO_BLOQUE : COLOR_ALERTA_BLOQUE,
        borderRadius: 28,
        padding: "26px 34px",
        textAlign: "center",
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
      }}
    >
      {esVerdad ? (
        <>
          <Sello texto="VERDAD" />
          <div style={{ fontSize, fontWeight: 800, color: "#fff", lineHeight: 1.12 }}>{verdad}</div>
        </>
      ) : (
        <>
          <Sello texto="MITO" />
          <div style={{ fontSize, fontWeight: 800, color: "#fff", lineHeight: 1.12, textDecoration: "line-through" }}>{mito}</div>
        </>
      )}
    </div>
  );
}
