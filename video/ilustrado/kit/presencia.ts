// Presencia de los personajes que entran, se van o pasan de largo (puro):
// dónde están y cómo se ven en cada cuadro. La usan el dibujo (EscenaKit) y
// la cámara (para cuidar a quien camina solo donde está en cada toma).
import type { DisparosEscena } from "../motor/plan";
import type { Rect } from "../motor/geometria";
import { PASO_LARGO, caminoDe, centroDePaso, type ComposicionUbicada, type PersonajeUbicado } from "./composicion";
import { PUERTAS } from "./dibujoLugares";

// "entra": aparece en la puerta del lugar y camina hasta su lugar; "se_va":
// camina hasta la puerta y desaparece. Si lo primero que hace es entrar, no
// está antes. dx: corrimiento desde su lugar; mira: hacia dónde camina.
export const CUADROS_CAMINAR = 36;
// escala: al entrar o salir por la puerta del fondo (sin caminar de lado), se
// achica un poco, como si se alejara.
// dy: hacia atrás (al salir por la puerta del fondo); pasa: va de largo (mira al frente).
// deEspaldas: cruzando la puerta hacia afuera (o recién entrando): sin rasgos de la cara.
export type Presencia = { dx: number; dy?: number; alpha: number; camina: boolean; mira?: "izquierda" | "derecha"; t: number; escala?: number; pasa?: boolean; deEspaldas?: boolean };
// Pasa a paso rápido (~26 unidades por cuadro): unos 1,4 s a la vista
// (CUADROS_PASAR cuenta desde que la voz lo nombra).
export const CUADROS_PASAR = 44;
const ADELANTO_PASO = 10;
export const PROFUNDIDAD_PUERTA = 170;
// Paso de caminar: arranca suave y sigue a paso parejo (al irse); al
// llegar, paso parejo y frena suave. (Con aceleración y freno en los dos
// extremos, el tramo visible se veía apurado.)
const arrancar = (k: number) => (k < 0.3 ? (k * k) / 0.6 : k - 0.15) / 0.85;
const frenar = (k: number) => 1 - arrancar(1 - k);

// Quienes pasan de largo en un lugar, de a uno: si el siguiente llega
// antes de que el anterior haya salido del plano (la voz va rápida), espera
// (revisión de la tanda 2: dos personas fundidas a la vez). Clave "id@cuadro".
export const SEPARACION_PASOS = CUADROS_PASAR;
const memoPasos = new WeakMap<DisparosEscena, WeakMap<ComposicionUbicada, Map<string, number>>>();
export function iniciosDePasar(cu: ComposicionUbicada, d: DisparosEscena): Map<string, number> {
  let porCu = memoPasos.get(d);
  if (!porCu) memoPasos.set(d, (porCu = new WeakMap()));
  const hecho = porCu.get(cu);
  if (hecho) return hecho;
  const res = new Map<string, number>();
  const todos = cu.personajes.flatMap((u) => (d[`${u.per.id}.pasa_de_largo`] ?? []).map((c) => ({ id: u.per.id, c }))).sort((a, b) => a.c - b.c);
  let libre = -Infinity;
  for (const p of todos) {
    const inicio = Math.max(p.c, libre);
    res.set(`${p.id}@${p.c}`, inicio);
    libre = inicio + SEPARACION_PASOS;
  }
  porCu.set(cu, res);
  return res;
}

export function presenciaDe(u: PersonajeUbicado, cu: ComposicionUbicada, d: DisparosEscena, frame: number): Presencia {
  const id = u.per.id;
  const pasos = iniciosDePasar(cu, d);
  const eventos = [
    ...(d[`${id}.entra`] ?? []).map((c) => ({ c, tipo: "entra" as const })),
    ...(d[`${id}.se_va`] ?? []).map((c) => ({ c, tipo: "se_va" as const })),
    ...(d[`${id}.pasa_de_largo`] ?? []).map((c) => ({ c: pasos.get(`${id}@${c}`) ?? c, tipo: "pasa" as const })),
  ].sort((a, b) => a.c - b.c);
  if (!eventos.length) return { dx: 0, alpha: 1, camina: false, t: 0 };
  const hasta = caminoDe(u, cu.c.fondo);
  const pasados = eventos.filter((e) => e.c <= frame);
  const ultimo = pasados.at(-1);
  const ausente: Presencia = { dx: hasta, alpha: 0, camina: false, t: 0 };
  if (!ultimo) return eventos[0].tipo === "se_va" ? { dx: 0, alpha: 1, camina: false, t: 0 } : ausente;
  const t = frame - ultimo.c;
  const hacia = (dx: number): "izquierda" | "derecha" => (dx < 0 ? "izquierda" : "derecha");
  // Pasa de largo: cruza de un lado al otro (pasando por su lugar) mirando
  // al frente; aparece y desaparece en los extremos; antes y después, no está.
  if (ultimo.tipo === "pasa") {
    // Arranca ya avanzado (el comienzo del recorrido queda fuera del plano):
    // entra al cuadro cuando la voz lo nombra, no medio segundo después.
    const kp = (t + ADELANTO_PASO) / (CUADROS_PASAR + ADELANTO_PASO);
    if (kp >= 1) return { ...ausente, t };
    const dir = u.per.mira === "izquierda" ? -1 : 1;
    const alpha = Math.min(1, t / 10, (CUADROS_PASAR - t) / 10);
    return { dx: centroDePaso(u, cu) + dir * PASO_LARGO * (2 * kp - 1), alpha, camina: true, mira: dir < 0 ? "izquierda" : "derecha", t, pasa: true };
  }
  if (PUERTAS[cu.c.fondo]) return porLaPuerta(u, cu, ultimo.tipo, t);
  const k = Math.min(1, t / CUADROS_CAMINAR);
  const suave = k * k * (3 - 2 * k);
  // Por la puerta del fondo (sin caminar de lado): camina hacia atrás
  // (sube y se achica) hasta desaparecer en la puerta; al entrar, al revés.
  const alFondo = (q: number): Presencia => ({ dx: 0, dy: -PROFUNDIDAD_PUERTA * q, escala: 1 - 0.3 * q, alpha: Math.min(1, (1 - q) / 0.3), camina: q > 0 && q < 1, t });
  if (ultimo.tipo === "entra") {
    if (k >= 1) return { dx: 0, alpha: 1, camina: false, t };
    if (hasta === 0) return alFondo(1 - suave);
    // Si todavía se estaba yendo, da media vuelta desde donde está (no salta a la puerta).
    const previo = pasados.at(-2);
    let [dx0, alpha0] = [hasta, 0];
    if (previo?.tipo === "se_va" && ultimo.c - previo.c < CUADROS_CAMINAR) {
      const kp = (ultimo.c - previo.c) / CUADROS_CAMINAR;
      dx0 = hasta * kp * kp * (3 - 2 * kp);
      alpha0 = 1 - Math.max(0, (ultimo.c - previo.c - (CUADROS_CAMINAR - 8)) / 8);
    }
    return { dx: dx0 * (1 - frenar(k)), alpha: alpha0 + (1 - alpha0) * Math.min(1, t / 8), camina: true, mira: hacia(-dx0 || -hasta), t };
  }
  if (k >= 1) return { ...ausente, t };
  if (hasta === 0) return alFondo(suave);
  return { dx: hasta * arrancar(k), alpha: 1 - Math.max(0, (t - (CUADROS_CAMINAR - 8)) / 8), camina: true, mira: hacia(hasta), t };
}


// ---------- Entrar y salir por la puerta (tienda, cocina, calle) ----------
// Irse: camina de costado hasta la puerta, la puerta se abre, da un paso
// hacia el vano (se achica un poco) y desaparece; la puerta se cierra.
// Entrar: al revés. Así se lee "se va" / "llega" aunque el dibujo sea de
// frente (revisión de la tanda 2).
export const VELOCIDAD_CAMINAR = 24; // unidades de la isla por cuadro (paso decidido)
export const CUADROS_ABRIR = 8;
export const CUADROS_CRUZAR = 15;
export const CUADROS_CERRAR = 8;
const suaveK = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

function hastaLaPuerta(u: PersonajeUbicado, cu: ComposicionUbicada): { dist: number; cuadros: number } {
  const dist = caminoDe(u, cu.c.fondo);
  return { dist, cuadros: Math.abs(dist) < 80 ? 0 : Math.round(Math.abs(dist) / VELOCIDAD_CAMINAR) };
}
// Cuándo empieza a cruzar la puerta (desde la acción): al irse, cuando llegó
// a la puerta y ya está abierta; al entrar, apenas se abre.
function inicioCruce(cuadros: number, tipo: "entra" | "se_va"): number {
  return tipo === "se_va" ? Math.max(cuadros, CUADROS_ABRIR) : CUADROS_ABRIR - 2;
}

// Cuántos cuadros dura entrar o irse (la cámara no corta antes): al irse,
// hasta que desapareció y la puerta va a medio cerrar.
export function duracionCaminar(u: PersonajeUbicado, cu: ComposicionUbicada, tipo: "entra" | "se_va"): number {
  if (!PUERTAS[cu.c.fondo]) return CUADROS_CAMINAR;
  const { cuadros } = hastaLaPuerta(u, cu);
  const cruce = inicioCruce(cuadros, tipo);
  return tipo === "se_va" ? cruce + CUADROS_CRUZAR + CUADROS_CERRAR / 2 : cruce + CUADROS_CRUZAR + Math.max(cuadros, CUADROS_CERRAR);
}

function porLaPuerta(u: PersonajeUbicado, cu: ComposicionUbicada, tipo: "entra" | "se_va", t: number): Presencia {
  const { dist, cuadros } = hastaLaPuerta(u, cu);
  const hacia = (dx: number): "izquierda" | "derecha" | undefined => (cuadros === 0 ? undefined : dx < 0 ? "izquierda" : "derecha");
  const cruce = inicioCruce(cuadros, tipo);
  // Cruzando: camina hacia el fondo hasta el umbral (los pies suben al piso
  // de la puerta y se achica hasta caber en el vano) y ahí desaparece.
  // q = 0 delante de la puerta, 1 ya del otro lado.
  const puerta = PUERTAS[cu.c.fondo]!;
  const escalaVano = Math.min(1, (0.9 * puerta.alto) / (u.p.alto * u.escala));
  const enVano = (q: number): Presencia => {
    const k = suaveK(Math.min(1, q / 0.75));
    return { dx: dist, dy: (puerta.y + puerta.alto - u.pies) * k, escala: 1 + (escalaVano - 1) * k, alpha: q < 0.7 ? 1 : Math.max(0, 1 - (q - 0.7) / 0.3), camina: true, mira: hacia(dist), t, deEspaldas: q > 0.2 };
  };
  if (tipo === "se_va") {
    if (t < cuadros) return { dx: dist * arrancar(t / cuadros), alpha: 1, camina: true, mira: hacia(dist), t };
    // Espera en la puerta mientras se abre.
    if (t < cruce) return { dx: dist, alpha: 1, camina: false, mira: hacia(dist), t };
    const q = (t - cruce) / CUADROS_CRUZAR;
    return q >= 1 ? { dx: dist, alpha: 0, camina: false, t } : enVano(q);
  }
  if (t < cruce) return { dx: dist, alpha: 0, camina: false, t };
  const q = 1 - (t - cruce) / CUADROS_CRUZAR;
  if (q > 0) return { ...enVano(q), alpha: q > 0.65 ? Math.max(0, (1 - q) / 0.35) : 1, mira: hacia(-dist) };
  const k = cuadros === 0 ? 1 : (t - cruce - CUADROS_CRUZAR) / cuadros;
  return k >= 1 ? { dx: 0, alpha: 1, camina: false, t } : { dx: dist * (1 - frenar(k)), alpha: 1, camina: true, mira: hacia(-dist), t };
}

// Cuánto está abierta la puerta del lugar en este cuadro (0 cerrada, 1 abierta).
export function aperturaPuerta(cu: ComposicionUbicada, d: DisparosEscena, frame: number): number {
  if (!PUERTAS[cu.c.fondo]) return 0;
  let a = 0;
  for (const u of cu.personajes) {
    const { cuadros } = hastaLaPuerta(u, cu);
    for (const tipo of ["entra", "se_va"] as const) {
      for (const c of d[`${u.per.id}.${tipo}`] ?? []) {
        const t = frame - c;
        const cruce = inicioCruce(cuadros, tipo);
        const abre = tipo === "se_va" ? cruce - CUADROS_ABRIR : 0;
        const cierra = cruce + CUADROS_CRUZAR;
        a = Math.max(a, suaveK((t - abre) / CUADROS_ABRIR) * (1 - suaveK((t - cierra) / CUADROS_CERRAR)));
      }
    }
  }
  return a;
}

// Ciclo de paso (ángulos en grados; paso: rebote, en fracción del alto). fase = t / 3.2: un paso
// cada ~10 cuadros. Las piernas abren en tijera; el cuerpo sube cuando
// están juntas y baja cuando están abiertas; el brazo cercano va al revés
// que su pierna. Inclinado hacia adelante. Quien pasa de largo, a paso
// más largo.
export const ANGOSTO_CAMINANDO = 0.88;
export type Caminata = { pierna: number; brazo: number; paso: number; inclinacion: number };
export function caminataEn(fase: number, largo: boolean): Caminata {
  const sn = Math.sin(fase);
  return { pierna: (largo ? 26 : 22) * sn, brazo: 16 * sn, paso: Math.abs(Math.cos(fase)) * (largo ? 0.018 : 0.014), inclinacion: 4 };
}

// Un rectángulo del personaje (en la isla) llevado a donde está según su presencia.
export function rectEnPresencia(u: PersonajeUbicado, r: Rect, p: Presencia): Rect {
  const k = p.escala ?? 1;
  const x = u.cx + p.dx + (r.x - u.cx) * k;
  const y = u.pies + (p.dy ?? 0) + (r.y - u.pies) * k;
  return { x, y, ancho: r.ancho * k, alto: r.alto * k };
}
