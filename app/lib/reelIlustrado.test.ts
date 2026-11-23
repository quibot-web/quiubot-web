import { describe, expect, it } from "vitest";
import { reelIlustradoActivo } from "./reelIlustrado";

describe("reelIlustradoActivo", () => {
  it("solo las cuentas de la lista, sin importar mayúsculas ni espacios", () => {
    expect(reelIlustradoActivo("Juan@Ejemplo.com", " juan@ejemplo.com , otra@x.co ")).toBe(true);
    expect(reelIlustradoActivo("cliente@tienda.com", "juan@ejemplo.com")).toBe(false);
  });
  it("sin variable o sin correo, nadie", () => {
    expect(reelIlustradoActivo("juan@ejemplo.com", undefined)).toBe(false);
    expect(reelIlustradoActivo("juan@ejemplo.com", "")).toBe(false);
    expect(reelIlustradoActivo(null, "juan@ejemplo.com")).toBe(false);
  });
});
