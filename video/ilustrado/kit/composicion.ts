// Una composición del kit ubicada en su isla (puro, probado): dónde queda
// cada personaje y objeto, qué recuadro declara cada uno para la cámara
// (lo nombrado ocupa >= 50 % de la pantalla), qué acciones tiene y qué se
// ve (para el control de calidad por visión).
import type { Rect } from "../motor/geometria";
import {
  COLORES_ROPA,
  NOMBRE_FONDO,
  NOMBRE_OBJETO,
  NOMBRE_PERSONAJE,
  PELOS,
  PIELES,
  VERBOS_OBJETO,
  VERBOS_PERSONAJE,
  type ColorRopa,
  type ComposicionKit,
  type ObjetoKit,
  type Pared,
  type PersonajeKit,
  type Peinado,
  type Pose,
  type TipoPersonaje,
  type Fondo,
  type TipoObjeto,
  esMayor,
  PARA_SENTARSE,
  MUEBLES,
  DE_MANO,
  VEHICULOS,
  LUGARES_DE_OBJETO,
  POSICIONES,
  type Posicion,
} from "./catalogoKit";
import { BOLSA, CAJA, CARRO, CELULAR, HELADO, MESA, MESA_ROPA, MOSTRADOR, MOTO, PERCHERO, PUERTAS, PUERTA_X, TORTA, VITRINA } from "./dibujoLugares";
import { CARTELERA, DIBUJO, DULCES, PUPITRE, SALON, SILLA, casillaCartelera } from "./dibujoObjetos";
import type { AspectoPersonaje } from "./dibujoPersonaje";
import { ropasDePaleta, type Variedad } from "./variedad";
import { estadoPose, posicionMano, proporciones, topeDePose, type Proporciones } from "./poses";

// Todos los lugares del kit miden lo mismo (mismas casillas y profundidades).
export const ISLA_KIT: Record<Fondo, { ancho: number; alto: number }> = {
  salon: { ancho: SALON.ancho, alto: SALON.alto },
  tienda: { ancho: SALON.ancho, alto: SALON.alto },
  cocina: { ancho: SALON.ancho, alto: SALON.alto },
  calle: { ancho: SALON.ancho, alto: SALON.alto },
  tienda_ropa: { ancho: SALON.ancho, alto: SALON.alto },
};

export const POS_X = { izquierda: 360, centro_izquierda: 740, centro: 1100, centro_derecha: 1460, derecha: 1840 } as const;
const PIES = { frente: 1445, fondo: 1205 } as const;
const ESCALA = { frente: 1, fondo: 0.8 } as const;
// Los niños, un poco más grandes en el mundo: con el zoom máximo de la
// cámara un niño solo ocupaba el 47 % de la pantalla (el mínimo es 50 %).
// Siguen siendo más chicos que la profesora.
const ESCALA_TIPO: Record<TipoPersonaje, number> = { profesora: 1, nino: 1.12, nina: 1.12, vendedor: 1, vendedora: 1, cliente: 1, emprendedor: 1, emprendedora: 1, mama: 1, papa: 1, abuela: 0.97, abuelo: 0.97 };
const PARED_X = { pared_izquierda: 620, pared_centro: 1100, pared_derecha: 1580 } as const;
const PARED_Y = 470;

// ---------- Variedad: lo que la IA no fija sale de la semilla del reel ----------
export function hashTexto(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const elegir = <T>(xs: readonly T[], h: number, salto = 0): T => xs[(h + salto) % xs.length];
const PEINADOS_POR_TIPO: Record<TipoPersonaje, Peinado[]> = {
  profesora: ["mono", "largo", "corto", "rizado"],
  nino: ["corto", "rizado"],
  nina: ["colitas", "largo", "rizado", "mono"],
  vendedor: ["corto", "rizado"],
  vendedora: ["mono", "largo", "colitas", "rizado"],
  cliente: ["corto", "rizado", "largo"],
  emprendedor: ["corto", "rizado"],
  emprendedora: ["largo", "mono", "rizado", "corto"],
  mama: ["largo", "mono", "rizado", "corto"],
  papa: ["corto", "rizado"],
  abuela: ["mono", "corto"],
  abuelo: ["corto"],
};
const ROPAS = Object.keys(COLORES_ROPA).filter((c) => c !== "blanco") as ColorRopa[];

// ropas: la paleta del reel (variedad entre reels); sin paleta, todas.
export function aspectoDe(per: PersonajeKit, semilla: string, indice: number, ropas: readonly ColorRopa[] = ROPAS): AspectoPersonaje {
  const h = hashTexto(`${semilla}:${per.id}`);
  // Ropa distinta para cada personaje de la escena (índice como salto).
  const ropa = per.ropa ?? elegir(ropas, h, indice * 3);
  // El segundo color, de fuera de la paleta si hace falta (pantalón/falda).
  const ropa2 = per.ropa2 ?? elegir(ROPAS.filter((c) => c !== ropa), h >>> 5, indice);
  return {
    tipo: per.tipo,
    piel: per.piel ?? elegir(Object.keys(PIELES) as AspectoPersonaje["piel"][], h >>> 9),
    // Los mayores, canosos; los demás, nunca (salvo la profesora).
    pelo: per.pelo ?? (esMayor(per.tipo) ? "canoso" : elegir((Object.keys(PELOS) as AspectoPersonaje["pelo"][]).filter((c) => per.tipo === "profesora" || c !== "canoso"), h >>> 13)),
    peinado: per.peinado ?? elegir(PEINADOS_POR_TIPO[per.tipo], h >>> 17),
    ropa,
    ropa2,
    accesorio: per.accesorio ?? accesorioPorDefecto(per.tipo, h >>> 21),
  };
}

function accesorioPorDefecto(tipo: TipoPersonaje, h: number): AspectoPersonaje["accesorio"] {
  if (tipo === "profesora") return elegir(["ninguno", "gafas"] as const, h);
  if (esMayor(tipo)) return elegir(tipo === "abuelo" ? (["gafas", "bigote", "gafas"] as const) : (["gafas", "gafas", "ninguno"] as const), h);
  if (tipo === "papa" || tipo === "vendedor" || tipo === "emprendedor") return elegir(["ninguno", "bigote", "ninguno", "gafas"] as const, h);
  if (tipo === "cliente" || tipo === "mama" || tipo === "vendedora" || tipo === "emprendedora") return elegir(["ninguno", "ninguno", "gafas"] as const, h);
  return "ninguno";
}

// ---------- Ubicación ----------
// sentado: detrás de un pupitre (la silla atrás, el pupitre adelante tapa las piernas).
export type PersonajeUbicado = { per: PersonajeKit; aspecto: AspectoPersonaje; p: Proporciones; cx: number; pies: number; escala: number; espejo: boolean; sentado?: { pupitre: Rect; silla: Rect; mueble: TipoObjeto };
  // Si en el plan entra o se va: cuánto camina hasta la puerta (la cámara
  // lo cuida en todo el recorrido).
  caminoDx?: number;
  pasaDeLargo?: boolean;
  centroPaso?: number;
};
export type ObjetoUbicado = { obj: ObjetoKit; rect: Rect | null }; // null: en la mano de alguien
export type ComposicionUbicada = { c: ComposicionKit; pared: Pared; isla: { ancho: number; alto: number }; personajes: PersonajeUbicado[]; objetos: ObjetoUbicado[] };

// Tamaño base de cada objeto en el mundo (antes del plano: atrás, 0,8).
const TAM_BASE: Record<TipoObjeto, { ancho: number; alto: number }> = {
  cartelera: { ancho: CARTELERA.ancho, alto: CARTELERA.alto },
  dibujo: { ancho: DIBUJO.ancho * 1.4, alto: DIBUJO.alto * 1.4 },
  dulces: { ancho: DULCES.ancho * 1.2, alto: DULCES.alto * 1.2 },
  pupitre: PUPITRE,
  torta: TORTA,
  helado: HELADO,
  caja: CAJA,
  bolsa: BOLSA,
  celular: CELULAR,
  moto: MOTO,
  carro: CARRO,
  mostrador: MOSTRADOR,
  vitrina: VITRINA,
  mesa: MESA,
  perchero: PERCHERO,
  mesa_ropa: MESA_ROPA,
};
function tamObjeto(o: ObjetoKit, plano: "frente" | "fondo" = o.plano): { ancho: number; alto: number } {
  const t = TAM_BASE[o.tipo];
  // Lo que va en la pared no se achica con el plano.
  const k = o.lugar?.startsWith("pared_") ? 1 : ESCALA[plano];
  return { ancho: t.ancho * k, alto: t.alto * k };
}

export function ubicarComposicion(c: ComposicionKit, semilla: string, variedad?: Partial<Variedad>): ComposicionUbicada {
  const ropas = ropasDePaleta(variedad?.paleta);
  const objetos = ubicarObjetos(c);
  const personajes = c.personajes.map((per, i): PersonajeUbicado => {
    const p = proporciones(per.tipo);
    const asiento = per.sentado_en ? objetos.find((o) => o.obj.id === per.sentado_en && (PARA_SENTARSE as readonly string[]).includes(o.obj.tipo)) : undefined;
    const pupitre = asiento?.rect ?? null;
    if (pupitre) {
      // Sentado: la cintura queda un poco debajo de la tapa del pupitre.
      const plano = c.objetos.find((o) => o.id === per.sentado_en)!.plano;
      const escala = ESCALA[plano] * ESCALA_TIPO[per.tipo];
      const pies = pupitre.y + 36 * ESCALA[plano] + (p.pies - p.torso.y1) * escala;
      const cx = pupitre.x + pupitre.ancho / 2;
      const ws = SILLA.ancho * ESCALA[plano];
      const hs = SILLA.alto * ESCALA[plano];
      const silla = { x: cx - ws / 2, y: pupitre.y + pupitre.alto - hs - 20 * ESCALA[plano], ancho: ws, alto: hs };
      return { per, aspecto: aspectoDe(per, semilla, i, ropas), p, cx, pies, escala, espejo: per.mira === "izquierda", sentado: { pupitre, silla, mueble: asiento!.obj.tipo } };
    }
    const escala = ESCALA[per.plano] * ESCALA_TIPO[per.tipo];
    return { per, aspecto: aspectoDe(per, semilla, i, ropas), p, cx: POS_X[per.posicion], pies: PIES[per.plano], escala, espejo: per.mira === "izquierda" };
  });
  const pared = c.pared ?? variedad?.pared ?? elegir(["crema", "menta", "celeste", "durazno"] as const, hashTexto(`${semilla}:${c.id}`));
  return { c, pared, isla: ISLA_KIT[c.fondo], personajes, objetos };
}

function ubicarObjetos(c: ComposicionKit): ObjetoUbicado[] {
  const base = c.objetos.map((obj): ObjetoUbicado => {
    if (obj.en_mano_de || !obj.lugar) return { obj, rect: null };
    const t = tamObjeto(obj);
    if (obj.lugar.startsWith("pared_")) {
      const x = PARED_X[obj.lugar as keyof typeof PARED_X];
      return { obj, rect: { x: x - t.ancho / 2, y: PARED_Y - t.alto / 2, ancho: t.ancho, alto: t.alto } };
    }
    const x = POS_X[obj.lugar.replace("piso_", "") as keyof typeof POS_X];
    return { obj, rect: { x: x - t.ancho / 2, y: PIES[obj.plano] - t.alto, ancho: t.ancho, alto: t.alto } };
  });
  // Encima de un mueble: en la repisa de la vitrina, o sobre el mostrador
  // o la mesa; varios en el mismo mueble, repartidos a lo ancho.
  return base.map((u) => {
    if (!u.obj.sobre) return u;
    const mueble = base.find((m) => m.obj.id === u.obj.sobre && m.rect);
    if (!mueble?.rect) return u;
    const m = mueble.rect;
    const t = tamObjeto(u.obj, mueble.obj.plano);
    const hermanos = c.objetos.filter((o) => o.sobre === u.obj.sobre);
    const i = hermanos.findIndex((o) => o.id === u.obj.id);
    const x = m.x + (m.ancho * (i + 1)) / (hermanos.length + 1) - t.ancho / 2;
    const apoyo = mueble.obj.tipo === "vitrina" ? m.y + m.alto * VITRINA.repisa : m.y + 6;
    return { ...u, rect: { x, y: apoyo - t.alto, ancho: t.ancho, alto: t.alto } };
  });
}

// Punto local del personaje (lienzo) -> coordenadas de la isla.
export function aIsla(u: PersonajeUbicado, x: number, y: number): { x: number; y: number } {
  return { x: u.cx + (x - u.p.cx) * u.escala * (u.espejo ? -1 : 1), y: u.pies + (y - u.p.pies) * u.escala };
}

// Recuadro del personaje en una pose (cuerpo + manos, a lo alto que llegue).
export function rectPersonaje(u: PersonajeUbicado, pose: Pose = u.per.pose): Rect {
  const e = estadoPose(pose, 6, 30, u.p);
  const manos = [posicionMano(u.p, e.mira, "mira"), posicionMano(u.p, e.otro, "otro")].map((m) => aIsla(u, m.x, m.y));
  const tope = aIsla(u, u.p.cx, topeDePose(u.p, e)).y;
  const medio = (u.p.cuerpoAncho / 2) * u.escala;
  const x0 = Math.min(u.cx - medio, ...manos.map((m) => m.x - 40));
  const x1 = Math.max(u.cx + medio, ...manos.map((m) => m.x + 40));
  const piso = u.sentado ? u.sentado.pupitre.y + u.sentado.pupitre.alto : u.pies + 10;
  return { x: x0, y: tope, ancho: x1 - x0, alto: piso - tope };
}

// Cabeza (con pelo) y torso: lo que nunca puede quedar cortado en el borde
// del cuadro (regla de cámara del kit: entero o fuera).
export function rectCabezaTorso(u: PersonajeUbicado): Rect {
  // El torso con la parte de arriba de los brazos (un hombro cortado en el
  // borde también se ve como un recorte).
  const medio = Math.max(u.p.cabeza.rx * 1.35, u.p.torso.hombros / 2 + u.p.brazo.ancho * 0.5);
  const a = aIsla(u, u.p.cx - medio, u.p.cabeza.cy - u.p.cabeza.ry * 1.3);
  const b = aIsla(u, u.p.cx + medio, u.p.torso.y1);
  return { x: Math.min(a.x, b.x), y: a.y, ancho: Math.abs(b.x - a.x), alto: b.y - a.y };
}

// Acción de grupo: "todos.<verbo>" dispara el verbo en todos los personajes
// de la composición en la misma palabra ("todos aplauden").
export const ID_TODOS = "todos";
export const VERBOS_TODOS = {
  aplaude: "todos aplauden",
  celebra: "todos celebran con los brazos arriba",
  feliz: "todos sonríen felices",
  triste: "todos se ponen tristes",
  sorprendido: "todos se sorprenden",
  levanta_la_mano: "todos levantan la mano",
  se_distrae: "todos se aburren y se distraen",
  presta_atencion: "todos prestan atención",
  saluda: "todos saludan",
} as const satisfies Partial<Record<keyof typeof VERBOS_PERSONAJE, string>>;

// Cuánto camina quien entra o se va: hacia la puerta del lugar, como
// mucho CAMINO_MAXIMO (aparece o desaparece con un fundido al final): un
// recorrido de todo el lugar no cabe en ningún plano sin cortarlo.
export const CAMINO_MAXIMO = 420;
export const CAMINO_LATERAL = 680;
// Con puerta dibujada (tienda, cocina, calle): camina justo hasta la puerta
// y la cruza (ver presencia.ts); el validador pide que quien entra o se va
// esté a DISTANCIA_MAXIMA_PUERTA o menos, para que el plano no quede tan
// abierto. Sin puerta (salón): hacia el costado, hasta salir del cuadro.
export const DISTANCIA_MAXIMA_PUERTA = 620;
// Las posiciones desde donde se puede entrar o irse por la puerta del lugar.
export function posicionesCercaDeLaPuerta(fondo: Fondo): Posicion[] {
  return POSICIONES.filter((p) => Math.abs(PUERTA_X[fondo] - POS_X[p]) <= DISTANCIA_MAXIMA_PUERTA);
}
export function caminoDe(u: PersonajeUbicado, fondo: Fondo): number {
  const d = PUERTA_X[fondo] - u.cx;
  if (PUERTAS[fondo]) return d;
  // Ya está junto a la puerta: sale (o entra) caminando hacia el costado más
  // cercano (dibujados de frente, salir "hacia el fondo" parecía quedarse
  // quieto); al tocar el borde del cuadro se desvanece.
  // Camina lo bastante para salir del cuadro (o entrar desde fuera): la
  // salida se ve completa.
  if (Math.abs(d) < 80) return u.cx < SALON.ancho / 2 ? -CAMINO_LATERAL : CAMINO_LATERAL;
  return Math.sign(d) * Math.min(Math.abs(d), CAMINO_MAXIMO);
}

// Lo que el plano muestra del recorrido: hasta CAMINO_MAXIMO; más allá,
// sale (o entra) por el borde del cuadro.
export const tramoVisible = (dx: number) => Math.sign(dx) * Math.min(Math.abs(dx), CAMINO_MAXIMO);

// Plano medio: de lo más alto (cabeza o manos en alto) hasta medio muslo.
export const PLANO_MEDIO = 0.62;
export function planoMedio(u: PersonajeUbicado, r: Rect): Rect {
  const alto = (u.pies - r.y) * PLANO_MEDIO;
  return { ...r, alto: Math.min(r.alto, alto) };
}

// Cuánto camina el que pasa de largo, a cada lado del centro de su paso.
// (Largo: entra y sale por los bordes del plano, que es cerrado sobre lo
// que no mira; revisión de la tanda 2.)
export const PASO_LARGO = 700;
// Quien pasa de largo cruza por delante del objeto principal más cercano (la
// vitrina, el mostrador, la cartelera, un vehículo): así se ve que pasa al
// lado de eso sin mirarlo. Sin objetos: alrededor de su lugar. Devuelve el
// corrimiento (en x) del centro del paso respecto de su lugar.
export function centroDePaso(u: PersonajeUbicado, cu: ComposicionUbicada): number {
  const principales = cu.objetos.filter((o) => o.rect && !o.obj.en_mano_de && !o.obj.sobre && o.obj.tipo !== "pupitre");
  if (!principales.length) return 0;
  const centros = principales.map((o) => o.rect!.x + o.rect!.ancho / 2);
  const mas = centros.reduce((a, b) => (Math.abs(b - u.cx) < Math.abs(a - u.cx) ? b : a));
  return mas - u.cx;
}

// Un rectángulo del personaje extendido a todo su recorrido (si camina).
export function enCamino(u: PersonajeUbicado, r: Rect): Rect {
  let res = u.caminoDx ? union(r, { ...r, x: r.x + u.caminoDx }) : r;
  if (u.pasaDeLargo) res = union(res, union({ ...r, x: r.x + (u.centroPaso ?? 0) - PASO_LARGO }, { ...r, x: r.x + (u.centroPaso ?? 0) + PASO_LARGO }));
  return res;
}

export function rectElemento(cu: ComposicionUbicada, id: string, pose?: Pose): Rect | null {
  const per = cu.personajes.find((x) => x.per.id === id);
  if (per) return rectPersonaje(per, pose);
  const obj = cu.objetos.find((x) => x.obj.id === id);
  if (!obj) return null;
  if (obj.rect) return obj.rect;
  const duenio = cu.personajes.find((x) => x.per.id === obj.obj.en_mano_de);
  return duenio ? rectPersonaje(duenio, pose) : null;
}

export function casillaHuecoEnIsla(cu: ComposicionUbicada): Rect | null {
  const cart = cu.objetos.find((o) => o.obj.tipo === "cartelera" && o.rect);
  if (!cart?.rect) return null;
  const h = casillaCartelera(CARTELERA.hueco);
  return { x: cart.rect.x + h.x, y: cart.rect.y + h.y, ancho: h.ancho, alto: h.alto };
}

export function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, ancho: Math.max(a.x + a.ancho, b.x + b.ancho) - x, alto: Math.max(a.y + a.alto, b.y + b.alto) - y };
}

// ---------- Acciones ("elemento.verbo") ----------
export type DefAccionKit = { descripcion: string; foco: Rect };

function nombreElemento(cu: ComposicionUbicada, id: string): string {
  const per = cu.personajes.find((x) => x.per.id === id);
  if (per) return NOMBRE_PERSONAJE[per.per.tipo].replace(/^una? /, "la ").replace(/^la niño/, "el niño");
  const obj = cu.objetos.find((x) => x.obj.id === id);
  return obj ? `el objeto ${obj.obj.tipo}` : id;
}

export function accionesDeComposicion(cu: ComposicionUbicada): Record<string, DefAccionKit> {
  const res: Record<string, DefAccionKit> = {};
  for (const u of cu.personajes) {
    for (const [verbo, def] of Object.entries(VERBOS_PERSONAJE)) {
      // Sentado no se entra ni se va caminando.
      if ((verbo === "entra" || verbo === "se_va" || verbo === "pasa_de_largo") && u.sentado) continue;
      const pose = "pose" in def ? def.pose : undefined;
      const r = rectPersonaje(u, pose);
      // Entrar o irse: el foco es todo el recorrido, de la puerta a su lugar.
      // Caminar se ve de cuerpo entero; las demás acciones de alguien de pie,
      // en plano medio (de la cabeza a medio muslo): un adulto de cuerpo
      // entero queda chico y con piso de sobra (revisión de la tanda 2).
      // Con puerta: el recorrido entero hasta la puerta (que queda detrás).
      const camino = caminoDe(u, cu.c.fondo);
      const foco =
        verbo === "entra" || verbo === "se_va"
          ? union(r, { ...r, x: r.x + (PUERTAS[cu.c.fondo] ? camino : tramoVisible(camino)) })
          : verbo === "pasa_de_largo"
            ? // El foco es quien pasa justo delante de lo que no mira (no todo el
              // cruce): el plano queda cerrado y el producto se ve grande.
              { ...r, x: r.x + centroDePaso(u, cu) }
            : u.sentado
              ? r
              : planoMedio(u, r);
      res[`${u.per.id}.${verbo}`] = { descripcion: `${nombreElemento(cu, u.per.id)} ${def.descripcion}`, foco };
    }
  }
  if (cu.personajes.length >= 2) {
    for (const [verbo, descripcion] of Object.entries(VERBOS_TODOS)) {
      const def = VERBOS_PERSONAJE[verbo as keyof typeof VERBOS_TODOS];
      const pose = "pose" in def ? def.pose : undefined;
      res[`${ID_TODOS}.${verbo}`] = { descripcion, foco: cu.personajes.map((u) => rectPersonaje(u, pose)).reduce(union) };
    }
  }
  const hueco = casillaHuecoEnIsla(cu);
  for (const o of cu.objetos) {
    for (const [verbo, descripcion] of Object.entries(VERBOS_OBJETO[o.obj.tipo])) {
      if (verbo === "va_al_hueco" && !hueco) continue;
      const r = rectElemento(cu, o.obj.id);
      if (!r) continue;
      // En la mano de alguien de pie: el plano medio de esa persona.
      const duenio = o.obj.en_mano_de ? cu.personajes.find((u) => u.per.id === o.obj.en_mano_de) : undefined;
      const base = duenio && !duenio.sentado ? planoMedio(duenio, r) : r;
      res[`${o.obj.id}.${verbo}`] = { descripcion, foco: verbo === "va_al_hueco" && hueco ? union(base, hueco) : base };
    }
  }
  return res;
}

// Foco de una acción, con su objetivo (ej. "la profesora señala el dibujo").
export function focoDeAccionKit(cu: ComposicionUbicada, accion: string, objetivo?: string): Rect | null {
  const def = accionesDeComposicion(cu)[accion];
  if (!def) return null;
  const otro = objetivo ? rectElemento(cu, objetivo) : null;
  return otro ? union(def.foco, otro) : def.foco;
}

// Foco más chico para cuando el de la acción no cabe con zoom >= mínimo sin
// cortar a nadie (revisión de la v6: "le trae dulces" se abría muchísimo):
// - con objetivo: solo quien hace la acción (al otro lo muestra después
//   un plano de reacción, ver coberturas en camara.ts);
// - el dibujo que vuela al hueco o el hueco que late: la zona del hueco;
// - la cartelera: su parte central (primer plano de los dibujos).
// Devuelve las alternativas en orden de preferencia.
export function focoReducidoKit(cu: ComposicionUbicada, accion: string, objetivo?: string): Rect[] {
  const [id, verbo] = accion.split(".");
  const cart = cu.objetos.find((o) => o.obj.tipo === "cartelera" && o.rect)?.rect ?? null;
  const hueco = casillaHuecoEnIsla(cu);
  const centro = cart ? zonaAlrededor({ x: cart.x + cart.ancho * 0.2, y: cart.y + cart.alto * 0.1, ancho: cart.ancho * 0.6, alto: cart.alto * 0.8 }, cart, 1, 1) : null;
  if ((verbo === "va_al_hueco" || verbo === "destaca_hueco") && hueco && cart) return [zonaAlrededor(hueco, cart, 2.4, 1.9), centro!];
  if (centro && cu.objetos.some((o) => o.obj.id === id && o.obj.tipo === "cartelera")) return [centro];
  if (objetivo) {
    const propio = accionesDeComposicion(cu)[accion]?.foco;
    return propio ? [propio] : [];
  }
  return [];
}
function zonaAlrededor(r: Rect, limite: Rect, fx: number, fy: number): Rect {
  const ancho = Math.min(limite.ancho, r.ancho * fx);
  const alto = Math.min(limite.alto, r.alto * fy);
  const x = Math.max(limite.x, Math.min(limite.x + limite.ancho - ancho, r.x + r.ancho / 2 - ancho / 2));
  const y = Math.max(limite.y, Math.min(limite.y + limite.alto - alto, r.y + r.alto / 2 - alto / 2));
  return { x, y, ancho, alto };
}

// ---------- Validación y descripción ----------
// Cuánto de la cartelera puede quedar detrás de la cabeza y el torso de
// alguien (un poco es natural en un salón; la mitad del centro, no).
export const TAPA_MAXIMO_CARTELERA = 0.12;

export function problemasComposicion(c: ComposicionKit): string[] {
  const p: string[] = [];
  const ids = [...c.personajes.map((x) => x.id), ...c.objetos.map((x) => x.id)];
  for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) p.push(`${c.id}: el id "${id}" se repite`);
  if (ids.includes(ID_TODOS)) p.push(`${c.id}: "${ID_TODOS}" está reservado para las acciones de grupo ("todos.aplaude"); usa otro id`);
  for (const o of c.objetos) {
    if (o.en_mano_de && !c.personajes.some((x) => x.id === o.en_mano_de)) p.push(`${c.id}: "${o.id}" está en la mano de "${o.en_mano_de}", que no existe en la composición`);
    if (o.tipo === "cartelera" && o.en_mano_de) p.push(`${c.id}: una cartelera no va en la mano`);
  }
  if (c.objetos.filter((o) => o.tipo === "cartelera").length > 1) p.push(`${c.id}: solo una cartelera por composición`);
  for (const o of c.objetos) {
    const de = (xs: readonly string[]) => xs.includes(o.tipo);
    if ((de(MUEBLES) || de(VEHICULOS)) && !o.lugar?.startsWith("piso_")) p.push(`${c.id}: "${o.id}" (${o.tipo}) va en el piso`);
    if ((o.en_mano_de || o.sobre) && !de(DE_MANO)) p.push(`${c.id}: "${o.id}" (${o.tipo}) no se sostiene en la mano ni va encima de un mueble`);
    if (o.lugar?.startsWith("pared_") && o.tipo !== "cartelera" && o.tipo !== "dibujo") p.push(`${c.id}: "${o.id}" (${o.tipo}) no va en la pared`);
    if (o.lugar?.startsWith("piso_") && de(DE_MANO) && o.tipo !== "caja" && o.tipo !== "bolsa") p.push(`${c.id}: "${o.id}" (${o.tipo}) no va en el piso: ponlo en la mano de alguien o "sobre" un mueble (mostrador, vitrina o mesa)`);
    if (o.sobre) {
      const m = c.objetos.find((x) => x.id === o.sobre);
      if (!m || !["mostrador", "vitrina", "mesa"].includes(m.tipo)) p.push(`${c.id}: "${o.id}" está sobre "${o.sobre}", que no es un mostrador, una vitrina ni una mesa de la composición`);
    }
    const lugares = LUGARES_DE_OBJETO[o.tipo];
    if (lugares && !lugares.includes(c.fondo)) p.push(`${c.id}: "${o.id}" (${o.tipo}) no va en ${c.fondo}; va en: ${lugares.join(", ")}`);
  }
  // Un dibujo en el piso no se entiende (primera corrida real de la IA, 24 nov 2026).
  for (const o of c.objetos) if (o.tipo === "dibujo" && o.lugar?.startsWith("piso_")) p.push(`${c.id}: el dibujo "${o.id}" va en la pared o en la mano de alguien, no en el piso`);
  // Cada personaje sostiene una sola cosa.
  const manos = c.objetos.flatMap((o) => (o.en_mano_de ? [o.en_mano_de] : []));
  for (const id of new Set(manos)) if (manos.filter((x) => x === id).length > 1) p.push(`${c.id}: "${id}" sostiene más de una cosa; cada personaje sostiene una sola`);
  for (const x of c.personajes) {
    if (x.sentado_en && !c.objetos.some((o) => o.id === x.sentado_en && (PARA_SENTARSE as readonly string[]).includes(o.tipo))) p.push(`${c.id}: "${x.id}" está sentado en "${x.sentado_en}", que no es un pupitre ni una mesa de la composición`);
    if (x.mira_a && !ids.includes(x.mira_a)) p.push(`${c.id}: "${x.id}" mira a "${x.mira_a}", que no existe en la composición`);
  }
  const sentados = c.personajes.flatMap((x) => (x.sentado_en ? [x.sentado_en] : []));
  for (const id of new Set(sentados)) if (sentados.filter((x) => x === id).length > 1) p.push(`${c.id}: dos personajes sentados en el mismo pupitre "${id}"`);
  const posiciones = c.personajes.filter((x) => x.plano === "frente" && !x.sentado_en).map((x) => x.posicion);
  for (const pos of new Set(posiciones)) if (posiciones.filter((x) => x === pos).length > 1) p.push(`${c.id}: dos personajes en el frente en la misma posición "${pos}"`);
  // Nunca en fila (revisión de la v6): con 3 o más personajes, al menos dos
  // profundidades distintas (de pie adelante, de pie atrás, sentado).
  const profundidades = new Set(c.personajes.map((x) => (x.sentado_en ? `sentado-${c.objetos.find((o) => o.id === x.sentado_en)?.plano}` : x.plano)));
  if (c.personajes.length >= 3 && profundidades.size < 2) p.push(`${c.id}: todos los personajes están en la misma línea (en fila); pon a alguno "plano": "fondo" o sentado en un pupitre, para que haya profundidad`);
  // Nadie tapa lo que está en la pared (primera corrida real de la IA, 24 nov
  // 2026: la profesora de pie delante de la cartelera tapaba los dibujos y
  // el espacio libre). Se mide con las piezas ya ubicadas.
  if (p.length === 0) {
    const cu = ubicarComposicion(c, "");
    for (const o of cu.objetos) {
      if (!o.rect || !o.obj.lugar?.startsWith("pared_")) continue;
      const w = o.rect;
      for (const u of cu.personajes) {
        const r = rectCabezaTorso(u);
        const ix = Math.max(0, Math.min(r.x + r.ancho, w.x + w.ancho) - Math.max(r.x, w.x));
        const iy = Math.max(0, Math.min(r.y + r.alto, w.y + w.alto) - Math.max(r.y, w.y));
        const limite = o.obj.tipo === "cartelera" ? TAPA_MAXIMO_CARTELERA : 0.25;
        if ((ix * iy) / (w.ancho * w.alto) > limite) p.push(`${c.id}: "${u.per.id}" tapa ${o.obj.tipo === "cartelera" ? "la cartelera" : `"${o.obj.id}"`} (${o.obj.lugar}); ponlo en otra posición, a un lado de lo que está en la pared`);
      }
    }
  }
  return p;
}

export function descripcionVisible(cu: ComposicionUbicada): string {
  const quienes = cu.personajes.map((u) => NOMBRE_PERSONAJE[u.per.tipo]);
  const cosas = cu.objetos.map((o) => NOMBRE_OBJETO[o.obj.tipo]);
  return `${NOMBRE_FONDO[cu.c.fondo]} ilustrado con ${[...quienes, ...cosas].join(", ")}`;
}
