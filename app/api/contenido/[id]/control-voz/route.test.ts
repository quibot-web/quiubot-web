// POST /api/contenido/[id]/control-voz con Supabase y OpenAI simulados -- nunca contra la base real.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...a: unknown[]) => authMock(...a) }));
vi.mock("@/lib/crypto", () => ({ desencriptarSiHaceFalta: (x: string) => x }));
vi.mock("@/lib/rateLimit", () => ({ verificarLimite: () => true }));
const transcribirMock = vi.fn();
vi.mock("@/app/lib/videoOrganico/generarVoz", () => ({ transcribirAudioFinal: (...a: unknown[]) => transcribirMock(...a) }));

const GUION = { escenas: [{ id: "e1", narracion: "Likes: muchos no garantizan nada." }, { id: "e3", narracion: "Escribe una pregunta concreta." }] };
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (tabla: string) => {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        single: async () => ({ data: tabla === "usuarios" ? { id: "u1", rol: "admin", openai_key: "k" } : null }),
        maybeSingle: async () => ({ data: { id: "p1", guion: GUION } }),
      };
      return q;
    },
  },
}));

const { POST } = await import("./route");
const ctx = { params: Promise.resolve({ id: "p1" }) };
function req(conAudio = true) {
  const form = new FormData();
  if (conAudio) form.set("audio", new Blob([new Uint8Array(100)], { type: "audio/wav" }), "final.wav");
  return new NextRequest("http://x/api/contenido/p1/control-voz", { method: "POST", body: form });
}

describe("POST /api/contenido/[id]/control-voz", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ user: { email: "admin@quiubot.com" } });
    transcribirMock.mockReset();
  });

  it("audio completo: sin hallazgos", async () => {
    transcribirMock.mockResolvedValue("Likes, muchos no garantizan nada. Escribe una pregunta concreta.");
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).hallazgos).toEqual([]);
  });

  it("falta la primera palabra de una frase: la reporta", async () => {
    transcribirMock.mockResolvedValue("Likes, muchos no garantizan nada. Una pregunta concreta.");
    const data = await (await POST(req(), ctx)).json();
    expect(data.hallazgos.join(" ")).toMatch(/primera palabra de una frase.*"Escribe"/);
  });

  it("sin audio: 400; sin sesión: 401", async () => {
    expect((await POST(req(false), ctx)).status).toBe(400);
    authMock.mockResolvedValue(null);
    expect((await POST(req(), ctx)).status).toBe(401);
  });
});
