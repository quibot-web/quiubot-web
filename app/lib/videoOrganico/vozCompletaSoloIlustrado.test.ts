import { beforeEach, describe, expect, it, vi } from "vitest";

// La revisión de "voz incompleta" (pedir la voz otra vez y, si sigue
// cortada, no entregar) es de visuales-v2: solo para cuentas del reel
// ilustrado. Para los clientes la voz tiene que comportarse igual que antes:
// un solo pedido a OpenAI y sin el error nuevo.
vi.mock("server-only", () => ({}));
const generarVoz = vi.fn();
vi.mock("./generarVoz", () => ({ generarVoz: (...a: unknown[]) => generarVoz(...a) }));

const { generarVozYTiempos } = await import("./generarGuionConVoz");

const narraciones = [
  { id: "e1", narracion: "hola a todos los que venden" },
  { id: "e2", narracion: "esta frase la voz no la dijo nunca" },
];
// TTS cortada: Whisper solo encuentra las palabras de la primera frase.
const vozCortada = {
  audioUrl: "https://ejemplo/voz.mp3",
  palabras: "hola a todos los que venden".split(" ").map((texto, i) => ({ texto, inicio_s: i * 0.3, fin_s: i * 0.3 + 0.25 })),
  silencios: [],
};
const params = { openaiKey: "k", voz: "nova", cloudinary: { cloudName: "c", apiKey: "a", apiSecret: "s" } };

describe("revisión de voz incompleta solo para el reel ilustrado", () => {
  beforeEach(() => {
    generarVoz.mockReset();
    generarVoz.mockResolvedValue(vozCortada);
  });

  it("clientes (sin la marca): un solo pedido de voz y nunca el error de voz incompleta", async () => {
    const r = await generarVozYTiempos(narraciones, params);
    expect(generarVoz).toHaveBeenCalledTimes(1);
    if (!r.ok) expect(r.error).not.toMatch(/incompleta/);
  });

  it("reel ilustrado: pide la voz otra vez y, si sigue cortada, no la entrega", async () => {
    const r = await generarVozYTiempos(narraciones, { ...params, revisarVozCompleta: true });
    expect(generarVoz).toHaveBeenCalledTimes(2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/incompleta/);
  });
});
