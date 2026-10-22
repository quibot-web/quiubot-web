// Tipos y matemática compartida de las esferas, copiados de la lógica de
// docs/diseno/esferas_v3.html (mirarHacia, la mirada libre del setInterval,
// y trazarOrbitas) -- sin reinterpretar las fórmulas.
export type AsistenteId =
  | "director"
  | "marca"
  | "estratega"
  | "creativo"
  | "publicador"
  | "analista"
  | "optimizador";

export type EstadoEsfera = "normal" | "trabajando" | "esperando" | "pausa";

// "normal" no es una clase CSS -- es simplemente la ausencia de las
// otras tres (ver .bot en el HTML original, sin clase de estado).
export function claseEstado(estado: EstadoEsfera): string {
  return estado === "normal" ? "" : estado;
}

// Replica mirarHacia(x, y) para UNA esfera -- cuánto se desplazan los
// ojos hacia (x, y), en px, para las variables CSS --mx/--my.
export function calcularMirada(bot: HTMLElement, x: number, y: number): { mx: number; my: number } {
  const r = bot.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy) || 1;
  const max = r.width * 0.05;
  const f = Math.min(1, d / 260);
  return {
    mx: Number(((dx / d) * max * f).toFixed(1)),
    my: Number(((dy / d) * max * 0.7 * f).toFixed(1)),
  };
}

// Replica la porción del setInterval(1400ms) de esferas_v3.html que
// decide la mirada libre de UNA esfera cuando nadie mueve el cursor --
// 35% de probabilidad de moverse, 30% de esas veces con f=0 (vuelve al
// centro en vez de mirar a un lado).
export function calcularMiradaLibre(bot: HTMLElement): { mx: number; my: number } | null {
  if (Math.random() >= 0.35) return null;
  const r = bot.getBoundingClientRect();
  const max = r.width * 0.05;
  const ang = Math.random() * Math.PI * 2;
  const f = Math.random() < 0.3 ? 0 : 1;
  return {
    mx: Number((Math.cos(ang) * max * f).toFixed(1)),
    my: Number((Math.sin(ang) * max * 0.6 * f).toFixed(1)),
  };
}

// Replica trazarOrbitas() para UNA esfera -- el path elíptico (inclinado
// como el anillo) que recorre la gema cuando está "trabajando".
export function calcularOffsetPath(bot: HTMLElement): string {
  const W = bot.offsetWidth;
  const H = bot.offsetHeight;
  const s = W / 1.6;
  const rx = s * 0.74;
  const ry = s * 0.21;
  const ang = (-12 * Math.PI) / 180;
  const d = s * 0.1;
  const cx = W / 2 - d * Math.sin(ang);
  const cy = H / 2 + d * Math.cos(ang);
  const pts: string[] = [];
  for (let k = 0; k <= 64; k++) {
    const t = (k / 64) * Math.PI * 2;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    pts.push(
      `${(cx + x * Math.cos(ang) - y * Math.sin(ang)).toFixed(1)} ${(cy + x * Math.sin(ang) + y * Math.cos(ang)).toFixed(1)}`
    );
  }
  return `path('M ${pts.join(" L ")} Z')`;
}
