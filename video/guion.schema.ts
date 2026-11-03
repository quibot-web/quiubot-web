import { z } from "zod";

// Ids reales de objetivos_config (ver app/lib/metas.ts -- OBJETIVOS_CATALOGO,
// confirmados contra la tabla objetivos_config). Cada uno tiene su receta en
// video/recetas/ (paso 3 de la Fase 1a): este schema solo valida la FORMA
// del guion en si mismo -- lo que depende de la receta del objetivo
// (orden de bloques, rango de duracion, que escenas son obligatorias) se
// valida aparte, componiendo con la receta, una vez exista.
export const OBJETIVOS_VIDEO = [
  "venta_directa_whatsapp",
  "venta_directa_web",
  "trafico_mensajes",
  "visitas_web",
  "leads",
  "reconocimiento",
  "retargeting",
  "seguidores_facebook",
  "seguidores_instagram",
] as const;

export type ObjetivoVideo = (typeof OBJETIVOS_VIDEO)[number];

export const ACCIONES_CTA = ["whatsapp", "web", "formulario", "seguir", "suave"] as const;
export type AccionCta = (typeof ACCIONES_CTA)[number];

const Bloque = z.enum(["gancho", "problema", "producto", "beneficio", "valor", "oferta", "objecion", "marca", "cta"]);

const Subtitulo = z.object({
  texto: z.string().min(1).max(80),
  palabra_clave: z.string().min(1).max(30),
});

const PRECIO_COP = /^\$[\d.]+$/;

const ParamsGanchoTexto = z.object({
  texto: z.string().min(1).max(60),
  palabra_clave: z.string().min(1).max(30),
  sticker: z.string().max(14).optional(),
});

// La fila "problema_dato" acepta una variante "pregunta" (una pregunta
// grande sin cifras) en vez del dato/contador -- misma escena, mismo tipo,
// un campo mas para distinguir cual de los dos juegos de campos aplica.
const ParamsProblemaDato = z
  .object({
    variante: z.enum(["dato", "pregunta"]).default("dato"),
    titulo: z.string().max(50).optional(),
    pregunta: z.string().max(60).optional(),
    valor_desde: z.number().optional(),
    valor_hasta: z.number().optional(),
    prefijo: z.string().max(10).optional(),
    sufijo: z.string().max(10).optional(),
    etiqueta: z.string().max(30).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.variante === "pregunta" && !v.pregunta) {
      ctx.addIssue({ code: "custom", message: "variante 'pregunta' necesita el campo pregunta", path: ["pregunta"] });
    }
    if (v.variante === "dato" && !v.titulo) {
      ctx.addIssue({ code: "custom", message: "variante 'dato' necesita el campo titulo", path: ["titulo"] });
    }
  });

const ParamsProductoHero = z.object({
  media_id: z.string().min(1),
  nombre: z.string().max(40),
  etiqueta: z.string().max(20).optional(),
});

const ParamsBeneficiosLista = z.object({
  titulo: z.string().max(40).optional(),
  items: z.array(z.string().max(36)).min(2).max(3),
});

const ParamsListaNumerada = z.object({
  titulo: z.string().max(45),
  items: z.array(z.string().max(40)).length(3),
});

const ParamsRevelacionMarca = z.object({
  frase: z.string().max(50),
  mostrar_logo: z.boolean(),
});

const ParamsOfertaPrecio = z.object({
  precio: z.string().regex(PRECIO_COP, "Precio en COP con formato $89.900"),
  precio_antes: z.string().regex(PRECIO_COP).optional(),
  nota: z.string().max(30).optional(),
});

const ParamsObjecionRespuesta = z.object({
  objecion: z.string().max(40),
  respuesta: z.string().max(40),
});

const ParamsCta = z
  .object({
    accion: z.enum(ACCIONES_CTA),
    texto_boton: z.string().max(28),
    mensajes: z.array(z.string().max(32)).max(3).optional(),
    usuario: z
      .string()
      .regex(/^@/, "usuario debe empezar con @")
      .optional(),
    subtexto: z.string().max(40).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mensajes && v.accion !== "whatsapp") {
      ctx.addIssue({ code: "custom", message: "mensajes solo aplica a accion 'whatsapp'", path: ["mensajes"] });
    }
    if (v.usuario && v.accion !== "seguir") {
      ctx.addIssue({ code: "custom", message: "usuario solo aplica a accion 'seguir'", path: ["usuario"] });
    }
  });

const EscenaBase = {
  id: z.string().min(1),
  bloque: Bloque,
  duracion_s: z.number().min(1.5).max(5),
  subtitulo: Subtitulo,
};

export const EscenaSchema = z.discriminatedUnion("tipo", [
  z.object({ ...EscenaBase, tipo: z.literal("gancho_texto"), params: ParamsGanchoTexto }),
  z.object({ ...EscenaBase, tipo: z.literal("problema_dato"), params: ParamsProblemaDato }),
  z.object({ ...EscenaBase, tipo: z.literal("producto_hero"), params: ParamsProductoHero }),
  z.object({ ...EscenaBase, tipo: z.literal("beneficios_lista"), params: ParamsBeneficiosLista }),
  z.object({ ...EscenaBase, tipo: z.literal("lista_numerada"), params: ParamsListaNumerada }),
  z.object({ ...EscenaBase, tipo: z.literal("revelacion_marca"), params: ParamsRevelacionMarca }),
  z.object({ ...EscenaBase, tipo: z.literal("oferta_precio"), params: ParamsOfertaPrecio }),
  z.object({ ...EscenaBase, tipo: z.literal("objecion_respuesta"), params: ParamsObjecionRespuesta }),
  z.object({ ...EscenaBase, tipo: z.literal("cta"), params: ParamsCta }),
]);

export type Escena = z.infer<typeof EscenaSchema>;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const Tema = z.object({
  color_primario: z.string().regex(HEX_COLOR),
  color_secundario: z.string().regex(HEX_COLOR),
  color_fondo: z.string().regex(HEX_COLOR),
  color_texto: z.string().regex(HEX_COLOR),
  fuente: z.enum(["impacto", "moderna", "elegante", "amigable"]),
  logo_url: z.url().nullable(),
});

const Bucle = z.object({
  texto: z.string().min(1).max(60),
  abre_en: z.string().min(1),
  cierra_en: z.string().min(1),
  indicador: z.enum(["contador", "espera_final", "ninguno"]),
});

const Musica = z.object({
  pista_id: z.uuid().nullable(),
  volumen: z.number().min(0).max(1),
});

export const GuionSchema = z
  .object({
    version: z.literal(1),
    formato: z.literal("9x16"),
    fps: z.literal(30),
    objetivo: z.enum(OBJETIVOS_VIDEO),
    duracion_objetivo_s: z.number().min(4).max(25),
    bucle: Bucle,
    tema: Tema,
    musica: Musica,
    escenas: z.array(EscenaSchema).min(3).max(7),
  })
  // Invariantes que no dependen de la receta del objetivo -- las que sí
  // dependen (orden de bloques, rango de duracion, escenas obligatorias
  // por objetivo) se validan aparte en video/recetas/ (paso 3).
  .superRefine((guion, ctx) => {
    const { escenas, bucle } = guion;

    const primera = escenas[0];
    if (primera.bloque !== "gancho") {
      ctx.addIssue({ code: "custom", message: "La primera escena debe ser bloque 'gancho'", path: ["escenas", 0, "bloque"] });
    } else if (primera.duracion_s > 2.5) {
      ctx.addIssue({ code: "custom", message: "El gancho debe durar 2.5s o menos", path: ["escenas", 0, "duracion_s"] });
    }

    const ultima = escenas[escenas.length - 1];
    if (ultima.tipo !== "cta") {
      ctx.addIssue({ code: "custom", message: "La ultima escena debe ser tipo 'cta'", path: ["escenas", escenas.length - 1, "tipo"] });
    }

    const ids = escenas.map((e) => e.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "Los ids de las escenas deben ser unicos", path: ["escenas"] });
    }

    const indiceAbre = ids.indexOf(bucle.abre_en);
    const indiceCierra = ids.indexOf(bucle.cierra_en);
    if (indiceAbre === -1) {
      ctx.addIssue({ code: "custom", message: `bucle.abre_en ('${bucle.abre_en}') no es el id de ninguna escena`, path: ["bucle", "abre_en"] });
    }
    if (indiceCierra === -1) {
      ctx.addIssue({ code: "custom", message: `bucle.cierra_en ('${bucle.cierra_en}') no es el id de ninguna escena`, path: ["bucle", "cierra_en"] });
    }
    if (indiceAbre !== -1 && indiceCierra !== -1 && indiceAbre >= indiceCierra) {
      ctx.addIssue({ code: "custom", message: "bucle.abre_en debe ir antes que bucle.cierra_en", path: ["bucle", "cierra_en"] });
    }
    if (indiceCierra !== -1 && bucle.indicador === "contador" && escenas[indiceCierra].tipo !== "lista_numerada") {
      ctx.addIssue({ code: "custom", message: "bucle.indicador 'contador' exige que la escena de cierre sea tipo 'lista_numerada'", path: ["bucle", "indicador"] });
    }

    const sumaDuraciones = escenas.reduce((acc, e) => acc + e.duracion_s, 0);
    if (Math.abs(sumaDuraciones - guion.duracion_objetivo_s) > 2) {
      ctx.addIssue({
        code: "custom",
        message: `La suma de duracion_s (${sumaDuraciones.toFixed(1)}s) se aleja mas de 2s de duracion_objetivo_s (${guion.duracion_objetivo_s}s)`,
        path: ["escenas"],
      });
    }
  });

export type Guion = z.infer<typeof GuionSchema>;
