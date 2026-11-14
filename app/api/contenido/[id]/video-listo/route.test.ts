// Prueba POST /api/contenido/[id]/video-listo con Supabase y Cloudinary
// mockeados -- nunca contra la base real ni contra Cloudinary de
// verdad. Cubre: solo admin, credenciales de Cloudinary configuradas,
// estado válido para recibir el video, éxito (álbum + pieza
// actualizada con actualizado_en), y fallo de la subida (pieza pasa a
// error con tipo_error "subida", nunca se deja en un estado intermedio).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const uploadMock = vi.fn();
vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: { upload: (...args: unknown[]) => uploadMock(...args) },
  },
}));

let usuarioActual: Record<string, unknown> | null = null;
let piezaActual: { id: string; estado: string } | null = null;
let insertAlbumCon: Record<string, unknown> | null = null;
let errorInsertAlbum: { message: string } | null = null;
let updateFinalCon: Record<string, unknown> | null = null;

function chainUsuarios(data: unknown) {
  const obj = { select: () => obj, eq: () => obj, single: async () => ({ data, error: null }) };
  return obj;
}

type CadenaPiezas = {
  select: () => CadenaPiezas;
  eq: () => CadenaPiezas;
  maybeSingle: () => Promise<{ data: unknown }>;
  update: (valores: Record<string, unknown>) => CadenaPiezas;
};

type CadenaAlbum = {
  insert: (valores: Record<string, unknown>) => CadenaAlbum;
  select: () => CadenaAlbum;
  single: () => Promise<{ data: unknown; error: unknown }>;
};

const fromMock = vi.fn();
fromMock.mockImplementation((tabla: unknown) => {
  if (tabla === "usuarios") return chainUsuarios(usuarioActual);
  if (tabla === "publicaciones_organicas") {
    const obj: CadenaPiezas = {
      select: () => obj,
      eq: () => obj,
      maybeSingle: async () => ({ data: piezaActual }),
      update: (valores) => {
        updateFinalCon = valores;
        return obj;
      },
    };
    return obj;
  }
  if (tabla === "album_creativos") {
    const obj: CadenaAlbum = {
      insert: (valores) => {
        insertAlbumCon = valores;
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

describe("POST /api/contenido/[id]/video-listo", () => {
  beforeEach(() => {
    fromMock.mockClear();
    uploadMock.mockReset();
    registrarErrorMock.mockReset();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    piezaActual = { id: "pieza-1", estado: "renderizando" };
    insertAlbumCon = null;
    errorInsertAlbum = null;
    updateFinalCon = null;
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
    piezaActual = { id: "pieza-1", estado: "lista" };
    const res = await POST(reqConArchivo(), contexto());
    expect(res.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("sin archivo en el form: 400", async () => {
    const req = new NextRequest("http://localhost/api/contenido/pieza-1/video-listo", { method: "POST", body: new FormData() });
    const res = await POST(req, contexto());
    expect(res.status).toBe(400);
  });

  it("éxito: sube a Cloudinary, crea la pieza del álbum y actualiza la publicación con actualizado_en", async () => {
    uploadMock.mockResolvedValue({ secure_url: "https://res.cloudinary.com/demo/video/upload/v1/reel.mp4", public_id: "reel-1" });

    const res = await POST(reqConArchivo(), contexto());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url_video).toBe("https://res.cloudinary.com/demo/video/upload/v1/reel.mp4");
    expect(insertAlbumCon).toMatchObject({ user_id: "user-1", url_imagen: "https://res.cloudinary.com/demo/video/upload/v1/reel.mp4", public_id: "reel-1", tipo: "video" });
    expect(updateFinalCon).toMatchObject({
      estado: "lista",
      url_video: "https://res.cloudinary.com/demo/video/upload/v1/reel.mp4",
      cloudinary_public_id: "reel-1",
      album_id: "album-1",
    });
    expect(typeof (updateFinalCon as Record<string, unknown>).actualizado_en).toBe("string");
  });

  it("si Cloudinary falla, la pieza pasa a error con tipo_error 'subida' y se registra el error", async () => {
    uploadMock.mockRejectedValue(new Error("Cloudinary caído"));

    const res = await POST(reqConArchivo(), contexto());
    expect(res.status).toBe(503);
    expect(registrarErrorMock).toHaveBeenCalledWith(expect.objectContaining({ origen: "contenido_video_listo" }));
    expect(updateFinalCon).toMatchObject({ estado: "error", tipo_error: "subida" });
    expect(typeof (updateFinalCon as Record<string, unknown>).actualizado_en).toBe("string");
  });
});
