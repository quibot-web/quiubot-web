// Una composición del kit en un cuadro (sin hooks de Remotion: recibe el
// cuadro por props). Solo dibuja <img> ya precargadas (PNG) y bloques de
// color: los brazos giran en hombro y codo, la cara parpadea y mira hacia
// lo que pasa, y los objetos aparecen, destacan o vuelan al hueco de la
// cartelera según las acciones amarradas a las palabras (d).
/* eslint-disable @next/next/no-img-element -- dibujos del video, no páginas */
import type { CSSProperties, ReactNode } from "react";
import { rampa, latido, primero } from "../motor/animacion";
import type { DisparosEscena } from "../motor/plan";
import { seTocan, type Rect } from "../motor/geometria";
import { PAREDES, VERBOS_PERSONAJE, type Expresion, type Pose } from "./catalogoKit";
import { ID_TODOS, aIsla, casillaHuecoEnIsla, centroDePaso, enCamino, rectCabezaTorso, hashTexto, rectElemento, rectPersonaje, type ComposicionUbicada, type PersonajeUbicado } from "./composicion";
import { BOLSA, CAJA, CELULAR, HELADO, TORTA, VENTANA_COCINA_X, coloresEntorno } from "./dibujoLugares";
import { CARTELERA, DIBUJO, DULCES, SALON, VENTANA_SALON, Y_LINEAS_PISO, casillaCartelera } from "./dibujoObjetos";
import { oscurecer, aclarar, type Cara } from "./dibujoPersonaje";
import { clave, motivoDe, motivosCartelera, type ImagenesKit, type ImagenPieza } from "./piezas";
import { ANGOSTO_CAMINANDO, aperturaPuerta, caminataEn, presenciaDe, rectEnPresencia } from "./presencia";
import { PUERTAS } from "./dibujoLugares";
import { apunteHacia, conVueltasAParado, estadoPose, poseEnCuadro, posicionMano, type AngulosBrazo, type CambioPose, type EstadoPose } from "./poses";

// objetivos: a qué apunta cada acción que lo tiene ("profesora.senala" en
// el cuadro c -> "dibujo_nina").
export type ObjetivosKit = { accion: string; cuadro: number; objetivo: string }[];
// vista: lo que ve la cámara, en coordenadas de la isla. Lo que queda fuera
// (con margen, por brazos y objetos que se salen) no se dibuja: cada <img>
// cuesta en el render del navegador (meta <= 5 s por segundo de video).
export type PropsEscenaKit = { cu: ComposicionUbicada; frame: number; fps: number; d: DisparosEscena; imagenes: ImagenesKit; objetivos?: ObjetivosKit; vista?: Rect };
const MARGEN_VISTA = 260;

// La pose y la expresión empiezan un poco antes de la palabra (se ve
// cuando la voz lo nombra, no después).
const ANTICIPO_POSE = 3;
const ANTICIPO_EXPRESION = 2;
const CUADROS_VUELO = 24;
// Cuánto dura la atención de todos sobre algo que pasa.
const ATENCION = 70;
// Entorno: cuánto continúa el lugar más allá de la isla.
export const ENTORNO = { izquierda: 700, derecha: 700, arriba: 1500, abajo: 1300 } as const;

function Img({ img, estilo }: { img: ImagenPieza | undefined; estilo?: CSSProperties }) {
  if (!img) return null;
  return <img src={img.url} alt="" decoding="sync" crossOrigin="anonymous" style={{ position: "absolute", left: 0, top: 0, width: img.ancho, height: img.alto, ...estilo }} />;
}

// Punto (en coordenadas locales de u) al que apunta: el centro del
// objetivo, un poco arriba si es una persona (su cara o lo que sostiene).
// Nunca por delante de una cara (revisión de la v7): si el brazo que
// señala cruzaría la cara de alguien que está detrás, se prueba un ángulo
// más alto o más bajo (lo más cerca posible del objetivo).
function apunteDe(u: PersonajeUbicado, cu: ComposicionUbicada | undefined, objetivo: string | undefined): number | undefined {
  if (!cu || !objetivo) return undefined;
  const r = rectElemento(cu, objetivo);
  if (!r) return undefined;
  const destino = { x: r.x + r.ancho / 2, y: r.y + r.alto * 0.55 };
  const lx = u.p.cx + (destino.x - u.cx) / (u.escala * (u.espejo ? -1 : 1));
  const ly = u.p.pies + (destino.y - u.pies) / u.escala;
  const ideal = apunteHacia(u.p, lx, ly);
  const detras = cu.personajes.filter((o) => o !== u && zDe(o) < zDe(u)).map(caraEnIsla);
  for (const delta of [0, -12, 12, -24, 24, -36, 36, -48, 48]) {
    const ang = Math.max(35, Math.min(125, ideal + delta));
    const brazo = segmentosBrazo(u, estadoPose("senalar", 30, 30, u.p, ang), "mira");
    if (!detras.some((c) => brazo.some((sg) => tocaCara(sg, c)))) return ang;
  }
  return ideal;
}

// ---------- Caras y lo que pasa por delante (pura, también la usan las pruebas) ----------
export type CaraEnIsla = { id: string; x: number; y: number; r: number };
// Orden de dibujo en el piso (más atrás = antes); el mismo que usa EscenaKit.
export function zDe(u: PersonajeUbicado): number {
  const s = u.sentado;
  return (s ? s.pupitre.y + s.pupitre.alto : u.pies) - (u.per.tipo === "profesora" ? 3 : 0);
}
export function caraEnIsla(u: PersonajeUbicado): CaraEnIsla {
  const c = aIsla(u, u.p.cabeza.cx, u.p.cabeza.cy + u.p.cabeza.ry * 0.1);
  return { id: u.per.id, x: c.x, y: c.y, r: Math.min(u.p.cabeza.rx, u.p.cabeza.ry) * 0.8 * u.escala };
}
type Segmento = { a: { x: number; y: number }; b: { x: number; y: number }; w: number };
function segmentosBrazo(u: PersonajeUbicado, e: EstadoPose, lado: "mira" | "otro"): Segmento[] {
  const ang = lado === "mira" ? e.mira : e.otro;
  const signo = lado === "mira" ? 1 : -1;
  const rad = (g: number) => (g * Math.PI) / 180;
  const hombro = { x: u.p.cx + signo * u.p.hombroDx, y: u.p.hombroY };
  const codo = { x: hombro.x + signo * u.p.brazo.largo * Math.sin(rad(ang.hombro)), y: hombro.y + u.p.brazo.largo * Math.cos(rad(ang.hombro)) };
  const mano = posicionMano(u.p, ang, lado);
  const enIsla = (q: { x: number; y: number }) => {
    const r = aIsla(u, q.x, q.y);
    return { x: r.x, y: r.y + e.saltoY * u.escala };
  };
  const w = (u.p.brazo.ancho / 2) * u.escala;
  return [
    { a: enIsla(hombro), b: enIsla(codo), w },
    { a: enIsla(codo), b: enIsla(mano), w: w + u.p.antebrazo.mano * 0.3 * u.escala },
  ];
}
function tocaCara(sg: Segmento, c: CaraEnIsla): boolean {
  const [dx, dy] = [sg.b.x - sg.a.x, sg.b.y - sg.a.y];
  const largo2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((c.x - sg.a.x) * dx + (c.y - sg.a.y) * dy) / largo2));
  return Math.hypot(sg.a.x + t * dx - c.x, sg.a.y + t * dy - c.y) < c.r + sg.w;
}
function rectTocaCara(r: Rect, c: CaraEnIsla): boolean {
  const x = Math.max(r.x, Math.min(c.x, r.x + r.ancho));
  const y = Math.max(r.y, Math.min(c.y, r.y + r.alto));
  return Math.hypot(x - c.x, y - c.y) < c.r;
}

// Brazos u objetos en la mano que, en este cuadro, quedan dibujados por
// delante de una cara (la de otro que está detrás, o la propia si el
// objeto va delante del cuerpo). Regla: nunca.
export function tapanCaras(cu: ComposicionUbicada, disparos: DisparosEscena, objetivos: ObjetivosKit, frame: number, fps: number): string[] {
  const d = conAccionesDeGrupo(cu, disparos);
  const res: string[] = [];
  const estados = new Map(cu.personajes.map((u) => [u, estadoEnCuadro(u, cu, d, objetivos, frame, fps).e]));
  for (const u of cu.personajes) {
    const e = estados.get(u)!;
    const brazos = [...segmentosBrazo(u, e, "mira"), ...segmentosBrazo(u, e, "otro")];
    const enMano = cu.objetos.filter((o) => o.obj.en_mano_de === u.per.id && o.obj.tipo !== "cartelera" && !d[`${o.obj.id}.va_al_hueco`]?.some((c) => c <= frame));
    const rects = enMano
      .filter((o) => esDeMano(o.obj.tipo))
      .map((o) => {
        const tipo = o.obj.tipo as DeMano;
        const extra = (1 + 0.22 * destacaDe(d, o.obj.id, frame)) * pop(aparicion(frame, o.obj.visible, primero(d[`${o.obj.id}.aparece`])));
        const om = objetoEnMano(u, tipo, cu, d, objetivos, frame, fps, extra);
        // Un poco más chico que la imagen (el papel y la bolsa tienen bordes transparentes).
        const r = rectEnMano(tipo, om.c, om.escala);
        return { id: o.obj.id, r: { x: r.x + r.ancho * 0.06, y: r.y + r.alto * 0.06, ancho: r.ancho * 0.88, alto: r.alto * 0.88 } };
      });
    const atras = esManosArriba(d, u, cu, objetivos, frame);
    for (const otro of cu.personajes) {
      const c = caraEnIsla(otro);
      if (otro === u) {
        if (!atras) for (const o of rects) if (rectTocaCara(o.r, c)) res.push(`${o.id} tapa la cara de ${u.per.id}`);
        continue;
      }
      if (zDe(otro) >= zDe(u)) continue; // el otro está delante: lo tapa él a u, no al revés
      if (brazos.some((sg) => tocaCara(sg, c))) res.push(`el brazo de ${u.per.id} tapa la cara de ${otro.per.id}`);
      if (!atras) for (const o of rects) if (rectTocaCara(o.r, c)) res.push(`${o.id} (de ${u.per.id}) tapa la cara de ${otro.per.id}`);
    }
  }
  return res;
}
function esManosArriba(d: DisparosEscena, u: PersonajeUbicado, cu: ComposicionUbicada, objetivos: ObjetivosKit, frame: number): boolean {
  const actual = conVueltasAParado(cambiosDe(d, u, cu, objetivos).poses).filter((c) => c.cuadro <= frame).at(-1)?.pose ?? u.per.pose;
  return actual === "aplaudir" || actual === "celebrar" || actual === "levantar_mano";
}

// Memoria por cuadro: los disparos de una escena son un objeto nuevo en
// cada cuadro, así que se usa como llave (WeakMap): dentro de un cuadro,
// cada cálculo por personaje se hace una sola vez.
const memoCambios = new WeakMap<DisparosEscena, Map<PersonajeUbicado, ReturnType<typeof cambiosSinMemo>>>();
function cambiosDe(d: DisparosEscena, u: PersonajeUbicado, cu?: ComposicionUbicada, objetivos: ObjetivosKit = []) {
  let m = memoCambios.get(d);
  if (!m) memoCambios.set(d, (m = new Map()));
  const clave = cu ? u : undefined;
  if (clave && m.has(clave)) return m.get(clave)!;
  const r = cambiosSinMemo(d, u, cu, objetivos);
  if (clave) m.set(clave, r);
  return r;
}
function cambiosSinMemo(d: DisparosEscena, u: PersonajeUbicado, cu?: ComposicionUbicada, objetivos: ObjetivosKit = []) {
  const id = u.per.id;
  const poses: CambioPose[] = [];
  const expresiones: { cuadro: number; expresion: Expresion }[] = [];
  for (const [verbo, def] of Object.entries(VERBOS_PERSONAJE)) {
    for (const c of d[`${id}.${verbo}`] ?? []) {
      const objetivo = objetivos.find((o) => o.accion === `${id}.${verbo}` && o.cuadro === c)?.objetivo;
      if ("pose" in def) poses.push({ cuadro: c - ANTICIPO_POSE, pose: def.pose as Pose, apunte: def.pose === "senalar" ? apunteDe(u, cu, objetivo) : undefined });
      if ("expresion" in def) expresiones.push({ cuadro: c - ANTICIPO_EXPRESION, expresion: def.expresion });
    }
  }
  // Participar (levantar la mano, aplaudir, celebrar) quita el aburrimiento
  // y la tristeza: nadie levanta la mano con cara de aburrido (v7).
  expresiones.sort((a, b) => a.cuadro - b.cuadro);
  for (const verbo of VERBOS_QUE_ANIMAN) {
    for (const c of d[`${id}.${verbo}`] ?? []) {
      const cuadro = c - ANTICIPO_EXPRESION;
      const antes = [...expresiones].reverse().find((x) => x.cuadro <= cuadro)?.expresion ?? u.per.expresion;
      const mismaVez = expresiones.some((x) => x.cuadro === cuadro);
      if (!mismaVez && (antes === "aburrido" || antes === "triste")) expresiones.push({ cuadro, expresion: verbo === "levanta_la_mano" ? "atento" : "feliz" });
    }
  }
  return { poses, expresiones: expresiones.sort((a, b) => a.cuadro - b.cuadro) };
}
const VERBOS_QUE_ANIMAN = ["levanta_la_mano", "aplaude", "celebra"] as const;

// ---------- Atención: hacia dónde mira cada uno ----------
type Atencion = { desde: number; hasta: number; punto: { x: number; y: number }; actor?: string };
function centro(r: Rect) {
  return { x: r.x + r.ancho / 2, y: r.y + r.alto * 0.45 };
}
export function atencionesDe(cu: ComposicionUbicada, d: DisparosEscena, objetivos: ObjetivosKit = []): Atencion[] {
  const res: Atencion[] = [];
  const hueco = casillaHuecoEnIsla(cu);
  for (const [accion, cuadros] of Object.entries(d)) {
    const [id, verbo] = accion.split(".");
    if (!verbo) continue;
    const esPersonaje = cu.personajes.some((u) => u.per.id === id);
    for (const c of cuadros) {
      const objetivo = objetivos.find((o) => o.accion === accion && o.cuadro === c)?.objetivo;
      let r: Rect | null = null;
      if (objetivo) r = rectElemento(cu, objetivo);
      else if ((verbo === "va_al_hueco" || verbo === "destaca_hueco") && hueco) r = hueco;
      else if (!esPersonaje || ["celebra", "aplaude", "levanta_la_mano", "ofrece"].includes(verbo)) r = rectElemento(cu, id);
      if (r) res.push({ desde: c - 4, hasta: c + ATENCION, punto: centro(r), actor: esPersonaje && !objetivo ? id : undefined });
    }
  }
  return res.sort((a, b) => a.desde - b.desde);
}

// -1 = mira a la izquierda de la pantalla, 1 = a la derecha, 0 = de frente.
function miradaCruda(u: PersonajeUbicado, cu: ComposicionUbicada, atenciones: Atencion[], frame: number): number {
  const cabeza = aIsla(u, u.p.cabeza.cx, u.p.cabeza.cy);
  const activa = [...atenciones].reverse().find((a) => frame >= a.desde && frame <= a.hasta && a.actor !== u.per.id);
  let punto = activa?.punto;
  if (!punto && u.per.mira_a) {
    const r = rectElemento(cu, u.per.mira_a);
    if (r) punto = centro(r);
  }
  if (!punto) return 0;
  const dx = punto.x - cabeza.x;
  if (Math.abs(dx) < 40) return 0;
  return Math.max(-1, Math.min(1, dx / 260));
}
// Gira suave (no de golpe): promedio de los últimos 8 cuadros.
function mirada(u: PersonajeUbicado, cu: ComposicionUbicada, atenciones: Atencion[], frame: number): number {
  let suma = 0;
  for (let k = 0; k < 8; k++) suma += miradaCruda(u, cu, atenciones, frame - k);
  return suma / 8;
}

// ---------- Personaje ----------
function zDetrasDelPaso(u: PersonajeUbicado, cu: ComposicionUbicada): number {
  const x = u.cx + centroDePaso(u, cu);
  const o = cu.objetos.find((o) => o.rect && !o.obj.en_mano_de && !o.obj.sobre && Math.abs(o.rect.x + o.rect.ancho / 2 - x) < 1);
  return o?.rect ? Math.min(zDe(u), o.rect.y + o.rect.alto - 1) : zDe(u);
}

// 0 si r toca o sale de la vista; de 0 a 1 en las últimas 40 unidades adentro.
export function margenDentro(r: Rect, v: Rect): number {
  const m = Math.min(r.x - v.x, v.x + v.ancho - (r.x + r.ancho), r.y - v.y, v.y + v.alto - (r.y + r.alto));
  return Math.max(0, Math.min(1, m / 40));
}

function Personaje({ u, cu, frame, fps, d, imagenes, objetivos, atenciones, vista }: { u: PersonajeUbicado; cu: ComposicionUbicada; frame: number; fps: number; d: DisparosEscena; imagenes: ImagenesKit; objetivos?: ObjetivosKit; atenciones: Atencion[]; vista?: Rect }) {
  const { p, aspecto: a } = u;
  const { expresiones } = cambiosDe(d, u, cu, objetivos);
  const { e } = estadoEnCuadro(u, cu, d, objetivos ?? [], frame, fps);
  // Caminando (entra, se va, pasa de largo): corrido, mirando hacia donde va, con paso.
  const pres = presenciaDe(u, cu, d, frame);
  const pasadas = expresiones.filter((x) => x.cuadro <= frame);
  const actual = pasadas.at(-1);
  const expresion = actual?.expresion ?? u.per.expresion;
  const previa = pasadas.at(-2)?.expresion ?? u.per.expresion;
  const mezcla = actual ? rampa(frame, actual.cuadro, 5) : 1;
  // Vida: parpadeo (cada uno con su ritmo), respiración y cabeza que se mueve.
  const h = hashTexto(u.per.id);
  const periodo = 95 + (h % 50);
  const parpadea = (frame + (h % periodo)) % periodo < 4;
  const ojos = parpadea ? "cerrados" : "abiertos";
  const respira = Math.sin((frame + h) / 18) * 0.012;
  // Distraído (aburrido): mira para el lado contrario a lo que pasa y baja la cabeza.
  const gAtento = mirada(u, cu, atenciones, frame);
  const distraido = expresion === "aburrido" ? (previa === "aburrido" ? 1 : mezcla) : previa === "aburrido" ? 1 - mezcla : 0;
  // El distraído mira por la ventana (si el lugar tiene) o para el otro lado.
  const cabezaX = aIsla(u, u.p.cabeza.cx, u.p.cabeza.cy).x;
  const ventanaX = cu.c.fondo === "salon" ? VENTANA_SALON.x + VENTANA_SALON.w / 2 : cu.c.fondo === "cocina" ? VENTANA_COCINA_X : null;
  const gLejos = ventanaX !== null && Math.abs(ventanaX - cabezaX) > 60 ? Math.max(-1, Math.min(1, (ventanaX - cabezaX) / 200)) : -(Math.sign(gAtento) || (u.espejo ? 1 : -1)) * 0.9;
  const gMundo = gAtento + (gLejos - gAtento) * distraido;
  // Y bosteza cada ~3 s (cara de bostezo unos 0,7 s).
  const bosteza = distraido >= 1 && (frame + (h % 97)) % 96 < 22;
  // Caminando mira al frente (hacia donde va), nunca a lo que pasa en el
  // lugar: así se lee "pasa de largo sin mirar".
  const g = pres.camina ? 1 : gMundo * (u.espejo ? -1 : 1); // en coordenadas locales
  const giroCabeza = e.inclinacion + g * 5 + 7 * distraido + Math.sin((frame + h) / 47) * 1.2;
  const micro = latido(frame, d.micro, 18) * Math.abs(Math.sin(frame / 3)) * 10;
  if (pres.alpha <= 0) return null;
  // Quien camina nunca se ve cortado por el borde: se desvanece al acercarse
  // (40 unidades) y no se dibuja si la cabeza o el torso lo tocarían.
  const bordeAlpha = pres.camina && vista ? margenDentro(rectEnPresencia(u, rectCabezaTorso(u), pres), vista) : 1;
  if (bordeAlpha <= 0) return null;
  const espejo = pres.mira ? pres.mira === "izquierda" : u.espejo;
  // Caminar (dibujo plano, siempre de frente): las piernas se alternan en
  // tijera desde la cadera, el brazo de adelante va contra su pierna, el
  // cuerpo se inclina hacia donde va y se angosta un poco (como girado), y
  // el brazo y la pierna del lado lejano quedan detrás del cuerpo. En
  // coordenadas locales "adelante" es la derecha (el espejo da la vuelta).
  const fase = pres.t / 3.2;
  const caminata = pres.camina ? caminataEn(fase, !!pres.pasa) : null;
  const paso = (caminata?.paso ?? 0) * p.alto;
  const angosto = caminata ? ANGOSTO_CAMINANDO : 1;
  const ep = pres.escala ?? 1;
  const sx = u.escala * ep * (espejo ? -1 : 1);
  const llevaAlgo = cu.objetos.some((o) => o.obj.en_mano_de === u.per.id);
  const brazoBalanceo = caminata && !llevaAlgo ? caminata.brazo : 0;
  const brazo = (lado: "mira" | "otro", ang: AngulosBrazo): ReactNode => {
    const s = lado === "mira" ? -1 : 1;
    const br = imagenes[clave.brazo(a)];
    const ab = imagenes[clave.antebrazo(a, ang.mano)];
    if (!br || !ab) return null;
    // Balanceo: el de adelante ("otro", el cercano) y el lejano, en contrafase.
    const hombro = ang.hombro - brazoBalanceo;
    return (
      <div key={lado} style={{ position: "absolute", left: p.cx - s * p.hombroDx * angosto, top: p.hombroY, transformOrigin: "0 0", transform: `rotate(${s * hombro}deg)` }}>
        <Img img={br} estilo={{ left: -br.ancla.x, top: -br.ancla.y }} />
        <div style={{ position: "absolute", left: 0, top: p.brazo.largo, transformOrigin: "0 0", transform: `rotate(${s * ang.codo}deg)` }}>
          <Img img={ab} estilo={{ left: -ab.ancla.x, top: -ab.ancla.y }} />
        </div>
      </div>
    );
  };
  const cabeza = imagenes[clave.cabeza(a)];
  const rasgos = (exPedida: Expresion, opacidad: number) => {
    const ex: Cara = bosteza && exPedida === "aburrido" ? "bostezo" : exPedida;
    const img = imagenes[clave.rasgos(a, ex, ex === "bostezo" ? "abiertos" : ojos)] ?? imagenes[clave.rasgos(a, ex, "abiertos")];
    if (!img || opacidad <= 0 || pres.deEspaldas) return null;
    // Los rasgos se corren hacia donde mira (giro de 3/4 sin redibujar).
    return <Img key={ex} img={img} estilo={{ opacity: opacidad, transform: `translateX(${g * 16}px)` }} />;
  };
  const peloAtras = imagenes[clave.peloAtras(a)];
  const giro = (img: ImagenPieza): CSSProperties => ({ transformOrigin: `${img.ancla.x}px ${img.ancla.y}px`, transform: `rotate(${giroCabeza}deg) translateX(${g * 4}px)` });
  return (
    <div style={{ position: "absolute", left: u.cx + pres.dx, top: u.pies + (pres.dy ?? 0), width: 0, height: 0, opacity: pres.alpha * bordeAlpha }}>
      <div style={{ position: "absolute", left: -p.cx, top: -p.pies, width: p.ancho, height: p.alto, transformOrigin: `${p.cx}px ${p.pies}px`, transform: `scale(${sx}, ${u.escala * ep * (1 + respira)}) translateY(${e.saltoY - micro - paso}px) rotate(${caminata?.inclinacion ?? 0}deg)` }}>
        {peloAtras && <Img img={peloAtras} estilo={giro(peloAtras)} />}
        {caminata ? (
          <>
            <div style={{ position: "absolute", left: p.cx - p.cuerpoAncho * 0.56, top: p.pies - p.alto * 0.016, width: p.cuerpoAncho * 1.12, height: p.alto * 0.032, borderRadius: "50%", background: "rgba(20,16,30,0.28)", transform: `translateY(${paso}px)` }} />
            {brazo("mira", e.mira)}
            {([true, false] as const).map((oscura) => {
              const img = imagenes[clave.pierna(a, oscura)];
              if (!img) return null;
              const x = p.cx + (oscura ? 1 : -1) * (p.piernas.separacion / 2) * angosto;
              return <Img key={String(oscura)} img={img} estilo={{ left: x - img.ancla.x, top: p.piernas.y0 - img.ancla.y, transformOrigin: `${img.ancla.x}px ${img.ancla.y}px`, transform: `rotate(${oscura ? -caminata.pierna : caminata.pierna}deg)` }} />;
            })}
            <Img img={imagenes[clave.cuerpoCamina(a)]} estilo={{ transformOrigin: `${p.cx}px ${p.pies}px`, transform: `scaleX(${angosto})` }} />
            {brazo("otro", e.otro)}
          </>
        ) : (
          <>
            <Img img={imagenes[clave.cuerpo(a)]} />
            {brazo("otro", e.otro)}
            {brazo("mira", e.mira)}
          </>
        )}
        {cabeza && (
          <div style={{ position: "absolute", left: 0, top: 0, width: cabeza.ancho, height: cabeza.alto, ...giro(cabeza) }}>
            <Img img={cabeza} />
            {/* Fundido entre expresiones (si se repite la misma, sin fundido: */}
            {/* p. ej. "nina.feliz" y luego "todos.feliz"). */}
            {mezcla < 1 && previa !== expresion && rasgos(previa, 1)}
            {rasgos(expresion, previa === expresion ? 1 : mezcla)}
          </div>
        )}
      </div>
    </div>
  );
}

// Pose de un personaje en este cuadro, ya ajustada para que sus brazos no
// pasen por delante de la cara de nadie que esté detrás (la usan el
// render, la mano que sostiene objetos y las pruebas: nunca se separan).
const memoEstados = new WeakMap<DisparosEscena, Map<string, { e: EstadoPose; pose: Pose }>>();
function estadoEnCuadro(u: PersonajeUbicado, cu: ComposicionUbicada, d: DisparosEscena, objetivos: ObjetivosKit, frame: number, fps: number): { e: EstadoPose; pose: Pose } {
  let m = memoEstados.get(d);
  if (!m) memoEstados.set(d, (m = new Map()));
  const clave = `${u.per.id}@${frame}`;
  const hecho = m.get(clave);
  if (hecho) return hecho;
  const r = estadoSinMemo(u, cu, d, objetivos, frame, fps);
  m.set(clave, r);
  return r;
}
function estadoSinMemo(u: PersonajeUbicado, cu: ComposicionUbicada, d: DisparosEscena, objetivos: ObjetivosKit, frame: number, fps: number): { e: EstadoPose; pose: Pose } {
  const { poses } = cambiosDe(d, u, cu, objetivos);
  const crudo = poseEnCuadro(poses, u.per.pose, frame, fps, u.p);
  const pose = conVueltasAParado(poses).filter((c) => c.cuadro <= frame).at(-1)?.pose ?? u.per.pose;
  const detras = cu.personajes.filter((o) => o !== u && zDe(o) < zDe(u)).map(caraEnIsla);
  if (!detras.length) return { e: crudo, pose };
  const e = { ...crudo };
  for (const lado of ["mira", "otro"] as const) {
    const libre = (ang: AngulosBrazo) => !segmentosBrazo(u, { ...e, [lado]: ang }, lado).some((sg) => detras.some((c) => tocaCara(sg, c)));
    if (libre(e[lado])) continue;
    // Se corre el hombro lo mínimo necesario (primero hacia abajo: un gesto más chico).
    for (const delta of [-15, 15, -30, 30, -45, 45, -60, 60, -80]) {
      const ang = { ...e[lado], hombro: e[lado].hombro + delta };
      if (libre(ang)) {
        e[lado] = ang;
        break;
      }
    }
  }
  return { e, pose };
}

// La presencia (entrar, irse, pasar de largo) vive en presencia.ts: la
// usan el dibujo y la cámara (quién está dónde en cada cuadro).
export { presenciaDe, CUADROS_CAMINAR, CUADROS_PASAR, PROFUNDIDAD_PUERTA, type Presencia } from "./presencia";

// Dónde está la mano del que sostiene un objeto en este cuadro. Al
// señalar, el objeto pasa a la otra mano (si no, barre lo que señala).
function manoEnIsla(u: PersonajeUbicado, cu: ComposicionUbicada, d: DisparosEscena, objetivos: ObjetivosKit, frame: number, fps: number) {
  const { e, pose } = estadoEnCuadro(u, cu, d, objetivos, frame, fps);
  const lado = pose === "senalar" || pose === "apoyar_cabeza" ? "otro" : "mira";
  const m = posicionMano(u.p, e[lado], lado);
  const enIsla = aIsla(u, m.x, m.y);
  return { x: enIsla.x + presenciaDe(u, cu, d, frame).dx, y: enIsla.y + e.saltoY * u.escala };
}

// Objeto en la mano: donde está la mano, pero bajado lo justo para no
// tocar ninguna cara (la propia, si va delante del cuerpo, ni la de quien
// está detrás). Lo usan el render y la verificación (tapanCaras).
// Cada cosa de mano: tamaño, punto por donde se agarra y escala en la mano.
const FORMA_EN_MANO = {
  dibujo: { ...DIBUJO, ax: 0.5, ay: 0.5, k: 1.4 },
  dulces: { ...DULCES, ax: 0.5, ay: 0.6, k: 1.2 },
  torta: { ...TORTA, ax: 0.5, ay: 0.6, k: 0.6 },
  helado: { ...HELADO, ax: 0.5, ay: 0.72, k: 0.9 },
  caja: { ...CAJA, ax: 0.5, ay: 0.5, k: 0.85 },
  bolsa: { ...BOLSA, ax: 0.5, ay: 40 / BOLSA.alto, k: 0.85 },
  celular: { ...CELULAR, ax: 0.5, ay: 0.5, k: 0.9 },
} as const;
type DeMano = keyof typeof FORMA_EN_MANO;
const esDeMano = (t: string): t is DeMano => t in FORMA_EN_MANO;
function rectEnMano(tipo: DeMano, c: { x: number; y: number }, escala: number): Rect {
  const f = FORMA_EN_MANO[tipo];
  return { x: c.x - f.ancho * f.ax * escala, y: c.y - f.alto * f.ay * escala, ancho: f.ancho * escala, alto: f.alto * escala };
}
function destacaDe(d: DisparosEscena, id: string, frame: number): number {
  return (d[`${id}.destaca`] ?? []).reduce((acc, c) => Math.max(acc, frame >= c && frame < c + 24 ? Math.sin(((frame - c) / 24) * Math.PI) : 0), 0);
}
function objetoEnMano(u: PersonajeUbicado, tipo: DeMano, cu: ComposicionUbicada, d: DisparosEscena, objetivos: ObjetivosKit, frame: number, fps: number, extra: number) {
  const c0 = manoEnIsla(u, cu, d, objetivos, frame, fps);
  const escala = u.escala * FORMA_EN_MANO[tipo].k * extra;
  const atras = esManosArriba(d, u, cu, objetivos, frame);
  const caras = [...(atras ? [] : [caraEnIsla(u)]), ...cu.personajes.filter((o) => o !== u && zDe(o) < zDe(u)).map(caraEnIsla)];
  const alto = FORMA_EN_MANO[tipo].alto * escala;
  for (let dy = 0; dy <= alto * 2; dy += alto * 0.1) {
    const c = { x: c0.x, y: c0.y + dy };
    if (!caras.some((cara) => rectTocaCara(rectEnMano(tipo, c, escala), cara))) return { c, escala, atras };
  }
  return { c: c0, escala, atras };
}

const aparicion = (frame: number, visible: boolean, aparece: number | undefined) => (visible && aparece === undefined ? 1 : rampa(frame, aparece, 10));
const pop = (t: number) => (t >= 1 ? 1 : 0.6 + 0.4 * t + Math.sin(t * Math.PI) * 0.12);

// ---------- Cartelera (la usan la escena y la puerta del celular) ----------
// Con el dibujo que ya voló al hueco, si voló (para la vuelta al celular).
export function CarteleraKit({ cu, frame, d, imagenes, conDibujoVolado = false }: { cu: ComposicionUbicada; frame: number; d: DisparosEscena; imagenes: ImagenesKit; conDibujoVolado?: boolean }) {
  const cart = cu.objetos.find((o) => o.obj.tipo === "cartelera");
  if (!cart) return null;
  const motivos = motivosCartelera(cu);
  const late = (d[`${cart.obj.id}.destaca_hueco`] ?? []).reduce((acc, c) => Math.max(acc, frame >= c && frame < c + 40 ? Math.abs(Math.sin(((frame - c) / 40) * Math.PI * 2)) : 0), 0);
  const ch = casillaCartelera(CARTELERA.hueco);
  const volado = conDibujoVolado ? cu.objetos.find((o) => o.obj.tipo === "dibujo" && (d[`${o.obj.id}.va_al_hueco`] ?? []).some((c) => c + CUADROS_VUELO <= frame)) : undefined;
  let k = 0;
  return (
    <>
      <Img img={imagenes[clave.cartelera()]} />
      {Array.from({ length: CARTELERA.columnas * CARTELERA.filas }, (_, i) => {
        if (i === CARTELERA.hueco) return null;
        const c = casillaCartelera(i);
        const motivo = motivos[k++ % Math.max(1, motivos.length)];
        return <Img key={i} img={imagenes[clave.dibujo(motivo)]} estilo={{ left: c.x, top: c.y, width: c.ancho, height: c.alto, transform: `rotate(${((i * 7) % 9) - 4}deg)` }} />;
      })}
      {volado && <Img img={imagenes[clave.dibujo(motivoDe(cu, volado.obj.id))]} estilo={{ left: ch.x, top: ch.y, width: ch.ancho, height: ch.alto }} />}
      {late > 0 && <div style={{ position: "absolute", left: ch.x - 10, top: ch.y - 10, width: ch.ancho + 20, height: ch.alto + 20, borderRadius: 14, background: `rgba(255,255,255,${0.45 * late})`, transform: `scale(${1 + 0.08 * late})` }} />}
    </>
  );
}

// Lo que muestra la pantalla del celular en la puerta: el lugar con el
// mismo encuadre que tendrá la cámara al cortar (centro en coordenadas de
// la isla; escala = zoom del lugar / zoom con que la cámara llena la
// pantalla). Así el corte de la pantalla al lugar no se nota.
export function PuertaEnPantalla({ cu, frame, fps, d, imagenes, objetivos, ancho, alto, opacidad, centro, escala }: PropsEscenaKit & { ancho: number; alto: number; opacidad: number; centro: { x: number; y: number }; escala: number }) {
  if (opacidad <= 0) return null;
  const vista = { x: centro.x - ancho / 2 / escala, y: centro.y - alto / 2 / escala, ancho: ancho / escala, alto: alto / escala };
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: ancho, height: alto, opacity: opacidad, background: PAREDES[cu.pared], overflow: "hidden" }}>
      <div style={{ position: "absolute", left: ancho / 2, top: alto / 2, width: 0, height: 0, transformOrigin: "0 0", transform: `scale(${escala}) translate(${-centro.x}px, ${-centro.y}px)` }}>
        <EscenaKit cu={cu} frame={frame} fps={fps} d={d} imagenes={imagenes} objetivos={objetivos} vista={vista} />
      </div>
    </div>
  );
}

// Acción de grupo: "todos.aplaude" es "<id>.aplaude" para cada personaje.
export function conAccionesDeGrupo(cu: ComposicionUbicada, d: DisparosEscena): DisparosEscena {
  const grupo = Object.entries(d).filter(([k]) => k.startsWith(`${ID_TODOS}.`));
  if (!grupo.length) return d;
  const res: DisparosEscena = { ...d };
  for (const [k, cuadros] of grupo) {
    const verbo = k.slice(ID_TODOS.length + 1);
    for (const u of cu.personajes) {
      const clave = `${u.per.id}.${verbo}`;
      res[clave] = [...(res[clave] ?? []), ...cuadros].sort((a, b) => a - b);
    }
  }
  return res;
}

// ---------- Entorno: el lugar continúa más allá de la isla ----------
function Entorno({ cu }: { cu: ComposicionUbicada }) {
  const col = coloresEntorno(cu.c.fondo, cu.pared);
  const { ancho, alto } = SALON;
  const y1 = SALON.pared.y1;
  const x0 = -ENTORNO.izquierda;
  const w = ancho + ENTORNO.izquierda + ENTORNO.derecha;
  const techo = -520;
  const bloque = (y: number, h: number, color: string): ReactNode => <div key={`${y}-${color}`} style={{ position: "absolute", left: x0, top: y, width: w, height: h, background: color }} />;
  return (
    <>
      {col.techo ? bloque(-ENTORNO.arriba, ENTORNO.arriba + techo, col.arriba) : bloque(-ENTORNO.arriba, ENTORNO.arriba + y1, col.arriba)}
      {col.techo && bloque(techo, 26, oscurecer(col.pared, 0.18))}
      {col.techo && bloque(techo + 26, y1 - techo - 26, col.pared)}
      {!col.techo && bloque(120, y1 - 120, col.pared)}
      {col.zocalo && bloque(y1 - 120, 120, col.zocalo)}
      {col.zocalo && bloque(y1 - 124, 10, oscurecer(col.pared, 0.22))}
      {bloque(y1, alto - y1, col.piso)}
      {bloque(alto, ENTORNO.abajo, col.abajo)}
      {bloque(y1, 22, "rgba(60,40,20,0.15)")}
      {[...Y_LINEAS_PISO].map((y) => bloque(y, 5, col.lineaPiso))}
      {/* Lámparas en el techo (adentro). */}
      {col.techo &&
        [-300, 700, 1500, 2500].map((x) => <div key={x} style={{ position: "absolute", left: x, top: techo - 60, width: 300, height: 60, borderRadius: "0 0 150px 150px", background: aclarar(col.pared, 0.7) }} />)}
    </>
  );
}

// ---------- Escena ----------
// La puerta del lugar mientras alguien entra o se va: el vano (la luz de
// afuera) y la hoja que gira en su bisagra (izquierda). Cerrada no se
// dibuja: es la del fondo.
function PuertaAbierta({ cu, d, frame, imagenes }: { cu: ComposicionUbicada; d: DisparosEscena; frame: number; imagenes: ImagenesKit }) {
  const puerta = PUERTAS[cu.c.fondo];
  const hoja = imagenes[clave.hojaPuerta(cu)];
  const a = aperturaPuerta(cu, d, frame);
  if (!puerta || !hoja || a <= 0) return null;
  return (
    <div style={{ position: "absolute", left: puerta.x, top: puerta.y, width: puerta.ancho, height: puerta.alto }}>
      <div style={{ position: "absolute", inset: 0, background: puerta.afuera }} />
      <Img img={hoja} estilo={{ transformOrigin: "0 50%", transform: `scaleX(${1 - 0.82 * a})` }} />
      {/* El canto de la hoja abierta, más oscuro (sin box-shadow: el render del navegador no lo dibuja). */}
      <div style={{ position: "absolute", top: 0, height: puerta.alto, left: puerta.ancho * (1 - 0.82 * a) - 12 * a, width: 12 * a, background: "rgba(40,30,20,0.35)" }} />
    </div>
  );
}

export function EscenaKit({ cu, frame, fps, d: disparos, imagenes, objetivos, vista }: PropsEscenaKit) {
  const seVe = (r: Rect | null | undefined) => !vista || !r || seTocan(r, vista, MARGEN_VISTA);
  const fondo = imagenes[clave.fondo(cu)];
  const hueco = casillaHuecoEnIsla(cu);
  // La atención sigue lo que hace alguien en particular; en una acción de
  // grupo cada uno hace lo suyo (nadie se queda mirando a otro).
  const atenciones = atencionesDe(cu, disparos, objetivos);
  const d = conAccionesDeGrupo(cu, disparos);
  // Dibujo que vuela al hueco (si lo hay) y su progreso.
  const vuelo = cu.objetos.find((o) => o.obj.tipo === "dibujo" && d[`${o.obj.id}.va_al_hueco`]?.length);
  const inicioVuelo = vuelo ? primero(d[`${vuelo.obj.id}.va_al_hueco`]) : undefined;
  const tVuelo = rampa(frame, inicioVuelo, CUADROS_VUELO);
  const capasPared: ReactNode[] = [];
  // Todo lo que está en el piso, con su profundidad (más atrás = antes).
  const piso: { z: number; nodo: ReactNode }[] = [];
  const enMano = new Map<string, ReactNode[]>();

  const ocupados = new Set(cu.personajes.flatMap((u) => (u.per.sentado_en ? [u.per.sentado_en] : [])));
  const zDeObjeto = new Map(cu.objetos.flatMap((o) => (o.rect ? [[o.obj.id, o.rect.y + o.rect.alto] as const] : [])));
  for (const o of cu.objetos) {
    const id = o.obj.id;
    if (ocupados.has(id)) continue; // van con quien se sienta (silla atrás, mueble adelante)
    // Los vehículos "llegan" (como aparecer) y "se van" deslizándose.
    const llega = primero(d[`${id}.llega`]);
    const visible = aparicion(frame, o.obj.visible && llega === undefined, primero(d[`${id}.aparece`]) ?? llega);
    const seVa = primero(d[`${id}.se_va`]);
    const salida = rampa(frame, seVa, 36);
    if (visible <= 0 || salida >= 1) continue;
    const destaca = destacaDe(d, id, frame);
    if (o.obj.tipo === "cartelera" && o.rect) {
      const r = o.rect;
      if (!seVe(r)) continue;
      capasPared.push(
        <div key={id} style={{ position: "absolute", left: r.x, top: r.y, width: r.ancho, height: r.alto, opacity: visible, transformOrigin: "50% 50%", transform: `scale(${pop(visible) * (1 + 0.035 * destaca)})` }}>
          <CarteleraKit cu={cu} frame={frame} d={d} imagenes={imagenes} />
        </div>
      );
      continue;
    }
    // Objetos en la mano, en la pared, sobre un mueble o en el piso.
    const img = imagenes[o.obj.tipo === "dibujo" ? clave.dibujo(motivoDe(cu, id)) : clave.objeto(o.obj.tipo)];
    if (!img) continue;
    const duenio = o.obj.en_mano_de ? cu.personajes.find((u) => u.per.id === o.obj.en_mano_de) : undefined;
    // El celular de quien "mira el celular" solo se ve mientras lo mira: al
    // atender o saludar, lo guarda (si no, parece que sigue en el celular).
    if (o.obj.tipo === "celular" && duenio && d[`${duenio.per.id}.mira_el_celular`]?.length && estadoEnCuadro(duenio, cu, d, objetivos ?? [], frame, fps).pose !== "mirar_celular") continue;
    const grande = !esDeMano(o.obj.tipo); // muebles y vehículos: sin "pop" al destacar
    const escalaObjeto = o.rect ? o.rect.ancho / img.ancho : (duenio?.escala ?? 1) * (esDeMano(o.obj.tipo) ? FORMA_EN_MANO[o.obj.tipo].k : 1);
    let c: { x: number; y: number };
    let escala = escalaObjeto * (grande ? 1 : (1 + 0.22 * destaca) * pop(visible));
    if (duenio && esDeMano(o.obj.tipo)) {
      const om = objetoEnMano(duenio, o.obj.tipo, cu, d, objetivos ?? [], frame, fps, (1 + 0.22 * destaca) * pop(visible));
      c = om.c;
      escala = om.escala;
    } else if (o.rect) c = { x: o.rect.x + img.ancla.x * escalaObjeto, y: o.rect.y + img.ancla.y * escalaObjeto };
    else continue;
    // Vehículo que llega (desde la izquierda) o se va (hacia la derecha).
    if (llega !== undefined && visible < 1) c = { x: c.x - (1 - visible) * 700, y: c.y };
    if (salida > 0) c = { x: c.x + salida * salida * 900, y: c.y };
    let rot = 0;
    // El celular vibra.
    for (const v of d[`${id}.vibra`] ?? []) if (frame >= v && frame < v + 20) rot = Math.sin((frame - v) * 2.2) * 9;
    const volando = vuelo?.obj.id === id && hueco !== null && tVuelo > 0;
    if (volando && hueco) {
      const destino = { x: hueco.x + hueco.ancho / 2, y: hueco.y + hueco.alto / 2 };
      c = { x: c.x + (destino.x - c.x) * tVuelo, y: c.y + (destino.y - c.y) * tVuelo - Math.sin(tVuelo * Math.PI) * 220 };
      escala = escalaObjeto + (hueco.ancho / img.ancho - escalaObjeto) * tVuelo;
      rot = Math.sin(tVuelo * Math.PI) * 12;
    }
    const capa = (
      <div key={id} style={{ position: "absolute", left: c.x, top: c.y, width: 0, height: 0 }}>
        {destaca > 0 && <div style={{ position: "absolute", left: (-img.ancho * escala) / 2 - 24, top: (-img.alto * escala) / 2 - 24, width: img.ancho * escala + 48, height: img.alto * escala + 48, borderRadius: 24, background: `rgba(255,255,255,${0.35 * destaca})` }} />}
        <Img img={img} estilo={{ left: -img.ancla.x, top: -img.ancla.y, opacity: visible * (1 - salida), transformOrigin: `${img.ancla.x}px ${img.ancla.y}px`, transform: `scale(${escala}) rotate(${rot}deg)` }} />
      </div>
    );
    if (volando) piso.push({ z: 1e6, nodo: capa }); // vuela por encima de todo
    else if (duenio) enMano.set(duenio.per.id, [...(enMano.get(duenio.per.id) ?? []), capa]);
    else if (o.obj.lugar?.startsWith("pared_")) capasPared.push(capa);
    // Encima de un mueble: justo delante de él.
    else if (o.obj.sobre) piso.push({ z: (zDeObjeto.get(o.obj.sobre) ?? (o.rect ? o.rect.y + o.rect.alto : 0)) + 0.5, nodo: capa });
    else if (o.rect) piso.push({ z: o.rect.y + o.rect.alto, nodo: capa });
  }

  const manosArriba = (u: PersonajeUbicado) => esManosArriba(d, u, cu, objetivos ?? [], frame);
  // Personajes (con su silla y pupitre si están sentados). Más atrás =
  // antes; en la misma fila, los adultos detrás de los niños.
  for (const u of cu.personajes) {
    if (!seVe(enCamino(u, rectPersonaje(u)))) continue;
    const s = u.sentado;
    // Quien pasa de largo va por detrás de lo que pasa (la vitrina): lo que
    // no mira sigue a la vista.
    // Quien cruza la puerta hacia el fondo queda detrás de los que están más adelante.
    const z = d[`${u.per.id}.pasa_de_largo`]?.length ? zDetrasDelPaso(u, cu) : zDe(u) + (presenciaDe(u, cu, d, frame).dy ?? 0);
    const silla = imagenes[clave.silla()];
    const pupitre = s ? imagenes[clave.objeto(s.mueble)] : undefined;
    piso.push({
      z,
      nodo: (
        <div key={u.per.id}>
          {s && silla && <Img img={silla} estilo={{ left: s.silla.x, top: s.silla.y, width: s.silla.ancho, height: s.silla.alto }} />}
          {/* Aplaudiendo o celebrando, lo que tiene en la mano va detrás del cuerpo (si no, le tapa la cara). */}
          {manosArriba(u) && enMano.get(u.per.id)}
          <Personaje u={u} cu={cu} frame={frame} fps={fps} d={d} imagenes={imagenes} objetivos={objetivos} atenciones={atenciones} vista={vista} />
          {s && pupitre && <Img img={pupitre} estilo={{ left: s.pupitre.x, top: s.pupitre.y, width: s.pupitre.ancho, height: s.pupitre.alto }} />}
          {!manosArriba(u) && enMano.get(u.per.id)}
        </div>
      ),
    });
  }
  piso.sort((a, b) => a.z - b.z);
  return (
    <>
      <Entorno cu={cu} />
      {fondo && <Img img={fondo} />}
      <PuertaAbierta cu={cu} d={d} frame={frame} imagenes={imagenes} />
      {capasPared}
      {piso.map((x) => x.nodo)}
    </>
  );
}
