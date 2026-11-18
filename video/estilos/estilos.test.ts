import { describe, expect, it } from "vitest";
import { contrasteHex } from "../tema";
import { GuionSchema } from "../guion.schema";
import { fixtureConsejosNumerados } from "../fixtures/organico/consejosNumerados";
import { asignarEstilo, layoutDeEscena, paletaNoche } from "./estilos";

const escena = (id: string, bloque: string, tipo: string, visual?: string) => ({ id, bloque, tipo, ...(visual ? { visual: { tipo: visual } } : {}) });

describe("asignarEstilo (paso 1: Noche)", () => {
  it("gancho de texto -> palabra gigante; visuales sin interfaz -> objeto protagonista; maquetas y CTA -> tarjeta flotante", () => {
    const estilo = asignarEstilo([
      escena("e1", "gancho", "gancho_texto", "comparacion_foto"),
      escena("e2", "valor", "gancho_texto", "icono_palabra"),
      escena("e3", "valor", "lista_numerada", "anuncio_boton"),
      escena("e4", "valor", "lista_numerada", "checklist"),
      escena("e5", "marca", "revelacion_marca", "celular_chat"),
      escena("e6", "cta", "cta", "boton_estado"),
    ]);
    expect(estilo).toEqual({
      id: "noche",
      version: 1,
      layouts: { e1: "palabra_gigante", e2: "objeto_protagonista", e3: "tarjeta_flotante", e4: "objeto_protagonista", e5: "tarjeta_flotante", e6: "tarjeta_flotante" },
    });
  });

  it("un gancho que no es de texto no puede ser palabra gigante", () => {
    expect(layoutDeEscena(escena("e1", "gancho", "producto_hero", "contador"))).toBe("objeto_protagonista");
  });

  it("el schema del guion conserva el estilo al validar (no lo descarta) y sigue aceptando guiones sin estilo", () => {
    const conEstilo = { ...fixtureConsejosNumerados, estilo: asignarEstilo(fixtureConsejosNumerados.escenas) };
    expect(GuionSchema.parse(conEstilo).estilo?.id).toBe("noche");
    expect(GuionSchema.parse(fixtureConsejosNumerados).estilo).toBeUndefined();
  });
});

describe("paletaNoche: contraste con cualquier paleta de marca", () => {
  const paletas = [
    ["#534AB7", "#B9B2FF"], // Quiubot
    ["#FFF3C4", "#FFE08A"], // pastel muy claro
    ["#0A0A0A", "#1E1E1E"], // casi negro
    ["#E63946", "#1D3557"], // saturado + oscuro
    ["#00A86B", "#FFFFFF"], // verde + blanco
  ];
  for (const [primario, secundario] of paletas) {
    it(`${primario} / ${secundario}`, () => {
      const p = paletaNoche({ color_primario: primario, color_secundario: secundario });
      for (const texto of [p.texto, p.alerta, p.exito]) expect(contrasteHex(texto, p.fondo)).toBeGreaterThanOrEqual(4.5);
      expect(contrasteHex(p.textoSuave, p.fondo)).toBeGreaterThanOrEqual(4.5);
      // La luz de la marca es decorativa/ícono: 3:1 mínimo.
      expect(contrasteHex(p.luz, p.fondo)).toBeGreaterThanOrEqual(3);
    });
  }
});
