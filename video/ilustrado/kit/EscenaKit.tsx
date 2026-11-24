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
import { aIsla, casillaHuecoEnIsla, hashTexto, rectElemento, rectPersonaje, type ComposicionUbicada, type PersonajeUbicado } from "./composicion";
import { CARTELERA, COLOR_LINEA_PISO, COLOR_PISO, SALON, Y_LINEAS_PISO, casillaCartelera } from "./dibujoObjetos";
import { oscurecer, aclarar } from "./dibujoPersonaje";
import { clave, motivoDe, motivosCartelera, type ImagenesKit, type ImagenPieza } from "./piezas";
import { apunteHacia, poseEnCuadro, posicionMano, type AngulosBrazo, type CambioPose } from "./poses";

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
function apunteDe(u: PersonajeUbicado, cu: ComposicionUbicada | undefined, objetivo: string | undefined): number | undefined {
  if (!cu || !objetivo) return undefined;
  const r = rectElemento(cu, objetivo);
  if (!r) return undefined;
  const destino = { x: r.x + r.ancho / 2, y: r.y + r.alto * 0.55 };
  const lx = u.p.cx + (destino.x - u.cx) / (u.escala * (u.espejo ? -1 : 1));
  const ly = u.p.pies + (destino.y - u.pies) / u.escala;
  return apunteHacia(u.p, lx, ly);
}

function cambiosDe(d: DisparosEscena, u: PersonajeUbicado, cu?: ComposicionUbicada, objetivos: ObjetivosKit = []) {
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
  return { poses, expresiones: expresiones.sort((a, b) => a.cuadro - b.cuadro) };
}

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
  const { poses, expresiones } = cambiosDe(d, u, cu, objetivos);
  const e = poseEnCuadro(poses, u.per.pose, frame, fps, p);
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
  const g = mirada(u, cu, atenciones, frame) * (u.espejo ? -1 : 1); // en coordenadas locales
  const giroCabeza = e.inclinacion + g * 5 + Math.sin((frame + h) / 47) * 1.2;
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
  const rasgos = (ex: Expresion, opacidad: number) => {
    const img = imagenes[clave.rasgos(a, ex, ojos)] ?? imagenes[clave.rasgos(a, ex, "abiertos")];
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
            {mezcla < 1 && rasgos(previa, 1)}
            {rasgos(expresion, mezcla)}
          </div>
        )}
      </div>
    </div>
  );
}

// Dónde está la mano del que sostiene un objeto en este cuadro.
function manoEnIsla(u: PersonajeUbicado, frame: number, fps: number, d: DisparosEscena) {
  const { poses } = cambiosDe(d, u);
  const e = poseEnCuadro(poses, u.per.pose, frame, fps, u.p);
  const m = posicionMano(u.p, e.mira, "mira");
  const enIsla = aIsla(u, m.x, m.y);
  return { x: enIsla.x, y: enIsla.y + e.saltoY * u.escala };
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

// Lo que muestra la pantalla del celular en la puerta: la pared del lugar
// con la cartelera al mismo tamaño y lugar que tendrá al cortar.
export function PuertaEnPantalla({ cu, frame, d, imagenes, ancho, alto, opacidad }: { cu: ComposicionUbicada; frame: number; d: DisparosEscena; imagenes: ImagenesKit; ancho: number; alto: number; opacidad: number }) {
  if (opacidad <= 0) return null;
  const k = ancho / CARTELERA.ancho;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: ancho, height: alto, opacity: opacidad, background: PAREDES[cu.pared], overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: (alto - CARTELERA.alto * k) / 2, width: CARTELERA.ancho, height: CARTELERA.alto, transformOrigin: "0 0", transform: `scale(${k})` }}>
        <CarteleraKit cu={cu} frame={frame} d={d} imagenes={imagenes} conDibujoVolado />
      </div>
    </div>
  );
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
export function EscenaKit({ cu, frame, fps, d, imagenes, objetivos, vista }: PropsEscenaKit) {
  const seVe = (r: Rect | null | undefined) => !vista || !r || seTocan(r, vista, MARGEN_VISTA);
  const fondo = imagenes[clave.fondo(cu)];
  const hueco = casillaHuecoEnIsla(cu);
  const atenciones = atencionesDe(cu, d, objetivos);
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
    const destaca = (d[`${id}.destaca`] ?? []).reduce((acc, c) => Math.max(acc, frame >= c && frame < c + 24 ? Math.sin(((frame - c) / 24) * Math.PI) : 0), 0);
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
    if (duenio) c = manoEnIsla(duenio, frame, fps, d);
    else if (o.rect) c = { x: o.rect.x + o.rect.ancho / 2, y: o.rect.y + o.rect.alto / 2 };
    else continue;
    let escala = escalaObjeto * (1 + 0.22 * destaca) * pop(visible);
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

  // Personajes (con su silla y pupitre si están sentados). Más atrás =
  // antes; en la misma fila, los adultos detrás de los niños.
  for (const u of cu.personajes) {
    if (!seVe(rectPersonaje(u))) continue;
    const s = u.sentado;
    const z = (s ? s.pupitre.y + s.pupitre.alto : u.pies) - (u.per.tipo === "profesora" ? 3 : 0);
    const silla = imagenes[clave.silla()];
    const pupitre = imagenes[clave.pupitre()];
    piso.push({
      z,
      nodo: (
        <div key={u.per.id}>
          {s && silla && <Img img={silla} estilo={{ left: s.silla.x, top: s.silla.y, width: s.silla.ancho, height: s.silla.alto }} />}
          <Personaje u={u} cu={cu} frame={frame} fps={fps} d={d} imagenes={imagenes} objetivos={objetivos} atenciones={atenciones} />
          {s && pupitre && <Img img={pupitre} estilo={{ left: s.pupitre.x, top: s.pupitre.y, width: s.pupitre.ancho, height: s.pupitre.alto }} />}
          {enMano.get(u.per.id)}
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
