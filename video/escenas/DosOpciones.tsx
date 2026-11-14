import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colorMasContraste, colorTextoSobre } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import { ZONA_SEGURA } from "../capas/ZonaSegura";
import type { PropsEscena } from "./tipos";

// Única receta orgánica (pregunta_comunidad) sin ninguna escena
// existente que le sirva -- "elige A o B". Las dos tarjetas entran una
// después de la otra, "VS" al centro como separador -- no hay ganador
// real en el guion (la IA nunca decide cuál es la "correcta"), la
// respuesta la da el espectador en los comentarios.
export function DosOpciones({ escena, tema }: PropsEscena<"dos_opciones">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { opcion_a, opcion_b } = escena.params;
  const colorTexto = colorTextoSobre(tema.color_primario);
  const colorTarjetaA = tema.color_primario;
  const colorTarjetaB = colorMasContraste([tema.color_secundario], tema.color_primario, colorTextoSobre(tema.color_primario));
  const progresoA = spring({ frame, fps, config: { damping: 14 } });
  const progresoB = spring({ frame: frame - 10, fps, config: { damping: 14 } });
  const progresoVs = spring({ frame: frame - 18, fps, config: { damping: 10 } });

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: `${ZONA_SEGURA.arriba}% 8% ${ZONA_SEGURA.abajo}%`,
          gap: 20,
        }}
      >
        <Tarjeta letra="A" texto={opcion_a} color={colorTarjetaA} colorTexto={colorTextoSobre(colorTarjetaA)} progreso={progresoA} />
        <div
          style={{
            fontSize: 44,
            fontWeight: 900,
            color: colorTexto,
            opacity: progresoVs,
            transform: `scale(${progresoVs})`,
          }}
        >
          VS
        </div>
        <Tarjeta letra="B" texto={opcion_b} color={colorTarjetaB} colorTexto={colorTextoSobre(colorTarjetaB)} progreso={progresoB} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Tarjeta({ letra, texto, color, colorTexto, progreso }: { letra: string; texto: string; color: string; colorTexto: string; progreso: number }) {
  return (
    <div
      style={{
        width: "100%",
        background: color,
        borderRadius: 24,
        padding: "28px 32px",
        display: "flex",
        alignItems: "center",
        gap: 20,
        opacity: progreso,
        transform: `translateX(${interpolate(progreso, [0, 1], [-30, 0])}px)`,
        boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          fontWeight: 900,
          color: colorTexto,
          flexShrink: 0,
        }}
      >
        {letra}
      </div>
      <div style={{ fontSize: 46, fontWeight: 700, color: colorTexto, lineHeight: 1.1 }}>{texto}</div>
    </div>
  );
}
