import { describe, expect, it } from "vitest";
import { contrasteHex } from "../tema";
import { GuionSchema } from "../guion.schema";
import { fixtureConsejosNumerados } from "../fixtures/organico/consejosNumerados";
import { acentoComplementario, acentoParaOscuro, asignarEstilo, elegirEstilo, estilosDisponibles, fondosColorPleno, idsFotosSinTexto, layoutDeEscena, paletaDeEstilo, paletaNoche } from "./estilos";
import { colorTextoSobre } from "../tema";

const escena = (id: string, bloque: string, tipo: string, visual?: string, mediaId?: string) => ({ id, bloque, tipo, ...(visual ? { visual: { tipo: visual, ...(mediaId ? { media_id: mediaId } : {}) } } : {}) });

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
      version: 4,
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
    escena("e4", "valor", "x", "comparacion_foto", "m4"),
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
    expect(asignarEstilo(escenas, "foto", { fotosSinTexto: ["m4"] }).layouts.e4).toBe("foto_borde_a_borde");
    expect(asignarEstilo(escenas, "foto", { fotosSinTexto: [] }).id).toBe("noche");
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

describe("Foto: solo con fotos reales sin texto", () => {
  const medios = { foto: { tipo: "imagen" }, captura: { tipo: "imagen" }, sinAnalisis: { tipo: "imagen" }, clip: { tipo: "video" } };
  const analisis = { foto: { tiene_texto: false }, captura: { tiene_texto: true }, clip: { tiene_texto: false } };

  it("una captura con texto, una imagen sin análisis o un video nunca sirven de fondo", () => {
    expect(idsFotosSinTexto(medios, analisis)).toEqual(["foto"]);
    expect(idsFotosSinTexto(medios, undefined)).toEqual([]);
  });

  it("comparacion_foto en Foto: borde a borde solo si SU foto no tiene texto", () => {
    const escenas = [escena("e1", "valor", "x", "comparacion_foto", "captura")];
    expect(asignarEstilo(escenas, "foto", { fotosSinTexto: ["foto"] }).layouts.e1).toBe("objeto_protagonista");
    expect(asignarEstilo([escena("e1", "valor", "x", "comparacion_foto", "foto")], "foto", { fotosSinTexto: ["foto"] }).layouts.e1).toBe("foto_borde_a_borde");
  });
});

describe("rotación de estilos (paso 3)", () => {
  const sinFoto = estilosDisponibles(false);
  const conFoto = estilosDisponibles(true);

  it("sin historial: Noche; nunca repite el estilo de la pieza anterior", () => {
    expect(elegirEstilo([], sinFoto)).toBe("noche");
    expect(elegirEstilo(["noche"], sinFoto)).toBe("color_pleno");
    expect(elegirEstilo(["color_pleno"], sinFoto)).toBe("noche");
  });

  it("el menos usado en las últimas 6, y en empate el usado hace más tiempo", () => {
    expect(elegirEstilo(["color_pleno", "noche", "noche", "foto", "noche", "color_pleno"], conFoto)).toBe("foto");
    expect(elegirEstilo(["noche", "foto", "color_pleno"], conFoto)).toBe("color_pleno");
  });

  it("piezas sin estilo (null) no cuentan, y una secuencia larga alterna sin repetir", () => {
    const historial: (string | null)[] = [null, null];
    for (let i = 0; i < 12; i++) {
      const e = elegirEstilo(historial, conFoto);
      expect(e).not.toBe(historial[0]);
      historial.unshift(e);
    }
    for (const e of conFoto) expect(historial.slice(0, 6).filter((h) => h === e).length).toBe(2);
  });

  it("sin fotos sin texto, Foto nunca sale", () => {
    for (const h of [[], ["noche"], ["color_pleno"], ["noche", "color_pleno"]]) expect(elegirEstilo(h, sinFoto)).not.toBe("foto");
  });
});

describe("Color pleno: escenas consecutivas que se notan", () => {
  for (const [nombre, primario, secundario] of [
    ["Quiubot", "#534AB7", "#B9B2FF"],
    ["tonos cercanos", "#6A5ACD", "#7B68EE"],
    ["un solo color", "#2A9D8F", "#2A9D8F"],
  ]) {
    it(nombre, () => {
      const fondos = fondosColorPleno({ color_primario: primario, color_secundario: secundario });
      // 6 escenas: alternan oscuro (texto blanco) y claro (texto tinta).
      for (let i = 0; i < 6; i++) {
        const actual = fondos[i % fondos.length];
        const siguiente = fondos[(i + 1) % fondos.length];
        expect(colorTextoSobre(actual)).not.toBe(colorTextoSobre(siguiente));
        expect(contrasteHex(actual, siguiente)).toBeGreaterThanOrEqual(3);
        expect(contrasteHex(colorTextoSobre(actual), actual)).toBeGreaterThanOrEqual(4.5);
      }
      // El acento es otro tono (complementario), no otro lila.
      expect(acentoComplementario(primario).toLowerCase()).not.toBe(primario.toLowerCase());
    });
  }
});

describe("acento oscuro sin tonos barrosos", () => {
  it("el morado de Quiubot no da verde oliva: el acento oscuro cae fuera de amarillos/naranjas", () => {
    const hex = acentoParaOscuro("#534AB7").replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    // Amarillo/naranja: rojo y verde altos con azul bajo.
    expect(r > 150 && g > 120 && b < 90).toBe(false);
  });
});

describe("Foto: la foto nítida es protagonista, no solo en el cierre", () => {
  it("el primer consejo que lo admite y el cierre van con la foto nítida; gancho y pantalla dividida no se tocan", () => {
    const escenas = [
      escena("e1", "gancho", "gancho_texto", "comparacion_foto", "f"),
      escena("e2", "valor", "x", "comparacion"),
      escena("e3", "valor", "x", "icono_palabra"),
      escena("e4", "valor", "x", "checklist"),
      escena("e5", "marca", "x", "anuncio_boton"),
      escena("e6", "cta", "cta", "boton_estado"),
    ];
    const { layouts } = asignarEstilo(escenas, "foto", { fotosSinTexto: ["f"] });
    expect(layouts.e1).toBe("palabra_gigante");
    expect(layouts.e2).toBe("pantalla_dividida");
    expect(layouts.e3).toBe("foto_borde_a_borde");
    expect(layouts.e4).toBe("objeto_protagonista");
    expect(layouts.e5).toBe("foto_borde_a_borde");
    expect(layouts.e6).toBe("tarjeta_flotante");
  });
});
