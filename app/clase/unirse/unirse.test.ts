import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// after() corre después de la respuesta: aquí se guardan las tareas para
// ejecutarlas a mano y comprobar que la redirección no depende de ellas.
const tareas: (() => unknown)[] = [];
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (fn: () => unknown) => tareas.push(fn) }));
vi.mock("@/auth", () => ({ auth: (fn: unknown) => fn }));
vi.mock("@/lib/adminCandado", () => ({ NOMBRE_COOKIE_ADMIN: "x", verificarCandadoAdmin: async () => true }));

const { GET } = await import("./route");
const { default: middleware } = await import("@/middleware");
const { registrarLead, RUTA_UNIRSE } = await import("../ClaseEnVivo");
const GRUPO = "https://chat.whatsapp.com/Lg8wjlX3JqULjmLaa5W6et";

const pedir = (ruta = "/clase/unirse?eid=evento-123abc", cookies = "_fbp=fb.1.111.222; _fbc=fb.1.333.IwAR") =>
  new NextRequest(`https://quiubot.site${ruta}`, { headers: { cookie: cookies, "user-agent": "Mozilla/5.0 (iPhone)", "x-forwarded-for": "190.1.2.3, 10.0.0.1" } });

describe("/clase/unirse", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    tareas.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("es pública: sin sesión el middleware la deja pasar", async () => {
    const url = "https://quiubot.site/clase/unirse?eid=abc12345";
    const req = { auth: null, url, nextUrl: new URL(url), cookies: { get: () => undefined }, headers: new Headers({ host: "quiubot.site" }) };
    const res = (await (middleware as unknown as (r: unknown) => Promise<Response | undefined>)(req)) as Response | undefined;
    expect(res?.headers.get("location") ?? "pasa").toBe("pasa");
  });

  it("sin token de Conversions API: solo redirige (302) al grupo y no llama a Meta", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
    const res = GET(pedir());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(GRUPO);
    for (const t of tareas) await t();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con token: redirige primero y después manda el Lead con el MISMO event_id, fbp/fbc, IP y user agent", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOKEN-SECRETO");
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const res = GET(pedir());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(GRUPO);
    expect(fetchMock).not.toHaveBeenCalled(); // nada antes de la respuesta
    for (const t of tareas) await t();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/\d+\/events$/);
    expect(url).not.toContain("TOKEN"); // el token nunca en la URL
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo.access_token).toBe("TOKEN-SECRETO");
    const ev = cuerpo.data[0];
    expect(ev).toMatchObject({ event_name: "Lead", event_id: "evento-123abc", action_source: "website", event_source_url: "https://quiubot.site/clase", custom_data: { content_name: "clase_26nov" } });
    expect(ev.user_data).toEqual({ client_ip_address: "190.1.2.3", client_user_agent: "Mozilla/5.0 (iPhone)", fbp: "fb.1.111.222", fbc: "fb.1.333.IwAR" });
  });

  it("si Meta falla, la redirección ya salió y no se rompe nada", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOKEN-SECRETO");
    fetchMock.mockRejectedValue(new Error("Meta caída"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = GET(pedir());
    expect(res.status).toBe(302);
    for (const t of tareas) await expect(Promise.resolve(t())).resolves.toBeUndefined();
    error.mockRestore();
  });

  it("eid inválido o ausente: el servidor usa uno propio (y sigue redirigiendo)", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOKEN-SECRETO");
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    for (const ruta of ["/clase/unirse", "/clase/unirse?eid=<script>"]) {
      tareas.length = 0;
      fetchMock.mockClear();
      expect(GET(pedir(ruta, "")).headers.get("location")).toBe(GRUPO);
      for (const t of tareas) await t();
      const ev = JSON.parse(fetchMock.mock.calls[0][1].body).data[0];
      expect(ev.event_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(ev.user_data.fbp).toBeUndefined();
    }
  });
});

describe("botón: Lead en el navegador", () => {
  it("dispara fbq('track','Lead',{content_name:'clase_26nov'},{eventID})", () => {
    const fbq = vi.fn();
    vi.stubGlobal("window", { fbq });
    registrarLead("evento-xyz98765");
    expect(fbq).toHaveBeenCalledWith("track", "Lead", { content_name: "clase_26nov" }, { eventID: "evento-xyz98765" });
    vi.unstubAllGlobals();
    expect(RUTA_UNIRSE).toBe("/clase/unirse");
  });
});
