// Presencia de los personajes que entran, se van o pasan de largo (puro):
// dónde están y cómo se ven en cada cuadro. La usan el dibujo (EscenaKit) y
// la cámara (para cuidar a quien camina solo donde está en cada toma).
import type { DisparosEscena } from "../motor/plan";
import type { Rect } from "../motor/geometria";
import { PASO_LARGO, caminoDe, centroDePaso, type ComposicionUbicada, type PersonajeUbicado } from "./composicion";

// "entra": aparece en la puerta del lugar y camina hasta su lugar; "se_va":
// camina hasta la puerta y desaparece. Si lo primero que hace es entrar, no
// está antes. dx: corrimiento desde su lugar; mira: hacia dónde camina.
export const CUADROS_CAMINAR = 36;
// escala: al entrar o salir por la puerta del fondo (sin caminar de lado), se
// achica un poco, como si se alejara.
// dy: hacia atrás (al salir por la puerta del fondo); pasa: va de largo (mira al frente).
export type Presencia = { dx: number; dy?: number; alpha: number; camina: boolean; mira?: "izquierda" | "derecha"; t: number; escala?: number; pasa?: boolean };
export const CUADROS_PASAR = 46;
export const PROFUNDIDAD_PUERTA = 170;
// Paso de caminar: arranca suave y sigue a paso parejo (al irse); al
// llegar, paso parejo y frena suave. (Con aceleración y freno en los dos
// extremos, el tramo visible se veía apurado.)
const arrancar = (k: number) => (k < 0.3 ? (k * k) / 0.6 : k - 0.15) / 0.85;
const frenar = (k: number) => 1 - arrancar(1 - k);

export function presenciaDe(u: PersonajeUbicado, cu: ComposicionUbicada, d: DisparosEscena, frame: number): Presencia {
  const id = u.per.id;
  const eventos = [
    ...(d[`${id}.entra`] ?? []).map((c) => ({ c, tipo: "entra" as const })),
    ...(d[`${id}.se_va`] ?? []).map((c) => ({ c, tipo: "se_va" as const })),
    ...(d[`${id}.pasa_de_largo`] ?? []).map((c) => ({ c, tipo: "pasa" as const })),
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
    const kp = t / CUADROS_PASAR;
    if (kp >= 1) return { ...ausente, t };
    const dir = u.per.mira === "izquierda" ? -1 : 1;
    const alpha = Math.min(1, t / 10, (CUADROS_PASAR - t) / 10);
    return { dx: centroDePaso(u, cu) + dir * PASO_LARGO * (2 * kp - 1), alpha, camina: true, mira: dir < 0 ? "izquierda" : "derecha", t, pasa: true };
  }
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


// Un rectángulo del personaje (en la isla) llevado a donde está según su presencia.
export function rectEnPresencia(u: PersonajeUbicado, r: Rect, p: Presencia): Rect {
  const k = p.escala ?? 1;
  const x = u.cx + p.dx + (r.x - u.cx) * k;
  const y = u.pies + (p.dy ?? 0) + (r.y - u.pies) * k;
  return { x, y, ancho: r.ancho * k, alto: r.alto * k };
}
