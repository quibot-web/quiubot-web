// Imágenes fijas del reel ilustrado (rendimiento, fase 1). El
// renderizador del navegador serializa CADA <svg> en CADA cuadro
// (XMLSerializer + getComputedStyle), aunque no cambie, y una <img> que
// apunta a un .svg se vuelve a rasterizar en cada drawImage (medido:
// peor que el <svg> en línea). Un PNG se dibuja como mapa de bits: todo
// dibujo que no cambia con el cuadro ni con la marca se publica como PNG
// en public/ilustrado/, al tamaño máximo con que se ve en pantalla. Se
// generan con
//   npx tsx video/ilustrado/generarImagenesFijas.ts
// y una prueba exige que la huella de cada SVG de origen coincida con
// la del manifiesto (si cambias un dibujo, hay que regenerar).
//
// Se dibujan con <img> simple, NO con <Img> de Remotion: en el
// renderizador del navegador, cada <Img> vuelve a asignar su src y a
// esperar decode() con un delayRender en cada cuadro (medido: 17-19 s
// por segundo de video). En su lugar, ReelIlustrado precarga todas las
// imágenes una vez (un solo delayRender) y las mantiene vivas: por el
// estándar HTML, una <img> con un src que ya está en la lista de
// imágenes disponibles del documento queda completa al instante.
import type { CSSProperties, ReactElement } from "react";
import { staticFile } from "remotion";
import { IconoMano } from "../iconos";
import { Ilustracion, IconoAtras, IconoComentario, IconoCompartir, IconoCorazon, IconoGuardar, IconoRayo, IconoSaludo } from "./Ilustraciones";

const Moneda = (
  <svg viewBox="0 0 100 100" width={100} height={100} style={{ overflow: "visible" }}>
    <defs>
      <radialGradient id="oro" cx="35%" cy="30%" r="75%">
        <stop offset="0" stopColor="#fff2a8" />
        <stop offset="0.5" stopColor="#f2c14e" />
        <stop offset="1" stopColor="#b07a12" />
      </radialGradient>
    </defs>
    <circle cx="53" cy="56" r="44" fill="rgba(0,0,0,0.3)" />
    <circle cx="50" cy="50" r="44" fill="url(#oro)" stroke="#8a5c0a" strokeWidth="4" />
    <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(138,92,10,0.55)" strokeWidth="3" />
    {/* "$" dibujado (en una imagen no hay fuentes cargadas) */}
    <path d="M60 36c-2.5-3-6-4.5-10-4.5-6 0-10 3-10 7.5 0 10 20 5.5 20 15.5 0 4.8-4.4 8-10.5 8-4.5 0-8.5-1.8-11-5" fill="none" stroke="#8a5c0a" strokeWidth="6" strokeLinecap="round" />
    <path d="M50 24v52" stroke="#8a5c0a" strokeWidth="6" strokeLinecap="round" />
  </svg>
);

const Billetera = (
  <svg viewBox="0 -10 400 340" width={400} height={340} style={{ overflow: "visible" }}>
    <defs>
      <linearGradient id="cuero" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#b26c3e" />
        <stop offset="1" stopColor="#5e3218" />
      </linearGradient>
      <linearGradient id="solapa" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#cf8752" />
        <stop offset="1" stopColor="#8a4d26" />
      </linearGradient>
    </defs>
    <ellipse cx="200" cy="300" rx="200" ry="20" fill="rgba(0,0,0,0.35)" />
    <rect x="40" y="10" width="300" height="90" rx="10" fill="#4C9A5B" transform="rotate(-4 190 55)" />
    <rect x="60" y="22" width="300" height="80" rx="10" fill="#5FB06E" transform="rotate(3 210 60)" />
    <rect x="0" y="40" width="400" height="260" rx="40" fill="url(#cuero)" />
    <rect x="18" y="58" width="364" height="224" rx="28" fill="none" stroke="rgba(255,220,180,0.35)" strokeWidth="4" strokeDasharray="12 10" />
    <path d="M0 80 Q0 40 40 40 H360 Q400 40 400 80 V150 H230 Q210 150 210 170 V190 Q210 210 190 210 H0 Z" fill="url(#solapa)" />
    <circle cx="250" cy="180" r="18" fill="#f2c14e" stroke="#9a6b12" strokeWidth="4" />
  </svg>
);

const RelojEsfera = (
  <svg viewBox="0 0 100 100" width={100} height={100} style={{ overflow: "visible" }}>
    <circle cx="53" cy="55" r="45" fill="rgba(0,0,0,0.3)" />
    <circle cx="50" cy="50" r="45" fill="#fff" stroke="#E8460B" strokeWidth="6" />
    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => (
      <line key={a} x1="50" y1="10" x2="50" y2="16" stroke="#2a2a33" strokeWidth="3" transform={`rotate(${a} 50 50)`} />
    ))}
  </svg>
);
const manecilla = (largo: number, grosor: number, color: string, centro: boolean) => (
  <svg viewBox="0 0 100 100" width={100} height={100}>
    <line x1="50" y1="50" x2="50" y2={50 - largo} stroke={color} strokeWidth={grosor} strokeLinecap="round" />
    {centro && <circle cx="50" cy="50" r="5" fill="#2a2a33" />}
  </svg>
);

const Ojo = (
  <svg viewBox="0 0 24 24" width={170} height={170}>
    <circle cx="12.6" cy="13" r="11" fill="rgba(0,0,0,0.25)" />
    <circle cx="12" cy="12" r="11" fill="#ffffff" />
    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" fill="none" stroke="#2a2a33" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3.2" fill="#2a2a33" />
  </svg>
);

const CorazonGrande = (
  <svg viewBox="0 0 24 24" width={320} height={320}>
    <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8 3.3 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.6 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z" fill="#ff3b5c" />
  </svg>
);

const Candado = (
  <svg viewBox="0 0 24 24" width={220} height={220} style={{ overflow: "visible" }}>
    <ellipse cx="12.5" cy="23" rx="8" ry="1.2" fill="rgba(0,0,0,0.3)" />
    <path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#8a5c0a" strokeWidth="2.4" />
    <rect x="4.5" y="10.5" width="15" height="11" rx="2.5" fill="#F2C14E" stroke="#8a5c0a" strokeWidth="1.2" />
    <circle cx="12" cy="15.5" r="1.6" fill="#8a5c0a" />
    <rect x="11.3" y="16" width="1.4" height="3" rx="0.7" fill="#8a5c0a" />
  </svg>
);

const Cono = (
  <svg width={1000} height={1300} viewBox="0 0 1000 1300">
    <defs>
      <linearGradient id="cono" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.34} />
        <stop offset="1" stopColor="#ffffff" stopOpacity={0.12} />
      </linearGradient>
    </defs>
    <polygon points="420,0 580,0 1000,1300 0,1300" fill="url(#cono)" />
  </svg>
);

// dibujo + ancho del PNG en px (~ tamaño máximo en pantalla con zoom)
export const IMAGENES_FIJAS = {
  "ilu-comida": { dibujo: <Ilustracion tipo="comida" ancho={700} alto={700} />, ancho: 1050 },
  "ilu-ropa": { dibujo: <Ilustracion tipo="ropa" ancho={700} alto={700} />, ancho: 1050 },
  "ilu-paisaje": { dibujo: <Ilustracion tipo="paisaje" ancho={700} alto={700} />, ancho: 1050 },
  "ilu-mascota": { dibujo: <Ilustracion tipo="mascota" ancho={700} alto={700} />, ancho: 1050 },
  "ico-corazon": { dibujo: <IconoCorazon tamano={50} />, ancho: 100 },
  "ico-corazon-lleno": { dibujo: <IconoCorazon tamano={50} relleno="#ff3b5c" />, ancho: 100 },
  "ico-comentario": { dibujo: <IconoComentario tamano={50} />, ancho: 100 },
  "ico-compartir": { dibujo: <IconoCompartir tamano={50} />, ancho: 100 },
  "ico-guardar": { dibujo: <IconoGuardar tamano={50} />, ancho: 100 },
  "ico-atras": { dibujo: <IconoAtras tamano={50} />, ancho: 100 },
  "ico-saludo": { dibujo: <IconoSaludo tamano={50} />, ancho: 100 },
  "ico-rayo": { dibujo: <IconoRayo tamano={50} color="#E8A100" />, ancho: 64 },
  mano: { dibujo: <IconoMano tamano={240} />, ancho: 360 },
  ojo: { dibujo: Ojo, ancho: 256 },
  "corazon-grande": { dibujo: CorazonGrande, ancho: 480 },
  moneda: { dibujo: Moneda, ancho: 400 },
  billetera: { dibujo: Billetera, ancho: 800 },
  "reloj-esfera": { dibujo: RelojEsfera, ancho: 600 },
  "reloj-corta": { dibujo: manecilla(24, 5, "#2a2a33", false), ancho: 600 },
  "reloj-larga": { dibujo: manecilla(32, 4, "#E8460B", true), ancho: 600 },
  candado: { dibujo: Candado, ancho: 300 },
  cono: { dibujo: Cono, ancho: 500 },
} satisfies Record<string, { dibujo: ReactElement; ancho: number }>;

export type NombreImagenFija = keyof typeof IMAGENES_FIJAS;

export function urlImagenFija(nombre: NombreImagenFija): string {
  return staticFile(`ilustrado/${nombre}.png`);
}

export function ImagenFija({ nombre, ancho, alto, estilo }: { nombre: NombreImagenFija; ancho: number | string; alto: number | string; estilo?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element -- dibujo del video, no una página
  return <img src={urlImagenFija(nombre)} alt="" decoding="sync" style={{ display: "block", width: ancho, height: alto, ...estilo }} />;
}

// Publicaciones genéricas del feed como una sola imagen cada una (las
// genera generarPostsFijos.ts con renderStill, mismas fuentes del video).
export const POSTS_FIJOS = ["comida", "ropa", "paisaje", "mascota"] as const;
export type TipoPostFijo = (typeof POSTS_FIJOS)[number];
export const ESCALA_POST_FIJO = 1.5;
export const urlPostFijo = (tipo: TipoPostFijo) => staticFile(`ilustrado/post-${tipo}.png`);
export function ImagenPostFijo({ tipo }: { tipo: TipoPostFijo }) {
  // eslint-disable-next-line @next/next/no-img-element -- dibujo del video, no una página
  return <img src={urlPostFijo(tipo)} alt="" decoding="sync" style={{ display: "block", width: "100%", height: "100%" }} />;
}

export function urlsImagenesFijas(): string[] {
  return [...(Object.keys(IMAGENES_FIJAS) as NombreImagenFija[]).map(urlImagenFija), ...POSTS_FIJOS.map(urlPostFijo)];
}

// Referencias vivas a las imágenes precargadas (para que sigan en la
// lista de imágenes disponibles mientras dura el render).
const precargadas = new Map<string, Promise<void>>();
export function precargarImagenes(urls: string[]): Promise<void> {
  return Promise.all(
    urls.map((url) => {
      let p = precargadas.get(url);
      if (!p) {
        const img = new Image();
        img.decoding = "sync";
        p = new Promise<void>((resolver) => {
          img.onload = () => img.decode().catch(() => undefined).finally(resolver);
          img.onerror = () => resolver(); // una imagen rota no puede colgar el render
        });
        img.src = url;
        // La promesa guarda la referencia a img mientras exista el Map.
        precargadas.set(url, p.then(() => void img.width));
        p = precargadas.get(url)!;
      }
      return p;
    })
  ).then(() => undefined);
}
