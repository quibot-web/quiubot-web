import { describe, expect, it } from "vitest";
import type { Guion } from "@/video/guion.schema";
import { rotuloEscena } from "./rotuloEscena";

const escena = (id: string, bloque: string, visual?: string) =>
  ({ id, bloque, tipo: "gancho_texto", duracion_s: 2, params: {}, ...(visual ? { visual: { tipo: visual, eventos: [] } } : {}) }) as unknown as Guion["escenas"][number];

describe("rotuloEscena", () => {
  const escenas = [
    escena("e1", "gancho", "icono_palabra"),
    escena("e2", "valor", "comparacion"),
    escena("e3", "valor", "checklist"),
    escena("e4", "valor", "anuncio_boton"),
    escena("e5", "marca", "icono_palabra"),
    escena("e6", "cta", "boton_estado"),
  ];

  it("muestra el bloque real y el visual, nunca el tipo de escena", () => {
    expect(escenas.map((_, i) => rotuloEscena(escenas, i).bloque)).toEqual(["Gancho", "Consejo 1", "Consejo 2", "Consejo 3", "Cierre", "CTA"]);
    expect(rotuloEscena(escenas, 1).visual).toBe("comparación así no / así sí");
  });

  it("sin visual (reels sin voz): solo el bloque", () => {
    expect(rotuloEscena([escena("e1", "gancho")], 0)).toEqual({ bloque: "Gancho", visual: null });
  });
});
