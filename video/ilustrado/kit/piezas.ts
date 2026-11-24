// Qué imágenes necesita cada composición del kit (puro) y cómo se
// convierten a PNG una sola vez al precargar (en el navegador). El render
// solo dibuja <img> con transformaciones: barato y sin serializar SVG por
// cuadro (meta <= 5 s de render por segundo de video).
import { EXPRESIONES, MOTIVOS_DIBUJO, type MotivoDibujo } from "./catalogoKit";
import { svgAntebrazo, svgBrazo, svgCabeza, svgCuerpo, svgPeloAtras, svgRasgos, type AspectoPersonaje, type Cara, type Ojos, type ParteSvg } from "./dibujoPersonaje";
import { svgCartelera, svgDibujo, svgDulces, svgPupitre, svgSalon, svgSilla } from "./dibujoObjetos";
import type { ComposicionUbicada } from "./composicion";
import type { FormaMano } from "./poses";

export const claveAspecto = (a: AspectoPersonaje) => [a.tipo, a.piel, a.pelo, a.peinado, a.ropa, a.ropa2, a.accesorio].join("-");
export const clave = {
  fondo: (cu: ComposicionUbicada) => `fondo:${cu.c.fondo}:${cu.pared}`,
  cuerpo: (a: AspectoPersonaje) => `cuerpo:${claveAspecto(a)}`,
  peloAtras: (a: AspectoPersonaje) => `peloatras:${claveAspecto(a)}`,
  cabeza: (a: AspectoPersonaje) => `cabeza:${claveAspecto(a)}`,
  rasgos: (a: AspectoPersonaje, e: Cara, ojos: Ojos) => `rasgos:${claveAspecto(a)}:${e}:${ojos}`,
  brazo: (a: AspectoPersonaje) => `brazo:${claveAspecto(a)}`,
  antebrazo: (a: AspectoPersonaje, m: FormaMano) => `antebrazo:${claveAspecto(a)}:${m}`,
  cartelera: () => "cartelera",
  dibujo: (m: MotivoDibujo) => `dibujo:${m}`,
  dulces: () => "dulces",
  pupitre: () => "pupitre",
  silla: () => "silla",
};

export type Pieza = { clave: string; parte: ParteSvg };

// Motivos de la cartelera: los 11 primeros que NO usa un dibujo suelto de
// la composición (el dibujo elegido no aparece repetido en la cartelera).
export function motivosCartelera(cu: ComposicionUbicada): MotivoDibujo[] {
  const usados = new Set(cu.objetos.filter((o) => o.obj.tipo === "dibujo").map((o) => motivoDe(cu, o.obj.id)));
  return MOTIVOS_DIBUJO.filter((m) => !usados.has(m)).slice(0, 11);
}
export function motivoDe(cu: ComposicionUbicada, id: string): MotivoDibujo {
  const o = cu.objetos.find((x) => x.obj.id === id);
  if (o?.obj.motivo) return o.obj.motivo;
  // Sin motivo: uno fijo por id (variado pero estable).
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MOTIVOS_DIBUJO[h % MOTIVOS_DIBUJO.length];
}

export function piezasDeComposicion(cu: ComposicionUbicada): Pieza[] {
  const piezas = new Map<string, ParteSvg>();
  const poner = (k: string, f: () => ParteSvg | null) => {
    if (piezas.has(k)) return;
    const parte = f();
    if (parte) piezas.set(k, parte);
  };
  if (cu.c.fondo === "salon") poner(clave.fondo(cu), () => svgSalon(cu.pared));
  for (const u of cu.personajes) {
    const a = u.aspecto;
    poner(clave.cuerpo(a), () => svgCuerpo(a));
    poner(clave.peloAtras(a), () => svgPeloAtras(a));
    poner(clave.brazo(a), () => svgBrazo(a));
    for (const m of ["abierta", "senala"] as const) poner(clave.antebrazo(a, m), () => svgAntebrazo(a, m));
    poner(clave.cabeza(a), () => svgCabeza(a));
    for (const e of EXPRESIONES) for (const ojos of ["abiertos", "cerrados"] as const) poner(clave.rasgos(a, e, ojos), () => svgRasgos(a, e, ojos));
    poner(clave.rasgos(a, "bostezo", "abiertos"), () => svgRasgos(a, "bostezo", "abiertos"));
  }
  for (const o of cu.objetos) {
    if (o.obj.tipo === "cartelera") {
      poner(clave.cartelera(), () => svgCartelera());
      for (const m of motivosCartelera(cu)) poner(clave.dibujo(m), () => svgDibujo(m));
    } else if (o.obj.tipo === "dibujo") {
      const m = motivoDe(cu, o.obj.id);
      poner(clave.dibujo(m), () => svgDibujo(m));
    } else if (o.obj.tipo === "pupitre") {
      poner(clave.pupitre(), () => svgPupitre());
      poner(clave.silla(), () => svgSilla());
    } else poner(clave.dulces(), () => svgDulces());
  }
  return [...piezas.entries()].map(([k, parte]) => ({ clave: k, parte }));
}

export const uriSvg = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// Lo que el render necesita de cada pieza (nunca vuelve a armar el SVG).
export type ImagenPieza = { url: string; ancho: number; alto: number; ancla: { x: number; y: number } };
export type ImagenesKit = Record<string, ImagenPieza>;

// Sin navegador (pruebas, render del servidor): el SVG como data URI.
export function urlsSinRasterizar(piezas: Pieza[]): ImagenesKit {
  return Object.fromEntries(piezas.map((p) => [p.clave, { url: uriSvg(p.parte.svg), ancho: p.parte.ancho, alto: p.parte.alto, ancla: p.parte.ancla }]));
}

const cache = new Map<string, Promise<string>>();
// En el navegador: SVG -> canvas -> PNG (blob:), una sola vez por pieza.
// escala 1.6: los personajes se ven hasta ~1,3x de cerca y siguen nítidos.
export async function rasterizarPiezas(piezas: Pieza[], escala = 1.6): Promise<ImagenesKit> {
  if (typeof document === "undefined") return urlsSinRasterizar(piezas);
  const una = (p: Pieza): Promise<string> => {
    const k = `${p.clave}@${escala}`;
    let promesa = cache.get(k);
    if (!promesa) {
      promesa = (async () => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = uriSvg(p.parte.svg);
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(p.parte.ancho * escala);
        canvas.height = Math.ceil(p.parte.alto * escala);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error("toBlob falló"))), "image/png"));
        return URL.createObjectURL(blob);
      })();
      cache.set(k, promesa);
    }
    return promesa;
  };
  const urls = await Promise.all(piezas.map(una));
  return Object.fromEntries(piezas.map((p, i) => [p.clave, { url: urls[i], ancho: p.parte.ancho, alto: p.parte.alto, ancla: p.parte.ancla }]));
}
