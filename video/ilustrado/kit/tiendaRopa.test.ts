// Tienda de ropa (revisión del episodio 1 de Historia narrada, 24 nov
// 2026): lugar propio con percheros, ropa doblada, maniquí, espejo y
// probador; la dueña acomoda la ropa; y las emociones con motivo.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { validarPlanIlustrado } from "../motor/validarPlan";
import { crearRegistro } from "../motor/registro";
import { EscenaKit } from "./EscenaKit";
import { piezasDeComposicion, urlsSinRasterizar } from "./piezas";

const escenas = [
  { id: "e1", narracion: "Imagina que eres dueña de una tienda de ropa." },
  { id: "e2", narracion: "Tienes trescientos mil pesos para anuncios este mes." },
];
const composicion = (fondo: "tienda" | "tienda_ropa") => ({
  id: "k_ropa",
  fondo,
  personajes: [{ id: "duena", tipo: "emprendedora" as const, posicion: "centro_izquierda" as const, mira: "derecha" as const }],
  objetos: fondo === "tienda_ropa" ? [{ id: "perchero", tipo: "perchero" as const, lugar: "piso_centro" as const }] : [],
});
const plan = (fondo: "tienda" | "tienda_ropa", accion: string, objetivo?: string) => ({
  composiciones: [composicion(fondo)],
  frases: [
    { escena_id: "e1", acciones: [{ escena: "k_ropa", accion, palabra: 1, ...(objetivo ? { objetivo } : {}) }, { escena: "k_ropa", accion: "duena.quieto", palabra: 6 }] },
    { escena_id: "e2", acciones: [{ escena: "billetera", accion: "se_llena", palabra: 2 }, { escena: "billetera", accion: "sale_moneda", palabra: 6 }] },
  ],
});

describe("tienda de ropa", () => {
  it("si la voz habla de ropa, el lugar es la tienda de ropa (no la de frascos)", () => {
    expect(validarPlanIlustrado(plan("tienda", "duena.saluda"), escenas).join(" ")).toMatch(/tienda_ropa/);
    expect(validarPlanIlustrado(plan("tienda_ropa", "duena.acomoda", "perchero"), escenas).join(" ")).not.toMatch(/habla de ropa/);
  });

  it("celebrar o aplaudir solo con motivo en la frase", () => {
    expect(validarPlanIlustrado(plan("tienda_ropa", "duena.celebra"), escenas).join(" ")).toMatch(/sin motivo/);
    const conMotivo = [{ id: "e1", narracion: "¡Vendiste toda la ropa del perchero esta semana!" }, escenas[1]];
    expect(validarPlanIlustrado(plan("tienda_ropa", "duena.celebra"), conMotivo).join(" ")).not.toMatch(/sin motivo/);
  });

  it("se dibuja con imágenes (perchero, fondo, la dueña acomodando), sin <svg> por cuadro", () => {
    const r = crearRegistro([composicion("tienda_ropa")], "s");
    const cu = r.composicion("k_ropa")!;
    const piezas = piezasDeComposicion(cu).map((p) => p.clave);
    expect(piezas).toContain("perchero");
    expect(piezas.some((k) => k.startsWith("fondo:tienda_ropa"))).toBe(true);
    const html = renderToStaticMarkup(createElement(EscenaKit, { cu, frame: 30, fps: 30, d: { "duena.acomoda": [10] }, imagenes: urlsSinRasterizar(piezasDeComposicion(cu)), objetivos: [{ accion: "duena.acomoda", cuadro: 10, objetivo: "perchero" }] }));
    expect(html).not.toMatch(/<svg/);
    // Nadie de ambiente parado en la puerta (x 330).
    for (const u of cu.personajes) if (u.per.id.startsWith("extra")) expect(Math.abs(u.cx - 330)).toBeGreaterThan(260);
  });
});
