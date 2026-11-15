// Visual "flujo de pasos" (Fase A): 3 cajas conectadas por un conector
// que se "enciende" en orden. Mismo criterio de timing que
// video/escenas/tipos.ts (cuadrosPorItemListaNumerada) -- se reescribe
// la fórmula acá mismo (no se importa) para no acoplar este reel de
// referencia, que no pasa por el sistema Escena, a ese archivo.
//
// A diferencia de "un item por pantalla" (ListaNumerada.tsx), aquí los
// pasos se ACUMULAN: una vez una caja se enciende, se queda encendida
// (no vuelve a apagarse) -- con solo 3 pasos cortos, verlos encenderse
// y quedarse así se lee como un flujo que avanza, no como un carrusel.
import { interpolate, spring } from "remotion";
import { colorMasContraste, colorTextoSobre, type TemaGuion } from "../../../../tema";

export function cuadrosPorPaso(duracionS: number, fps: number, totalPasos: number): number {
  return Math.max(10, Math.floor((duracionS * fps) / totalPasos));
}

// Conector simple (barra vertical con background-color), no un glifo de
// texto ("↓" -- se probó primero y en el render real el glifo no tenía
// trazo, el espacio quedaba reservado pero invisible). Se posiciona con
// position:absolute dentro de un contenedor position:relative, NUNCA
// como hijo normal del flex column de abajo: un div vacío (sin texto,
// sin tamaño de contenido propio) adentro de un flex-column se comprime
// a 0 por el flex-shrink:1 por defecto antes que las cajas (que sí
// tienen contenido de texto, con un tamaño mínimo propio) -- se probó
// en el render real: con flex normal, el conector quedaba invisible
// aunque el código "se viera" correcto.
function Flecha({ activa, color }: { activa: boolean; color: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: -24,
        left: "50%",
        transform: "translateX(-50%)",
        width: 8,
        height: 24,
        borderRadius: 4,
        background: activa ? color : "rgba(255,255,255,0.3)",
      }}
    />
  );
}

function Caja({ texto, activa, progreso, colorActivo, colorTexto }: { texto: string; activa: boolean; progreso: number; colorActivo: string; colorTexto: string }) {
  return (
    <div
      style={{
        width: "84%",
        padding: "26px 30px",
        borderRadius: 24,
        background: activa ? colorActivo : "rgba(255,255,255,0.12)",
        color: activa ? colorTexto : "rgba(255,255,255,0.65)",
        fontSize: 36,
        fontWeight: 800,
        textAlign: "center",
        lineHeight: 1.18,
        boxShadow: activa ? "0 10px 26px rgba(0,0,0,0.3)" : "none",
        transform: `scale(${activa ? interpolate(progreso, [0, 1], [0.92, 1]) : 1})`,
      }}
    >
      {texto}
    </div>
  );
}

export function FlujoPasos({
  frame,
  fps,
  duracionS,
  titulo,
  pasos,
  tema,
  colorTexto,
}: {
  frame: number;
  fps: number;
  duracionS: number;
  titulo: string;
  pasos: string[];
  tema: TemaGuion;
  colorTexto: string;
}) {
  const colorActivo = colorMasContraste([tema.color_secundario, tema.color_primario], tema.color_primario, colorTexto);
  const colorTextoActivo = colorTextoSobre(colorActivo);
  const porPaso = cuadrosPorPaso(duracionS, fps, pasos.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 34, padding: "0 8%" }}>
      <div style={{ fontSize: 34, fontWeight: 700, color: colorTexto, opacity: 0.9, marginBottom: 10, textAlign: "center" }}>{titulo}</div>
      {pasos.map((texto, i) => {
        const cuadroActivacion = i * porPaso + fps * 0.15;
        const activa = frame >= cuadroActivacion;
        const progreso = spring({ frame: frame - cuadroActivacion, fps, config: { damping: 13 } });
        return (
          <div key={i} style={{ position: "relative" }}>
            {i > 0 && <Flecha activa={activa} color={colorActivo} />}
            <Caja texto={texto} activa={activa} progreso={progreso} colorActivo={colorActivo} colorTexto={colorTextoActivo} />
          </div>
        );
      })}
    </div>
  );
}
