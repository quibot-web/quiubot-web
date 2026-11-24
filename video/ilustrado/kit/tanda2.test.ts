// Tanda 2 del kit (24 nov 2026): tienda, cocina y calle; vendedor/a,
// cliente, emprendedor/a, mamá/papá, persona mayor; torta, helado, caja,
// bolsa, celular, moto y carro (más mostrador, vitrina y mesa). Mismas
// reglas de director y cámara que el salón. Los planes son salidas reales
// de la IA con las narraciones de muestra.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import planTienda from "../fixtures/planIATienda.json";
import planTorta from "../fixtures/planIATorta.json";
import tiemposTienda from "../fixtures/tiemposTienda.json";
import tiemposTorta from "../fixtures/tiemposTorta.json";
import { camaraDelCuadro, prepararReel } from "../motor/preparar";
import { metricasKit } from "../motor/metricasKit";
import { cuerposEnMundo } from "../motor/camara";
import { carasCortadas } from "../motor/encuadreKit";
import { disparosDeEscena, type PlanIlustrado } from "../motor/plan";
import { validarPlanIlustrado } from "../motor/validarPlan";
import { crearRegistro } from "../motor/registro";
import { ComposicionKitSchema, TIPOS_PERSONAJE } from "./catalogoKit";
import { problemasComposicion, ubicarComposicion } from "./composicion";
import { EscenaKit, presenciaDe, tapanCaras } from "./EscenaKit";
import { piezasDeComposicion, urlsSinRasterizar } from "./piezas";
import type { TiemposIlustrado } from "../tiempoIlustrado";

const casos = [
  ["tienda", planTienda, tiemposTienda],
  ["torta", planTorta, tiemposTorta],
] as const;

describe("tanda 2: los planes de negocio de la IA cumplen todas las reglas", () => {
  for (const [nombre, plan, tiempos] of casos) {
    it(`${nombre}: válido, sin caras cortadas ni tapadas, ningún plano de más de ~2 s, sin piso vacío`, () => {
      expect(validarPlanIlustrado(plan, tiempos.escenas)).toEqual([]);
      const reel = prepararReel(tiempos as TiemposIlustrado, plan as PlanIlustrado, 30, "");
      const m = metricasKit(reel, 30);
      expect(m.planoMasLargo).toBeLessThanOrEqual(2.2);
      expect(m.pisoVacioMaximo).toBeLessThanOrEqual(0.25);
      for (const id of Object.keys(reel.recorrido).filter((x) => reel.registro.composicion(x))) {
        const cuerpos = cuerposEnMundo(id, reel.recorrido, reel.registro);
        const cu = reel.registro.composicion(id)!;
        const d = disparosDeEscena(reel.disparos, id);
        for (let f = 0; f < reel.linea.duracionCuadros; f++) {
          expect(carasCortadas(camaraDelCuadro(reel, f), cuerpos), `${id} cuadro ${f}`).toEqual([]);
          if (f % 3 === 0) expect(tapanCaras(cu, d, [], f, 30), `${id} cuadro ${f}`).toEqual([]);
        }
      }
    }, 60_000);
  }
});

describe("tanda 2: reglas de composición y presencia", () => {
  const base = { id: "k_t", fondo: "tienda" as const };
  it("cada cosa donde tiene sentido: vehículos solo en la calle, muebles en el piso, 'sobre' solo un mostrador, vitrina o mesa", () => {
    const c = ComposicionKitSchema.parse({
      ...base,
      personajes: [{ id: "v", tipo: "vendedora", posicion: "derecha" }],
      objetos: [
        { id: "moto", tipo: "moto", lugar: "piso_izquierda" },
        { id: "vitrina", tipo: "vitrina", lugar: "pared_centro" },
        { id: "torta", tipo: "torta", sobre: "v" },
        { id: "helado", tipo: "helado", lugar: "piso_centro" },
      ],
    });
    const p = problemasComposicion(c).join(" ");
    expect(p).toMatch(/"moto" \(moto\) no va en tienda/);
    expect(p).toMatch(/"vitrina" \(vitrina\) va en el piso/);
    expect(p).toMatch(/"torta" está sobre "v"/);
    expect(p).toMatch(/"helado" \(helado\) no va en el piso/);
  });

  it("la torta va en la repisa de la vitrina; quien se sienta a la mesa queda detrás de ella", () => {
    const c = ComposicionKitSchema.parse({
      id: "k_c",
      fondo: "cocina",
      personajes: [{ id: "mama", tipo: "mama", posicion: "centro", sentado_en: "mesa" }],
      objetos: [
        { id: "mesa", tipo: "mesa", lugar: "piso_centro" },
        { id: "vitrina", tipo: "vitrina", lugar: "piso_derecha" },
        { id: "torta", tipo: "torta", sobre: "vitrina" },
      ],
    });
    expect(problemasComposicion(c)).toEqual([]);
    const cu = ubicarComposicion(c, "x");
    const vitrina = cu.objetos.find((o) => o.obj.id === "vitrina")!.rect!;
    const torta = cu.objetos.find((o) => o.obj.id === "torta")!.rect!;
    expect(torta.y + torta.alto).toBeGreaterThan(vitrina.y);
    expect(torta.y + torta.alto).toBeLessThan(vitrina.y + vitrina.alto * 0.5);
    expect(cu.personajes[0].sentado?.mueble).toBe("mesa");
  });

  it("entrar e irse: solo entra quien no está y solo se va quien está; quien se fue no actúa hasta volver", () => {
    const plan = planTienda as PlanIlustrado;
    const roto = { ...plan, frases: plan.frases.map((f) => (f.escena_id === "e3" ? { ...f, acciones: f.acciones.filter((a) => !a.accion.endsWith(".se_va")) } : f)) };
    expect(validarPlanIlustrado(roto, tiemposTienda.escenas).join(" ")).toMatch(/"cliente" ya está/);
  });

  it("el que entra camina desde la puerta (antes no está); el que se va desaparece", () => {
    const reel = prepararReel(tiemposTienda as TiemposIlustrado, planTienda as PlanIlustrado, 30, "");
    const cu = reel.registro.composicion("k_tienda")!;
    const cliente = cu.personajes.find((u) => u.per.id === "cliente")!;
    const d = disparosDeEscena(reel.disparos, "k_tienda");
    const primeraEntrada = d["cliente.entra"][0];
    const salida = d["cliente.se_va"][0];
    expect(presenciaDe(cliente, cu, d, primeraEntrada + 2).alpha).toBeLessThan(0.5);
    expect(presenciaDe(cliente, cu, d, primeraEntrada + 60).alpha).toBe(1);
    // Saliendo: camina (o se desvanece en la puerta) y ya no está del todo.
    const saliendo = presenciaDe(cliente, cu, d, salida + 10);
    expect(saliendo.camina).toBe(true);
    expect(saliendo.alpha).toBeLessThan(1);
  });

  it("la misma persona (mismo id) en dos lugares se ve igual", () => {
    const comp = (id: string, fondo: "tienda" | "calle") => ({ id, fondo, personajes: [{ id: "cliente", tipo: "cliente" as const, posicion: "centro" as const }], objetos: [] });
    const r = crearRegistro([comp("k_a", "tienda"), comp("k_b", "calle")], "s");
    expect(r.composicion("k_b")!.personajes[0].aspecto).toEqual(r.composicion("k_a")!.personajes[0].aspecto);
  });

  it("todos los personajes nuevos y objetos se dibujan con imágenes (sin <svg> por cuadro ni texto)", () => {
    const tipos = TIPOS_PERSONAJE.filter((t) => !["profesora", "nino", "nina"].includes(t));
    const c = ComposicionKitSchema.parse({
      id: "k_c",
      fondo: "calle",
      personajes: tipos.slice(0, 5).map((tipo, i) => ({ id: `p${i}`, tipo, posicion: (["izquierda", "centro_izquierda", "centro", "centro_derecha", "derecha"] as const)[i], plano: i % 2 ? "fondo" : "frente" })),
      objetos: [
        { id: "carro", tipo: "carro", lugar: "piso_centro", plano: "fondo" },
        { id: "helado", tipo: "helado", en_mano_de: "p0" },
        { id: "bolsa", tipo: "bolsa", en_mano_de: "p1" },
        { id: "celular", tipo: "celular", en_mano_de: "p2" },
        { id: "caja", tipo: "caja", en_mano_de: "p3" },
      ],
    });
    const cu = ubicarComposicion(c, "x");
    const piezas = piezasDeComposicion(cu);
    for (const p of piezas) expect(p.parte.svg, p.clave).not.toMatch(/<text|<tspan|font-family/);
    const html = renderToStaticMarkup(EscenaKit({ cu, frame: 40, fps: 30, d: {}, imagenes: urlsSinRasterizar(piezas) }));
    expect(html).not.toMatch(/<svg/);
    for (const k of ["carro", "helado", "bolsa", "celular", "caja"]) expect(piezas.some((p) => p.clave === k), k).toBe(true);
  });
});
