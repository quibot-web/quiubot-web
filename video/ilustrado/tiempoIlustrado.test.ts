import { describe, expect, it } from "vitest";
import { camaraEnCuadro, construirLineaDeTiempo, silencioMasLargo } from "./tiempoIlustrado";
import { NARRACION_PROTOTIPO, tiemposSinteticos } from "./guionPrototipo";
import { colorTextoSobre, contrasteHex, mezclarColoresHex } from "../tema";
import { paletaNoche } from "../estilos/estilos";
import { ALTO_PANTALLA, ANCHO_PANTALLA, FRANJA_SEGURA, RECTS, encuadre, enfoques, eventosDe, puntosCamara, rectEnPantalla } from "./mundo";

describe("línea de tiempo del reel ilustrado", () => {
  it("escenas una después de la otra y cada palabra en su cuadro global", () => {
    const l = construirLineaDeTiempo(tiemposSinteticos(), 30);
    expect(l.escenas).toHaveLength(NARRACION_PROTOTIPO.length);
    for (let i = 1; i < l.escenas.length; i++) expect(l.escenas[i].desde).toBe(l.escenas[i - 1].desde + l.escenas[i - 1].duracion);
    expect(l.cuadroDePalabra("e1", 0)).toBe(0);
    expect(l.cuadroDePalabra("e1", 1)).toBe(9); // 0,3 s
    const palabras = l.palabras.map((p) => p.desde);
    expect([...palabras].sort((a, b) => a - b)).toEqual(palabras);
  });

  it("silencio más largo entre palabras: se mide sobre la línea ya compactada", () => {
    expect(silencioMasLargo(construirLineaDeTiempo(tiemposSinteticos(), 30))).toBeCloseTo(0.27, 1);
  });
});

describe("cámara continua", () => {
  const puntos = [
    { cuadro: 0, x: 0, y: 0, zoom: 1 },
    { cuadro: 30, x: 100, y: 200, zoom: 2 },
    { cuadro: 60, x: 100, y: 200, zoom: 2 },
  ];
  it("pasa por los puntos clave y se queda en los extremos", () => {
    expect(camaraEnCuadro(puntos, 0)).toMatchObject({ x: 0, y: 0, zoom: 1 });
    expect(camaraEnCuadro(puntos, 30)).toMatchObject({ x: 100, y: 200, zoom: 2 });
    expect(camaraEnCuadro(puntos, 999)).toMatchObject({ x: 100, zoom: 2 });
  });

  it("nunca corta: de un cuadro al siguiente se mueve poco (sin saltos)", () => {
    for (let f = 1; f <= 60; f++) {
      const a = camaraEnCuadro(puntos, f - 1);
      const b = camaraEnCuadro(puntos, f);
      expect(Math.abs(b.x - a.x)).toBeLessThan(10);
      expect(Math.abs(b.zoom - a.zoom)).toBeLessThan(0.12);
    }
  });
});

describe("subtítulo karaoke: contraste", () => {
  it("texto blanco y palabra activa sobre la píldora llegan a 4,5:1, aun con la pantalla blanca del celular detrás", () => {
    const pildora = mezclarColoresHex("#FFFFFF", "#0A0A12", 0.82); // peor caso: fondo blanco
    expect(contrasteHex("#FFFFFF", pildora)).toBeGreaterThanOrEqual(4.5);
    const luz = paletaNoche({ color_primario: "#534AB7", color_secundario: "#B9B2FF" }).luz;
    expect(contrasteHex(colorTextoSobre(luz), luz)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("escala: lo que la voz nombra ocupa al menos media pantalla (ronda 2)", () => {
  const linea = construirLineaDeTiempo(tiemposSinteticos(), 30);
  const ev = eventosDe(linea);
  const puntos = puntosCamara(ev, linea.duracionCuadros);
  for (const e of enfoques(ev)) {
    it(`"${e.palabra}": >= 50% del ancho o del alto, centrado en la franja segura`, () => {
      const r = rectEnPantalla(e.rect, camaraEnCuadro(puntos, e.cuadro));
      expect(Math.max(r.ancho / ANCHO_PANTALLA, r.alto / ALTO_PANTALLA)).toBeGreaterThanOrEqual(0.5);
      const centroY = r.y + r.alto / 2;
      expect(centroY).toBeGreaterThanOrEqual(FRANJA_SEGURA.arriba);
      expect(centroY).toBeLessThanOrEqual(FRANJA_SEGURA.abajo);
    });
  }

  it("los objetos que se encuadran enteros (billetera, elegidos, reloj + cliente, billetera + gráfica) caben en la franja segura", () => {
    for (const nombre of ["billetera", "elegidos", "relojYCliente", "billeteraYGrafica"] as const) {
      const r = rectEnPantalla(RECTS[nombre], encuadre(RECTS[nombre]));
      expect(r.y, nombre).toBeGreaterThanOrEqual(FRANJA_SEGURA.arriba - 1);
      expect(r.y + r.alto, nombre).toBeLessThanOrEqual(FRANJA_SEGURA.abajo + 1);
    }
  });
});
