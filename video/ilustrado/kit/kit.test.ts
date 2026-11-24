import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ComposicionKitSchema } from "./catalogoKit";
import { aspectoDe, problemasComposicion, rectPersonaje, ubicarComposicion } from "./composicion";
import { EscenaKit, atencionesDe } from "./EscenaKit";
import { piezasDeComposicion, urlsSinRasterizar } from "./piezas";
import { apunteHacia, conVueltasAParado, estadoPose, posicionMano, proporciones } from "./poses";
import { COMPOSICION_SALON, NARRACION_PROTOTIPO_KIT, PLAN_PROTOTIPO_KIT } from "./planPrototipoKit";
import tiemposKit from "../fixtures/tiemposPrototipoKit.json";
import { prepararReel } from "../motor/preparar";
import { crearRegistro } from "../motor/registro";
import { ocupacion } from "../motor/geometria";
import { unionRects } from "../motor/catalogo";
import { validarPlanIlustrado } from "../motor/validarPlan";
import { camaraEnCuadro, type TiemposIlustrado } from "../tiempoIlustrado";

describe("kit de escenas: la IA solo compone con listas cerradas", () => {
  it("acepta la composición del prototipo y rechaza valores fuera de las listas o campos de más (nunca código ni SVG)", () => {
    expect(ComposicionKitSchema.safeParse(COMPOSICION_SALON).success).toBe(true);
    const base = { id: "k_x", fondo: "salon", personajes: [], objetos: [] };
    expect(ComposicionKitSchema.safeParse({ ...base, personajes: [{ id: "a", tipo: "perro", posicion: "centro" }] }).success).toBe(false);
    expect(ComposicionKitSchema.safeParse({ ...base, fondo: "playa" }).success).toBe(false);
    expect(ComposicionKitSchema.safeParse({ ...base, svg: "<svg/>" }).success).toBe(false);
    expect(ComposicionKitSchema.safeParse({ ...base, objetos: [{ id: "c", tipo: "dulces" }] }).success).toBe(false); // sin lugar ni mano
  });

  it("problemas de una composición: ids repetidos, mano de alguien que no existe, dos personajes en la misma casilla", () => {
    const c = ComposicionKitSchema.parse({
      id: "k_x",
      fondo: "salon",
      personajes: [
        { id: "a", tipo: "nino", posicion: "centro" },
        { id: "a", tipo: "nina", posicion: "centro" },
      ],
      objetos: [{ id: "d", tipo: "dulces", en_mano_de: "fantasma" }],
    });
    const p = problemasComposicion(c).join(" ");
    expect(p).toMatch(/"a" se repite/);
    expect(p).toMatch(/mano de "fantasma"/);
    expect(p).toMatch(/misma posición "centro"/);
  });

  it("variedad: lo que la IA no fija cambia con la semilla del reel; lo que fija, se respeta", () => {
    const per = ComposicionKitSchema.parse({ id: "k_x", fondo: "salon", personajes: [{ id: "n", tipo: "nina", posicion: "centro" }], objetos: [] }).personajes[0];
    const aspectos = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(aspectoDe(per, `reel-${i}`, 0))));
    expect(aspectos.size).toBeGreaterThan(6);
    const fijo = { ...per, ropa: "rojo" as const, piel: "oscura" as const };
    expect(aspectoDe(fijo, "a", 0)).toMatchObject({ ropa: "rojo", piel: "oscura" });
  });
});

describe("poses con brazos articulados", () => {
  it("aplaudir: las manos se juntan frente al pecho (no en la cintura)", () => {
    for (const tipo of ["profesora", "nino"] as const) {
      const p = proporciones(tipo);
      const e = estadoPose("aplaudir", 0, 30, p); // t=0: juntas
      const m = posicionMano(p, e.mira, "mira");
      const o = posicionMano(p, e.otro, "otro");
      expect(Math.abs(m.x - o.x), tipo).toBeLessThan(30);
      expect(m.y, tipo).toBeLessThan((p.torso.y0 + p.torso.y1) / 2);
    }
  });

  it("señalar apunta al objetivo; los gestos vuelven solos a 'parado'", () => {
    const p = proporciones("profesora");
    expect(apunteHacia(p, p.cx + 600, p.hombroY)).toBeCloseTo(90, 0); // a la altura del hombro: horizontal
    expect(apunteHacia(p, p.cx + 400, p.hombroY + 400)).toBeLessThan(60); // abajo: brazo inclinado
    const cambios = conVueltasAParado([{ cuadro: 0, pose: "senalar" }]);
    expect(cambios.at(-1)).toMatchObject({ pose: "parado" });
  });
});

describe("el kit en el motor (registro, cámara, validación)", () => {
  const tiempos = tiemposKit as TiemposIlustrado;

  it("el plan del prototipo pasa la misma validación que los planes de la IA", () => {
    expect(validarPlanIlustrado(PLAN_PROTOTIPO_KIT, NARRACION_PROTOTIPO_KIT)).toEqual([]);
  });

  it("acción o objetivo que no existen en la composición: se rechazan con un mensaje para la IA", () => {
    const malo = { ...PLAN_PROTOTIPO_KIT, frases: PLAN_PROTOTIPO_KIT.frases.map((f, i) => (i === 3 ? { ...f, acciones: [{ escena: "k_salon", accion: "profesora.vuela", palabra: 0 }, { escena: "k_salon", accion: "profesora.senala", palabra: 2, objetivo: "nadie" }] } : f)) };
    const p = validarPlanIlustrado(malo, NARRACION_PROTOTIPO_KIT).join(" ");
    expect(p).toMatch(/no tiene la acción "profesora.vuela"/);
    expect(p).toMatch(/el objetivo "nadie"/);
  });

  it("cada composición es una isla: lo nombrado ocupa >= 50 % (o el grupo, cuando la cámara encuadra a todos juntos)", () => {
    const reel = prepararReel(tiempos, PLAN_PROTOTIPO_KIT, 30, "prototipo");
    expect(Object.keys(reel.recorrido)).toEqual(expect.arrayContaining(["celular", "k_salon"]));
    for (const t of reel.tomas) {
      const individual = Math.min(...t.focos.map((f) => ocupacion(f, t.encuadre)));
      expect(Math.max(individual, ocupacion(unionRects(t.focos), t.encuadre)), `toma ${t.desde}`).toBeGreaterThanOrEqual(0.5);
    }
    // Sin saltar de un niño a otro cada pocos cuadros.
    const delSalon = reel.tomas.filter((t) => t.escena === "k_salon");
    for (let i = 1; i < delSalon.length; i++) expect(delSalon[i].desde - delSalon[i - 1].desde, `tomas ${delSalon[i - 1].desde}->${delSalon[i].desde}`).toBeGreaterThanOrEqual(8);
  });

  it("el registro describe lo que se ve (para el control de calidad por visión), sin inventar texto", () => {
    const r = crearRegistro([COMPOSICION_SALON], "x");
    const def = r.escena("k_salon")!;
    expect(def.visible).toMatch(/salón de clases.*una profesora.*cartelera/);
    expect(def.acciones["profesora.senala"].descripcion).toBe("la profesora señala");
    expect(def.acciones["dibujo_nina.va_al_hueco"]).toBeDefined();
  });
});

describe("dibujo y rendimiento", () => {
  const cu = ubicarComposicion(COMPOSICION_SALON, "prototipo");
  const piezas = piezasDeComposicion(cu);

  it("ninguna pieza tiene texto (las cosas se muestran, no se escriben)", () => {
    for (const p of piezas) expect(p.parte.svg, p.clave).not.toMatch(/<text|<tspan|font-family/);
  });

  it("la escena solo dibuja imágenes (PNG precargados), nunca un <svg> por cuadro", () => {
    const html = renderToStaticMarkup(EscenaKit({ cu, frame: 200, fps: 30, d: { "profesora.senala": [190], "cartelera.aparece": [10] }, imagenes: urlsSinRasterizar(piezas) }));
    expect(html).not.toMatch(/<svg/);
    expect((html.match(/<img/g) ?? []).length).toBeGreaterThan(30);
  });

  it("los niños se ven a >= 50 % con el zoom máximo (no quedan chicos)", () => {
    const nino = cu.personajes.find((u) => u.per.tipo === "nino")!;
    expect(rectPersonaje(nino).alto * 1.3).toBeGreaterThanOrEqual(1920 * 0.5);
  });
});

describe("v4: lugar a pantalla completa, sentados, mirada y puerta celular↔salón", () => {
  const tiempos = tiemposKit as TiemposIlustrado;
  const cu = ubicarComposicion(COMPOSICION_SALON, "prototipo");

  it("los niños sentados quedan detrás de su pupitre (los pies no pasan del borde de abajo del pupitre)", () => {
    const sentados = cu.personajes.filter((u) => u.per.sentado_en);
    expect(sentados.length).toBe(3);
    for (const u of sentados) {
      const pupitre = u.sentado!.pupitre;
      const r = rectPersonaje(u);
      expect(r.x + r.ancho / 2, u.per.id).toBeGreaterThan(pupitre.x);
      expect(r.x + r.ancho / 2, u.per.id).toBeLessThan(pupitre.x + pupitre.ancho);
      expect(r.y + r.alto, u.per.id).toBeLessThanOrEqual(pupitre.y + pupitre.alto + 1);
    }
  });

  it("nadie tapa la cartelera: alguien de pie justo delante es un problema para la IA (la composición del prototipo pasa)", () => {
    expect(problemasComposicion(COMPOSICION_SALON)).toEqual([]);
    const c = ComposicionKitSchema.parse({
      id: "k_x",
      fondo: "salon",
      personajes: [{ id: "profesora", tipo: "profesora", posicion: "centro" }],
      objetos: [{ id: "cartelera", tipo: "cartelera", lugar: "pared_centro" }],
    });
    expect(problemasComposicion(c).join(" ")).toMatch(/"profesora" tapa la cartelera/);
  });

  it("un dibujo en el piso o alguien con dos cosas en la mano: problema para la IA", () => {
    const c = ComposicionKitSchema.parse({
      id: "k_x",
      fondo: "salon",
      personajes: [{ id: "a", tipo: "nino", posicion: "centro" }],
      objetos: [
        { id: "d", tipo: "dibujo", lugar: "piso_izquierda" },
        { id: "e", tipo: "dibujo", en_mano_de: "a" },
        { id: "f", tipo: "dulces", en_mano_de: "a" },
      ],
    });
    const p = problemasComposicion(c).join(" ");
    expect(p).toMatch(/"d" va en la pared o en la mano/);
    expect(p).toMatch(/"a" sostiene más de una cosa/);
  });

  it("dos niños en el mismo pupitre o sentado en algo que no es pupitre: problema para la IA", () => {
    const c = ComposicionKitSchema.parse({
      id: "k_x",
      fondo: "salon",
      personajes: [
        { id: "a", tipo: "nino", posicion: "centro", sentado_en: "p" },
        { id: "b", tipo: "nina", posicion: "derecha", sentado_en: "p" },
        { id: "c", tipo: "nina", posicion: "izquierda", sentado_en: "d", mira_a: "nadie" },
      ],
      objetos: [{ id: "p", tipo: "pupitre", lugar: "piso_centro" }, { id: "d", tipo: "dulces", en_mano_de: "a" }],
    });
    const p = problemasComposicion(c).join(" ");
    expect(p).toMatch(/pupitre/);
    expect(p).toMatch(/nadie/);
  });

  it("la mirada va hacia lo que pasa: cuando la profesora señala el dibujo, hay un punto de atención en el dibujo", () => {
    const at = atencionesDe(cu, { "profesora.senala": [100] }, [{ accion: "profesora.senala", cuadro: 100, objetivo: "dibujo_nina" }]);
    expect(at.length).toBe(1);
    expect(at[0].desde).toBeLessThanOrEqual(100);
    expect(at[0].hasta).toBeGreaterThan(130);
  });

  it("parpadeo y respiración: dos cuadros distintos del mismo personaje quieto cambian algo (no es una foto)", () => {
    const imagenes = urlsSinRasterizar(piezasDeComposicion(cu));
    const cuadros = Array.from({ length: 160 }, (_, i) => renderToStaticMarkup(EscenaKit({ cu, frame: i, fps: 30, d: {}, imagenes })));
    expect(new Set(cuadros).size).toBeGreaterThan(20);
    const ojosCerrados = Object.entries(imagenes).filter(([k]) => k.startsWith("rasgos:") && k.endsWith(":cerrados")).map(([, v]) => v.url);
    expect(cuadros.some((h) => ojosCerrados.some((url) => h.includes(url)))).toBe(true);
  });

  it("del celular al salón (y de vuelta) se entra por la pantalla del celular: nunca se ve el mundo oscuro", () => {
    const reel = prepararReel(tiempos, PLAN_PROTOTIPO_KIT, 30, "prototipo");
    expect(reel.puertas.map((p) => p.desde)).toEqual(["celular", "kit"]);
    expect(reel.viajes.length).toBe(0);
    // Al salir, la cámara no viaja por el salón: ya está sobre la cartelera
    // (solo se cierra) los cuadros antes de pasar al celular.
    const salida = reel.puertas.find((p) => p.desde === "kit")!.cuadro;
    const xs = Array.from({ length: 12 }, (_, k) => Math.round(camaraEnCuadro(reel.camara, salida - 12 + k).x));
    expect(new Set(xs).size).toBe(1);
  });

  it("en el salón no hay cortes más seguidos que cada 12 cuadros", () => {
    const reel = prepararReel(tiempos, PLAN_PROTOTIPO_KIT, 30, "prototipo");
    const delSalon = reel.tomas.filter((t) => t.escena === "k_salon");
    for (let i = 1; i < delSalon.length; i++) expect(delSalon[i].desde - delSalon[i - 1].desde).toBeGreaterThanOrEqual(12);
  });
});

describe("v4: rendimiento", () => {
  it("con la cámara cerca de un niño, no se dibuja lo que queda fuera de cuadro", () => {
    const cu = ubicarComposicion(COMPOSICION_SALON, "prototipo");
    const imagenes = urlsSinRasterizar(piezasDeComposicion(cu));
    const todo = (renderToStaticMarkup(EscenaKit({ cu, frame: 200, fps: 30, d: {}, imagenes })).match(/<img/g) ?? []).length;
    const nino = rectPersonaje(cu.personajes.find((u) => u.per.id === "nino")!);
    const vista = { x: nino.x - 100, y: nino.y, ancho: 1080 / 1.6, alto: 1920 / 1.6 };
    const cerca = (renderToStaticMarkup(EscenaKit({ cu, frame: 200, fps: 30, d: {}, imagenes, vista })).match(/<img/g) ?? []).length;
    expect(cerca).toBeLessThan(todo * 0.7);
  });
});
