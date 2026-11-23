// Subtítulo karaoke corto (2-3 palabras) arriba, debajo de lo que tapa
// Instagram (ZONA_SEGURA.arriba = 14%).
import { useMemo } from "react";
import { colorTextoSobre } from "../../tema";
import { quitarGlifosFueraDeFuentes } from "../../glifos";
import { CUADROS_CHIP_SERIE } from "../../capas/ChipSerie";
import type { LineaDeTiempo } from "../tiempoIlustrado";

type Grupo = { desde: number; hasta: number; palabras: LineaDeTiempo["palabras"] };

export function gruposSubtitulo(l: LineaDeTiempo): Grupo[] {
  const res: Grupo[] = [];
  let actual: LineaDeTiempo["palabras"] = [];
  l.palabras.forEach((p, i) => {
    actual.push(p);
    const cierra = /[.,:;?!…]$/.test(p.texto) || actual.length === 3 || i === l.palabras.length - 1 || l.palabras[i + 1].escena !== p.escena;
    if (cierra) {
      res.push({ desde: actual[0].desde, hasta: actual[actual.length - 1].hasta, palabras: actual });
      actual = [];
    }
  });
  return res;
}

// etiqueta: "Parte 1 de 2" al inicio de un reel de serie, dentro de la
// misma píldora (el celular está anclado justo debajo del subtítulo).
export function Subtitulo({ linea, frame, luz, etiqueta }: { linea: LineaDeTiempo; frame: number; luz: string; etiqueta?: string | null }) {
  const todos = useMemo(() => gruposSubtitulo(linea), [linea]);
  if (todos.length === 0) return null;
  const grupo = [...todos].reverse().find((g) => frame >= g.desde) ?? todos[0];
  return (
    <div style={{ position: "absolute", top: "14.5%", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", maxWidth: 1000, gap: 14, background: "rgba(10,10,18,0.82)", borderRadius: 18, padding: "12px 24px", fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>
        {etiqueta && frame < CUADROS_CHIP_SERIE && (
          <span style={{ padding: "4px 14px", borderRadius: 10, border: "3px solid #fff", fontSize: 32, letterSpacing: 1 }}>{etiqueta}</span>
        )}
        {grupo.palabras.map((p, i) => {
          const activa = frame >= p.desde && frame < p.hasta + 2;
          return (
            <span key={i} style={{ padding: "0 8px", borderRadius: 10, background: activa ? luz : "transparent", color: activa ? colorTextoSobre(luz) : "#fff" }}>
              {quitarGlifosFueraDeFuentes(p.texto)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
