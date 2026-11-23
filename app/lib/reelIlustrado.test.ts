import { describe, expect, it } from "vitest";
import { enmascararCorreo, estadoReelIlustrado, reelIlustradoActivo } from "./reelIlustrado";

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

describe("estadoReelIlustrado (línea de estado en la página de admin)", () => {
  it("dice si está activo y cuántos correos tiene la variable, con el correo enmascarado y nunca la lista", () => {
    const e = estadoReelIlustrado(" Juan.Jose@Gmail.com ", "otra@x.co, juan.jose@gmail.com");
    expect(e).toEqual({ activo: true, correosEnLaVariable: 2, sesion: "j***e@gmail.com" });
    expect(JSON.stringify(e)).not.toContain("otra@x.co");
    expect(estadoReelIlustrado("juan.jose@gmail.com", undefined)).toEqual({ activo: false, correosEnLaVariable: 0, sesion: "j***e@gmail.com" });
  });
  it("enmascara correos cortos sin revelarlos", () => {
    expect(enmascararCorreo("ab@x.co")).toBe("a***@x.co");
  });
});
