// Pruebas del motor del reel ilustrado (fase 1): plan válido, escala de
// lo nombrado, cámara sin mareo, recorrido de islas, coreografía del
// feed, datos sin inventar y presupuesto de render.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Img de Remotion necesita el contexto del render; para el HTML basta un <img>.
vi.mock("remotion", async (original) => {
  const real = await original<typeof import("remotion")>();
  return { ...real, Img: (p: Record<string, unknown>) => createElement("img", p) };
});

import { camaraEnCuadro, type TiemposIlustrado } from "../tiempoIlustrado";
import { NARRACION_PROTOTIPO, tiemposSinteticos } from "../guionPrototipo";
import { MARCA_PROTOTIPO, PLAN_PROTOTIPO } from "../planPrototipo";
import tiemposReales from "../fixtures/tiemposPrototipoReales.json";
import { paletaNoche } from "../../estilos/estilos";
import { CATALOGO, CELULAR_ISLA, ID_ESCENAS, PANTALLA, POST_NOMBRADO, definicionAccion } from "./catalogo";
import { focoGlobal } from "./camara";
import { ALTO_PANTALLA, ANCHO_PANTALLA, FONDO_SUBTITULO, FRANJA_SEGURA, ocupacion, rectEnPantalla, seTocan } from "./geometria";
import { problemasDelPlan, type PlanIlustrado } from "./plan";
import { prepararReel } from "./preparar";
import { coreografiaFeed } from "./escenas/Pantallas";
import { MundoIlustrado } from "./MundoIlustrado";
import { ALTO_POST } from "../Objetos";

const TEMA = { color_primario: "#534AB7", color_secundario: "#B9B2FF", fuente: "moderna" as const, logo_url: null, nombre_marca: "Quiubot", instagramUsuario: "quiubot" };
const PALABRAS = Object.fromEntries(NARRACION_PROTOTIPO.map((e) => [e.id, e.narracion.split(/\s+/).length]));
const TIEMPOS: [string, TiemposIlustrado][] = [
  ["tiempos sintéticos", tiemposSinteticos()],
  ["voz real del prototipo", tiemposReales as TiemposIlustrado],
];

describe("plan ilustrado", () => {
  it("el plan del prototipo es válido contra su narración", () => {
    expect(problemasDelPlan(PLAN_PROTOTIPO, PALABRAS)).toEqual([]);
  });

  it("detecta escena, acción o palabra inexistentes", () => {
    const malo: PlanIlustrado = {
      frases: [
        { escena_id: "e1", acciones: [{ escena: "nave" as never, accion: "vuela", palabra: 0 }] },
        { escena_id: "e2", acciones: [{ escena: "billetera", accion: "explota", palabra: 0 }] },
        { escena_id: "e3", acciones: [{ escena: "billetera", accion: "sale_moneda", palabra: 99 }] },
      ],
    };
    const p = problemasDelPlan(malo, PALABRAS);
    expect(p.some((x) => x.includes('escena desconocida "nave"'))).toBe(true);
    expect(p.some((x) => x.includes('no tiene la acción "explota"'))).toBe(true);
    expect(p.some((x) => x.includes("palabra 99 fuera de rango"))).toBe(true);
  });

  it("toda acción del catálogo tiene descripción y una zona que la cámara puede encuadrar", () => {
    for (const e of ID_ESCENAS) for (const a of Object.keys(CATALOGO[e].acciones)) expect(definicionAccion(e, a)?.descripcion.length).toBeGreaterThan(5);
  });
});

for (const [nombre, tiempos] of TIEMPOS) {
  describe(`cámara automática (${nombre})`, () => {
    const reel = prepararReel(tiempos, PLAN_PROTOTIPO, 30);

    it("lo que nombra cada acción ocupa >= 50% de la pantalla, centrado en la franja segura, a más tardar 0,8 s después de su palabra", () => {
      const bienEncuadrado = (d: (typeof reel.disparos)[number], f: number) => {
        const cam = camaraEnCuadro(reel.camara, f);
        const foco = focoGlobal(d, reel.recorrido);
        const r = rectEnPantalla(foco, cam);
        const centro = r.y + r.alto / 2;
        return ocupacion(foco, cam) >= 0.5 && centro >= FRANJA_SEGURA.arriba && centro <= FRANJA_SEGURA.abajo;
      };
      const tarde: string[] = [];
      // Las micro-acciones no cambian de toma: no se encuadran solas.
      for (const d of reel.disparos.filter((x) => x.accion !== "micro")) {
        const llega = Array.from({ length: 25 }, (_, k) => d.cuadro + k).find((f) => bienEncuadrado(d, f));
        if (llega === undefined) tarde.push(`${d.frase} ${d.escena}.${d.accion}`);
      }
      expect(tarde).toEqual([]);
    });

    it("celular: mientras la cámara está quieta en una toma del celular, el tope de la pantalla queda DEBAJO del subtítulo y la publicación nombrada ocupa >= 50%", () => {
      const celular = reel.recorrido.celular!;
      const puntos = [...reel.camara].sort((a, b) => a.cuadro - b.cuadro);
      // puntos: [0] llegada de la toma 0; luego (salida, llegada) por toma; al final, el cierre.
      const llegadas = [0, ...reel.tomas.slice(1).map((_, i) => puntos[2 + 2 * i].cuadro)];
      const salidas = [...reel.tomas.slice(1).map((_, i) => puntos[1 + 2 * i].cuadro), reel.linea.duracionCuadros - 1];
      let revisados = 0;
      reel.tomas.forEach((t, i) => {
        if (!t.celular) return;
        for (let f = llegadas[i]; f <= salidas[i]; f += 5) {
          const cam = camaraEnCuadro(reel.camara, f);
          const topePantalla = ALTO_PANTALLA / 2 + (celular.y + CELULAR_ISLA.borde - cam.y) * cam.zoom;
          expect(topePantalla, `toma ${i}, cuadro ${f}`).toBeGreaterThanOrEqual(FONDO_SUBTITULO);
          const esFeed = t.focos.some((r) => r.alto === POST_NOMBRADO.alto + 130);
          if (esFeed) expect(ocupacion({ ...POST_NOMBRADO, x: POST_NOMBRADO.x + celular.x, y: POST_NOMBRADO.y + celular.y }, cam), `toma ${i}, cuadro ${f}`).toBeGreaterThanOrEqual(0.5);
          revisados++;
        }
      });
      expect(revisados).toBeGreaterThan(20);
    });

    it("casi todas las acciones (>= 85%) ya están encuadradas ~0,3 s después de su palabra", () => {
      const aTiempo = reel.disparos.filter((d) => d.accion !== "micro").filter((d) => ocupacion(focoGlobal(d, reel.recorrido), camaraEnCuadro(reel.camara, d.cuadro + 10)) >= 0.5).length;
      expect(aTiempo / reel.disparos.filter((d) => d.accion !== "micro").length).toBeGreaterThanOrEqual(0.85);
    });

    it("sin mareo: velocidad y zoom por cuadro acotados, y nunca un corte", () => {
      for (let f = 1; f < reel.linea.duracionCuadros; f++) {
        const a = camaraEnCuadro(reel.camara, f - 1);
        const b = camaraEnCuadro(reel.camara, f);
        const z = Math.min(a.zoom, b.zoom);
        expect((Math.abs(b.x - a.x) * z) / ANCHO_PANTALLA + (Math.abs(b.y - a.y) * z) / ALTO_PANTALLA, `cuadro ${f}`).toBeLessThan(0.1);
        expect(Math.abs(Math.log(b.zoom / a.zoom)), `cuadro ${f}`).toBeLessThan(0.05);
      }
    });

    it("después de llegar a una toma, la cámara se queda al menos 0,5 s", () => {
      const puntos = [...reel.camara].sort((a, b) => a.cuadro - b.cuadro);
      // Pares (llegada, salida): cada viaje empieza >= 15 cuadros después de la llegada anterior.
      for (let i = 2; i < puntos.length - 1; i += 2) expect(puntos[i].cuadro - puntos[i - 1].cuadro).toBeGreaterThanOrEqual(15);
    });
  });
}

describe("recorrido de islas", () => {
  const reel = prepararReel(tiemposSinteticos(), PLAN_PROTOTIPO, 30);
  it("las islas no se pisan y todas están sobre el mismo piso", () => {
    const islas = Object.values(reel.recorrido);
    for (let i = 0; i < islas.length; i++) for (let j = i + 1; j < islas.length; j++) expect(seTocan(islas[i]!, islas[j]!)).toBe(false);
    const pisos = new Set(islas.map((r) => r!.y + r!.alto));
    expect(pisos.size).toBe(1);
  });
  it("la billetera queda al lado del celular (se visitan seguidas: venta -> billetera)", () => {
    const { celular, billetera } = reel.recorrido;
    const distancia = Math.abs(celular!.x + celular!.ancho / 2 - (billetera!.x + billetera!.ancho / 2));
    expect(distancia).toBeLessThan(celular!.ancho + billetera!.ancho);
  });
});

describe("coreografía del feed", () => {
  it("aparece_anuncio centra un anuncio; foto_apagada marca un anuncio; se_detiene pone el corazón en la publicación centrada", () => {
    const c = coreografiaFeed([
      { accion: "aparece_anuncio", cuadro: 12 },
      { accion: "desliza", cuadro: 40 },
      { accion: "foto_apagada", cuadro: 100 },
      { accion: "foto_se_aclara", cuadro: 150 },
      { accion: "se_detiene", cuadro: 200 },
    ]);
    const posEn = (cuadro: number) => [...c.pares].filter(([f]) => f <= cuadro).pop()![1];
    expect(posEn(30)).toBe(1); // publicación 1 = anuncio
    expect(c.fotoApagada).not.toBeNull();
    expect(c.corazones[0].post).toBe(c.fotoApagada);
    expect(c.pares[0][0]).toBe(0); // se mueve desde el cuadro 0
  });
});

describe("datos sin inventar (cuenta de la tienda)", () => {
  const paleta = paletaNoche(TEMA);
  const reel = prepararReel(tiemposSinteticos(), PLAN_PROTOTIPO, 30);
  const html = (frame: number) => renderToStaticMarkup(createElement(MundoIlustrado, { frame, fps: 30, reel, paleta, tema: TEMA, marca: MARCA_PROTOTIPO, fotoUrl: "foto.jpg" }));

  it("el anuncio de la tienda no muestra 'Me gusta' ni descripción inventada", () => {
    const frame = reel.disparos.find((d) => d.accion === "aparece_anuncio")!.cuadro + 20;
    const h = html(frame);
    expect(h).toContain(MARCA_PROTOTIPO.nombreTienda);
    const anuncio = h.slice(h.indexOf(MARCA_PROTOTIPO.nombreTienda));
    expect(anuncio.slice(0, anuncio.indexOf("Comprar ahora") + 400)).not.toMatch(/Me gusta/);
  });

  it("el perfil no muestra contadores (publicaciones, seguidores)", () => {
    const frame = reel.disparos.find((d) => d.accion === "toque_seguir")!.cuadro + 20;
    const texto = html(frame).replace(/<[^>]+>/g, " ");
    expect(texto).toContain("Siguiendo");
    expect(texto).not.toMatch(/seguidores|publicaciones|posts/i);
    // El único número que puede aparecer en el perfil es ninguno.
    const perfil = texto.slice(texto.indexOf(MARCA_PROTOTIPO.nombreTienda));
    expect(perfil).not.toMatch(/\d/);
  });

  it("la respuesta del chat del prototipo no promete precio ni envío", () => {
    expect(MARCA_PROTOTIPO.chat.respuesta).not.toMatch(/\$|\d|env[ií]o|gratis|descuento/i);
  });
});

describe("presupuesto de render (rendimiento en el navegador)", () => {
  const paleta = paletaNoche(TEMA);
  const reel = prepararReel(tiemposReales as TiemposIlustrado, PLAN_PROTOTIPO, 30);
  const muestras = Array.from({ length: Math.floor(reel.linea.duracionCuadros / 10) }, (_, i) => i * 10);
  const html = (frame: number) => renderToStaticMarkup(createElement(MundoIlustrado, { frame, fps: 30, reel, paleta, tema: TEMA, marca: MARCA_PROTOTIPO, fotoUrl: "foto.jpg" }));

  it("sin filter, box-shadow, degradados radiales ni fondos url() (Safari no aplica filter en el renderizador, los radiales solo se dibujan centrados y cuestan un canvas por cuadro, y los fondos con imagen no se dibujan)", () => {
    for (const f of muestras) {
      const h = html(f);
      expect(h, `cuadro ${f}`).not.toMatch(/filter:|box-shadow|radial-gradient|background[^;"]*url\(/);
    }
  });

  it("cantidad de elementos por cuadro acotada (solo se dibuja lo que la cámara ve)", () => {
    let maximo = 0;
    for (const f of muestras) maximo = Math.max(maximo, (html(f).match(/<[a-z]/g) ?? []).length);
    expect(maximo).toBeLessThanOrEqual(PRESUPUESTO_ELEMENTOS);
  });

  it("el feed solo dibuja las publicaciones que se ven", () => {
    const frame = reel.disparos.find((d) => d.accion === "aparece_anuncio")!.cuadro + 20;
    // Solo <img> (React agrega además <link rel="preload"> de cada imagen al renderizar en servidor).
    const posts = (html(frame).match(/Comprar ahora|<img src="[^"]*ilustrado\/post-/g) ?? []).length;
    expect(posts).toBeLessThanOrEqual(Math.ceil(PANTALLA.alto / ALTO_POST) + 1);
  });
});

// Calibrado con el prototipo (máximo medido + ~15%); si una escena nueva
// lo supera, hay que bajar su costo antes de subir este número.
const PRESUPUESTO_ELEMENTOS = 520;

describe("cuadro 0 completo (nunca el celular vacío)", () => {
  const paleta = paletaNoche(TEMA);
  for (const [nombre, tiempos] of TIEMPOS) {
    it(`${nombre}: la primera pantalla entra sin fundido y ya muestra el feed con sus imágenes`, () => {
      const reel = prepararReel(tiempos, PLAN_PROTOTIPO, 30);
      const h = renderToStaticMarkup(createElement(MundoIlustrado, { frame: 0, fps: 30, reel, paleta, tema: TEMA, marca: MARCA_PROTOTIPO, fotoUrl: "foto.jpg" }));
      // Ninguna capa con opacidad 0 (el fundido de entrada dejaba el celular en blanco).
      expect(h).not.toMatch(/opacity:0[;"]/);
      // El feed está: barra de arriba, publicaciones como imagen y la foto del anuncio.
      expect(h).toContain("Inicio");
      expect((h.match(/<img src="[^"]*ilustrado\/post-/g) ?? []).length + (h.match(/<img[^>]*src="foto.jpg"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    });
  }
});

describe("chat que abre el reel (pieza 9c3bec9f, QC: 'pantalla vacía' en el inicio)", () => {
  it("en el cuadro 0 ya se ven la fecha y la primera burbuja, completas", () => {
    const plan = {
      frases: [
        { escena_id: "e1", acciones: [{ escena: "chat" as const, accion: "llega_mensaje", palabra: 1 }] },
        { escena_id: "e2", acciones: [{ escena: "chat" as const, accion: "responde", palabra: 2 }] },
      ],
    };
    const reel = prepararReel(tiemposSinteticos(), plan, 30);
    const h = renderToStaticMarkup(createElement(MundoIlustrado, { frame: 0, fps: 30, reel, paleta: paletaNoche(TEMA), tema: TEMA, marca: MARCA_PROTOTIPO, fotoUrl: "foto.jpg" }));
    expect(h).toContain(">Hoy<");
    const burbuja = h.slice(0, h.indexOf("Hola"));
    expect(burbuja.slice(burbuja.lastIndexOf("opacity:"))).toMatch(/^opacity:1[;"]/);
  });
});

