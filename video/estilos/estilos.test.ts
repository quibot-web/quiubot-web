import { describe, expect, it } from "vitest";
import { contrasteHex } from "../tema";
import { GuionSchema } from "../guion.schema";
import { fixtureConsejosNumerados } from "../fixtures/organico/consejosNumerados";
import { asignarEstilo, estilosDisponibles, fondosColorPleno, layoutDeEscena, paletaDeEstilo, paletaNoche } from "./estilos";
import { colorTextoSobre } from "../tema";

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
      version: 2,
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

describe("paso 2: Color pleno y Foto", () => {
  const escenas = [
    escena("e1", "gancho", "gancho_texto", "comparacion_foto"),
    escena("e2", "valor", "x", "contador"),
    escena("e3", "valor", "x", "comparacion"),
    escena("e4", "valor", "x", "comparacion_foto"),
    escena("e5", "marca", "x", "icono_palabra"),
    escena("e6", "cta", "cta", "boton_estado"),
  ];

  it("Color pleno: contador -> golpe de dato, comparaciones -> pantalla dividida", () => {
    expect(asignarEstilo(escenas, "color_pleno").layouts).toEqual({
      e1: "palabra_gigante",
      e2: "golpe_de_dato",
      e3: "pantalla_dividida",
      e4: "pantalla_dividida",
      e5: "objeto_protagonista",
      e6: "tarjeta_flotante",
    });
  });

  it("Foto: la foto de borde a borde; sin fotos, Foto cae a Noche (y no se ofrece)", () => {
    expect(asignarEstilo(escenas, "foto", { tieneFotos: true }).layouts.e4).toBe("foto_borde_a_borde");
    expect(asignarEstilo(escenas, "foto", { tieneFotos: false }).id).toBe("noche");
    expect(estilosDisponibles(false)).toEqual(["noche", "color_pleno"]);
    expect(estilosDisponibles(true)).toContain("foto");
  });

  const paletas = [
    ["#534AB7", "#B9B2FF"],
    ["#FFF3C4", "#FFE08A"],
    ["#0A0A0A", "#1E1E1E"],
    ["#E63946", "#1D3557"],
    ["#00A86B", "#FFFFFF"],
    ["#808080", "#7F7F7F"], // gris medio: ni blanco ni negro llegan solos a 4,5
  ];
  for (const [primario, secundario] of paletas) {
    it(`Color pleno ${primario} / ${secundario}: texto legible sobre cada fondo y sobre la placa`, () => {
      for (const fondo of fondosColorPleno({ color_primario: primario, color_secundario: secundario })) {
        expect(contrasteHex(colorTextoSobre(fondo), fondo)).toBeGreaterThanOrEqual(4.5);
      }
      const p = paletaDeEstilo("color_pleno", { color_primario: primario, color_secundario: secundario });
      for (const texto of [p.texto, p.textoSuave, p.alerta, p.exito]) expect(contrasteHex(texto, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(contrasteHex(p.luz, "#FFFFFF")).toBeGreaterThanOrEqual(3);
    });
  }
});
