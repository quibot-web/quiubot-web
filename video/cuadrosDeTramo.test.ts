import { describe, expect, it } from "vitest";
import { cuadrosDeTramo } from "./cuadrosDeTramo";

describe("cuadrosDeTramo (redondeo a favor de la voz, sin correr la voz)", () => {
  const fps = 30;
  it("el recorte de la fuente nunca empieza DESPUÉS del inicio del tramo, y la voz cae a menos de medio cuadro de su lugar", () => {
    for (let k = 0; k < 200; k++) {
      const oi = 0.5 + k * 0.0137;
      const ci = 2 + k * 0.0091;
      const t = { original: { inicio_s: oi, fin_s: oi + 1.2 }, compactado: { inicio_s: ci, fin_s: ci + 1.2 } };
      const r = cuadrosDeTramo(t, 1, fps);
      expect(r.trimBefore / fps).toBeLessThanOrEqual(oi + 1e-9);
      // instante en que suena el inicio del tramo vs. dónde debería sonar
      const suenaEn = 1 + (r.desde + (oi * fps - r.trimBefore)) / fps;
      expect(Math.abs(suenaEn - ci)).toBeLessThanOrEqual(0.5 / fps + 1e-9);
      // cubre hasta el final del tramo
      expect((r.desde + r.duracion) / fps).toBeGreaterThanOrEqual(ci + 1.2 - 1 - 1e-9);
    }
  });

  it("primer tramo de la escena: nunca adelanta la voz (si no cabe antes del cuadro 0, recorta silencio del margen)", () => {
    const t = { original: { inicio_s: 4.98, fin_s: 6 }, compactado: { inicio_s: 3, fin_s: 4.02 } };
    const r = cuadrosDeTramo(t, 3, fps);
    expect(r.desde).toBe(0);
    const suenaEn = 3 + (r.desde + (4.98 * fps - r.trimBefore)) / fps;
    expect(Math.abs(suenaEn - 3)).toBeLessThanOrEqual(1 / fps);
    expect(suenaEn).toBeLessThanOrEqual(3 + 1e-9 + 1 / fps);
    expect(suenaEn - 3).toBeGreaterThanOrEqual(-1e-9); // nunca antes de tiempo
  });
});
