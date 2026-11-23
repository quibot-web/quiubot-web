// Imágenes que dependen de la marca o de la foto del cliente, generadas
// UNA vez en un canvas al precargar el reel (fase 1, ronda de Safari).
// Por qué no CSS:
// - el renderizador del navegador aplica `filter` con ctx.filter, que
//   Safari no tiene: la foto "apagada" salía igual a la "clara";
// - solo dibuja degradados radiales CENTRADOS, y cada uno crea un canvas
//   nuevo en cada cuadro (caro): la "luz de ventana" ni se veía.
// Acá se hornean en píxeles y el video solo dibuja <img> (barato y
// igual en Chrome y Safari).

export type RecursosGenerados = {
  fotoApagada: string; // oscura y casi sin color
  fotoClara: string; // luminosa y cálida, con luz de ventana arriba a la izquierda
  brilloLuz: string; // halo radial en el color de luz de la marca (fondo transparente)
};

const cache = new Map<string, Promise<string>>();

function cargar(url: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolver(img);
    img.onerror = () => rechazar(new Error(`No se pudo cargar ${url.slice(0, 80)}`));
    img.src = url;
  });
}

function aUrl(canvas: HTMLCanvasElement, tipo = "image/jpeg"): Promise<string> {
  return new Promise((resolver, rechazar) =>
    canvas.toBlob((b) => (b ? resolver(URL.createObjectURL(b)) : rechazar(new Error("toBlob falló"))), tipo, 0.92)
  );
}

// Transformación de color por píxel (pura, probada): "apagada" y "clara".
export function pixelApagado(r: number, g: number, b: number): [number, number, number] {
  const gris = 0.299 * r + 0.587 * g + 0.114 * b;
  // 92% desaturado, 38% de brillo, un poco frío.
  const m = (c: number) => (gris * 0.92 + c * 0.08) * 0.38;
  return [m(r) * 0.95, m(g) * 0.98, m(b) * 1.05].map((c) => Math.max(0, Math.min(255, c))) as [number, number, number];
}
export function pixelClaro(r: number, g: number, b: number): [number, number, number] {
  const gris = 0.299 * r + 0.587 * g + 0.114 * b;
  // +40% de saturación, +14% de brillo y tono cálido (más rojo, menos azul).
  const s = (c: number) => gris + (c - gris) * 1.4;
  return [s(r) * 1.14 * 1.1 + 10, s(g) * 1.14 * 1.02 + 6, s(b) * 1.14 * 0.82].map((c) => Math.max(0, Math.min(255, c))) as [number, number, number];
}

async function variante(url: string, cual: "apagada" | "clara"): Promise<string> {
  const img = await cargar(url);
  const escala = Math.min(1, 1080 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * escala);
  canvas.height = Math.round(img.naturalHeight * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const p = datos.data;
  const f = cual === "apagada" ? pixelApagado : pixelClaro;
  for (let i = 0; i < p.length; i += 4) {
    const [r, g, b] = f(p[i], p[i + 1], p[i + 2]);
    p[i] = r;
    p[i + 1] = g;
    p[i + 2] = b;
  }
  ctx.putImageData(datos, 0, 0);
  if (cual === "clara") {
    // Luz de ventana: halo cálido arriba a la izquierda (horneado).
    const { width: w, height: h } = canvas;
    const halo = ctx.createRadialGradient(w * 0.3, h * 0.25, 0, w * 0.3, h * 0.25, Math.max(w, h) * 0.75);
    halo.addColorStop(0, "rgba(255,226,170,0.55)");
    halo.addColorStop(0.45, "rgba(255,180,100,0.2)");
    halo.addColorStop(1, "rgba(255,170,90,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
  }
  return aUrl(canvas);
}

async function brillo(color: string): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  const [r, gg, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  g.addColorStop(0, `rgba(${r},${gg},${b},0.9)`);
  g.addColorStop(0.45, `rgba(${r},${gg},${b},0.28)`);
  g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  return aUrl(canvas, "image/png");
}

function unaVez(clave: string, crear: () => Promise<string>, respaldo: string): Promise<string> {
  let p = cache.get(clave);
  if (!p) {
    // Si algo falla (foto sin CORS, por ejemplo), se usa el respaldo: el
    // reel sale igual, solo sin el contraste apagada/clara.
    p = crear().catch((e) => {
      console.warn("Reel ilustrado: no se pudo generar", clave, e);
      return respaldo;
    });
    cache.set(clave, p);
  }
  return p;
}

export async function generarRecursos(fotoUrl: string, colorLuz: string): Promise<RecursosGenerados> {
  if (typeof document === "undefined") return recursosSinGenerar(fotoUrl);
  const [fotoApagada, fotoClara, brilloLuz] = await Promise.all([
    unaVez(`apagada|${fotoUrl}`, () => variante(fotoUrl, "apagada"), fotoUrl),
    unaVez(`clara|${fotoUrl}`, () => variante(fotoUrl, "clara"), fotoUrl),
    unaVez(`brillo|${colorLuz}`, () => brillo(colorLuz), ""),
  ]);
  return { fotoApagada, fotoClara, brilloLuz };
}

// Para pruebas y para el primer render antes de generar.
export function recursosSinGenerar(fotoUrl: string): RecursosGenerados {
  return { fotoApagada: fotoUrl, fotoClara: fotoUrl, brilloLuz: "" };
}
