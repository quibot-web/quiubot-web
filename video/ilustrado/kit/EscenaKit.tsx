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
import { ID_TODOS, aIsla, casillaHuecoEnIsla, hashTexto, rectElemento, rectPersonaje, type ComposicionUbicada, type PersonajeUbicado } from "./composicion";
import { CARTELERA, COLOR_LINEA_PISO, COLOR_PISO, DIBUJO, DULCES, SALON, VENTANA_SALON, Y_LINEAS_PISO, casillaCartelera } from "./dibujoObjetos";
import { oscurecer, aclarar, type Cara } from "./dibujoPersonaje";
import { clave, motivoDe, motivosCartelera, type ImagenesKit, type ImagenPieza } from "./piezas";
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
      .filter((o) => o.obj.tipo === "dibujo" || o.obj.tipo === "dulces")
      .map((o) => {
        const tipo = o.obj.tipo as "dibujo" | "dulces";
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
function Personaje({ u, cu, frame, fps, d, imagenes, objetivos, atenciones }: { u: PersonajeUbicado; cu: ComposicionUbicada; frame: number; fps: number; d: DisparosEscena; imagenes: ImagenesKit; objetivos?: ObjetivosKit; atenciones: Atencion[] }) {
  const { p, aspecto: a } = u;
  const { expresiones } = cambiosDe(d, u, cu, objetivos);
  const { e } = estadoEnCuadro(u, cu, d, objetivos ?? [], frame, fps);
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
  const ventanaX = cu.c.fondo === "salon" ? VENTANA_SALON.x + VENTANA_SALON.w / 2 : null;
  const gLejos = ventanaX !== null && Math.abs(ventanaX - cabezaX) > 60 ? Math.max(-1, Math.min(1, (ventanaX - cabezaX) / 200)) : -(Math.sign(gAtento) || (u.espejo ? 1 : -1)) * 0.9;
  const gMundo = gAtento + (gLejos - gAtento) * distraido;
  // Y bosteza cada ~3 s (cara de bostezo unos 0,7 s).
  const bosteza = distraido >= 1 && (frame + (h % 97)) % 96 < 22;
  const g = gMundo * (u.espejo ? -1 : 1); // en coordenadas locales
  const giroCabeza = e.inclinacion + g * 5 + 7 * distraido + Math.sin((frame + h) / 47) * 1.2;
  const micro = latido(frame, d.micro, 18) * Math.abs(Math.sin(frame / 3)) * 10;
  const sx = u.escala * (u.espejo ? -1 : 1);
  const brazo = (lado: "mira" | "otro", ang: AngulosBrazo): ReactNode => {
    const s = lado === "mira" ? -1 : 1;
    const br = imagenes[clave.brazo(a)];
    const ab = imagenes[clave.antebrazo(a, ang.mano)];
    if (!br || !ab) return null;
    return (
      <div key={lado} style={{ position: "absolute", left: p.cx - s * p.hombroDx, top: p.hombroY, transformOrigin: "0 0", transform: `rotate(${s * ang.hombro}deg)` }}>
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
    if (!img || opacidad <= 0) return null;
    // Los rasgos se corren hacia donde mira (giro de 3/4 sin redibujar).
    return <Img key={ex} img={img} estilo={{ opacity: opacidad, transform: `translateX(${g * 16}px)` }} />;
  };
  const peloAtras = imagenes[clave.peloAtras(a)];
  const giro = (img: ImagenPieza): CSSProperties => ({ transformOrigin: `${img.ancla.x}px ${img.ancla.y}px`, transform: `rotate(${giroCabeza}deg) translateX(${g * 4}px)` });
  return (
    <div style={{ position: "absolute", left: u.cx, top: u.pies, width: 0, height: 0 }}>
      <div style={{ position: "absolute", left: -p.cx, top: -p.pies, width: p.ancho, height: p.alto, transformOrigin: `${p.cx}px ${p.pies}px`, transform: `scale(${sx}, ${u.escala * (1 + respira)}) translateY(${e.saltoY - micro}px)` }}>
        {peloAtras && <Img img={peloAtras} estilo={giro(peloAtras)} />}
        <Img img={imagenes[clave.cuerpo(a)]} />
        {brazo("otro", e.otro)}
        {brazo("mira", e.mira)}
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

// Dónde está la mano del que sostiene un objeto en este cuadro. Al
// señalar, el objeto pasa a la otra mano (si no, barre lo que señala).
function manoEnIsla(u: PersonajeUbicado, cu: ComposicionUbicada, d: DisparosEscena, objetivos: ObjetivosKit, frame: number, fps: number) {
  const { e, pose } = estadoEnCuadro(u, cu, d, objetivos, frame, fps);
  const lado = pose === "senalar" || pose === "apoyar_cabeza" ? "otro" : "mira";
  const m = posicionMano(u.p, e[lado], lado);
  const enIsla = aIsla(u, m.x, m.y);
  return { x: enIsla.x, y: enIsla.y + e.saltoY * u.escala };
}

// Objeto en la mano: donde está la mano, pero bajado lo justo para no
// tocar ninguna cara (la propia, si va delante del cuerpo, ni la de quien
// está detrás). Lo usan el render y la verificación (tapanCaras).
const FORMA_EN_MANO = { dibujo: { ...DIBUJO, ax: 0.5, ay: 0.5, k: 1.4 }, dulces: { ...DULCES, ax: 0.5, ay: 0.6, k: 1.2 } } as const;
function rectEnMano(tipo: "dibujo" | "dulces", c: { x: number; y: number }, escala: number): Rect {
  const f = FORMA_EN_MANO[tipo];
  return { x: c.x - f.ancho * f.ax * escala, y: c.y - f.alto * f.ay * escala, ancho: f.ancho * escala, alto: f.alto * escala };
}
function destacaDe(d: DisparosEscena, id: string, frame: number): number {
  return (d[`${id}.destaca`] ?? []).reduce((acc, c) => Math.max(acc, frame >= c && frame < c + 24 ? Math.sin(((frame - c) / 24) * Math.PI) : 0), 0);
}
function objetoEnMano(u: PersonajeUbicado, tipo: "dibujo" | "dulces", cu: ComposicionUbicada, d: DisparosEscena, objetivos: ObjetivosKit, frame: number, fps: number, extra: number) {
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
function EntornoSalon({ cu }: { cu: ComposicionUbicada }) {
  const pared = PAREDES[cu.pared];
  const { ancho, alto } = SALON;
  const y1 = SALON.pared.y1;
  const x0 = -ENTORNO.izquierda;
  const w = ancho + ENTORNO.izquierda + ENTORNO.derecha;
  const techo = -520;
  const bloque = (y: number, h: number, color: string): ReactNode => <div key={`${y}-${color}`} style={{ position: "absolute", left: x0, top: y, width: w, height: h, background: color }} />;
  return (
    <>
      {bloque(-ENTORNO.arriba, ENTORNO.arriba + techo, aclarar(pared, 0.35))}
      {bloque(techo, 26, oscurecer(pared, 0.18))}
      {bloque(techo + 26, y1 - techo - 26, pared)}
      {bloque(y1 - 120, 120, oscurecer(pared, 0.12))}
      {bloque(y1 - 124, 10, oscurecer(pared, 0.22))}
      {bloque(y1, alto - y1 + ENTORNO.abajo, COLOR_PISO)}
      {bloque(y1, 22, "rgba(60,40,20,0.18)")}
      {[...Y_LINEAS_PISO, 1700, 1950].map((y) => bloque(y, 5, COLOR_LINEA_PISO))}
      {/* Lámparas en el techo. */}
      {[-300, 700, 1500, 2500].map((x) => (
        <div key={x} style={{ position: "absolute", left: x, top: techo - 60, width: 300, height: 60, borderRadius: "0 0 150px 150px", background: aclarar(pared, 0.7) }} />
      ))}
    </>
  );
}

// ---------- Escena ----------
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

  for (const o of cu.objetos) {
    const id = o.obj.id;
    if (o.obj.tipo === "pupitre") continue; // van con quien se sienta (silla atrás, pupitre adelante)
    const visible = aparicion(frame, o.obj.visible, primero(d[`${id}.aparece`]));
    if (visible <= 0) continue;
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
    // Objetos en la mano, en la pared o en el piso.
    const motivo = o.obj.tipo === "dibujo" ? motivoDe(cu, id) : null;
    const img = o.obj.tipo === "dibujo" ? imagenes[clave.dibujo(motivo!)] : imagenes[clave.dulces()];
    if (!img) continue;
    const duenio = o.obj.en_mano_de ? cu.personajes.find((u) => u.per.id === o.obj.en_mano_de) : undefined;
    const escalaObjeto = (duenio?.escala ?? 1) * (o.obj.tipo === "dibujo" ? 1.4 : 1.2);
    let c: { x: number; y: number };
    let escala = escalaObjeto * (1 + 0.22 * destaca) * pop(visible);
    if (duenio && (o.obj.tipo === "dibujo" || o.obj.tipo === "dulces")) {
      const om = objetoEnMano(duenio, o.obj.tipo, cu, d, objetivos ?? [], frame, fps, (1 + 0.22 * destaca) * pop(visible));
      c = om.c;
      escala = om.escala;
    } else if (o.rect) c = { x: o.rect.x + o.rect.ancho / 2, y: o.rect.y + o.rect.alto / 2 };
    else continue;
    let rot = 0;
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
        <Img img={img} estilo={{ left: -img.ancla.x, top: -img.ancla.y, opacity: visible, transformOrigin: `${img.ancla.x}px ${img.ancla.y}px`, transform: `scale(${escala}) rotate(${rot}deg)` }} />
      </div>
    );
    if (volando) piso.push({ z: 1e6, nodo: capa }); // vuela por encima de todo
    else if (duenio) enMano.set(duenio.per.id, [...(enMano.get(duenio.per.id) ?? []), capa]);
    else if (o.obj.lugar?.startsWith("pared_")) capasPared.push(capa);
    else if (o.rect) piso.push({ z: o.rect.y + o.rect.alto, nodo: capa });
  }

  const manosArriba = (u: PersonajeUbicado) => esManosArriba(d, u, cu, objetivos ?? [], frame);
  // Personajes (con su silla y pupitre si están sentados). Más atrás =
  // antes; en la misma fila, los adultos detrás de los niños.
  for (const u of cu.personajes) {
    if (!seVe(rectPersonaje(u))) continue;
    const s = u.sentado;
    const z = zDe(u);
    const silla = imagenes[clave.silla()];
    const pupitre = imagenes[clave.pupitre()];
    piso.push({
      z,
      nodo: (
        <div key={u.per.id}>
          {s && silla && <Img img={silla} estilo={{ left: s.silla.x, top: s.silla.y, width: s.silla.ancho, height: s.silla.alto }} />}
          {/* Aplaudiendo o celebrando, lo que tiene en la mano va detrás del cuerpo (si no, le tapa la cara). */}
          {manosArriba(u) && enMano.get(u.per.id)}
          <Personaje u={u} cu={cu} frame={frame} fps={fps} d={d} imagenes={imagenes} objetivos={objetivos} atenciones={atenciones} />
          {s && pupitre && <Img img={pupitre} estilo={{ left: s.pupitre.x, top: s.pupitre.y, width: s.pupitre.ancho, height: s.pupitre.alto }} />}
          {!manosArriba(u) && enMano.get(u.per.id)}
        </div>
      ),
    });
  }
  // Pupitres vacíos (sin nadie sentado).
  for (const o of cu.objetos) {
    if (o.obj.tipo !== "pupitre" || !o.rect || cu.personajes.some((u) => u.per.sentado_en === o.obj.id)) continue;
    piso.push({ z: o.rect.y + o.rect.alto, nodo: <Img key={o.obj.id} img={imagenes[clave.pupitre()]} estilo={{ left: o.rect.x, top: o.rect.y, width: o.rect.ancho, height: o.rect.alto }} /> });
  }
  piso.sort((a, b) => a.z - b.z);
  return (
    <>
      {cu.c.fondo === "salon" && <EntornoSalon cu={cu} />}
      {fondo && <Img img={fondo} />}
      {capasPared}
      {piso.map((x) => x.nodo)}
    </>
  );
}
