import { z } from "zod";
// Import relativo a propósito, no "@/..." -- el bundler propio de
// Remotion (Studio, npm run render, el worker de Fase 1b) no entiende el
// alias de tsconfig, solo lo resuelve el bundler de Next.
import { AnalisisPiezaSchema } from "../app/lib/analisisPieza";

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

export const BLOQUES = ["gancho", "problema", "producto", "beneficio", "valor", "oferta", "objecion", "marca", "cta"] as const;
export type BloqueGuion = (typeof BLOQUES)[number];

const Bloque = z.enum(BLOQUES);

// Cómo se muestra una foto o video real del álbum -- sección "Tratamientos
// de imagen" del plan. "recortado" (producto sin fondo sobre colores de
// marca) queda afuera a propósito: el costo de e_background_removal de
// Cloudinary depende del plan de CADA cliente y no está documentado con
// certeza, se revisa más adelante.
export const TRATAMIENTOS_MEDIA = ["tarjeta", "celular", "completa"] as const;
export type TratamientoMedia = (typeof TRATAMIENTOS_MEDIA)[number];

const Subtitulo = z.object({
  texto: z.string().min(1).max(80),
  palabra_clave: z.string().min(1).max(30),
});

const PRECIO_COP = /^\$[\d.]+$/;

const ParamsGanchoTexto = z.object({
  texto: z.string().min(1).max(60),
  palabra_clave: z.string().min(1).max(30),
  sticker: z.string().max(14).optional(),
  // Solo en recetas de venta (venta_directa_whatsapp, venta_directa_web,
  // retargeting) cuando el admin eligió pieza del álbum: el gancho usa
  // esa foto o video como fondo, con degradado oscuro abajo y el texto
  // encima -- "gancho = portada" (sección "Gancho con producto").
  media_id: z.string().min(1).optional(),
  // Solo tiene sentido si hay media_id -- se valida en el superRefine
  // de más abajo, junto con la regla de "nunca recortar con texto".
  tratamiento: z.enum(TRATAMIENTOS_MEDIA).optional(),
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
  tratamiento: z.enum(TRATAMIENTOS_MEDIA),
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
  // Sin voz en la Fase 1, pero SOLO producto_hero muestra subtítulo: las
  // demás escenas ya tienen su propio texto grande en pantalla, uno
  // duplicado encima se siente repetido ("sin subtítulo duplicado").
  subtitulo: Subtitulo.optional(),
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

// Sin color_fondo/color_texto: cada escena pinta su propio fondo (marca,
// alerta, o la foto/video real) y elige su color de texto en caliente
// con colorTextoSobre() (video/tema.ts) contra lo que de verdad hay
// detrás -- un solo color de texto fijo no podía funcionar sobre fondos
// que cambian de escena a escena.
const Tema = z.object({
  color_primario: z.string().regex(HEX_COLOR),
  color_secundario: z.string().regex(HEX_COLOR),
  fuente: z.enum(["impacto", "moderna", "elegante", "amigable"]),
  logo_url: z.url().nullable(),
  // Respaldo del cta "suave" cuando no hay logo_url.
  nombre_marca: z.string().max(40).nullable(),
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
    // Copia del análisis de cada pieza usada (album_creativos.analisis),
    // por media_id -- así el guion queda autocontenido: no hace falta
    // volver a consultar el álbum ni pagar el análisis de nuevo para
    // revalidar un guion ya generado (ni al editarlo, ni en el worker
    // de render de la Fase 1b).
    analisisPiezas: z.record(z.string(), AnalisisPiezaSchema).optional(),
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

    // Tratamientos de imagen (sección "Nunca recortar una pieza con
    // texto"): si el análisis de la pieza dice tiene_texto, "completa"
    // (recorte de pantalla completa) le cortaría el texto impreso --
    // solo se permite "tarjeta" o "celular", que muestran la imagen
    // entera. También variedad: la misma pieza en 2+ escenas no puede
    // usar el mismo tratamiento en todas.
    const porMedia = new Map<string, { indiceEscena: number; tratamiento: TratamientoMedia }[]>();
    escenas.forEach((escena, indiceEscena) => {
      if (escena.tipo !== "producto_hero" && escena.tipo !== "gancho_texto") return;
      const mediaId = escena.params.media_id;
      const tratamiento = escena.params.tratamiento;
      if (!mediaId || !tratamiento) return;

      // "completa" solo se permite cuando el análisis EXISTE y dice
      // explícitamente tiene_texto: false -- nunca por falta de dato.
      // Antes solo se rechazaba si tiene_texto era true, así que una
      // pieza sin analizar (ej. elegida antes de que existiera la
      // columna analisis) pasaba igual y el recorte a pantalla completa
      // le cortaba el texto impreso.
      const analisis = guion.analisisPiezas?.[mediaId];
      if (tratamiento === "completa" && analisis?.tiene_texto !== false) {
        const motivo = analisis ? "tiene texto" : "no se pudo analizar";
        ctx.addIssue({
          code: "custom",
          message: `La escena "${escena.id}" usa "completa" en una pieza que ${motivo} (${mediaId}) -- sin confirmar que no tiene texto, solo se permite "tarjeta" o "celular".`,
          path: ["escenas", indiceEscena, "params", "tratamiento"],
        });
      }

      const lista = porMedia.get(mediaId) || [];
      lista.push({ indiceEscena, tratamiento });
      porMedia.set(mediaId, lista);
    });

    for (const [mediaId, usos] of porMedia) {
      if (usos.length > 1 && usos.every((u) => u.tratamiento === usos[0].tratamiento)) {
        ctx.addIssue({
          code: "custom",
          message: `La pieza ${mediaId} se usa en ${usos.length} escenas con el mismo tratamiento ("${usos[0].tratamiento}") -- usa al menos uno distinto para variar.`,
          path: ["escenas", usos[0].indiceEscena, "params", "tratamiento"],
        });
      }
    }
  });

export type Guion = z.infer<typeof GuionSchema>;

// ids de media_id que la IA realmente usó (gancho opcional + producto_hero
// obligatorio) -- "la IA nunca escribe URLs", solo puede reusar un id de
// los que se le mandaron como disponibles. Compartido entre
// /api/video/guion (resolver las piezas antes de guardar el guion) y
// video/render.ts (el CLI local de "npm run render", que resuelve las
// mismas piezas desde un guion.json ya generado).
export function idsDeMediaUsados(escenas: Guion["escenas"]): string[] {
  const ids: string[] = [];
  for (const e of escenas) {
    if (e.tipo === "producto_hero") ids.push(e.params.media_id);
    if (e.tipo === "gancho_texto" && e.params.media_id) ids.push(e.params.media_id);
  }
  return ids;
}
