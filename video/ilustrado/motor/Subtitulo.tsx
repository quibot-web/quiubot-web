// Subtítulo karaoke corto (2-3 palabras) arriba, debajo de lo que tapa
// Instagram (ZONA_SEGURA.arriba = 14%).
import { useMemo } from "react";
import { colorTextoSobre } from "../../tema";
import { quitarGlifosFueraDeFuentes } from "../../glifos";
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

export function Subtitulo({ linea, frame, luz }: { linea: LineaDeTiempo; frame: number; luz: string }) {
  const todos = useMemo(() => gruposSubtitulo(linea), [linea]);
  if (todos.length === 0) return null;
  const grupo = [...todos].reverse().find((g) => frame >= g.desde) ?? todos[0];
  return (
    <div style={{ position: "absolute", top: "14.5%", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", gap: 14, background: "rgba(10,10,18,0.82)", borderRadius: 18, padding: "12px 24px", fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>
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
