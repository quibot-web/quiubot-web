// Proporciones y cinemática de los personajes del kit (puro, probado).
// Vista de frente, en 2.5D: cuerpo, cabeza y dos brazos articulados en
// hombro y codo. Cada brazo se describe con ángulos "hacia afuera" (0 =
// colgando, 90 = horizontal hacia el costado, 180 = arriba); el render los
// pasa a rotaciones CSS. "mira" es el brazo del lado hacia donde mira el
// personaje (el que señala u ofrece); el otro brazo es "otro".
import type { Pose, TipoPersonaje } from "./catalogoKit";

export type Proporciones = {
  ancho: number; // lienzo del personaje (coordenadas locales)
  alto: number;
  cx: number;
  pies: number; // y de las plantas
  cabeza: { cx: number; cy: number; rx: number; ry: number };
  alturaCabeza: number; // alto del lienzo de la cabeza (incluye pelo largo)
  cuello: { y0: number; y1: number; ancho: number };
  torso: { y0: number; y1: number; hombros: number; cintura: number };
  piernas: { y0: number; y1: number; ancho: number; separacion: number };
  hombroDx: number;
  hombroY: number;
  brazo: { largo: number; ancho: number };
  antebrazo: { largo: number; ancho: number; mano: number };
  // Recuadro ajustado del cuerpo (para la cámara), sin los brazos en alto.
  cuerpoAncho: number;
};

const ADULTO: Proporciones = {
  ancho: 420,
  alto: 1000,
  cx: 210,
  pies: 985,
  cabeza: { cx: 210, cy: 150, rx: 90, ry: 106 },
  alturaCabeza: 420,
  cuello: { y0: 238, y1: 292, ancho: 50 },
  torso: { y0: 284, y1: 600, hombros: 226, cintura: 186 },
  piernas: { y0: 590, y1: 950, ancho: 64, separacion: 60 },
  hombroDx: 108,
  hombroY: 312,
  brazo: { largo: 196, ancho: 60 },
  antebrazo: { largo: 184, ancho: 52, mano: 34 },
  cuerpoAncho: 300,
};

const NINO: Proporciones = {
  ancho: 420,
  alto: 720,
  cx: 210,
  pies: 708,
  cabeza: { cx: 210, cy: 150, rx: 98, ry: 110 },
  alturaCabeza: 400,
  cuello: { y0: 248, y1: 284, ancho: 44 },
  torso: { y0: 278, y1: 470, hombros: 178, cintura: 164 },
  piernas: { y0: 462, y1: 676, ancho: 54, separacion: 46 },
  hombroDx: 84,
  hombroY: 302,
  brazo: { largo: 132, ancho: 46 },
  antebrazo: { largo: 126, ancho: 40, mano: 27 },
  cuerpoAncho: 260,
};

export function proporciones(tipo: TipoPersonaje): Proporciones {
  return tipo === "profesora" ? ADULTO : NINO;
}

export type FormaMano = "abierta" | "senala";
export type AngulosBrazo = { hombro: number; codo: number; mano: FormaMano };
export type EstadoPose = { mira: AngulosBrazo; otro: AngulosBrazo; saltoY: number; inclinacion: number };

const suave = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// Ángulo total del antebrazo (hombro + codo) para que la mano quede a
// "distancia" del centro del cuerpo, con el hombro abierto "hombro" grados.
// Con el antebrazo hacia ARRIBA y adentro (manos frente al pecho, no en la
// cintura): la otra solución del arcoseno.
function totalParaManoEn(p: Proporciones, hombro: number, distancia: number): number {
  const codoX = p.hombroDx + p.brazo.largo * Math.sin((hombro * Math.PI) / 180);
  const s = Math.max(-1, Math.min(1, (distancia - codoX) / p.antebrazo.largo));
  return -180 - (Math.asin(s) * 180) / Math.PI;
}

// Pose en un cuadro, contando desde que empezó (t en cuadros). apunte:
// ángulo del hombro hacia lo que señala (si la acción tiene objetivo).
export function estadoPose(pose: Pose, t: number, fps: number, p: Proporciones, apunte?: number): EstadoPose {
  const respira = Math.sin(t / 22) * 1.5;
  const base: EstadoPose = { mira: { hombro: 8 + respira, codo: -4, mano: "abierta" }, otro: { hombro: 8 + respira, codo: -4, mano: "abierta" }, saltoY: 0, inclinacion: Math.sin(t / 40) * 1.5 };
  switch (pose) {
    case "parado":
      return base;
    case "senalar": {
      const toque = t < 24 ? Math.sin(t / 3) * 4 * (1 - t / 24) : 0;
      return { ...base, mira: { hombro: (apunte ?? 82) + toque, codo: 4, mano: "senala" }, otro: { hombro: 12, codo: -8, mano: "abierta" }, inclinacion: 4 };
    }
    case "celebrar": {
      const ola = Math.sin(t / 3.2) * 9;
      return {
        mira: { hombro: 150 + ola, codo: 22, mano: "abierta" },
        otro: { hombro: 150 - ola, codo: 22, mano: "abierta" },
        saltoY: -Math.abs(Math.sin((Math.PI * t) / 13)) * 0.06 * p.alto,
        inclinacion: Math.sin(t / 6) * 4,
      };
    }
    case "aplaudir": {
      // Las manos se juntan frente al pecho ~2,5 veces por segundo: codos
      // abajo frente al cuerpo y antebrazos hacia arriba (de frente, un
      // adulto no alcanza el centro del pecho con el brazo hacia afuera).
      const hombro = -10;
      const juntas = totalParaManoEn(p, hombro, 6);
      const separadas = totalParaManoEn(p, hombro, p.hombroDx * 0.75);
      const k = (1 + Math.cos((2 * Math.PI * t * 2.5) / fps)) / 2; // 1 = juntas
      const total = separadas + (juntas - separadas) * k;
      const brazo = { hombro, codo: total - hombro, mano: "abierta" as const };
      return { mira: brazo, otro: brazo, saltoY: -k * 0.006 * p.alto, inclinacion: Math.sin(t / 8) * 2 };
    }
    case "ofrecer":
      return { ...base, mira: { hombro: 48, codo: 38, mano: "abierta" }, otro: { hombro: 10, codo: -6, mano: "abierta" }, inclinacion: 3 };
    case "levantar_mano": {
      // Brazo bien arriba, con un vaivén de "¡yo, yo!".
      const vaiven = Math.sin(t / 4) * 6;
      return { ...base, mira: { hombro: 168 + vaiven, codo: 6, mano: "abierta" }, otro: { hombro: 8, codo: -4, mano: "abierta" }, inclinacion: -3 };
    }
  }
}

// Transición entre dos poses (k de 0 a 1).
export function mezclarPoses(a: EstadoPose, b: EstadoPose, k: number): EstadoPose {
  const m = (x: number, y: number) => x + (y - x) * k;
  const brazo = (x: AngulosBrazo, y: AngulosBrazo): AngulosBrazo => ({ hombro: m(x.hombro, y.hombro), codo: m(x.codo, y.codo), mano: k < 0.5 ? x.mano : y.mano });
  return { mira: brazo(a.mira, b.mira), otro: brazo(a.otro, b.otro), saltoY: m(a.saltoY, b.saltoY), inclinacion: m(a.inclinacion, b.inclinacion) };
}

export const CUADROS_TRANSICION = 8;
// Cuánto dura cada gesto antes de volver solo a "parado" (si no viene otro
// antes): nadie se queda señalando todo el reel.
export const DURACION_GESTO: Partial<Record<Pose, number>> = { senalar: 60, ofrecer: 75, celebrar: 90, aplaudir: 90, levantar_mano: 75 };

export type CambioPose = { cuadro: number; pose: Pose; apunte?: number };

// Agrega las vueltas a "parado" cuando un gesto termina.
export function conVueltasAParado(cambios: CambioPose[]): CambioPose[] {
  const orden = [...cambios].sort((a, b) => a.cuadro - b.cuadro);
  const res: CambioPose[] = [];
  orden.forEach((c, i) => {
    res.push(c);
    const dura = DURACION_GESTO[c.pose];
    const siguiente = orden[i + 1]?.cuadro ?? Infinity;
    if (dura !== undefined && c.cuadro + dura < siguiente) res.push({ cuadro: c.cuadro + dura, pose: "parado" });
  });
  return res;
}

// Pose en el cuadro "frame" dada la lista de cambios de pose (cuadro, pose).
export function poseEnCuadro(cambios: CambioPose[], inicial: Pose, frame: number, fps: number, p: Proporciones): EstadoPose {
  const pasados = conVueltasAParado(cambios).filter((c) => c.cuadro <= frame);
  const actual = pasados[pasados.length - 1];
  if (!actual) return estadoPose(inicial, frame, fps, p);
  const previo = pasados[pasados.length - 2];
  const t = frame - actual.cuadro;
  const nuevo = estadoPose(actual.pose, t, fps, p, actual.apunte);
  if (t >= CUADROS_TRANSICION) return nuevo;
  return mezclarPoses(estadoPose(previo?.pose ?? inicial, frame - (previo?.cuadro ?? 0), fps, p, previo?.apunte), nuevo, suave(t / CUADROS_TRANSICION));
}

// Ángulo del hombro (lado "mira") para que el brazo apunte a un punto
// (coordenadas locales del personaje). Entre 35 y 125 grados.
export function apunteHacia(p: Proporciones, x: number, y: number): number {
  const dx = x - (p.cx + p.hombroDx);
  const dy = y - p.hombroY;
  const a = (Math.atan2(dx, dy) * 180) / Math.PI;
  return Math.max(35, Math.min(125, a));
}

// Dónde queda la mano (coordenadas locales del personaje, sin espejo).
// lado "mira" = brazo del costado derecho del lienzo.
export function posicionMano(p: Proporciones, brazo: AngulosBrazo, lado: "mira" | "otro"): { x: number; y: number } {
  const signo = lado === "mira" ? 1 : -1;
  const rad = (g: number) => (g * Math.PI) / 180;
  const ex = p.cx + signo * (p.hombroDx + p.brazo.largo * Math.sin(rad(brazo.hombro)));
  const ey = p.hombroY + p.brazo.largo * Math.cos(rad(brazo.hombro));
  const total = brazo.hombro + brazo.codo;
  return { x: ex + signo * p.antebrazo.largo * Math.sin(rad(total)), y: ey + p.antebrazo.largo * Math.cos(rad(total)) };
}

// Punto más alto que alcanza el personaje en la pose (para la cámara).
export function topeDePose(p: Proporciones, e: EstadoPose): number {
  const manos = [posicionMano(p, e.mira, "mira"), posicionMano(p, e.otro, "otro")];
  return Math.min(p.cabeza.cy - p.cabeza.ry - 20, ...manos.map((m) => m.y - p.antebrazo.mano)) + e.saltoY;
}
