// Cámara automática del reel ilustrado (pura). Por cada acción del plan,
// la cámara encuadra la zona que esa acción declara en el catálogo, así
// lo nombrado ocupa al menos media pantalla. Reglas para no marear:
// - acciones a menos de 1 s entre sí se encuadran juntas si todas siguen
//   ocupando >= 50% (si no, la cámara se mueve igual, después de una
//   pausa mínima);
// - cada viaje dura 0,5-1,4 s según la distancia (más lejos = más lento),
//   con arranque y frenado suaves, y llega ~0,2 s después de la palabra;
// - después de llegar, la cámara se queda al menos 0,5 s (con un
//   acercamiento lento para que nunca esté muerta), y no se va de una
//   toma hasta que su última acción se vio al menos 0,4 s.
import type { PuntoCamara } from "../tiempoIlustrado";
import { MICRO, unionRects } from "./catalogo";
import { REGISTRO_CATALOGO, type Registro } from "./registro";
import { ALTO_PANTALLA, ANCHO_PANTALLA, acercar, desplazar, encuadre, ocupacion, vistaDelMundo, type Encuadre, type Rect } from "./geometria";
import { disparosDeEscena, type Disparo, type DisparosEscena } from "./plan";
import type { Recorrido } from "./recorrido";
import { VERBOS_PERSONAJE } from "../kit/catalogoKit";
import { ID_TODOS, aIsla, enCamino, rectCabezaTorso, rectPersonaje } from "../kit/composicion";
import { duracionCaminar, presenciaDe, rectEnPresencia } from "../kit/presencia";
import type { MovimientoCamara } from "../kit/variedad";
import { ZOOM_MAXIMO_KIT, cabeEnFranja, encuadrarKit, encuadreSeguro, ocupacionUtil, type Cuerpo, type ResultadoEncuadre } from "./encuadreKit";
export { ZOOM_MAXIMO_KIT };

export const JUNTAR_SI_MENOS_DE = 30; // cuadros (1 s)
export const PAUSA_MINIMA = 15; // cuadros (0,5 s)
export const VER_ULTIMA_ACCION = 12; // cuadros (0,4 s)
const LLEGAR_TRAS_PALABRA = 6; // cuadros

export function focoGlobal(d: Pick<Disparo, "escena" | "accion" | "objetivo">, recorrido: Recorrido, registro: Registro = REGISTRO_CATALOGO): Rect {
  const foco = registro.foco(d.escena, d.accion, d.objetivo);
  const idIsla = registro.escena(d.escena)?.isla;
  const isla = idIsla ? recorrido[idIsla] : undefined;
  if (!foco || !isla) throw new Error(`Sin foco para ${d.escena}.${d.accion}`);
  return desplazar(foco, isla.x, isla.y);
}

// pendiente: algo que la acción nombra pero no entró en la toma (el que
// recibe lo que se ofrece): la primera cobertura lo muestra.
// cobertura: plano agregado para que ninguno dure más de ~2 s.
export type Toma = { desde: number; ultimaAccion: number; focos: Rect[]; encuadre: Encuadre; celular: boolean; escena?: string; grupo?: boolean; pendiente?: Rect; cobertura?: boolean; cuerpoEntero?: boolean; caminaHasta?: number };

export const CALMA_KIT = 18;
// 20 cuadros: un plano más corto entre dos parecidos se ve como un parpadeo (reel_1).
export const CORTE_MINIMO_KIT = 20;
const encuadrar = (focos: Rect[], celular: boolean) => encuadre(unionRects(focos), undefined, celular ? "arriba" : "centro");

const igual = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.ancho === b.ancho && a.alto === b.alto;

// Cabeza y torso de cada personaje de un lugar del kit, en el mundo.
// tiempo (opcional): solo lo que se ve entre "desde" y "hasta" (quien entra,
// se va o pasa de largo cuenta donde está en esa ventana, y si no está, no
// cuenta). Sin tiempo: su recorrido completo (lo más prudente).
export type VentanaCuerpos = { d: DisparosEscena; desde: number; hasta: number };
export function cuerposEnMundo(escena: string, recorrido: Recorrido, registro: Registro, tiempo?: VentanaCuerpos): Cuerpo[] {
  const cu = registro.composicion(escena);
  const isla = recorrido[registro.escena(escena)?.isla ?? ""];
  if (!cu || !isla) return [];
  const res: Cuerpo[] = [];
  for (const u of cu.personajes) {
    const cabeza = aIsla(u, u.p.cx, u.p.cabeza.cy).y;
    const camina = tiempo && (tiempo.d[`${u.per.id}.entra`] || tiempo.d[`${u.per.id}.se_va`] || tiempo.d[`${u.per.id}.pasa_de_largo`]);
    if (!camina) {
      // Sin ventana, quien pasa de largo nunca está quieto: en movimiento.
      res.push({ id: u.per.id, rect: desplazar(enCamino(u, rectCabezaTorso(u)), isla.x, isla.y), cabezaY: cabeza + isla.y, completo: desplazar(enCamino(u, rectPersonaje(u)), isla.x, isla.y), movil: !tiempo && !!u.pasaDeLargo && !u.caminoDx });
      continue;
    }
    // Por separado, donde está quieto (se protege siempre) y donde camina
    // (el dibujo lo oculta al tocar el borde: se puede ignorar).
    const partes = { quieto: { rect: null as Rect | null, completo: null as Rect | null, cabezaY: -Infinity }, camina: { rect: null as Rect | null, completo: null as Rect | null, cabezaY: -Infinity } };
    for (let f = tiempo.desde; f <= tiempo.hasta; f += 2) {
      const p = presenciaDe(u, cu, tiempo.d, f);
      if (p.alpha <= 0) continue;
      const parte = p.camina ? partes.camina : partes.quieto;
      const r = rectEnPresencia(u, rectCabezaTorso(u), p);
      const c = rectEnPresencia(u, rectPersonaje(u), p);
      parte.rect = parte.rect ? unionRects([parte.rect, r]) : r;
      parte.completo = parte.completo ? unionRects([parte.completo, c]) : c;
      parte.cabezaY = Math.max(parte.cabezaY, u.pies + (p.dy ?? 0) + (cabeza - u.pies) * (p.escala ?? 1));
    }
    for (const [nombre, parte] of Object.entries(partes)) {
      if (!parte.rect || !parte.completo) continue;
      res.push({ id: u.per.id, rect: desplazar(parte.rect, isla.x, isla.y), cabezaY: parte.cabezaY + isla.y, completo: desplazar(parte.completo, isla.x, isla.y), movil: nombre === "camina" });
    }
  }
  return res;
}
// Los cuerpos en un cuadro exacto (para las pruebas y el control).
export function cuerposEnCuadro(escena: string, recorrido: Recorrido, registro: Registro, d: DisparosEscena, cuadro: number): Cuerpo[] {
  return cuerposEnMundo(escena, recorrido, registro, { d, desde: cuadro, hasta: cuadro });
}

// ¿Se puede mostrar esta acción con un plano limpio (zoom normal, nadie
// cortado), con su foco o uno reducido? Si no, quiénes estorban (para que
// la IA los mueva). Se mide en coordenadas de la isla.
export function planoLimpio(escena: string, accion: string, objetivo: string | undefined, registro: Registro): { ok: boolean; estorban: string[] } {
  const cu = registro.composicion(escena);
  const foco = registro.foco(escena, accion, objetivo);
  if (!cu || !foco || accion.startsWith(`${ID_TODOS}.`)) return { ok: true, estorban: [] };
  const recorrido = { [registro.escena(escena)?.isla ?? escena]: { x: 0, y: 0, ...cu.isla } } as unknown as Recorrido;
  const cuerpos = cuerposEnMundo(escena, recorrido, registro);
  const focos = [foco, ...registro.focoReducido(escena, accion, objetivo)];
  for (const sinOcupacionMinima of [false, true]) for (const f of focos) if (encuadrarKit({ obligatorios: [f], cuerpos, soloNormal: true, sinOcupacionMinima })) return { ok: true, estorban: [] };
  // Quiénes impiden el plano, en una búsqueda gruesa alrededor del foco.
  const cuenta = new Map<string, number>();
  for (const f of focos) {
    for (let z = 1.1; z >= 0.75; z -= 0.05) {
      for (let dx = -400; dx <= 400; dx += 50) {
        for (let dy = -500; dy <= 500; dy += 50) {
          const cam = { x: f.x + f.ancho / 2 + dx, y: f.y + f.alto / 2 + dy, zoom: z };
          if (!cabeEnFranja(f, cam)) continue;
          for (const c of cuerpos) if (!encuadreSeguro(cam, [c])) cuenta.set(c.id, (cuenta.get(c.id) ?? 0) + 1);
        }
      }
    }
  }
  const max = Math.max(0, ...cuenta.values());
  return { ok: false, estorban: [...cuenta.entries()].filter(([, n]) => n >= max * 0.5).sort((a, b) => b[1] - a[1]).map(([id]) => id) };
}

// El encuadre de una acción del kit (lo usan las tomas y la puerta del
// celular). Orden: lo que pide la acción con zoom normal; si no cabe sin
// cortar a nadie, un foco más chico (ver focoReducidoKit), primero ocupando
// >= 50 % y si no entero con zoom normal; después más abierto; y como
// último recurso, siempre seguro, el plano con más personajes enteros.
export function encuadreDeAccionKit(escena: string, accion: string, objetivo: string | undefined, recorrido: Recorrido, registro: Registro, tiempo?: VentanaCuerpos): { r: ResultadoEncuadre; focos: Rect[]; pendiente?: Rect } | null {
  const isla = recorrido[registro.escena(escena)?.isla ?? ""];
  const foco = registro.foco(escena, accion, objetivo);
  if (!isla || !foco) return null;
  const f = desplazar(foco, isla.x, isla.y);
  const cuerpos = cuerposEnMundo(escena, recorrido, registro, tiempo);
  // Acciones de personajes: la gente apoyada abajo (sin piso vacío).
  // (también un objeto en la mano de alguien: el plano es de esa persona).
  const cu = registro.composicion(escena);
  const idAccion = accion.split(".")[0];
  // Lo apoyado en el piso (un vehículo, un mueble) se encuadra como alguien
  // de cuerpo entero: apoyado abajo, sin franja de vereda vacía debajo.
  const enPiso = !!cu?.objetos.some((o) => o.obj.id === idAccion && o.obj.lugar?.startsWith("piso_"));
  const anclarAbajo = !!cu && (enPiso || cu.personajes.some((u) => u.per.id === idAccion) || cu.objetos.some((o) => o.obj.id === idAccion && !!o.obj.en_mano_de));
  // Caminar (entra, se va, pasa de largo): de cuerpo entero, con los pies sobre la zona de Instagram.
  const verbo = accion.split(".")[1];
  const cuerpoEntero = enPiso || verbo === "entra" || verbo === "se_va" || verbo === "pasa_de_largo";
  let r = encuadrarKit({ obligatorios: [f], cuerpos, soloNormal: true, anclarAbajo, cuerpoEntero });
  if (r) return { r, focos: [f] };
  const reducidos = registro.focoReducido(escena, accion, objetivo).map((x) => desplazar(x, isla.x, isla.y));
  for (const sinOcupacionMinima of [false, true]) {
    for (const fr of reducidos) {
      r = encuadrarKit({ obligatorios: [fr], cuerpos, soloNormal: true, sinOcupacionMinima, anclarAbajo, cuerpoEntero });
      if (!r) continue;
      // El objetivo (a quién se le da o se le señala) que no entró va en la cobertura.
      const o = objetivo ? (registro.foco(escena, `${objetivo}.quieto`) ?? registro.foco(escena, `${objetivo}.destaca`)) : null;
      return { r, focos: [fr], pendiente: o ? desplazar(o, isla.x, isla.y) : undefined };
    }
  }
  r = encuadrarKit({ obligatorios: [f], cuerpos, anclarAbajo, cuerpoEntero });
  if (r) return { r, focos: [f] };
  const todos = encuadrarKit({ obligatorios: [], deseables: personajesEnMundo(escena, "quieto", recorrido, registro), cuerpos, anclarAbajo: true, cuerpoEntero: true });
  return todos ? { r: todos, focos: todos.incluidos } : null;
}

// Cada personaje de pie (o sentado) en la pose de una acción de grupo, en el mundo.
function personajesEnMundo(escena: string, verbo: string, recorrido: Recorrido, registro: Registro): Rect[] {
  const cu = registro.composicion(escena);
  const isla = recorrido[registro.escena(escena)?.isla ?? ""];
  if (!cu || !isla) return [];
  const def = VERBOS_PERSONAJE[verbo as keyof typeof VERBOS_PERSONAJE];
  const pose = def && "pose" in def ? def.pose : undefined;
  return cu.personajes.map((u) => desplazar(rectPersonaje(u, pose), isla.x, isla.y));
}

export function tomasDeCamara(disparos: Disparo[], recorrido: Recorrido, registro: Registro = REGISTRO_CATALOGO): Toma[] {
  const tomas: Toma[] = [];
  for (const d of disparos) {
    // La micro-acción no cambia de toma (ver pulsoDeCamara).
    if (d.accion === MICRO) continue;
    const f = focoGlobal(d, recorrido, registro);
    const esCelular = registro.escena(d.escena)?.celular === true;
    const ultima = tomas[tomas.length - 1];
    if (registro.composicion(d.escena)) {
      tomaDelKit(tomas, d, f, recorrido, registro, disparos);
      continue;
    }
    if (ultima) {
      if (ultima.focos.some((g) => igual(g, f))) {
        ultima.ultimaAccion = d.cuadro;
        continue;
      }
      if (d.cuadro - ultima.desde < JUNTAR_SI_MENOS_DE && ultima.celular === esCelular && !registro.composicion(ultima.escena ?? "")) {
        const focos = [...ultima.focos, f];
        const enc = encuadrar(focos, esCelular);
        if (focos.every((g) => ocupacion(g, enc) >= 0.5)) {
          ultima.focos = focos;
          ultima.encuadre = enc;
          ultima.ultimaAccion = d.cuadro;
          continue;
        }
      }
    }
    tomas.push({ desde: d.cuadro, ultimaAccion: d.cuadro, focos: [f], encuadre: encuadrar([f], esCelular), celular: esCelular, escena: d.escena });
  }
  return conCorteTrasSalida(tomas, disparos, recorrido, registro);
}

// Después de que alguien se va (cruzó la puerta y se cerró), el lugar vacío
// se ve como mucho VACIO_TRAS_SALIDA: luego se corta a quien sigue ahí (el
// más cercano a quien se fue), nunca un plano vacío mientras la voz sigue
// (revisión de la tanda 2: la tienda vacía durante "si lo atiendes rápido").
export const VACIO_TRAS_SALIDA = 15;
function conCorteTrasSalida(tomas: Toma[], disparos: Disparo[], recorrido: Recorrido, registro: Registro): Toma[] {
  const res = [...tomas];
  for (const d of disparos) {
    const [id, verbo] = d.accion.split(".");
    const cu = registro.composicion(d.escena);
    if (verbo !== "se_va" || !cu) continue;
    const fin = d.cuadro + cuadrosCaminando(d, registro);
    const i = res.findIndex((t) => t.desde > fin);
    const siguiente = res[i];
    // Sin plano siguiente (el reel termina en el lugar) o corte pronto: nada que hacer.
    if (!siguiente || siguiente.desde - fin <= VACIO_TRAS_SALIDA) continue;
    const enEscena = disparosDeEscena(disparos, d.escena);
    const quedan = cu.personajes.filter((u) => u.per.id !== id && presenciaDe(u, cu, enEscena, fin).alpha >= 1 && presenciaDe(u, cu, enEscena, siguiente.desde - 1).alpha >= 1);
    if (!quedan.length) continue;
    const xSale = cu.personajes.find((x) => x.per.id === id)?.cx ?? 0;
    const otro = quedan.reduce((a, b) => (Math.abs(b.cx - xSale) < Math.abs(a.cx - xSale) ? b : a));
    const tiempo: VentanaCuerpos = { d: enEscena, desde: fin, hasta: siguiente.desde };
    const e = encuadreDeAccionKit(d.escena, `${otro.per.id}.quieto`, undefined, recorrido, registro, tiempo);
    if (!e) continue;
    // Se corta apenas se cierra la puerta (si queda poco, igual: mejor un plano corto que el lugar vacío).
    const desde = fin + Math.max(0, Math.min(VACIO_TRAS_SALIDA - 8, siguiente.desde - fin - MIN_PLANO_KIT));
    res.splice(i, 0, { desde, ultimaAccion: desde, focos: e.focos, encuadre: e.r.encuadre, celular: false, escena: d.escena });
  }
  return res;
}

// Una acción en un lugar del kit (ver encuadreKit.ts para las reglas).
// Ventana de una toma para cuidar a quien camina: de la acción a ~2,3 s después.
const VENTANA_TOMA = 70;
function tomaDelKit(tomas: Toma[], d: Disparo, f: Rect, recorrido: Recorrido, registro: Registro, disparos: Disparo[] = []) {
  const tiempo: VentanaCuerpos = { d: disparosDeEscena(disparos, d.escena), desde: d.cuadro - 6, hasta: d.cuadro + VENTANA_TOMA };
  const cuerpos = cuerposEnMundo(d.escena, recorrido, registro, tiempo);
  const [id, verbo] = d.accion.split(".");
  const grupo = id === ID_TODOS;
  const ultima = tomas[tomas.length - 1];
  const mismoLugar = ultima?.escena === d.escena;
  // Quien entra o se va camina hasta este cuadro (la toma no se corta antes).
  const caminaHasta = verbo === "entra" || verbo === "se_va" ? d.cuadro + cuadrosCaminando(d, registro) : undefined;
  const sigueCaminando = (t: Toma) => {
    if (caminaHasta !== undefined) t.caminaHasta = Math.max(t.caminaHasta ?? 0, caminaHasta);
  };
  if (ultima && mismoLugar) {
    // Lo mismo de antes (o el mismo grupo): la cámara se queda.
    if (ultima.focos.some((g) => igual(g, f)) || (grupo && ultima.grupo)) {
      ultima.ultimaAccion = d.cuadro;
      sigueCaminando(ultima);
      return;
    }
    const dt = d.cuadro - ultima.desde;
    // Calma: llega muy pronto y ya se ve entero: sin corte.
    if (!grupo && dt < CALMA_KIT && cabeEnFranja(f, ultima.encuadre)) {
      ultima.ultimaAccion = d.cuadro;
      sigueCaminando(ultima);
      return;
    }
    // Seguidas: una toma que muestre las dos, si cabe sin alejarse de más.
    if (!grupo && !ultima.grupo && dt < JUNTAR_SI_MENOS_DE) {
      const focos = [...ultima.focos, f];
      // Si son acciones de personajes, la gente apoyada abajo (sin piso vacío).
      const deGente = !!registro.composicion(d.escena)?.personajes.some((u) => u.per.id === id);
      // Si alguna es caminar, la toma junta va de cuerpo entero.
      const camina = verbo === "entra" || verbo === "se_va" || verbo === "pasa_de_largo" || ultima.cuerpoEntero === true;
      const r = encuadrarKit({ obligatorios: focos, cuerpos, soloNormal: true, anclarAbajo: deGente, cuerpoEntero: camina });
      if (r && ocupacionUtil(unionRects(focos), r.encuadre) >= 0.5) {
        ultima.focos = focos;
        ultima.encuadre = r.encuadre;
        ultima.ultimaAccion = d.cuadro;
        ultima.cuerpoEntero = camina;
        sigueCaminando(ultima);
        return;
      }
    }
  }
  let focos = [f];
  let r: ResultadoEncuadre | null = null;
  let pendiente: Rect | undefined;
  if (grupo) r = encuadrarKit({ obligatorios: [], deseables: personajesEnMundo(d.escena, verbo, recorrido, registro), cuerpos, anclarAbajo: true, cuerpoEntero: true });
  else {
    const e = encuadreDeAccionKit(d.escena, d.accion, d.objetivo, recorrido, registro, tiempo);
    if (e) ({ r, focos, pendiente } = e);
  }
  // Nunca dos cortes a menos de CORTE_MINIMO_KIT en el mismo lugar; y si la
  // toma anterior es de alguien que entra o se va, no se corta hasta que
  // termina de caminar (la salida se ve completa).
  const minimo = ultima?.caminaHasta ?? 0;
  const desde = ultima && mismoLugar ? Math.max(d.cuadro, ultima.desde + CORTE_MINIMO_KIT, minimo) : d.cuadro;
  tomas.push({
    desde,
    ultimaAccion: d.cuadro,
    focos: r ? (grupo ? r.incluidos : focos) : [f],
    pendiente,
    // Sin ningún encuadre seguro (no debería pasar): se queda el anterior.
    encuadre: r?.encuadre ?? (ultima && mismoLugar ? ultima.encuadre : encuadre(f, ZOOM_MAXIMO_KIT)),
    celular: false,
    escena: d.escena,
    grupo,
    cuerpoEntero: grupo || verbo === "entra" || verbo === "se_va" || verbo === "pasa_de_largo",
    caminaHasta,
  });
}

// ---------- Ritmo de planos en el kit (revisión de la v6) ----------
// Ningún encuadre igual dura más de MAX_PLANO_KIT (~2 s): si una toma del
// kit es más larga, se intercalan planos de cobertura (detalles de la
// cartelera, el hueco, reacciones de quienes miran, lo que la acción
// nombró y no entró) y se vuelve al plano principal en cada acción, para
// que se vea cuando la voz la nombra. Todos siguen las reglas de encuadre.
export const MAX_PLANO_KIT = 60;
// Ningún plano de cobertura más corto que esto (uno de 0,5 s entre dos
// iguales se ve como un parpadeo del mismo plano: reel_1, 24 nov 2026).
export const MIN_PLANO_KIT = 24;
const PLANO_COBERTURA = 40;
const VER_ACCION = 18; // cuadros que el plano principal se queda después de una acción
const ANTES_ACCION = 4;

function distintos(a: Encuadre, b: Encuadre): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) > 160 || Math.max(a.zoom / b.zoom, b.zoom / a.zoom) > 1.2;
}

// Planos de cobertura posibles para una toma del kit, en orden de interés
// (revisión de la v7: durante "le trae dulces" la cobertura mostraba la
// cartelera). Primero lo que la acción nombró y no entró (pendiente);
// después, según el tema de la toma:
// - si es sobre personas: primer plano de quien actúa, de a quién se dirige,
//   y reacciones de quienes miran; los detalles de la cartelera al final;
// - si es sobre la cartelera: sus detalles (mitades, el hueco) intercalados
//   con reacciones de quienes la miran.
export function coberturasDeToma(t: Toma, recorrido: Recorrido, registro: Registro, accionesDeToma: Disparo[] = [], tiempo?: VentanaCuerpos): { encuadre: Encuadre; focos: Rect[] }[] {
  const cu = t.escena ? registro.composicion(t.escena) : null;
  const isla = t.escena ? recorrido[registro.escena(t.escena)?.isla ?? ""] : undefined;
  if (!cu || !isla) return [];
  const cuerpos = cuerposEnMundo(t.escena!, recorrido, registro, tiempo);
  const enMundo = (r: Rect) => desplazar(r, isla.x, isla.y);
  const principal = unionRects(t.focos);
  const cart = cu.objetos.find((o) => o.obj.tipo === "cartelera" && o.rect);
  const detalles: Rect[] = [];
  if (cart?.rect) {
    const c = cart.rect;
    const hueco = registro.focoReducido(t.escena!, `${cart.obj.id}.destaca_hueco`)[0];
    const mitad = (lado: 0 | 1): Rect => ({ x: c.x + (lado ? c.ancho * 0.5 : 0), y: c.y, ancho: c.ancho * 0.5, alto: c.alto * 0.7 });
    detalles.push(...[mitad(0), ...(hueco ? [hueco] : []), mitad(1)].map(enMundo));
  }
  // Quiénes están en juego: el que actúa, su objetivo y quien tiene en la mano el objeto de la acción.
  const ids = new Set<string>();
  for (const d of accionesDeToma) {
    const [id] = d.accion.split(".");
    if (id === ID_TODOS) continue;
    const obj = cu.objetos.find((o) => o.obj.id === id);
    ids.add(obj?.obj.en_mano_de ?? id);
    if (d.objetivo) ids.add(cu.objetos.find((o) => o.obj.id === d.objetivo)?.obj.en_mano_de ?? d.objetivo);
  }
  const enJuego = cu.personajes.filter((u) => ids.has(u.per.id));
  const primerosPlanos = enJuego.map((u) => enMundo(rectCabezaTorso(u)));
  const temaCartelera = !!cart && accionesDeToma.length > 0 && accionesDeToma.every((d) => d.accion.startsWith(`${cart.obj.id}.`) || d.accion.endsWith(".va_al_hueco"));
  // Reacciones: los que no están en el plano principal; primero los que
  // miran a alguien en juego o a la cartelera (según el tema).
  const mira = (u: (typeof cu.personajes)[number]) => (u.per.mira_a && (ids.has(u.per.mira_a) || (temaCartelera && u.per.mira_a === cart?.obj.id)) ? 1 : 0);
  // No como reacción a quien está detrás y al alcance del brazo de alguien
  // en juego (v8: el brazo de la profesora cruzaba el primer plano de un
  // niño sentado atrás).
  const zU = (u: (typeof cu.personajes)[number]) => (u.sentado ? u.sentado.pupitre.y + u.sentado.pupitre.alto : u.pies);
  const alAlcance = (u: (typeof cu.personajes)[number]) =>
    enJuego.some((a) => zU(a) > zU(u) && Math.abs(a.cx - u.cx) < (a.p.brazo.largo + a.p.antebrazo.largo) * a.escala * 1.3 + (u.p.cuerpoAncho / 2) * u.escala);
  const reacciones = cu.personajes
    .filter((u) => !ids.has(u.per.id) && !alAlcance(u))
    .map((u) => ({ u, r: enMundo(rectPersonaje(u)) }))
    .filter(({ r }) => !seTocanMucho(r, principal))
    .sort((a, b) => mira(b.u) - mira(a.u))
    .map(({ r }) => r);
  const intercalar = (a: Rect[], b: Rect[]) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]]).flat().filter((x): x is Rect => !!x);
  const orden: Rect[] = [...(t.pendiente ? [t.pendiente] : []), ...(temaCartelera ? intercalar(detalles, reacciones) : [...intercalar(primerosPlanos, reacciones), ...detalles])];
  const res: { encuadre: Encuadre; focos: Rect[] }[] = [];
  // Siempre, al final: el plano general del lugar (todos de cuerpo entero).
  const general = encuadrarKit({ obligatorios: [], deseables: cu.personajes.map((u) => enMundo(rectPersonaje(u))), cuerpos, anclarAbajo: true, cuerpoEntero: true });
  const esReaccion = new Set([...reacciones, ...(t.pendiente ? [t.pendiente] : [])]);
  for (const r of orden) {
    const anclarAbajo = esReaccion.has(r);
    // Reacciones: de cuerpo entero, con los pies sobre la zona de Instagram.
    const e = encuadrarKit({ obligatorios: [r], cuerpos, soloNormal: true, anclarAbajo, cuerpoEntero: anclarAbajo }) ?? encuadrarKit({ obligatorios: [r], cuerpos, soloNormal: true, sinOcupacionMinima: true, anclarAbajo });
    if (e && distintos(e.encuadre, t.encuadre) && res.every((x) => distintos(x.encuadre, e.encuadre))) res.push({ encuadre: e.encuadre, focos: [r] });
  }
  if (general && general.incluidos.length && distintos(general.encuadre, t.encuadre) && res.every((x) => distintos(x.encuadre, general.encuadre))) res.push({ encuadre: general.encuadre, focos: general.incluidos });
  return res;
}
function interseccion(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return { x, y, ancho: Math.max(0, Math.min(a.x + a.ancho, b.x + b.ancho) - x), alto: Math.max(0, Math.min(a.y + a.alto, b.y + b.alto) - y) };
}
const area = (r: Rect) => r.ancho * r.alto;
function seTocanMucho(a: Rect, b: Rect): boolean {
  const ix = Math.max(0, Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.alto, b.y + b.alto) - Math.max(a.y, b.y));
  return ix * iy > 0.5 * a.ancho * a.alto;
}

// Cuánto hay que seguir viendo una acción antes de cortar: quien entra o se
// va, hasta que termina de caminar (la salida se ve completa).
function verAccion(a: Disparo, registro: Registro): number {
  return /\.(entra|se_va)$/.test(a.accion) ? Math.max(VER_ACCION, cuadrosCaminando(a, registro)) : VER_ACCION;
}
// Cuánto camina quien entra o se va (hasta cruzar la puerta, si hay).
function cuadrosCaminando(a: Disparo, registro: Registro): number {
  const [id, verbo] = a.accion.split(".");
  const cu = registro.composicion(a.escena);
  const u = cu?.personajes.find((x) => x.per.id === id);
  return cu && u && (verbo === "entra" || verbo === "se_va") ? duracionCaminar(u, cu, verbo) : 36;
}

export function conCobertura(tomasOriginales: Toma[], disparos: Disparo[], recorrido: Recorrido, registro: Registro, total: number): Toma[] {
  // Tomas seguidas del mismo lugar con el mismo encuadre se ven como un solo
  // plano (no hay corte): se cuentan juntas.
  const tomas: Toma[] = [];
  for (const t of tomasOriginales) {
    const ultima = tomas[tomas.length - 1];
    if (ultima && ultima.escena === t.escena && t.escena && registro.composicion(t.escena) && !distintos(ultima.encuadre, t.encuadre)) {
      ultima.ultimaAccion = Math.max(ultima.ultimaAccion, t.ultimaAccion);
      if (t.caminaHasta !== undefined) ultima.caminaHasta = Math.max(ultima.caminaHasta ?? 0, t.caminaHasta);
      // Si la que se suma es de grupo, el plano (ya igual) muestra al grupo.
      if (t.grupo) {
        ultima.grupo = true;
        ultima.focos = t.focos;
      }
      continue;
    }
    tomas.push({ ...t });
  }
  const res: Toma[] = [];
  tomas.forEach((t, i) => {
    // Si sigue el celular, la puerta corta antes (sale del lugar ~22 cuadros antes).
    const siguiente = tomas[i + 1];
    const fin = siguiente ? (siguiente.celular && t.escena && registro.composicion(t.escena) ? siguiente.desde + LLEGAR_TRAS_PALABRA - 2 * CUADROS_PUERTA : siguiente.desde) : total;
    const visibleDesde = i === 0 ? 0 : tomas[i - 1].celular ? t.desde + LLEGAR_TRAS_PALABRA - CUADROS_PUERTA : t.desde;
    if (!t.escena || !registro.composicion(t.escena) || fin - visibleDesde <= MAX_PLANO_KIT) {
      res.push(t);
      return;
    }
    const deLaToma = disparos.filter((d) => d.escena === t.escena && d.accion !== MICRO && d.cuadro >= t.desde - CORTE_MINIMO_KIT && d.cuadro < fin);
    const acciones = deLaToma.filter((d) => d.cuadro >= t.desde);
    const candidatos = coberturasDeToma(t, recorrido, registro, deLaToma, { d: disparosDeEscena(disparos, t.escena), desde: t.desde, hasta: fin });
    res.push(t);
    if (!candidatos.length) return;
    // ¿La cobertura ya muestra lo que nombra la acción? (un detalle de la
    // cartelera muestra "la cartelera brilla"): entonces no hace falta volver.
    const muestra = (c: { encuadre: Encuadre; focos: Rect[] }, d: Disparo) => {
      const f = focoGlobal(d, recorrido, registro);
      const v = vistaDelMundo(c.encuadre);
      return area(interseccion(f, v)) >= 0.4 * area(f) || area(interseccion(c.focos[0], f)) >= 0.8 * area(c.focos[0]);
    };
    // Nunca se corta mientras alguien entra o se va caminando.
    const libre = (c: number) => !acciones.some((a) => c > a.cuadro && c < a.cuadro + verAccion(a, registro));
    let k = 0;
    // Desde cuándo se ve de verdad: la primera toma, desde el cuadro 0; la
    // que sigue a la puerta del celular, desde el corte (unos cuadros antes).
    let inicio = i === 0 ? 0 : tomas[i - 1].celular ? t.desde + LLEGAR_TRAS_PALABRA - CUADROS_PUERTA : t.desde;
    let enPrincipal = true;
    for (let vueltas = 0; fin - inicio > MAX_PLANO_KIT && vueltas < 50; vueltas++) {
      let corte = inicio + (enPrincipal ? Math.min(45, MAX_PLANO_KIT) : PLANO_COBERTURA);
      let trasCaminar = false; // el corte es justo cuando termina de caminar
      if (enPrincipal) {
        let estorbo: Disparo | undefined;
        for (const a of acciones) if (corte > a.cuadro - ANTES_ACCION && corte < a.cuadro + verAccion(a, registro)) {
          corte = a.cuadro + verAccion(a, registro);
          estorbo ??= a;
        }
        // Correr el corte después de la acción dejaría el plano principal
        // demasiado largo: se corta antes, con una cobertura que vuelve en la acción.
        const antes = estorbo ? estorbo.cuadro - ANTES_ACCION - MIN_PLANO_KIT : 0;
        if (estorbo && (corte - inicio > MAX_PLANO_KIT || fin - corte < MIN_PLANO_KIT)) {
          // Si en "antes" alguien todavía camina, se corta apenas termina
          // (la cobertura que sigue muestra la acción que viene).
          const tras = libre(antes) ? antes : Math.max(...acciones.filter((a) => antes > a.cuadro && antes < a.cuadro + verAccion(a, registro)).map((a) => a.cuadro + verAccion(a, registro)));
          if (tras - inicio >= CORTE_MINIMO_KIT && tras < estorbo.cuadro && fin - tras >= MIN_PLANO_KIT) {
            corte = tras;
            trasCaminar = tras !== antes;
          }
        }
      }
      if (fin - corte < MIN_PLANO_KIT) break;
      // Preferir una cobertura que ya muestre las acciones que vienen.
      const ventana = (desde: number) => acciones.filter((a) => a.cuadro >= desde && a.cuadro < desde + PLANO_COBERTURA + 10);
      const elegir = (desde: number) => {
        for (let n = 0; n < candidatos.length; n++) {
          const c = candidatos[(k + n) % candidatos.length];
          if (ventana(desde).every((a) => muestra(c, a))) return { c, n };
        }
        return { c: candidatos[k % candidatos.length], n: 0 };
      };
      let { c, n } = elegir(corte);
      let pendiente = ventana(corte).find((a) => !muestra(c, a));
      // Si esa acción llegaría antes de que la cobertura dure lo mínimo,
      // se corta antes (la cobertura entra entera antes de la acción).
      // Cortando justo al terminar de caminar, la cobertura dura lo mínimo y se
      // vuelve con la acción ya empezada (mejor que un plano de más de 2 s).
      if (pendiente && pendiente.cuadro - ANTES_ACCION - corte < MIN_PLANO_KIT && enPrincipal && !trasCaminar) {
        const antes = pendiente.cuadro - ANTES_ACCION - MIN_PLANO_KIT;
        // Si en "antes" alguien todavía camina, se corta apenas termina.
        const tras = libre(antes) ? antes : Math.max(...acciones.filter((a) => antes > a.cuadro && antes < a.cuadro + verAccion(a, registro)).map((a) => a.cuadro + verAccion(a, registro)));
        if (tras - inicio >= CORTE_MINIMO_KIT && tras < pendiente.cuadro) {
          corte = tras;
          ({ c, n } = elegir(corte));
          pendiente = ventana(corte).find((a) => !muestra(c, a));
        } else {
          // No cabe: el plano principal sigue hasta después de la acción.
          inicio = Math.max(inicio, pendiente.cuadro + VER_ACCION - Math.min(45, MAX_PLANO_KIT));
          continue;
        }
      }
      k += n + 1;
      res.push({ ...t, desde: corte, ultimaAccion: corte, focos: c.focos, encuadre: c.encuadre, cobertura: true, grupo: false, pendiente: undefined });
      inicio = corte;
      enPrincipal = false;
      if (pendiente) {
        const vuelta = Math.max(pendiente.cuadro - ANTES_ACCION, corte + MIN_PLANO_KIT);
        res.push({ ...t, desde: vuelta, pendiente: undefined });
        inicio = vuelta;
        enPrincipal = true;
      }
    }
  });
  return res;
}

export function duracionViaje(a: Encuadre, b: Encuadre, fps: number): number {
  const z = Math.min(a.zoom, b.zoom);
  const pantallas = (Math.abs(a.x - b.x) * z) / ANCHO_PANTALLA + (Math.abs(a.y - b.y) * z) / ALTO_PANTALLA;
  const segundos = Math.min(1.5, Math.max(0.5, 0.5 + 0.35 * pantallas + 0.45 * Math.abs(Math.log(b.zoom / a.zoom))));
  return Math.round(segundos * fps);
}

const mismoEncuadre = (a: Encuadre, b: Encuadre) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.zoom - b.zoom) < 0.005;
const empuje = (cuadros: number) => 1 + Math.min(0.05, 0.0012 * cuadros);
// En los lugares del kit, acercamiento más corto (+2 %): los personajes ya
// dan vida, y el encuadre que garantiza que nadie quede con la cara cortada
// tiene que valer hasta el máximo acercamiento (ver ZOOM_TOMA_MAX).
export const EMPUJE_MAXIMO_KIT = 0.02;
// Barrido de lado (variedad "barrer_*"): de -6 a +6 unidades del mundo; la
// deriva de la cámara baja para que la suma no pase el margen de encuadreSeguro.
export const BARRIDO_KIT = 6;
const empujeKit = (cuadros: number) => 1 + Math.min(EMPUJE_MAXIMO_KIT, 0.0008 * cuadros);

// Puerta celular <-> lugar del kit (visuales-v2): en vez de viajar por el
// mundo oscuro entre islas, la cámara entra a la pantalla del celular hasta
// llenarla; la pantalla ya muestra el lugar con el mismo encuadre (enLugar)
// que tendrá la cámara al cortar, así el corte no se nota. Al volver, al
// revés. enLugar sigue las reglas del kit (nadie con la cara cortada).
export type Puerta = { cuadro: number; desde: "celular" | "kit"; kit: string; enLugar: Encuadre; zoomPantalla: number };
export type OpcionesPuerta = {
  esKit: (escena: string | undefined) => boolean;
  // Pantalla del celular (mundo) y el encuadre del lugar al cortar.
  pantalla: Rect | null;
  encuadreKit: (escena: string) => Encuadre | null;
  // Movimiento dentro de cada plano del kit (variedad entre reels).
  movimiento?: MovimientoCamara;
};
export const CUADROS_PUERTA = 14;
export const ZOOM_PUERTA_MAXIMO = 1.6;

export function cubrir(r: Rect, llenarAlto = false): Encuadre {
  const zoom = Math.min(ZOOM_PUERTA_MAXIMO, llenarAlto ? Math.max(ANCHO_PANTALLA / r.ancho, ALTO_PANTALLA / r.alto) : ANCHO_PANTALLA / r.ancho);
  return { x: r.x + r.ancho / 2, y: r.y + r.alto / 2, zoom };
}

export function puntosCamaraAutomatica(tomas: Toma[], total: number, fps: number, puertas?: OpcionesPuerta): PuntoCamara[] {
  return planDeCamara(tomas, total, fps, puertas).puntos;
}

export function planDeCamara(tomas: Toma[], total: number, fps: number, opciones?: OpcionesPuerta): { puntos: PuntoCamara[]; puertas: Puerta[] } {
  if (tomas.length === 0) return { puntos: [{ cuadro: 0, x: 1000, y: 1000, zoom: 1 }], puertas: [] };
  // Movimiento dentro de cada plano del kit: acercarse (+2 %), alejarse
  // (de +2 % a 0), barrer de lado (12 unidades) o quedarse quieta. Todos
  // dentro de los márgenes de encuadreSeguro.
  const mov = opciones?.movimiento ?? "acercar";
  const lado = mov === "barrer_derecha" ? 1 : mov === "barrer_izquierda" ? -1 : 0;
  const inicioKit = (e: Encuadre): Encuadre => (mov === "alejar" ? acercar(e, 1 + EMPUJE_MAXIMO_KIT) : lado ? { ...e, x: e.x - lado * BARRIDO_KIT } : e);
  const finKit = (e: Encuadre, c: number): Encuadre => {
    if (mov === "acercar") return acercar(e, empujeKit(c));
    if (mov === "alejar") return acercar(e, 1 + EMPUJE_MAXIMO_KIT - Math.min(EMPUJE_MAXIMO_KIT, 0.0008 * c));
    if (lado) return { ...e, x: e.x - lado * BARRIDO_KIT + lado * Math.min(2 * BARRIDO_KIT, 0.25 * c) };
    return e;
  };
  const esKitToma = (t: Toma) => !!opciones?.esKit(t.escena);
  const puntos: PuntoCamara[] = [{ cuadro: 0, ...(esKitToma(tomas[0]) ? inicioKit(tomas[0].encuadre) : tomas[0].encuadre) }];
  const puertas: Puerta[] = [];
  let llegadaAnterior = 0;
  for (let i = 1; i < tomas.length; i++) {
    const a = tomas[i - 1].encuadre;
    const b = tomas[i].encuadre;
    const ta = tomas[i - 1];
    const tb = tomas[i];
    const haciaKit = ta.celular && opciones?.esKit(tb.escena);
    const desdeKit = tb.celular && opciones?.esKit(ta.escena);
    if (opciones?.pantalla && (haciaKit || desdeKit)) {
      const kit = (haciaKit ? tb.escena : ta.escena)!;
      const enLugar = opciones.encuadreKit(kit);
      if (enLugar) {
        let T = tb.desde + LLEGAR_TRAS_PALABRA - CUADROS_PUERTA;
        const salidaMinima = Math.max(llegadaAnterior + PAUSA_MINIMA, ta.ultimaAccion + VER_ULTIMA_ACCION) + CUADROS_PUERTA + 1;
        if (T < salidaMinima) T = salidaMinima;
        const pantalla = cubrir(opciones.pantalla, true);
        puertas.push({ cuadro: T, desde: haciaKit ? "celular" : "kit", kit, enLugar, zoomPantalla: pantalla.zoom });
        if (haciaKit) {
          // Entra a la pantalla, corta al lugar y se queda (acercándose
          // lento) hasta la acción; si esa acción pide otro encuadre, corta.
          puntos.push({ cuadro: T - CUADROS_PUERTA, ...acercar(a, empuje(T - CUADROS_PUERTA - llegadaAnterior), "arriba") });
          puntos.push({ cuadro: T - 1, ...pantalla });
          puntos.push({ cuadro: T, ...inicioKit(enLugar) });
          if (mismoEncuadre(enLugar, b)) llegadaAnterior = T; // la toma ya empezó
          else {
            const Tb = Math.max(T + CUADROS_PUERTA, tb.desde);
            puntos.push({ cuadro: Tb - 1, ...finKit(enLugar, Tb - 1 - T) });
            puntos.push({ cuadro: Tb, ...inicioKit(b) });
            llegadaAnterior = Tb;
          }
        } else {
          // Sale: corta al encuadre de la puerta, se acerca lento y pasa a
          // la pantalla del celular, que se abre hasta la toma siguiente.
          puntos.push({ cuadro: T - CUADROS_PUERTA - 1, ...finKit(a, T - CUADROS_PUERTA - 1 - llegadaAnterior) });
          puntos.push({ cuadro: T - CUADROS_PUERTA, ...inicioKit(enLugar) });
          puntos.push({ cuadro: T - 1, ...finKit(enLugar, CUADROS_PUERTA) });
          puntos.push({ cuadro: T, ...pantalla });
          puntos.push({ cuadro: T + CUADROS_PUERTA, ...b });
          llegadaAnterior = T + CUADROS_PUERTA;
        }
        continue;
      }
    }
    // Dentro de un mismo lugar del kit: corte (como en el cine), no viaje.
    // Un viaje de 0,5-1,5 s por toma, con tomas cada ~1 s, atrasa la cámara
    // respecto a la voz y el atraso se acumula (v4: ~3 s al final).
    // También entre un lugar del kit y otra isla (sin puerta): un viaje
    // cruzaría el mundo oscuro con encuadres a medias (caras cortadas).
    if (opciones?.esKit(ta.escena) || opciones?.esKit(tb.escena)) {
      const T = Math.max(tb.desde, llegadaAnterior + CORTE_MINIMO_KIT);
      const durA = T - 1 - llegadaAnterior;
      puntos.push({ cuadro: T - 1, ...(esKitToma(ta) ? finKit(a, durA) : acercar(a, empuje(durA), ta.celular ? "arriba" : "centro")) });
      puntos.push({ cuadro: T, ...(esKitToma(tb) ? inicioKit(b) : b) });
      llegadaAnterior = T;
      continue;
    }
    const dur = duracionViaje(a, b, fps);
    let llegada = tomas[i].desde + LLEGAR_TRAS_PALABRA;
    let inicio = llegada - dur;
    const salidaMinima = Math.max(llegadaAnterior + PAUSA_MINIMA, tomas[i - 1].ultimaAccion + VER_ULTIMA_ACCION);
    if (inicio < salidaMinima) {
      inicio = salidaMinima;
      llegada = inicio + dur;
    }
    puntos.push({ cuadro: inicio, ...acercar(a, empuje(inicio - llegadaAnterior), tomas[i - 1].celular ? "arriba" : "centro") });
    puntos.push({ cuadro: llegada, ...b });
    llegadaAnterior = llegada;
  }
  const ultima = tomas[tomas.length - 1].encuadre;
  const fin = Math.max(total, llegadaAnterior + 1);
  const tUltima = tomas[tomas.length - 1];
  puntos.push({ cuadro: fin, ...(esKitToma(tUltima) ? finKit(ultima, fin - llegadaAnterior) : acercar(ultima, empuje(fin - llegadaAnterior), tUltima.celular ? "arriba" : "centro")) });
  return { puntos, puertas };
}

// Micro-acción: acercamiento corto (+5% en ~0,4 s) que se suelta en ~1,3 s.
// Multiplica el zoom de la toma en curso; no la cambia.
export function pulsoDeCamara(frame: number, pulsos: number[]): number {
  let extra = 0;
  for (const p of pulsos) {
    const t = frame - p;
    if (t < 0 || t > 52) continue;
    extra = Math.max(extra, t < 12 ? 0.05 * Math.sin((t / 12) * (Math.PI / 2)) : 0.05 * (1 - (t - 12) / 40));
  }
  return 1 + extra;
}

