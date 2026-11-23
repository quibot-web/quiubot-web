import { describe, expect, it } from "vitest";
import { fotoParaReelIlustrado, marcaDesdeTema, propsReelIlustradoDesdeGuion } from "./desdeGuion";
import { GuionSchema, type Guion } from "../guion.schema";
import { PLAN_PROTOTIPO } from "./planPrototipo";

const TEMA = { color_primario: "#1F6F5C", color_secundario: "#F2C14E", fuente: "moderna" as const, logo_url: null, nombre_marca: "Cerámica Luna", instagramUsuario: "@ceramica.luna" };

describe("marca del reel ilustrado desde el tema (fase 2)", () => {
  it("usa el usuario real de Instagram, sin descripción inventada y con un chat que no promete nada", () => {
    const m = marcaDesdeTema(TEMA);
    expect(m.nombreTienda).toBe("ceramica.luna");
    expect(m.inicial).toBe("C");
    expect(m.descripcionPerfil).toBeNull();
    expect(m.chat.respuesta).not.toMatch(/\$|\d|env[ií]o|gratis|descuento|precio/i);
  });
  it("sin usuario de Instagram, el nombre de la marca", () => {
    expect(marcaDesdeTema({ ...TEMA, instagramUsuario: null }).nombreTienda).toBe("Cerámica Luna");
  });
});

describe("foto del reel ilustrado", () => {
  it("solo una foto analizada y sin texto; nunca una captura con texto ni una foto sin analizar (sin foto apta: tarjeta de marca)", () => {
    const medios = { a: { url: "a.jpg", tipo: "imagen" as const }, b: { url: "b.jpg", tipo: "imagen" as const }, v: { url: "v.mp4", tipo: "video" as const } };
    expect(fotoParaReelIlustrado({ analisisPiezas: { a: { tiene_texto: true }, b: { tiene_texto: false } } as never }, medios)).toBe("b.jpg");
    expect(fotoParaReelIlustrado({ analisisPiezas: { a: { tiene_texto: true }, b: { tiene_texto: true } } as never }, medios)).toBeUndefined();
    expect(fotoParaReelIlustrado({ analisisPiezas: undefined }, medios)).toBeUndefined();
    expect(fotoParaReelIlustrado({ analisisPiezas: undefined }, { v: medios.v })).toBeUndefined();
  });
});

describe("guion con plan ilustrado", () => {
  it("el esquema del guion conserva el plan; sin plan, el reel no es ilustrado", () => {
    const base = {
      tiemposRender: [{ escena_id: "e1", inicio_s: 0, fin_s: 1 }],
      palabrasPorEscena: [{ escena_id: "e1", palabras: [] }],
      segmentosAudio: [{ escena_id: "e1", tramos: [] }],
      vozUrl: "voz.mp3",
      tema: TEMA,
      musica: { pista_id: null, volumen: 0.35 },
    } as unknown as Guion;
    expect(propsReelIlustradoDesdeGuion(base, undefined, null)).toBeNull();
    const props = propsReelIlustradoDesdeGuion({ ...base, ilustrado: PLAN_PROTOTIPO }, undefined, "musica.mp3");
    expect(props?.plan).toBe(PLAN_PROTOTIPO);
    expect(props?.pistaMusicaUrl).toBe("musica.mp3");
    expect(props?.marca.nombreTienda).toBe("ceramica.luna");
    expect(GuionSchema.shape.ilustrado.safeParse(PLAN_PROTOTIPO).success).toBe(true);
    expect(GuionSchema.shape.ilustrado.safeParse({ frases: [{ escena_id: "e1", acciones: [{ escena: "feed", accion: "desliza", palabra: 0, precio: "$9.900" }] }] }).success).toBe(false);
  });
});
