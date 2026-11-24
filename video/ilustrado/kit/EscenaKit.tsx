// Una composición del kit en un cuadro (sin hooks de Remotion: recibe el
// cuadro por props). Solo dibuja <img> ya precargadas (PNG) con
// transformaciones: los brazos giran en hombro y codo, la cabeza cambia de
// expresión y los objetos aparecen, destacan o vuelan al hueco de la
// cartelera según las acciones amarradas a las palabras (d).
/* eslint-disable @next/next/no-img-element -- dibujos del video, no páginas */
import type { CSSProperties, ReactNode } from "react";
import { rampa, latido, primero } from "../motor/animacion";
import type { DisparosEscena } from "../motor/plan";
import { VERBOS_PERSONAJE, type Expresion, type Pose } from "./catalogoKit";
import { aIsla, casillaHuecoEnIsla, rectElemento, type ComposicionUbicada, type PersonajeUbicado } from "./composicion";
import { CARTELERA, casillaCartelera } from "./dibujoObjetos";
import { clave, motivoDe, motivosCartelera, type ImagenesKit, type ImagenPieza } from "./piezas";
import { apunteHacia, poseEnCuadro, posicionMano, type AngulosBrazo, type CambioPose } from "./poses";

// objetivos: a qué apunta cada acción que lo tiene ("profesora.senala" en
// el cuadro c -> "dibujo_nina").
export type ObjetivosKit = { accion: string; cuadro: number; objetivo: string }[];
export type PropsEscenaKit = { cu: ComposicionUbicada; frame: number; fps: number; d: DisparosEscena; imagenes: ImagenesKit; objetivos?: ObjetivosKit };

// La pose y la expresión empiezan un poco antes de la palabra (se ve
// cuando la voz lo nombra, no después).
const ANTICIPO_POSE = 3;
const ANTICIPO_EXPRESION = 2;
const CUADROS_VUELO = 24;

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

// ---------- Personaje ----------
function Personaje({ u, cu, frame, fps, d, imagenes, objetivos }: { u: PersonajeUbicado; cu: ComposicionUbicada; frame: number; fps: number; d: DisparosEscena; imagenes: ImagenesKit; objetivos?: ObjetivosKit }) {
  const { p, aspecto: a } = u;
  const { poses, expresiones } = cambiosDe(d, u, cu, objetivos);
  const e = poseEnCuadro(poses, u.per.pose, frame, fps, p);
  const pasadas = expresiones.filter((x) => x.cuadro <= frame);
  const actual = pasadas.at(-1);
  const expresion = actual?.expresion ?? u.per.expresion;
  const previa = pasadas.at(-2)?.expresion ?? u.per.expresion;
  const mezcla = actual ? rampa(frame, actual.cuadro, 5) : 1;
  // Micro-acción de la escena: todos dan un saltito.
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
  const cabeza = (ex: Expresion, opacidad: number) => {
    const img = imagenes[clave.cabeza(a, ex)];
    if (!img || opacidad <= 0) return null;
    return <Img key={ex + opacidad} img={img} estilo={{ opacity: opacidad, transformOrigin: `${img.ancla.x}px ${img.ancla.y}px`, transform: `rotate(${e.inclinacion}deg)` }} />;
  };
  const peloAtras = imagenes[clave.peloAtras(a)];
  return (
    <div style={{ position: "absolute", left: u.cx, top: u.pies, width: 0, height: 0 }}>
      <div style={{ position: "absolute", left: -p.cx, top: -p.pies, width: p.ancho, height: p.alto, transformOrigin: `${p.cx}px ${p.pies}px`, transform: `scale(${sx}, ${u.escala}) translateY(${e.saltoY - micro}px)` }}>
        {peloAtras && <Img img={peloAtras} estilo={{ transformOrigin: `${peloAtras.ancla.x}px ${peloAtras.ancla.y}px`, transform: `rotate(${e.inclinacion}deg)` }} />}
        <Img img={imagenes[clave.cuerpo(a)]} />
        {brazo("otro", e.otro)}
        {brazo("mira", e.mira)}
        {mezcla < 1 && cabeza(previa, 1)}
        {cabeza(expresion, mezcla)}
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

// ---------- Escena ----------
export function EscenaKit({ cu, frame, fps, d, imagenes, objetivos }: PropsEscenaKit) {
  const fondo = imagenes[clave.fondo(cu)];
  const hueco = casillaHuecoEnIsla(cu);
  // Dibujo que vuela al hueco (si lo hay) y su progreso.
  const vuelo = cu.objetos.find((o) => o.obj.tipo === "dibujo" && d[`${o.obj.id}.va_al_hueco`]?.length);
  const inicioVuelo = vuelo ? primero(d[`${vuelo.obj.id}.va_al_hueco`]) : undefined;
  const tVuelo = rampa(frame, inicioVuelo, CUADROS_VUELO);
  const capasFrente: ReactNode[] = [];
  const capasPared: ReactNode[] = [];

  for (const o of cu.objetos) {
    const id = o.obj.id;
    const visible = aparicion(frame, o.obj.visible, primero(d[`${id}.aparece`]));
    if (visible <= 0) continue;
    const destaca = (d[`${id}.destaca`] ?? []).reduce((acc, c) => Math.max(acc, frame >= c && frame < c + 24 ? Math.sin(((frame - c) / 24) * Math.PI) : 0), 0);
    if (o.obj.tipo === "cartelera" && o.rect) {
      const r = o.rect;
      const motivos = motivosCartelera(cu);
      const late = (d[`${id}.destaca_hueco`] ?? []).reduce((acc, c) => Math.max(acc, frame >= c && frame < c + 40 ? Math.abs(Math.sin(((frame - c) / 40) * Math.PI * 2)) : 0), 0);
      let k = 0;
      capasPared.push(
        <div key={id} style={{ position: "absolute", left: r.x, top: r.y, width: r.ancho, height: r.alto, opacity: visible, transformOrigin: "50% 50%", transform: `scale(${pop(visible)})` }}>
          <Img img={imagenes[clave.cartelera()]} />
          {Array.from({ length: CARTELERA.columnas * CARTELERA.filas }, (_, i) => {
            if (i === CARTELERA.hueco) return null;
            const c = casillaCartelera(i);
            const motivo = motivos[k++ % Math.max(1, motivos.length)];
            return <Img key={i} img={imagenes[clave.dibujo(motivo)]} estilo={{ left: c.x, top: c.y, width: c.ancho, height: c.alto, transform: `rotate(${((i * 7) % 9) - 4}deg)` }} />;
          })}
          {late > 0 && (
            <div style={{ position: "absolute", left: casillaCartelera(CARTELERA.hueco).x - 10, top: casillaCartelera(CARTELERA.hueco).y - 10, width: casillaCartelera(CARTELERA.hueco).ancho + 20, height: casillaCartelera(CARTELERA.hueco).alto + 20, borderRadius: 14, background: `rgba(255,255,255,${0.45 * late})`, transform: `scale(${1 + 0.08 * late})` }} />
          )}
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
    let centro: { x: number; y: number };
    if (duenio) centro = manoEnIsla(duenio, frame, fps, d);
    else if (o.rect) centro = { x: o.rect.x + o.rect.ancho / 2, y: o.rect.y + o.rect.alto / 2 };
    else continue;
    let escala = escalaObjeto * (1 + 0.22 * destaca) * pop(visible);
    let rot = 0;
    // Vuela al hueco de la cartelera.
    if (vuelo?.obj.id === id && hueco && tVuelo > 0) {
      const destino = { x: hueco.x + hueco.ancho / 2, y: hueco.y + hueco.alto / 2 };
      const t = tVuelo;
      centro = { x: centro.x + (destino.x - centro.x) * t, y: centro.y + (destino.y - centro.y) * t - Math.sin(t * Math.PI) * 220 };
      escala = escalaObjeto + (hueco.ancho / img.ancho - escalaObjeto) * t;
      rot = Math.sin(t * Math.PI) * 12;
    }
    const capa = (
      <div key={id} style={{ position: "absolute", left: centro.x, top: centro.y, width: 0, height: 0 }}>
        {destaca > 0 && <div style={{ position: "absolute", left: (-img.ancho * escala) / 2 - 24, top: (-img.alto * escala) / 2 - 24, width: img.ancho * escala + 48, height: img.alto * escala + 48, borderRadius: 24, background: `rgba(255,255,255,${0.35 * destaca})` }} />}
        <Img img={img} estilo={{ left: -img.ancla.x, top: -img.ancla.y, opacity: visible, transformOrigin: `${img.ancla.x}px ${img.ancla.y}px`, transform: `scale(${escala}) rotate(${rot}deg)` }} />
      </div>
    );
    if (o.rect && o.obj.lugar?.startsWith("pared_") && !(vuelo?.obj.id === id && tVuelo > 0)) capasPared.push(capa);
    else capasFrente.push(<div key={`f-${id}`} data-duenio={duenio?.per.id ?? ""}>{capa}</div>);
  }

  // Profundidad: el plano del fondo primero; en el mismo plano, los adultos
  // detrás de los niños (el brazo de la profesora pasa por detrás de las
  // cabezas, nunca por encima de una cara). Cada uno, seguido de lo que sostiene.
  const profundidad = (u: PersonajeUbicado) => (u.per.plano === "fondo" ? 0 : 2) + (u.per.tipo === "profesora" ? 0 : 1);
  const orden = [...cu.personajes].sort((a, b) => profundidad(a) - profundidad(b));
  const enMano = (id: string) => capasFrente.filter((c) => (c as { props?: { "data-duenio"?: string } }).props?.["data-duenio"] === id);
  const sueltos = capasFrente.filter((c) => !(c as { props?: { "data-duenio"?: string } }).props?.["data-duenio"]);
  return (
    <>
      {fondo && <Img img={fondo} />}
      {capasPared}
      {orden.map((u) => (
        <div key={u.per.id}>
          <Personaje u={u} cu={cu} frame={frame} fps={fps} d={d} imagenes={imagenes} objetivos={objetivos} />
          {enMano(u.per.id)}
        </div>
      ))}
      {sueltos}
    </>
  );
}
