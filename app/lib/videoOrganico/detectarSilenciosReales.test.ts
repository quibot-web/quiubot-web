import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@remotion/renderer", () => ({ getSilentParts: vi.fn() }));
const { unirSilencios } = await import("./detectarSilenciosReales");

describe("unirSilencios (ffmpeg parte una pausa en pedazos por un chasquido)", () => {
  it("caso real 9c3bec9f: tres pedazos separados por 51 ms y 1 ms son UNA pausa de 0.71 s", () => {
    const partes = [
      { inicio_s: 3.955687, fin_s: 4.372979 },
      { inicio_s: 4.423979, fin_s: 4.572479 },
      { inicio_s: 4.573146, fin_s: 4.669271 },
    ];
    const r = unirSilencios(partes, 0.2);
    expect(r).toHaveLength(1);
    expect(r[0].inicio_s).toBeCloseTo(3.955687, 6);
    expect(r[0].fin_s).toBeCloseTo(4.669271, 6);
  });

  it("un sonido de más de 60 ms entre dos silencios (una palabra corta) nunca se une; los pedazos sueltos de menos de 0.2 s se descartan", () => {
    const r = unirSilencios(
      [
        { inicio_s: 1, fin_s: 1.3 },
        { inicio_s: 1.42, fin_s: 1.8 }, // 120 ms de sonido en medio: "y"
        { inicio_s: 2.5, fin_s: 2.6 },
      ],
      0.2
    );
    expect(r).toEqual([
      { inicio_s: 1, fin_s: 1.3 },
      { inicio_s: 1.42, fin_s: 1.8 },
    ]);
  });
});
