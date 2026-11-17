// generarVoz() con fetch y Cloudinary mockeados -- nunca contra
// OpenAI ni Cloudinary reales. Mismo patrón de vi.stubGlobal("fetch", ...)
// que app/api/contenido/[id]/guion/route.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const uploadMock = vi.fn();
vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: { upload: (...args: unknown[]) => uploadMock(...args) },
  },
}));

// Ronda I: generarVoz() ahora también llama a detectarSilenciosReales(),
// que corre un ffmpeg REAL contra el audio -- en este archivo el "audio"
// es un ArrayBuffer falso (texto plano, ni siquiera un mp3 real), así
// que dejarlo correr de verdad cuelga/falla sin sentido. Se mockea
// igual que cloudinary: esta unidad prueba la orquestación de
// generarVoz(), nunca la detección de silencio real en sí (eso lo
// prueba detectarSilenciosReales.test.ts/compactarPausas.test.ts).
const detectarSilenciosMock = vi.fn().mockResolvedValue([]);
vi.mock("./detectarSilenciosReales", () => ({
  detectarSilenciosReales: (...args: unknown[]) => detectarSilenciosMock(...args),
}));

import { generarVoz } from "./generarVoz";

const AUDIO_FALSO = new TextEncoder().encode("audio-falso").buffer;

function respuestaSpeechOk() {
  return { ok: true, status: 200, arrayBuffer: async () => AUDIO_FALSO };
}

function respuestaTranscripcionOk() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      words: [
        { word: "hola", start: 0, end: 0.3 },
        { word: "mundo", start: 0.3, end: 0.7 },
      ],
    }),
  };
}

const OPCIONES = { openaiKey: "sk-test", voz: "alloy", cloudinary: { cloudName: "demo", apiKey: "k", apiSecret: "s" } };

beforeEach(() => {
  uploadMock.mockReset();
  uploadMock.mockResolvedValue({ secure_url: "https://res.cloudinary.com/demo/video/upload/narracion.mp3" });
  detectarSilenciosMock.mockReset();
  detectarSilenciosMock.mockResolvedValue([{ inicio_s: 0.3, fin_s: 0.4 }]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generarVoz", () => {
  it("camino feliz: devuelve audioUrl de Cloudinary y las palabras con sus tiempos reales", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respuestaSpeechOk()).mockResolvedValueOnce(respuestaTranscripcionOk());
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await generarVoz("Hola mundo", OPCIONES);

    expect(resultado.audioUrl).toBe("https://res.cloudinary.com/demo/video/upload/narracion.mp3");
    expect(resultado.palabras).toEqual([
      { texto: "hola", inicio_s: 0, fin_s: 0.3 },
      { texto: "mundo", inicio_s: 0.3, fin_s: 0.7 },
    ]);
    expect(resultado.silencios).toEqual([{ inicio_s: 0.3, fin_s: 0.4 }]);
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(detectarSilenciosMock).toHaveBeenCalledTimes(1);
  });

  it("créditos de OpenAI agotados en el TTS: mensaje claro, no el error crudo", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: "no credits", type: "insufficient_quota", code: "credit_balance_exhausted" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(generarVoz("Hola mundo", OPCIONES)).rejects.toThrow("Tu cuenta de OpenAI no tiene créditos");
  });

  it("falla la transcripción: el error se propaga, nunca se sube nada roto a Cloudinary", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respuestaSpeechOk()).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "server error",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(generarVoz("Hola mundo", OPCIONES)).rejects.toThrow("Error de OpenAI (500)");
  });
});
