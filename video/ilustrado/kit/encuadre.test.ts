// Reglas automáticas de cámara en los lugares del kit (revisión de la v4):
// planos sin piso vacío, nunca caras cortadas, un protagonista por toma y
// acciones de grupo. Valen para cualquier composición (la IA compone sola).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ComposicionKitSchema, LUGARES_PISO, POSICIONES, TIPOS_PERSONAJE, type ComposicionKitEntrada } from "./catalogoKit";
import { problemasComposicion } from "./composicion";
import { conAccionesDeGrupo, EscenaKit, PuertaEnPantalla } from "./EscenaKit";
import { clave, piezasDeComposicion, urlsSinRasterizar } from "./piezas";
import { PLAN_PROTOTIPO_KIT } from "./planPrototipoKit";
import tiemposKit from "../fixtures/tiemposPrototipoKit.json";
import { camaraDelCuadro, prepararReel } from "../motor/preparar";
import { CORTE_MINIMO_KIT, cuerposEnMundo, planDeCamara, tomasDeCamara } from "../motor/camara";
import { carasCortadas, encuadreSeguro, ZOOM_MINIMO_KIT, ZOOM_MINIMO_KIT_EXCEPCIONAL } from "../motor/encuadreKit";
import { crearRegistro } from "../motor/registro";
import { construirRecorrido } from "../motor/recorrido";
import { MICRO, unionRects } from "../motor/catalogo";
import { ALTO_PANTALLA, FRANJA_SEGURA, rectEnPantalla } from "../motor/geometria";
import type { Disparo } from "../motor/plan";
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

  it("planos sin piso vacío: zoom >= 0,8 (salvo excepción) y lo nombrado centrado en la franja útil, no arriba con el piso debajo", () => {
    for (const t of reel.tomas.filter((x) => x.escena === "k_salon")) {
      expect(t.encuadre.zoom, `toma ${t.desde}`).toBeGreaterThanOrEqual(ZOOM_MINIMO_KIT_EXCEPCIONAL - 1e-9);
      const p = rectEnPantalla(unionRects(t.focos), t.encuadre);
      const centro = p.y + p.alto / 2;
      const franja = (FRANJA_SEGURA.arriba + FRANJA_SEGURA.abajo) / 2;
      expect(Math.abs(centro - franja) / ALTO_PANTALLA, `toma ${t.desde}`).toBeLessThan(0.1);
      // Lo que queda debajo de lo nombrado (piso + interfaz de Instagram).
      expect((ALTO_PANTALLA - (p.y + p.alto)) / ALTO_PANTALLA, `toma ${t.desde}`).toBeLessThan(0.35);
    }
    // Más abierto que 0,8 solo para acciones entre dos cosas lejanas (alguien
    // le da algo a otro, el dibujo vuela a la cartelera) y sin otra salida.
    for (const t of reel.tomas.filter((x) => x.escena === "k_salon" && x.encuadre.zoom < ZOOM_MINIMO_KIT - 1e-9)) {
      const acciones = reel.disparos.filter((d) => d.escena === "k_salon" && d.cuadro >= t.desde - CORTE_MINIMO_KIT && d.cuadro <= t.ultimaAccion);
      expect(acciones.some((d) => d.objetivo || d.accion.endsWith(".va_al_hueco")), `toma ${t.desde}`).toBe(true);
    }
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
      const tomas = tomasDeCamara(disparos, recorrido, registro);
      const camara = planDeCamara(tomas, 640, 30, { esKit: (e) => !!e && !!registro.composicion(e), pantalla: null, encuadreKit: () => null }).puntos;
      const cuerpos = cuerposEnMundo("k_azar", recorrido, registro);
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
