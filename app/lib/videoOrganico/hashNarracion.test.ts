import { describe, it, expect } from "vitest";
import { calcularHashNarracion, vozDesactualizada } from "./hashNarracion";

describe("calcularHashNarracion / vozDesactualizada", () => {
  const escenas = [{ narracion: "Hola a todos" }, { narracion: "Sígueme para más" }];

  it("el mismo contenido siempre da el mismo hash", () => {
    expect(calcularHashNarracion(escenas)).toBe(calcularHashNarracion([...escenas]));
  });

  it("cambiar una sola narracion cambia el hash", () => {
    const hashOriginal = calcularHashNarracion(escenas);
    const editado = [{ narracion: "Hola a todos" }, { narracion: "Síguenos ya" }];
    expect(calcularHashNarracion(editado)).not.toBe(hashOriginal);
  });

  it("vozDesactualizada: false si el hash guardado coincide, true si no coincide o si no hay hash guardado", () => {
    const hash = calcularHashNarracion(escenas);
    expect(vozDesactualizada(hash, escenas)).toBe(false);
    expect(vozDesactualizada(null, escenas)).toBe(true);
    expect(vozDesactualizada("un-hash-viejo", escenas)).toBe(true);
  });
});
