// POST /api/cron/publicar-organico -- auth y gate de entorno, con el
// publicador mockeado (su lógica se prueba en
// app/lib/publicadorOrganico.test.ts).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const ejecutarMock = vi.fn();
vi.mock("@/app/lib/publicadorOrganico", () => ({ ejecutarPublicadorOrganico: (...a: unknown[]) => ejecutarMock(...a) }));
const registrarErrorMock = vi.fn();
vi.mock("@/lib/registrarError", () => ({ registrarError: (...a: unknown[]) => registrarErrorMock(...a) }));

const { POST } = await import("./route");

function req(auth?: string) {
  return new NextRequest("http://localhost/api/cron/publicar-organico", { method: "POST", headers: auth ? { authorization: auth } : {} });
}

describe("POST /api/cron/publicar-organico", () => {
  beforeEach(() => {
    ejecutarMock.mockReset().mockResolvedValue({ vencidas: 0 });
    registrarErrorMock.mockReset();
    vi.stubEnv("ADMIN_SECRET", "secreto");
    vi.stubEnv("PUBLICADOR_ORGANICO_ACTIVO", "true");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sin Bearer correcto: 401 y no corre nada", async () => {
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req("Bearer otro"))).status).toBe(401);
    expect(ejecutarMock).not.toHaveBeenCalled();
  });

  it("sin ADMIN_SECRET configurado: 401", async () => {
    vi.stubEnv("ADMIN_SECRET", "");
    expect((await POST(req("Bearer "))).status).toBe(401);
  });

  it("PUBLICADOR_ORGANICO_ACTIVO distinto de 'true': 200 sin tocar nada", async () => {
    for (const valor of ["", "false", "TRUE", "1"]) {
      vi.stubEnv("PUBLICADOR_ORGANICO_ACTIVO", valor);
      const res = await POST(req("Bearer secreto"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, activo: false });
    }
    expect(ejecutarMock).not.toHaveBeenCalled();
  });

  it("activo: corre el publicador y devuelve el resumen", async () => {
    const res = await POST(req("Bearer secreto"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, activo: true, vencidas: 0 });
    expect(ejecutarMock).toHaveBeenCalledOnce();
  });

  it("si el publicador revienta: 500 con mensaje amable y registrarError", async () => {
    ejecutarMock.mockRejectedValue(new Error("detalle crudo de postgres"));
    const res = await POST(req("Bearer secreto"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("postgres");
    expect(registrarErrorMock).toHaveBeenCalledWith(expect.objectContaining({ origen: "publicador_organico" }));
  });
});
