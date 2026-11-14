// Prueba POST /api/contenido/[id]/video-listo con Supabase y Cloudinary
// mockeados -- nunca contra la base real ni contra Cloudinary de
// verdad. Cubre: solo admin, credenciales de Cloudinary configuradas,
// estado válido para recibir el video, éxito (álbum + pieza
// actualizada con actualizado_en), reintento sin re-render (1er fallo
// no marca error, 2do sí), la carrera perdida contra otra pestaña
// (borra de Cloudinary, nunca crea la pieza del álbum), y el fallo de
// Cloudinary en sí.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const uploadMock = vi.fn();
const destroyMock = vi.fn();
vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload: (...args: unknown[]) => uploadMock(...args),
      destroy: (...args: unknown[]) => destroyMock(...args),
    },
  },
}));

let usuarioActual: Record<string, unknown> | null = null;
let piezaActual: { id: string; estado: string; intentos: number } | null = null;
let filasReclamadasActual: { id: string }[] | null = [{ id: "pieza-1" }];
let errorClaimActual: { message: string } | null = null;
let errorInsertAlbum: { message: string } | null = null;
let updatesRealizados: Record<string, unknown>[] = [];

function chainUsuarios(data: unknown) {
  const obj = { select: () => obj, eq: () => obj, single: async () => ({ data, error: null }) };
  return obj;
}

type CadenaAlbum = {
  insert: (valores: Record<string, unknown>) => CadenaAlbum;
  select: () => CadenaAlbum;
  single: () => Promise<{ data: unknown; error: unknown }>;
};

const fromMock = vi.fn();
fromMock.mockImplementation((tabla: unknown) => {
  if (tabla === "usuarios") return chainUsuarios(usuarioActual);
  if (tabla === "publicaciones_organicas") {
    // select("id, estado, intentos").eq().eq().maybeSingle() (lectura
    // inicial) vs. update({...}).eq().eq()[.in()][.select("id")]
    // (retry-failure/claim/album_id-final) -- un solo objeto encadenable
    // que decide su resolución según si alguien llamó select() después
    // de update() (el claim) o no (fire-and-forget, como hace el código
    // real en los otros dos updates).
    let huboSelectTrasUpdate = false;
    const obj = {
      select: () => {
        huboSelectTrasUpdate = true;
        return obj;
      },
      eq: () => obj,
      in: () => obj,
      maybeSingle: async () => ({ data: piezaActual }),
      update: (valores: Record<string, unknown>) => {
        huboSelectTrasUpdate = false;
        updatesRealizados.push(valores);
        return obj;
      },
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => {
        resolve(huboSelectTrasUpdate ? { data: filasReclamadasActual, error: errorClaimActual } : { data: null, error: null });
      },
    };
    return obj;
  }
  if (tabla === "album_creativos") {
    const obj: CadenaAlbum = {
      insert: (valores) => {
        updatesRealizados.push({ __insertAlbum: true, ...valores });
        return obj;
      },
      select: () => obj,
      single: async () => (errorInsertAlbum ? { data: null, error: errorInsertAlbum } : { data: { id: "album-1" }, error: null }),
    };
    return obj;
  }
  throw new Error(`from("${String(tabla)}") no mockeado en este test`);
});

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}));

const registrarErrorMock = vi.fn();
vi.mock("@/lib/registrarError", () => ({ registrarError: (...args: unknown[]) => registrarErrorMock(...args) }));

const { POST } = await import("./route");

const USUARIO_ADMIN = { id: "user-1", rol: "admin", cloudinary_name: "demo", cloudinary_key: "key", cloudinary_secret: "secret" };

function reqConArchivo(): NextRequest {
  const formData = new FormData();
  formData.set("archivo", new File([new Uint8Array([1, 2, 3])], "spike.mp4", { type: "video/mp4" }));
  return new NextRequest("http://localhost/api/contenido/pieza-1/video-listo", { method: "POST", body: formData });
}

function contexto(id = "pieza-1") {
  return { params: Promise.resolve({ id }) };
}

function updateQueTocaCampo(campo: string) {
  return updatesRealizados.find((u) => campo in u);
}

describe("POST /api/contenido/[id]/video-listo", () => {
  beforeEach(() => {
    fromMock.mockClear();
    uploadMock.mockReset();
    destroyMock.mockReset().mockResolvedValue({});
    registrarErrorMock.mockReset();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    piezaActual = { id: "pieza-1", estado: "renderizando", intentos: 0 };
    filasReclamadasActual = [{ id: "pieza-1" }];
    errorClaimActual = null;
    errorInsertAlbum = null;
    updatesRealizados = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sin sesión: 401", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(reqConArchivo(), contexto());
    expect(res.status).toBe(401);
  });

  it("usuario no admin: 403", async () => {
    usuarioActual = { ...USUARIO_ADMIN, rol: "cliente" };
    const res = await POST(reqConArchivo(), contexto());
    expect(res.status).toBe(403);
  });

  it("sin credenciales de Cloudinary: 400", async () => {
    usuarioActual = { ...USUARIO_ADMIN, cloudinary_name: null };
    const res = await POST(reqConArchivo(), contexto());
    expect(res.status).toBe(400);
  });

  it("pieza inexistente o de otro usuario: 404", async () => {
    piezaActual = null;
    const res = await POST(reqConArchivo(), contexto());
    expect(res.status).toBe(404);
  });

  it("pieza en un estado que no acepta video (ej. ya 'lista'): 400, nunca sube nada", async () => {
    piezaActual = { id: "pieza-1", estado: "lista", intentos: 0 };
    const res = await POST(reqConArchivo(), contexto());
    expect(res.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("sin archivo en el form: 400", async () => {
    const req = new NextRequest("http://localhost/api/contenido/pieza-1/video-listo", { method: "POST", body: new FormData() });
    const res = await POST(req, contexto());
    expect(res.status).toBe(400);
  });

  it("éxito: sube a Cloudinary, reclama la pieza, crea el álbum y guarda el album_id", async () => {
    uploadMock.mockResolvedValue({ secure_url: "https://res.cloudinary.com/demo/video/upload/v1/reel.mp4", public_id: "reel-1" });

    const res = await POST(reqConArchivo(), contexto());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url_video).toBe("https://res.cloudinary.com/demo/video/upload/v1/reel.mp4");
    expect(updateQueTocaCampo("__insertAlbum")).toMatchObject({ user_id: "user-1", url_imagen: expect.any(String), public_id: "reel-1", tipo: "video" });
    expect(updateQueTocaCampo("estado")).toMatchObject({ estado: "lista", url_video: expect.any(String), cloudinary_public_id: "reel-1" });
    expect(updateQueTocaCampo("album_id")).toMatchObject({ album_id: "album-1" });
    for (const u of updatesRealizados) {
      if (!("__insertAlbum" in u)) expect(typeof u.actualizado_en).toBe("string");
    }
    expect(destroyMock).not.toHaveBeenCalled();
  });

  it("primer fallo de Cloudinary: NO pasa a error, cuenta el intento, es reintentable", async () => {
    uploadMock.mockRejectedValue(new Error("Cloudinary caído"));

    const res = await POST(reqConArchivo(), contexto());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.reintentable).toBe(true);
    expect(registrarErrorMock).not.toHaveBeenCalled();
    expect(updatesRealizados[0]).toMatchObject({ intentos: 1 });
    expect(updatesRealizados[0]).not.toHaveProperty("estado");
  });

  it("segundo fallo seguido de Cloudinary: ahí sí pasa a error", async () => {
    piezaActual = { id: "pieza-1", estado: "renderizando", intentos: 1 };
    uploadMock.mockRejectedValue(new Error("Cloudinary caído otra vez"));

    const res = await POST(reqConArchivo(), contexto());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.reintentable).toBe(false);
    expect(registrarErrorMock).toHaveBeenCalledWith(expect.objectContaining({ origen: "contenido_video_listo" }));
    expect(updatesRealizados[0]).toMatchObject({ intentos: 2, estado: "error", tipo_error: "subida" });
  });

  it("carrera perdida contra otra pestaña: no crea la pieza del álbum y borra el archivo de Cloudinary", async () => {
    uploadMock.mockResolvedValue({ secure_url: "https://res.cloudinary.com/demo/video/upload/v1/reel.mp4", public_id: "reel-1" });
    filasReclamadasActual = [];

    const res = await POST(reqConArchivo(), contexto());

    expect(res.status).toBe(409);
    expect(destroyMock).toHaveBeenCalledWith("reel-1", { resource_type: "video" });
    expect(updateQueTocaCampo("__insertAlbum")).toBeUndefined();
  });
});
