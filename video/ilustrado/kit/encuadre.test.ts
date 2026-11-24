// Reglas automáticas de cámara en los lugares del kit (revisión de la v4):
// planos sin piso vacío, nunca caras cortadas, un protagonista por toma y
// acciones de grupo. Valen para cualquier composición (la IA compone sola).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ComposicionKitSchema, LUGARES_PISO, POSICIONES, TIPOS_PERSONAJE, type ComposicionKitEntrada } from "./catalogoKit";
import { problemasComposicion } from "./composicion";
import { completarAmbiente, esExtra, MIN_PERSONAJES_SALON } from "./ambiente";
import { conAccionesDeGrupo, EscenaKit, PuertaEnPantalla, tapanCaras } from "./EscenaKit";
import { disparosDeEscena } from "../motor/plan";
import { clave, piezasDeComposicion, urlsSinRasterizar } from "./piezas";
import { PLAN_PROTOTIPO_KIT } from "./planPrototipoKit";
import tiemposKit from "../fixtures/tiemposPrototipoKit.json";
import { camaraDelCuadro, prepararReel } from "../motor/preparar";
import { conCobertura, cuerposEnMundo, planDeCamara, tomasDeCamara } from "../motor/camara";
import { carasCortadas, encuadreSeguro, ZOOM_MINIMO_KIT } from "../motor/encuadreKit";
import { metricasKit } from "../motor/metricasKit";
import { crearRegistro } from "../motor/registro";
import { construirRecorrido } from "../motor/recorrido";
import { MICRO, unionRects } from "../motor/catalogo";
import { ALTO_PANTALLA, FRANJA_SEGURA, rectEnPantalla } from "../motor/geometria";
import type { Disparo } from "../motor/plan";
import { brazoHacia, estadoPose, posicionMano, proporciones } from "./poses";
import type { TiemposIlustrado } from "../tiempoIlustrado";

const reel = prepararReel(tiemposKit as TiemposIlustrado, PLAN_PROTOTIPO_KIT, 30, "prototipo-kit");
const total = reel.linea.duracionCuadros;

describe("cámara del kit: reglas automáticas", () => {
  it("nunca una cara cortada: en todos los cuadros del prototipo, cada personaje está entero (cabeza y torso) o fuera", () => {
    const cuerpos = cuerposEnMundo("k_salon", reel.recorrido, reel.registro);
    const malos: string[] = [];
    for (let f = 0; f < total; f++) {
      const c = carasCortadas(camaraDelCuadro(reel, f), cuerpos);
      if (c.length) malos.push(`${f}:${c.join("+")}`);
    }
    expect(malos).toEqual([]);
  });

  it("planos sin piso vacío y con ritmo: zoom normal, nada de medio cuadro de piso debajo de la gente, ningún plano de más de ~2 s", () => {
    for (const t of reel.tomas.filter((x) => x.escena === "k_salon")) {
      expect(t.encuadre.zoom, `toma ${t.desde}`).toBeGreaterThanOrEqual(ZOOM_MINIMO_KIT - 1e-9);
      // Lo nombrado centrado en la franja útil (no arriba con el piso debajo).
      // Las coberturas (reacciones, detalles) pueden correrse para no cortar a nadie.
      if (t.cobertura) continue;
      const p = rectEnPantalla(unionRects(t.focos), t.encuadre);
      const franja = (FRANJA_SEGURA.arriba + FRANJA_SEGURA.abajo) / 2;
      expect(Math.abs(p.y + p.alto / 2 - franja) / ALTO_PANTALLA, `toma ${t.desde}`).toBeLessThan(0.12);
    }
    const m = metricasKit(reel, 30);
    expect(m.pisoVacioMaximo).toBeLessThanOrEqual(0.25); // incluye el 20 % de la interfaz de Instagram
    expect(m.planoMasLargo).toBeLessThanOrEqual(2.2);
  });

  it("la puerta celular↔salón usa un encuadre seguro, y la pantalla del celular muestra ese mismo encuadre con los personajes", () => {
    const cuerpos = cuerposEnMundo("k_salon", reel.recorrido, reel.registro);
    for (const p of reel.puertas) expect(encuadreSeguro(p.enLugar, cuerpos)).toBe(true);
    const cu = reel.registro.composicion("k_salon")!;
    const p = reel.puertas[0];
    const isla = reel.recorrido.k_salon!;
    const html = renderToStaticMarkup(
      PuertaEnPantalla({ cu, frame: p.cuadro - 2, fps: 30, d: {}, imagenes: urlsSinRasterizar(piezasDeComposicion(cu)), ancho: 700, alto: 1400, opacidad: 1, centro: { x: p.enLugar.x - isla.x, y: p.enLugar.y - isla.y }, escala: p.enLugar.zoom / p.zoomPantalla })!,
    );
    expect((html.match(/<img/g) ?? []).length).toBeGreaterThan(20); // cartelera + personajes
  });
});

describe("acción de grupo (todos.<verbo>)", () => {
  it("'todos.aplaude' dispara el aplauso en cada personaje en la misma palabra, incluido el que tiene algo en la mano", () => {
    const cu = reel.registro.composicion("k_salon")!;
    const d = conAccionesDeGrupo(cu, { "todos.aplaude": [445], "nina.celebra": [405] });
    for (const u of cu.personajes) expect(d[`${u.per.id}.aplaude`], u.per.id).toEqual([445]);
    expect(d["nina.celebra"]).toEqual([405]);
    expect(reel.registro.escena("k_salon")!.acciones["todos.aplaude"].descripcion).toBe("todos aplauden");
  });

  it("la toma de grupo deja enteros a varios (no a uno solo) y nadie cortado", () => {
    const t = reel.tomas.find((x) => x.grupo)!;
    expect(t.focos.length).toBeGreaterThanOrEqual(3);
  });

  it("'todos' es un id reservado", () => {
    const c = ComposicionKitSchema.parse({ id: "k_x", fondo: "salon", personajes: [{ id: "todos", tipo: "nino", posicion: "centro" }], objetos: [] });
    expect(problemasComposicion(c).join(" ")).toMatch(/reservado/);
  });

  it("la escena con una acción de grupo sigue dibujando solo imágenes", () => {
    const cu = reel.registro.composicion("k_salon")!;
    const html = renderToStaticMarkup(EscenaKit({ cu, frame: 460, fps: 30, d: { "todos.aplaude": [445] }, imagenes: urlsSinRasterizar(piezasDeComposicion(cu)) }));
    expect(html).not.toMatch(/<svg/);
  });
});

// Composiciones al azar (como podría armarlas la IA) con acciones al azar:
// en ningún cuadro queda una cara cortada.
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function composicionAlAzar(n: number): ComposicionKitEntrada {
  const r = azar(n * 7919 + 1);
  const elegir = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const personajes: Record<string, unknown>[] = [];
  const objetos: Record<string, unknown>[] = [{ id: "cartelera", tipo: "cartelera", lugar: elegir(["pared_izquierda", "pared_centro", "pared_derecha"]) }];
  const usadas = new Set<string>();
  const cantidad = 2 + Math.floor(r() * 4);
  const pupitres = [...LUGARES_PISO];
  for (let i = 0; i < cantidad; i++) {
    const tipo = i === 0 && r() < 0.6 ? "profesora" : elegir(TIPOS_PERSONAJE.filter((t) => t !== "profesora"));
    const id = `p${i}`;
    const sentado = tipo !== "profesora" && r() < 0.5 && pupitres.length > 0;
    if (sentado) {
      const lugar = pupitres.splice(Math.floor(r() * pupitres.length), 1)[0];
      const plano = r() < 0.5 ? "frente" : "fondo";
      objetos.push({ id: `pup${i}`, tipo: "pupitre", lugar, plano });
      personajes.push({ id, tipo, posicion: elegir(POSICIONES), sentado_en: `pup${i}`, mira: elegir(["izquierda", "derecha"]) });
    } else {
      let posicion = elegir(POSICIONES);
      const plano = r() < 0.6 ? "frente" : "fondo";
      for (let k = 0; k < 5 && usadas.has(`${posicion}-${plano}`); k++) posicion = POSICIONES[(POSICIONES.indexOf(posicion) + 1) % POSICIONES.length];
      usadas.add(`${posicion}-${plano}`);
      personajes.push({ id, tipo, posicion, plano, mira: elegir(["izquierda", "derecha"]) });
    }
  }
  objetos.push({ id: "dibujo", tipo: "dibujo", en_mano_de: "p0" });
  return { id: "k_azar", fondo: "salon", personajes, objetos } as ComposicionKitEntrada;
}

describe("propiedad: con cualquier composición, nadie con la cara cortada", () => {
  it("30 composiciones al azar con acciones al azar (incluidas las de grupo)", () => {
    const fallas: string[] = [];
    let probadas = 0;
    for (let n = 0; n < 30; n++) {
      const comp = composicionAlAzar(n);
      const c = ComposicionKitSchema.safeParse(comp);
      if (!c.success || problemasComposicion(c.data).length) continue;
      probadas++;
      const registro = crearRegistro([comp], `azar-${n}`);
      const acciones = Object.keys(registro.escena("k_azar")!.acciones).filter((a) => a !== MICRO);
      const r = azar(n + 99);
      const disparos: Disparo[] = [];
      for (let f = 20; f < 600; f += 14 + Math.floor(r() * 30)) disparos.push({ escena: "k_azar", accion: acciones[Math.floor(r() * acciones.length)], palabra: 0, cuadro: f, frase: "e1", inicioFrase: 0 });
      const recorrido = construirRecorrido(disparos, registro);
      const tomas = conCobertura(tomasDeCamara(disparos, recorrido, registro), disparos, recorrido, registro, 640);
      const camara = planDeCamara(tomas, 640, 30, { esKit: (e) => !!e && !!registro.composicion(e), pantalla: null, encuadreKit: () => null }).puntos;
      const cuerpos = cuerposEnMundo("k_azar", recorrido, registro);
      const cuAzar = registro.composicion("k_azar")!;
      const dAzar = disparosDeEscena(disparos, "k_azar");
      for (let f = 0; f < 640; f += 3) {
        const tapadas = tapanCaras(cuAzar, dAzar, [], f, 30);
        if (tapadas.length) {
          fallas.push(`composición ${n}, cuadro ${f}: ${tapadas.join("; ")}`);
          break;
        }
      }
      for (let f = 0; f < 640; f++) {
        const cortadas = carasCortadas(camaraDelCuadro({ camara, tomas, pulsos: [], registro }, f), cuerpos);
        if (cortadas.length) {
          fallas.push(`composición ${n}, cuadro ${f}: ${cortadas.join("+")}`);
          break;
        }
      }
    }
    expect(probadas).toBeGreaterThanOrEqual(15);
    expect(fallas).toEqual([]);
  }, 60_000);
});

describe("expresión repetida", () => {
  it("la misma expresión dos veces seguidas (la suya y la de todos) no duplica la capa de la cara", () => {
    const cu = reel.registro.composicion("k_salon")!;
    const imagenes = urlsSinRasterizar(piezasDeComposicion(cu));
    const una = renderToStaticMarkup(EscenaKit({ cu, frame: 100, fps: 30, d: { "nina.feliz": [60] }, imagenes }));
    const dos = renderToStaticMarkup(EscenaKit({ cu, frame: 100, fps: 30, d: { "nina.feliz": [60, 100] }, imagenes }));
    const n = (h: string) => (h.match(/<img/g) ?? []).length;
    expect(n(dos)).toBe(n(una));
  });
});

describe("lo que se tiene en la mano", () => {
  it("al aplaudir, la bolsa de dulces va detrás del cuerpo (no tapa la cara)", () => {
    const cu = reel.registro.composicion("k_salon")!;
    const imagenes = urlsSinRasterizar(piezasDeComposicion(cu));
    const nino = cu.personajes.find((u) => u.per.id === "nino")!;
    const urlDulces = imagenes[clave.dulces()].url;
    const urlCuerpo = imagenes[clave.cuerpo(nino.aspecto)].url;
    // Posición de los dulces respecto del cuerpo del niño en el HTML (orden de dibujo).
    const orden = (h: string) => ({ dulces: h.indexOf(urlDulces) - h.indexOf(urlCuerpo) });
    const quieto = orden(renderToStaticMarkup(EscenaKit({ cu, frame: 200, fps: 30, d: {}, imagenes })));
    const aplaude = orden(renderToStaticMarkup(EscenaKit({ cu, frame: 200, fps: 30, d: { "todos.aplaude": [190] }, imagenes })));
    // Quieto: los dulces después del cuerpo (encima); aplaudiendo: antes (detrás).
    expect(quieto.dulces).toBeGreaterThan(0);
    expect(aplaude.dulces).toBeLessThan(0);
  });
});

describe("reglas de director (revisión de la v6)", () => {
  const trio = ComposicionKitSchema.parse({
    id: "k_x",
    fondo: "salon",
    personajes: [
      { id: "nino", tipo: "nino", posicion: "izquierda" },
      { id: "profesora", tipo: "profesora", posicion: "derecha" },
      { id: "nina", tipo: "nina", posicion: "centro_derecha", plano: "fondo" },
    ],
    objetos: [{ id: "cartelera", tipo: "cartelera", lugar: "pared_centro" }],
  });

  it("escena poblada: con pocos personajes, el código agrega niños sentados al fondo (variados, mirando la cartelera, sin tapar nada)", () => {
    const c = completarAmbiente(trio, "s1");
    const extras = c.personajes.filter((p) => esExtra(p.id));
    expect(c.personajes.length).toBeGreaterThanOrEqual(MIN_PERSONAJES_SALON);
    for (const e of extras) {
      expect(e.sentado_en).toBeDefined();
      expect(c.objetos.find((o) => o.id === e.sentado_en)?.plano).toBe("fondo");
      expect(e.mira_a).toBe("cartelera");
    }
    expect(problemasComposicion(c)).toEqual([]);
    // Varían con la semilla del reel.
    const otra = completarAmbiente(trio, "s2");
    const r1 = crearRegistro([trio], "s1").composicion("k_x")!;
    const r2 = crearRegistro([trio], "s2").composicion("k_x")!;
    expect(r1.personajes.length).toBe(c.personajes.length);
    expect(JSON.stringify(r1.personajes.filter((u) => esExtra(u.per.id)).map((u) => u.aspecto)) !== JSON.stringify(r2.personajes.filter((u) => esExtra(u.per.id)).map((u) => u.aspecto)) || JSON.stringify(otra) !== JSON.stringify(c)).toBe(true);
    // La composición del prototipo ya tiene ambiente: no se toca.
    expect(completarAmbiente(ComposicionKitSchema.parse(PLAN_PROTOTIPO_KIT.composiciones![0]), "x").personajes.length).toBe(5);
  });

  it("nunca en fila: tres o más personajes todos de pie adelante es un problema para la IA", () => {
    const fila = ComposicionKitSchema.parse({ ...trio, personajes: trio.personajes.map((p) => ({ ...p, plano: "frente" })) });
    expect(problemasComposicion(fila).join(" ")).toMatch(/en fila/);
    expect(problemasComposicion(trio).join(" ")).not.toMatch(/en fila/);
  });

  it("el que se distrae pone cara de aburrido (está en la lista de la IA, también para todos)", () => {
    const def = reel.registro.escena("k_salon")!.acciones;
    expect(def["nino.se_distrae"].descripcion).toMatch(/distrae/);
    expect(def["todos.se_distrae"].descripcion).toBe("todos se aburren y se distraen");
    const cu = reel.registro.composicion("k_salon")!;
    const imagenes = urlsSinRasterizar(piezasDeComposicion(cu));
    const nino = cu.personajes.find((u) => u.per.id === "nino")!;
    const aburrido = imagenes[clave.rasgos(nino.aspecto, "aburrido", "abiertos")].url;
    expect(renderToStaticMarkup(EscenaKit({ cu, frame: 130, fps: 30, d: { "nino.se_distrae": [100] }, imagenes }))).toContain(aburrido);
  });

  it("si lo que pide la acción no cabe con zoom normal, se usa un foco más chico (nunca un plano lejano)", () => {
    const cu = reel.registro.composicion("k_salon")!;
    const [hueco] = reel.registro.focoReducido("k_salon", "dibujo_nina.va_al_hueco");
    const cart = cu.objetos.find((o) => o.obj.tipo === "cartelera")!.rect!;
    expect(hueco.ancho).toBeLessThan(cart.ancho);
    expect(reel.registro.focoReducido("k_salon", "nino.ofrece", "profesora")[0]).toEqual(reel.registro.foco("k_salon", "nino.ofrece"));
  });
});

describe("gestos que contradicen la cara", () => {
  it("el que estaba aburrido y levanta la mano pasa a atento (nadie participa con cara de aburrido)", () => {
    const cu = reel.registro.composicion("k_salon")!;
    const imagenes = urlsSinRasterizar(piezasDeComposicion(cu));
    const nino = cu.personajes.find((u) => u.per.id === "nino")!;
    const html = renderToStaticMarkup(EscenaKit({ cu, frame: 200, fps: 30, d: { "nino.se_distrae": [100], "nino.levanta_la_mano": [180] }, imagenes }));
    expect(html).toContain(imagenes[clave.rasgos(nino.aspecto, "atento", "abiertos")].url);
    expect(html).not.toContain(imagenes[clave.rasgos(nino.aspecto, "aburrido", "abiertos")].url);
  });
});

describe("emociones legibles en un celular y nada tapa una cara (revisión de la v7)", () => {
  it("aburrido: la mano bajo el mentón (no sobre la cara), el cuerpo hundido y la cabeza ladeada", () => {
    for (const tipo of ["nino", "nina", "profesora"] as const) {
      const p = proporciones(tipo);
      const e = estadoPose("apoyar_cabeza", 10, 30, p);
      const mano = posicionMano(p, e.mira, "mira");
      expect(mano.y, tipo).toBeGreaterThan(p.cabeza.cy + p.cabeza.ry * 0.7); // debajo de la boca
      expect(Math.abs(mano.x - p.cx), tipo).toBeLessThan(p.cabeza.rx); // bajo el mentón
      expect(e.saltoY, tipo).toBeGreaterThan(0); // hundido
      expect(Math.abs(e.inclinacion), tipo).toBeGreaterThan(6); // cabeza ladeada
    }
    const p = proporciones("nino");
    const destino = { x: p.cx + 18, y: 260 };
    const m = posicionMano(p, { ...brazoHacia(p, "mira", destino), mano: "abierta" }, "mira");
    expect(Math.hypot(m.x - destino.x, m.y - destino.y)).toBeLessThan(2);
  });

  it("el distraído bosteza cada tanto y mira hacia la ventana; el atento se ve distinto (cara y cuerpo)", () => {
    const cu = reel.registro.composicion("k_salon")!;
    const imagenes = urlsSinRasterizar(piezasDeComposicion(cu));
    const nino = cu.personajes.find((u) => u.per.id === "nino")!;
    const bostezo = imagenes[clave.rasgos(nino.aspecto, "bostezo", "abiertos")].url;
    const cuadros = Array.from({ length: 120 }, (_, i) => renderToStaticMarkup(EscenaKit({ cu, frame: 130 + i, fps: 30, d: { "nino.se_distrae": [100] }, imagenes })));
    expect(cuadros.some((h) => h.includes(bostezo))).toBe(true);
    expect(cuadros.filter((h) => h.includes(bostezo)).length).toBeLessThan(cuadros.length / 2);
    const atento = estadoPose("inclinarse", 10, 30, nino.p);
    const aburrido = estadoPose("apoyar_cabeza", 10, 30, nino.p);
    expect(atento.saltoY).toBeLessThan(0); // derecho, hacia arriba
    expect(aburrido.saltoY).toBeGreaterThan(0); // hundido
    expect(reel.registro.escena("k_salon")!.acciones["todos.presta_atencion"].descripcion).toBe("todos prestan atención");
  });

  it("ningún brazo ni objeto pasa por delante de una cara, en ningún cuadro de los planes de prueba", () => {
    const cu = reel.registro.composicion("k_salon")!;
    const d = disparosDeEscena(reel.disparos, "k_salon");
    const objetivos = reel.disparos.filter((x) => x.escena === "k_salon" && x.objetivo).map((x) => ({ accion: x.accion, cuadro: x.cuadro, objetivo: x.objetivo! }));
    const malos = Array.from({ length: total }, (_, f) => tapanCaras(cu, d, objetivos, f, 30).map((m) => `${f}: ${m}`)).flat();
    expect(malos).toEqual([]);
  });
});
