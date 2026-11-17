import { describe, it, expect } from "vitest";
import { silenciosLargosDesdeNivelesDb } from "./encontrarSilenciosLargos";

const VENTANA_S = 0.05;
const UMBRAL_DB = -45;

describe("silenciosLargosDesdeNivelesDb", () => {
  it("sin niveles por debajo del umbral, no encuentra nada", () => {
    const niveles = new Array(40).fill(-10); // "con audio" todo el tiempo
    expect(silenciosLargosDesdeNivelesDb(niveles, VENTANA_S, UMBRAL_DB, 0.4)).toEqual([]);
  });

  it("un silencio de exactamente 0.4s (8 ventanas de 0.05s) SÍ se reporta", () => {
    const niveles = [...new Array(4).fill(-10), ...new Array(8).fill(-60), ...new Array(4).fill(-10)];
    const resultado = silenciosLargosDesdeNivelesDb(niveles, VENTANA_S, UMBRAL_DB, 0.4);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].inicio_s).toBeCloseTo(4 * VENTANA_S, 5);
    expect(resultado[0].fin_s).toBeCloseTo(12 * VENTANA_S, 5);
  });

  it("un silencio de 0.3s (menos del mínimo de 0.4s) NO se reporta -- caso real: el hueco de 0.25s que compactarPausas() ya deja a propósito entre cortes", () => {
    const niveles = [...new Array(4).fill(-10), ...new Array(6).fill(-60), ...new Array(4).fill(-10)]; // 6*0.05=0.3s
    expect(silenciosLargosDesdeNivelesDb(niveles, VENTANA_S, UMBRAL_DB, 0.4)).toEqual([]);
  });

  it("varios silencios largos separados se reportan todos, cada uno con su propio rango", () => {
    const niveles = [
      ...new Array(2).fill(-10),
      ...new Array(10).fill(-60), // silencio 1: 0.1s a 0.6s
      ...new Array(3).fill(-10),
      ...new Array(9).fill(-60), // silencio 2
      ...new Array(2).fill(-10),
    ];
    const resultado = silenciosLargosDesdeNivelesDb(niveles, VENTANA_S, UMBRAL_DB, 0.4);
    expect(resultado).toHaveLength(2);
    expect(resultado[0].inicio_s).toBeCloseTo(0.1, 5);
    expect(resultado[0].fin_s).toBeCloseTo(0.6, 5);
  });

  it("un silencio que llega hasta el final del audio (sin que vuelva a sonar) también se cierra y se reporta", () => {
    const niveles = [...new Array(4).fill(-10), ...new Array(10).fill(-60)];
    const resultado = silenciosLargosDesdeNivelesDb(niveles, VENTANA_S, UMBRAL_DB, 0.4);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].fin_s).toBeCloseTo(14 * VENTANA_S, 5);
  });

  it("lista vacía no revienta, da 0 silencios", () => {
    expect(silenciosLargosDesdeNivelesDb([], VENTANA_S, UMBRAL_DB, 0.4)).toEqual([]);
  });

  it("niveles justo en el umbral (ni uno ni otro lado) no cuentan como silencio -- el corte es estrictamente 'menor que'", () => {
    const niveles = new Array(10).fill(UMBRAL_DB);
    expect(silenciosLargosDesdeNivelesDb(niveles, VENTANA_S, UMBRAL_DB, 0.4)).toEqual([]);
  });
});
