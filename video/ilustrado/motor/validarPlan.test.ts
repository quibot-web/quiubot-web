import { describe, expect, it } from "vitest";
import { NARRACION_PROTOTIPO } from "../guionPrototipo";
import { PLAN_PROTOTIPO } from "../planPrototipo";
import { ajustarPlanConTiempos, validarPlanIlustrado } from "./validarPlan";

const ESCENAS = [
  { id: "e1", narracion: "Pagas anuncios y nadie te compra hoy" }, // 7
  { id: "e2", narracion: "Cada vez que pasa se te va una moneda" }, // 8
];
const plan = (frases: unknown) => ({ frases });

describe("validarPlanIlustrado", () => {
  it("el plan del prototipo cumple todas las reglas", () => {
    expect(validarPlanIlustrado(PLAN_PROTOTIPO, NARRACION_PROTOTIPO)).toEqual([]);
  });

  it("datos reales: el plan no acepta NINGÚN campo de texto para la pantalla (precio, descuento, reseñas, respuesta del chat)", () => {
    for (const extra of [{ precio: "$45.000" }, { descuento: "30%" }, { estrellas: 5 }, { texto: "Envío gratis" }]) {
      const p = plan([
        { escena_id: "e1", acciones: [{ escena: "feed", accion: "aparece_anuncio", palabra: 1, ...extra }] },
        { escena_id: "e2", acciones: [{ escena: "billetera", accion: "sale_moneda", palabra: 7 }] },
      ]);
      expect(validarPlanIlustrado(p, ESCENAS).join(" ")).toMatch(/Unrecognized key/);
    }
    const conRespuesta = { frases: [{ escena_id: "e1", acciones: [{ escena: "chat", accion: "responde", palabra: 0 }] }], respuesta_chat: "¡Sí! Envío gratis" };
    expect(validarPlanIlustrado(conRespuesta, ESCENAS).join(" ")).toMatch(/Unrecognized key/);
  });

  it("exige una entrada por frase, en orden, y movimiento desde la palabra 0 o 1", () => {
    expect(validarPlanIlustrado(plan([{ escena_id: "e1", acciones: [{ escena: "feed", accion: "desliza", palabra: 0 }] }]), ESCENAS).join(" ")).toMatch(/una entrada por frase/);
    const tarde = plan([
      { escena_id: "e1", acciones: [{ escena: "feed", accion: "desliza", palabra: 3 }] },
      { escena_id: "e2", acciones: [{ escena: "feed", accion: "desliza", palabra: 2 }] },
    ]);
    expect(validarPlanIlustrado(tarde, ESCENAS).join(" ")).toMatch(/palabra 0 o 1/);
  });

  it("ritmo: nunca más de 7 palabras sin cambio, tampoco al final", () => {
    const hueco = plan([
      { escena_id: "e1", acciones: [{ escena: "feed", accion: "desliza", palabra: 0 }] },
      { escena_id: "e2", acciones: [{ escena: "feed", accion: "desliza", palabra: 4 }] },
    ]);
    expect(validarPlanIlustrado(hueco, ESCENAS).join(" ")).toMatch(/palabras sin ningún cambio/);
  });

  it("acciones seguidas en lugares distintos van separadas al menos 2 palabras (feed, chat y perfil son el mismo lugar)", () => {
    const juntas = plan([
      { escena_id: "e1", acciones: [{ escena: "feed", accion: "aparece_anuncio", palabra: 1 }, { escena: "billetera", accion: "sale_moneda", palabra: 2 }] },
      { escena_id: "e2", acciones: [{ escena: "billetera", accion: "sale_moneda", palabra: 7 }] },
    ]);
    expect(validarPlanIlustrado(juntas, ESCENAS).join(" ")).toMatch(/lugares distintos/);
    // Mismo celular: no les aplica la separación entre lugares, sí la
    // permanencia de 4 palabras por pantalla.
    const mismoCelular = plan([
      { escena_id: "e1", acciones: [{ escena: "feed", accion: "aparece_anuncio", palabra: 1 }, { escena: "chat", accion: "llega_mensaje", palabra: 5 }, { escena: "chat", accion: "llega_mensaje", palabra: 6 }] },
      { escena_id: "e2", acciones: [{ escena: "chat", accion: "responde", palabra: 3 }, { escena: "perfil", accion: "aparece", palabra: 7 }] },
    ]);
    expect(validarPlanIlustrado(mismoCelular, ESCENAS)).toEqual([]);
  });

  it("acción que no existe en la escena: el mensaje lista las que sí hay", () => {
    const malo = plan([
      { escena_id: "e1", acciones: [{ escena: "billetera", accion: "explota", palabra: 0 }] },
      { escena_id: "e2", acciones: [{ escena: "billetera", accion: "sale_moneda", palabra: 4 }] },
    ]);
    expect(validarPlanIlustrado(malo, ESCENAS).join(" ")).toMatch(/no tiene la acción "explota" \(tiene: sale_moneda/);
  });
});

describe("ajustarPlanConTiempos", () => {
  it("corre a la palabra siguiente una acción de otro lugar que quedó a menos de 0,6 s de la anterior", () => {
    const p = { frases: [{ escena_id: "e1", acciones: [{ escena: "chat" as const, accion: "se_vuelve_venta", palabra: 1 }, { escena: "billetera" as const, accion: "recibe_moneda", palabra: 2 }] }] };
    const tiempos = [{ escena_id: "e1", palabras: [0, 0.4, 0.6, 0.9, 1.4, 1.8].map((inicio_s) => ({ inicio_s })) }];
    const { plan: ajustado, ajustes } = ajustarPlanConTiempos(p, tiempos);
    expect(ajustado.frases[0].acciones[1].palabra).toBe(4); // 0,6 y 0,9 quedan a menos de 0,6 s de 0,4 -> palabra 4 (1,4 s)
    expect(ajustes).toHaveLength(1);
    expect(p.frases[0].acciones[1].palabra).toBe(2); // no muta el original
  });
});
