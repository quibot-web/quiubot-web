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
import { cuerposEnCuadro } from "../motor/camara";
import { carasCortadas } from "../motor/encuadreKit";
import { disparosDeEscena, type PlanIlustrado } from "../motor/plan";
import { validarPlanIlustrado } from "../motor/validarPlan";
import { crearRegistro } from "../motor/registro";
import { ComposicionKitSchema, TIPOS_PERSONAJE } from "./catalogoKit";
import { problemasComposicion, rectCabezaTorso, ubicarComposicion } from "./composicion";
import { CUADROS_PASAR, EscenaKit, presenciaDe, tapanCaras } from "./EscenaKit";
import { caminataEn, rectEnPresencia } from "./presencia";
import { svgCuerpo, svgPierna, type AspectoPersonaje } from "./dibujoPersonaje";
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
        const cu = reel.registro.composicion(id)!;
        const d = disparosDeEscena(reel.disparos, id);
        for (let f = 0; f < reel.linea.duracionCuadros; f++) {
          expect(carasCortadas(camaraDelCuadro(reel, f), cuerposEnCuadro(id, reel.recorrido, reel.registro, d, f)), `${id} cuadro ${f}`).toEqual([]);
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
    const roto = { ...plan, frases: plan.frases.map((f) => (({ ...f, acciones: f.acciones.filter((a) => !a.accion.endsWith(".se_va")) }))) };
    expect(validarPlanIlustrado(roto, tiemposTienda.escenas).join(" ")).toMatch(/"cliente" ya está/);
    // Irse y volver enseguida (se va al final de e1, vuelve en la 1.ª palabra
    // de e2): la salida no alcanza a verse.
    const rapido = { ...plan, frases: plan.frases.map((f) => ({ ...f, acciones: f.acciones.map((a) => (f.escena_id === "e2" && a.accion === "cliente.entra" ? { ...a, palabra: 0 } : a)) })) };
    expect(validarPlanIlustrado(rapido, tiemposTienda.escenas).join(" ")).toMatch(/vuelve a entrar 1 palabras después de irse/);
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
    // Se aleja caminando de lado (bien visible), mirando hacia donde va.
    expect(Math.abs(saliendo.dx)).toBeGreaterThan(50);
    expect(saliendo.mira).toBeDefined();
    // Y al final de la salida ya no está (sin volver a entrar).
    expect(presenciaDe(cliente, cu, { "cliente.se_va": [100] }, 136).alpha).toBe(0);
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

describe("quien camina nunca se ve cortado por el borde", () => {
  it("pasa de largo: cruza el cuadro; si su cabeza o su torso tocarían el borde de la vista, no se dibuja (se desvanece antes)", () => {
    const c = ComposicionKitSchema.parse({
      id: "k_c",
      fondo: "calle",
      personajes: [{ id: "peaton", tipo: "cliente", posicion: "centro", mira: "derecha" }],
      objetos: [],
    });
    const cu = ubicarComposicion(c, "x");
    const u = cu.personajes[0];
    const imagenes = urlsSinRasterizar(piezasDeComposicion(cu));
    const d = { "peaton.pasa_de_largo": [10] };
    const cuerpo = rectCabezaTorso(u);
    // Vista que corta justo por el medio del recorrido.
    const vista = { x: u.cx - 200, y: cuerpo.y - 300, ancho: 500, alto: 1600 };
    const dibuja = (f: number) => renderToStaticMarkup(EscenaKit({ cu, frame: f, fps: 30, d, imagenes, vista })).includes(imagenes[`cuerpo:${[u.aspecto.tipo, u.aspecto.piel, u.aspecto.pelo, u.aspecto.peinado, u.aspecto.ropa, u.aspecto.ropa2, u.aspecto.accesorio].join("-")}`].url);
    for (let f = 10; f < 10 + CUADROS_PASAR; f += 2) {
      const p = presenciaDe(u, cu, d, f);
      const r = rectEnPresencia(u, cuerpo, p);
      const entero = r.x >= vista.x && r.x + r.ancho <= vista.x + vista.ancho;
      if (!entero) expect(dibuja(f), `cuadro ${f}`).toBe(false);
    }
    expect(presenciaDe(u, cu, d, 5).alpha).toBe(0); // antes no está
    expect(presenciaDe(u, cu, d, 10 + CUADROS_PASAR + 2).alpha).toBe(0); // después, tampoco
    expect(presenciaDe(u, cu, d, 10 + CUADROS_PASAR / 2).pasa).toBe(true);
  });
});

describe("sin piso vacío en los 4 lugares (planos reales de los videos de muestra)", () => {
  // Calle: plan armado a mano sobre los tiempos de la narración de la torta.
  const planCalle: PlanIlustrado = {
    composiciones: [
      ComposicionKitSchema.parse({
        id: "k_calle",
        fondo: "calle",
        personajes: [
          { id: "papa", tipo: "papa", posicion: "centro_izquierda", mira: "derecha" },
          { id: "cliente", tipo: "cliente", posicion: "centro", plano: "fondo", mira: "derecha" },
        ],
        objetos: [
          { id: "celular", tipo: "celular", en_mano_de: "papa" },
          { id: "moto", tipo: "moto", lugar: "piso_derecha", plano: "fondo" },
        ],
      }),
    ],
    frases: [
      { escena_id: "e1", acciones: [{ escena: "k_calle", accion: "papa.mira_el_celular", palabra: 1 }, { escena: "k_calle", accion: "moto.llega", palabra: 4 }, { escena: "k_calle", accion: "cliente.pasa_de_largo", palabra: 6 }] },
      { escena_id: "e2", acciones: [{ escena: "k_calle", accion: "papa.saluda", palabra: 0 }, { escena: "k_calle", accion: "papa.feliz", palabra: 3 }] },
      { escena_id: "e3", acciones: [{ escena: "perfil", accion: "aparece", palabra: 0 }, { escena: "perfil", accion: "toque_seguir", palabra: 2 }] },
    ],
  };

  it("el plan de calle es válido", () => {
    expect(validarPlanIlustrado(planCalle, tiemposTorta.escenas)).toEqual([]);
  });

  it("salón, tienda, cocina y calle: debajo de la gente nunca queda más de 1/4 de pantalla; en la tienda, la gente ocupa al menos el 45 % de la altura", () => {
    const planes = [
      ["tienda", planTienda, tiemposTienda],
      ["tienda + cocina (torta)", planTorta, tiemposTorta],
      ["calle", planCalle, tiemposTorta],
    ] as const;
    for (const [nombre, plan, tiempos] of planes) {
      const m = metricasKit(prepararReel(tiempos as TiemposIlustrado, plan as PlanIlustrado, 30, ""), 30);
      expect(m.pisoVacioMaximo, nombre).toBeLessThanOrEqual(0.25);
    }
    // El salón ya lo exigen encuadre.test y calidadIA.test (planes a mano y de la IA).
    const tienda = metricasKit(prepararReel(tiemposTienda as TiemposIlustrado, planTienda as PlanIlustrado, 30, ""), 30);
    expect(tienda.alturaPersonaMinima).toBeGreaterThanOrEqual(0.45);
  });
});

describe("caminar se lee como caminar (piernas, brazos, cuerpo)", () => {
  it("las piernas abren en tijera y el brazo cercano va al revés que su pierna", () => {
    for (const fase of [0.4, 1.2, 2.5, 4, 5.3]) {
      const c = caminataEn(fase, false);
      // Pierna cercana: + = hacia atrás; brazo cercano: + = hacia adelante.
      if (Math.abs(Math.sin(fase)) > 0.2) expect(Math.sign(c.pierna)).toBe(Math.sign(c.brazo));
      expect(c.inclinacion).toBeGreaterThan(0);
    }
    // El cuerpo sube con las piernas juntas y baja con las piernas abiertas.
    expect(caminataEn(0, false).paso).toBeGreaterThan(caminataEn(Math.PI / 2, false).paso);
    // Quien pasa de largo da pasos más largos.
    expect(Math.abs(caminataEn(1.5, true).pierna)).toBeGreaterThan(Math.abs(caminataEn(1.5, false).pierna));
  });

  it("el cuerpo de pie no cambia (las piernas sueltas son solo para caminar)", () => {
    const a: AspectoPersonaje = { tipo: "cliente", piel: "media", pelo: "castano", peinado: "corto", ropa: "azul", ropa2: "rojo", accesorio: "gafas" };
    const quieto = svgCuerpo(a).svg;
    const camina = svgCuerpo(a, false).svg;
    const pierna = svgPierna(a, false).svg;
    expect(quieto.length).toBeGreaterThan(camina.length);
    expect(camina).not.toContain("<ellipse");
    // La pierna suelta es la misma forma (mismo rectángulo) que la del cuerpo de pie.
    const rect = pierna.match(/<rect x="[^"]+" y="0" width="([^"]+)" height="([^"]+)"/)!;
    expect(quieto).toContain(`width="${rect[1]}" height="${rect[2]}"`);
  });
});
