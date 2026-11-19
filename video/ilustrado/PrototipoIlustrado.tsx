// Prototipo de "reel ilustrado" (18 nov 2026): "Por qué tus anuncios no
// venden". Un solo mundo 2.5D (celular, billetera, multitud, cliente,
// gráfica) y una cámara que se mueve por él; cada cambio está amarrado a
// una palabra de la narración. Casi sin texto: solo un subtítulo karaoke
// corto arriba. No toca /contenido ni los visuales de siempre.
import { useMemo } from "react";
import { AbsoluteFill, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { familiaDeFuente } from "../fuentes";
import { colorTextoSobre, hexConAlfa, type TemaGuion } from "../tema";
import { paletaNoche } from "../estilos/estilos";
import { CapaVoz } from "../visuales/CapaVoz";
import { IconoMano, IconoCheck } from "../iconos";
import { quitarGlifosFueraDeFuentes } from "../glifos";
import { camaraEnCuadro, construirLineaDeTiempo, type LineaDeTiempo, type PuntoCamara, type TiemposIlustrado } from "./tiempoIlustrado";
import {
  ALTO_BARRA_FEED,
  ALTO_POST,
  BILLETERA,
  CELULAR,
  PANTALLA,
  BarraSuperiorFeed,
  Billetera,
  Burbuja,
  Celular,
  Grafica,
  Moneda,
  Persona,
  Post,
  Reloj,
  type TipoPost,
} from "./Objetos";

// fotoUrl opcional: por defecto la foto de cerámica de public/demo-organico.
export type PropsPrototipoIlustrado = { tiempos: TiemposIlustrado; vozUrl: string | null; fotoUrl?: string; tema: TemaGuion };

const FPS = 30;

export function duracionPrototipoIlustrado(props: PropsPrototipoIlustrado): number {
  return Math.max(1, construirLineaDeTiempo(props.tiempos, FPS).duracionCuadros);
}

// ---------- utilidades de tiempo ----------
function rampa(frame: number, desde: number, duracion: number): number {
  if (frame <= desde) return 0;
  if (frame >= desde + duracion) return 1;
  const t = (frame - desde) / duracion;
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function claves(pares: [number, number][], frame: number): number {
  const p = [...pares].sort((a, b) => a[0] - b[0]);
  if (frame <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (frame <= p[i][0]) return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * rampa(frame, p[i - 1][0], p[i][0] - p[i - 1][0]);
  }
  return p[p.length - 1][1];
}

// ---------- eventos: el cuadro de cada palabra que dispara un cambio ----------
function eventosDe(l: LineaDeTiempo) {
  const w = l.cuadroDePalabra;
  return {
    e1: { anuncios: w("e1", 1), y: w("e1", 2), nadie: w("e1", 3), compra: w("e1", 5) },
    e2: { inicio: w("e2", 0), gente: w("e2", 1), ve: w("e2", 2), anuncio: w("e2", 4), pasa: w("e2", 6), largo: w("e2", 8) },
    e3: { inicio: w("e3", 0), pasa: w("e3", 4), va: w("e3", 7), moneda: w("e3", 9) },
    e4: { primer: w("e4", 0), hablas: w("e4", 3), mundo: w("e4", 7) },
    e5: { elige: w("e5", 0), quien: w("e5", 2), iluminan: w("e5", 5), comprarte: w("e5", 10) },
    e6: { segundo: w("e6", 0), foto: w("e6", 2), detiene: w("e6", 4), dedo: w("e6", 6) },
    e7: { foto: w("e7", 1), clara: w("e7", 2), producto: w("e7", 5), detiene: w("e7", 10) },
    e8: { tercero: w("e8", 0), escriben: w("e8", 2), nadie: w("e8", 4), responde: w("e8", 5) },
    e9: { responde: w("e9", 0), rapido: w("e9", 1), mensaje: w("e9", 4), vuelve: w("e9", 6), venta: w("e9", 7) },
    e10: { asi: w("e10", 0), presupuesto: w("e10", 2), irse: w("e10", 5), empieza: w("e10", 7), volver: w("e10", 9) },
    e11: { sigue: w("e11", 0), quiubot: w("e11", 2) },
  };
}
type Eventos = ReturnType<typeof eventosDe>;

// ---------- cámara: entra y sale del celular, baja a la multitud, vuelve ----------
const CENTRO_CELULAR = { x: CELULAR.x + CELULAR.ancho / 2, y: CELULAR.y + CELULAR.alto / 2 };
const CERCA_PANTALLA = { x: CENTRO_CELULAR.x, y: CENTRO_CELULAR.y - 20, zoom: 1.36 };

function puntosCamara(ev: Eventos, total: number): PuntoCamara[] {
  const p = (cuadro: number, c: { x: number; y: number; zoom: number }) => ({ cuadro, ...c });
  const mover = 16; // ~0,5 s por movimiento
  return [
    p(0, CERCA_PANTALLA),
    p(ev.e1.compra, { ...CERCA_PANTALLA, zoom: 1.42 }),
    // e2: sale del celular para ver a "la gente" pasar de largo.
    p(ev.e2.gente, { ...CERCA_PANTALLA, zoom: 1.4 }),
    p(ev.e2.gente + mover, { x: CENTRO_CELULAR.x, y: CENTRO_CELULAR.y, zoom: 1.0 }),
    // e3: aparece la billetera al lado.
    p(ev.e3.inicio, { x: CENTRO_CELULAR.x - 80, y: CENTRO_CELULAR.y + 40, zoom: 0.96 }),
    p(ev.e3.inicio + mover, { x: 880, y: 1480, zoom: 0.8 }),
    p(ev.e3.moneda, { x: 860, y: 1560, zoom: 0.78 }),
    // e4: la cámara sigue la moneda hacia abajo, a la multitud.
    p(ev.e4.primer, { x: 860, y: 1700, zoom: 0.78 }),
    p(ev.e4.primer + mover + 6, { x: 1200, y: 3050, zoom: 0.64 }),
    p(ev.e5.elige, { x: 1200, y: 3080, zoom: 0.68 }),
    p(ev.e5.iluminan, { x: 1200, y: 3120, zoom: 0.76 }),
    // e6: sube de vuelta y entra al celular.
    p(ev.e6.segundo, { x: 1200, y: 3060, zoom: 0.76 }),
    p(ev.e6.segundo + mover + 6, CERCA_PANTALLA),
    p(ev.e7.detiene, { ...CERCA_PANTALLA, zoom: 1.46 }),
    // e8: se abre para ver al cliente junto al celular.
    p(ev.e8.tercero, { ...CERCA_PANTALLA, zoom: 1.44 }),
    p(ev.e8.tercero + mover, { x: 1470, y: 1380, zoom: 0.94 }),
    // e9: hacia la billetera, a donde vuela la venta.
    p(ev.e9.mensaje, { x: 1400, y: 1400, zoom: 0.92 }),
    p(ev.e9.venta, { x: 950, y: 1460, zoom: 0.8 }),
    // e10: plano general del mundo.
    p(ev.e10.asi, { x: 950, y: 1480, zoom: 0.8 }),
    p(ev.e10.asi + mover + 8, { x: 1200, y: 2050, zoom: 0.52 }),
    p(ev.e11.sigue, { x: 1200, y: 2000, zoom: 0.54 }),
    // e11: entra al celular, al perfil.
    p(ev.e11.sigue + mover + 4, CERCA_PANTALLA),
    p(total, { ...CERCA_PANTALLA, zoom: 1.4 }),
  ];
}

// ---------- multitud ----------
const FILAS = [
  { y: 2880, escala: 0.82, cantidad: 9 },
  { y: 3110, escala: 0.95, cantidad: 8 },
  { y: 3360, escala: 1.1, cantidad: 7 },
];
const ILUMINADOS = new Set(["0-2", "0-6", "1-1", "1-4", "2-3", "2-5"]);

// ---------- subtítulo karaoke corto (2-3 palabras) arriba ----------
function grupos(l: LineaDeTiempo): { desde: number; hasta: number; palabras: LineaDeTiempo["palabras"] }[] {
  const res: { desde: number; hasta: number; palabras: LineaDeTiempo["palabras"] }[] = [];
  let actual: LineaDeTiempo["palabras"] = [];
  l.palabras.forEach((p, i) => {
    actual.push(p);
    const cierra = /[.,:;?!…]$/.test(p.texto) || actual.length === 3 || i === l.palabras.length - 1 || l.palabras[i + 1].escena !== p.escena;
    if (cierra) {
      res.push({ desde: actual[0].desde, hasta: actual[actual.length - 1].hasta, palabras: actual });
      actual = [];
    }
  });
  return res;
}

function Subtitulo({ linea, frame, tema }: { linea: LineaDeTiempo; frame: number; tema: TemaGuion }) {
  const todos = useMemo(() => grupos(linea), [linea]);
  const grupo = [...todos].reverse().find((g) => frame >= g.desde) ?? todos[0];
  const luz = paletaNoche(tema).luz;
  return (
    // 14,5%: debajo de lo que tapa Instagram arriba (título "Reels" y la
    // cámara) -- ZONA_SEGURA.arriba = 14%.
    <div style={{ position: "absolute", top: "14.5%", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", gap: 14, background: "rgba(10,10,18,0.82)", borderRadius: 18, padding: "12px 24px", fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>
        {grupo.palabras.map((p, i) => {
          const activa = frame >= p.desde && frame < p.hasta + 2;
          return (
            <span key={i} style={{ padding: "0 8px", borderRadius: 10, background: activa ? luz : "transparent", color: activa ? colorTextoSobre(luz) : "#fff" }}>
              {quitarGlifosFueraDeFuentes(p.texto)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function PrototipoIlustrado({ tiempos, vozUrl, fotoUrl: fotoPropia, tema }: PropsPrototipoIlustrado) {
  const fotoUrl = fotoPropia ?? staticFile("demo-organico/foto-producto-ceramica.jpg");
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const linea = useMemo(() => construirLineaDeTiempo(tiempos, fps), [tiempos, fps]);
  const ev = useMemo(() => eventosDe(linea), [linea]);
  const paleta = paletaNoche(tema);
  const colorMarca = tema.color_primario;

  // Cámara + una deriva leve para que nunca esté quieta.
  const base = camaraEnCuadro(puntosCamara(ev, linea.duracionCuadros), frame);
  const cam = { x: base.x + Math.sin(frame / 40) * 8, y: base.y + Math.cos(frame / 52) * 8, zoom: base.zoom * (1 + Math.sin(frame / 70) * 0.01) };
  const transformMundo = `translate(${540 - cam.x * cam.zoom}px, ${960 - cam.y * cam.zoom}px) scale(${cam.zoom})`;

  // ---- pantalla del celular ----
  const centrar = (k: number) => k * ALTO_POST - (PANTALLA.alto - ALTO_BARRA_FEED - ALTO_POST) / 2;
  const scroll = claves(
    [
      [0, centrar(1) - 650],
      [ev.e1.anuncios, centrar(1)],
      [ev.e1.y, centrar(1) + 40],
      [ev.e1.compra, centrar(2) + 120],
      [ev.e2.gente, centrar(3) + 40],
      [ev.e2.anuncio, centrar(4)],
      [ev.e2.pasa, centrar(4) + 30],
      [ev.e2.largo, centrar(5) + 200],
      [ev.e6.segundo, centrar(5) + 520],
      [ev.e6.foto, centrar(6)],
      [ev.e6.detiene, centrar(6) + 20],
      [ev.e6.dedo + 10, centrar(6) + 380],
      [ev.e7.clara, centrar(6) + 360],
      [ev.e7.producto, centrar(6)],
      [ev.e10.asi, centrar(6)],
    ],
    frame
  );
  const posts: TipoPost[] = ["generico", "anuncio", "generico", "generico", "anuncio", "generico", "anuncio_apagado", "generico"];
  const brilloFoto = rampa(frame, ev.e7.clara, 12);
  const corazon = frame >= ev.e7.detiene ? spring({ frame: frame - ev.e7.detiene, fps, config: { damping: 9, stiffness: 160 } }) * (1 - rampa(frame, ev.e8.tercero - 6, 8)) : 0;

  const enChat = frame >= ev.e8.tercero && frame < ev.e10.asi;
  const mezclaChat = rampa(frame, ev.e8.tercero, 8) * (1 - rampa(frame, ev.e10.asi, 8));
  const mezclaPerfil = rampa(frame, ev.e11.sigue, 8);

  // "La gente ve tu anuncio": ojos que se abren sobre el anuncio.
  const ojos = [0, 1, 2].map((i) => (frame >= ev.e2.ve + i * 4 ? spring({ frame: frame - ev.e2.ve - i * 4, fps, config: { damping: 12 } }) : 0) * (1 - rampa(frame, ev.e2.pasa, 8)));

  // Chat: llegan mensajes, nadie responde; luego respuesta rápida -> venta.
  const msg1 = frame >= ev.e8.escriben ? spring({ frame: frame - ev.e8.escriben, fps, config: { damping: 13 } }) : 0;
  const msg2 = frame >= ev.e8.escriben + 8 ? spring({ frame: frame - ev.e8.escriben - 8, fps, config: { damping: 13 } }) : 0;
  const respuesta = frame >= ev.e9.responde ? spring({ frame: frame - ev.e9.responde, fps, config: { damping: 13 } }) : 0;
  const aBolsa = rampa(frame, ev.e9.vuelve, 8);

  // ---- billetera y monedas ----
  const salidas = [ev.e3.pasa, ev.e3.va, ev.e3.moneda];
  const inflado = 1 - 0.2 * salidas.filter((c) => frame >= c).length + 0.25 * rampa(frame, ev.e9.venta, 14) + 0.55 * rampa(frame, ev.e10.volver - 4, 16);
  const bocaBilletera = { x: BILLETERA.x + BILLETERA.ancho / 2, y: BILLETERA.y + 120 };

  // ---- multitud ----
  const barrido = frame >= ev.e4.hablas ? ((frame - ev.e4.hablas) / 40) % 1 : -1;
  const todosTenue = rampa(frame, ev.e4.mundo, 10) * (1 - rampa(frame, ev.e5.iluminan, 8));
  const elegidos = rampa(frame, ev.e5.iluminan, 10);

  // ---- cliente junto al celular (e8-e9) ----
  const clienteVisible = rampa(frame, ev.e8.tercero, 10);
  const clienteSeVa = rampa(frame, ev.e8.responde, 14) * (1 - rampa(frame, ev.e9.responde, 14));
  const clienteX = 1880 + 420 * clienteSeVa;

  // ---- mano ----
  const deslices: [number, number][] = [
    [0, ev.e1.anuncios],
    [ev.e1.y, ev.e1.compra],
    [ev.e2.pasa, ev.e2.largo],
    [ev.e6.dedo - 4, ev.e6.dedo + 12],
  ];
  const deslizando = deslices.find(([a, b]) => frame >= a && frame <= b + 4);
  const toques = [ev.e7.detiene, ev.e11.quiubot];
  const toque = toques.find((c) => frame >= c - 6 && frame <= c + 10);
  const manoVisible = (frame < ev.e2.gente + 10 || (frame >= ev.e6.segundo + 10 && frame < ev.e8.tercero) || frame >= ev.e11.sigue + 10) ? 1 : 0;
  const enPerfilMano = frame >= ev.e11.sigue;
  const manoY = deslizando ? 1150 - 650 * rampa(frame, deslizando[0], Math.max(6, deslizando[1] - deslizando[0])) : enPerfilMano ? 560 : 1000;
  const manoX = enPerfilMano ? 330 : 420;
  const manoEscala = toque !== undefined ? 1 - 0.18 * Math.sin(Math.min(1, Math.max(0, (frame - (toque - 6)) / 16)) * Math.PI) : 1;

  const siguiendo = frame >= ev.e11.quiubot + 3;

  return (
    <AbsoluteFill style={{ fontFamily: familiaDeFuente(tema.fuente), background: `linear-gradient(180deg, ${paleta.fondo} 0%, ${paleta.fondoProfundo} 100%)`, overflow: "hidden" }}>
      {/* Fondo con parallax: se mueve más lento que el mundo (profundidad). */}
      <AbsoluteFill style={{ transform: `translate(${-cam.x * 0.12}px, ${-cam.y * 0.08}px)` }}>
        {Array.from({ length: 18 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (i * 397) % 1500 - 100,
              top: (i * 613) % 2600 - 200,
              width: 120 + (i % 4) * 60,
              height: 120 + (i % 4) * 60,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${hexConAlfa(paleta.luz, 0.22)} 0%, ${hexConAlfa(paleta.luz, 0)} 70%)`,
            }}
          />
        ))}
      </AbsoluteFill>

      <div style={{ position: "absolute", left: 0, top: 0, width: 2400, height: 4000, transformOrigin: "0 0", transform: transformMundo }}>
        {/* Piso de la multitud */}
        <div style={{ position: "absolute", left: -400, top: 2700, width: 3200, height: 1300, background: `linear-gradient(180deg, ${hexConAlfa(paleta.luz, 0.06)} 0%, rgba(0,0,0,0.35) 100%)`, borderRadius: "50% 50% 0 0 / 12% 12% 0 0" }} />

        {/* Foco que barre a la multitud (e4) y se cierra sobre los elegidos (e5) */}
        {barrido >= 0 && frame < ev.e6.segundo && (() => {
          // Cono de luz desde arriba que barre a la multitud (e4) y se
          // abre para "todo el mundo"; se apaga cuando se iluminan los
          // elegidos (e5).
          const centroX = 300 + barrido * 1600;
          const ancho = 520 + 1400 * todosTenue;
          const intensidad = 0.32 * (1 - elegidos);
          return (
            <>
              {/* Polígono SVG (no clip-path CSS): mismo camino que ya funciona en el renderizador del navegador. */}
              <svg width={ancho} height={1250} viewBox={`0 0 ${ancho} 1250`} style={{ position: "absolute", left: centroX - ancho / 2, top: 2250 }}>
                <defs>
                  <linearGradient id="cono" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#ffffff" stopOpacity={intensidad} />
                    <stop offset="1" stopColor="#ffffff" stopOpacity={intensidad * 0.35} />
                  </linearGradient>
                </defs>
                <polygon points={`${ancho * 0.42},0 ${ancho * 0.58},0 ${ancho},1250 0,1250`} fill="url(#cono)" />
              </svg>
              <div style={{ position: "absolute", left: centroX - ancho / 2, top: 3330, width: ancho, height: 260, borderRadius: "50%", background: `radial-gradient(ellipse, ${hexConAlfa("#ffffff", intensidad * 0.8)} 0%, rgba(255,255,255,0) 70%)` }} />
            </>
          );
        })()}

        {FILAS.map((fila, f) =>
          Array.from({ length: fila.cantidad }, (_, k) => {
            const x = 1200 + (k - (fila.cantidad - 1) / 2) * 230 * fila.escala + (f % 2) * 40;
            const elegido = ILUMINADOS.has(`${f}-${k}`);
            const bajoElFoco = barrido >= 0 && Math.abs(x - (300 + barrido * 1600)) < 260 + 700 * todosTenue && frame < ev.e5.iluminan ? 0.45 : 0;
            const luz = elegido ? Math.max(elegidos, todosTenue * 0.25, bajoElFoco) : Math.max(todosTenue * 0.25, bajoElFoco) * (1 - elegidos);
            const mirar = elegido ? rampa(frame, ev.e5.comprarte, 10) : 0;
            const opacidad = elegido ? 1 : 1 - 0.45 * elegidos;
            return <Persona key={`${f}-${k}`} x={x} y={fila.y} escala={fila.escala} luz={luz} colorLuz={paleta.luz} mirarArriba={mirar} opacidad={opacidad} />;
          })
        )}

        {/* Gráfica que sube detrás del celular (e10) */}
        <Grafica x={1640} y={640} avance={rampa(frame, ev.e10.empieza, 26)} color={paleta.luz} />

        <Billetera inflado={Math.max(0.2, Math.min(1.1, inflado))} />

        {/* Monedas que se van (e3) -- la última sigue cayendo hacia la multitud (e4) */}
        {salidas.map((c, i) => {
          if (frame < c) return null;
          const t = (frame - c) / fps;
          const ultima = i === salidas.length - 1;
          const y = bocaBilletera.y + 900 * t * t + 120 * t;
          const yMax = ultima ? 2780 : 1900;
          return <Moneda key={i} x={bocaBilletera.x + (i - 1) * 70 + 60 * t} y={Math.min(y, yMax)} rotacion={t * 320} opacidad={ultima ? 1 - rampa(frame, ev.e5.elige, 10) : 1 - rampa(frame, c + 40, 14)} />;
        })}

        {/* La venta vuelve como moneda a la billetera (e9) */}
        {frame >= ev.e9.venta && frame < ev.e9.venta + 30 && (
          <Moneda
            x={CENTRO_CELULAR.x + (bocaBilletera.x - CENTRO_CELULAR.x) * rampa(frame, ev.e9.venta, 20)}
            y={CENTRO_CELULAR.y - 200 + (bocaBilletera.y - CENTRO_CELULAR.y + 200) * rampa(frame, ev.e9.venta, 20) - Math.sin(rampa(frame, ev.e9.venta, 20) * Math.PI) * 260}
            tamano={130}
            rotacion={frame * 8}
          />
        )}

        {/* El presupuesto empieza a volver (e10): lluvia de monedas hacia la billetera */}
        {Array.from({ length: 6 }, (_, i) => {
          const inicio = ev.e10.empieza + i * 4;
          if (frame < inicio || frame > inicio + 26) return null;
          const t = rampa(frame, inicio, 20);
          const desdeX = 1200 + (i - 2.5) * 260;
          const desdeY = 2850;
          return <Moneda key={`v${i}`} x={desdeX + (bocaBilletera.x - desdeX) * t} y={desdeY + (bocaBilletera.y - desdeY) * t - Math.sin(t * Math.PI) * 500} tamano={100} rotacion={frame * 9 + i * 40} opacidad={1 - rampa(frame, inicio + 20, 6)} />;
        })}

        {/* Cliente junto al celular (e8-e9): se va si nadie responde */}
        {clienteVisible > 0 && frame < ev.e10.asi + 10 && (
          <Persona x={clienteX} y={1960} escala={1.6} luz={0.55} colorLuz={paleta.luz} opacidad={clienteVisible * (1 - 0.85 * clienteSeVa) * (1 - rampa(frame, ev.e10.asi, 10))} />
        )}
        {frame >= ev.e8.escriben && frame < ev.e9.responde + 6 && (
          <Reloj x={1880} y={1180} tamano={260} angulo={(frame - ev.e8.escriben) * (frame >= ev.e8.nadie ? 26 : 10)} aparicion={rampa(frame, ev.e8.escriben, 8) * (1 - rampa(frame, ev.e9.responde, 6))} />
        )}

        <Celular>
          {/* Feed */}
          <div style={{ position: "absolute", inset: 0, opacity: 1 - Math.max(mezclaChat, mezclaPerfil) }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: ALTO_BARRA_FEED, bottom: 0, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: -scroll, height: posts.length * ALTO_POST }}>
                {posts.map((tipo, i) => (
                  <Post key={i} tipo={tipo} indice={i} fotoUrl={fotoUrl} brillo={brilloFoto} colorMarca={colorMarca} corazon={i === 6 ? corazon : 0} />
                ))}
              </div>
              {/* Ojos: "la gente ve tu anuncio" */}
              {ojos.map((o, i) =>
                o > 0 ? (
                  <svg key={i} viewBox="0 0 24 24" width={170} height={170} style={{ position: "absolute", left: 70 + i * 190, top: 520 + (i % 2) * 70, transform: `scale(${o})`, opacity: o, filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.35))" }}>
                    <circle cx="12" cy="12" r="11" fill="#ffffff" />
                    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" fill="none" stroke="#2a2a33" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="3.2" fill="#2a2a33" />
                  </svg>
                ) : null
              )}
            </div>
            <BarraSuperiorFeed />
          </div>

          {/* Chat */}
          {(enChat || mezclaChat > 0) && (
            <div style={{ position: "absolute", inset: 0, opacity: mezclaChat, background: "#f7f7fa", display: "flex", flexDirection: "column" }}>
              <div style={{ height: ALTO_BARRA_FEED, background: "#fff", borderBottom: "2px solid #eee", display: "flex", alignItems: "flex-end", gap: 20, padding: "0 30px 22px" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#4b4b5c" }} />
                <div style={{ width: 200, height: 22, borderRadius: 11, background: "#2a2a33", marginBottom: 20 }} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, padding: "40px 30px" }}>
                <Burbuja ancho={420} aparicion={msg1} />
                <Burbuja ancho={360} aparicion={msg2} />
                <div style={{ position: "relative", alignSelf: "flex-end" }}>
                  <div style={{ opacity: 1 - aBolsa, transform: `scale(${1 - 0.5 * aBolsa})`, transformOrigin: "100% 50%" }}>
                    <Burbuja propia ancho={400} aparicion={respuesta} color="#0F7A3C" />
                  </div>
                  {aBolsa > 0 && (
                    <svg viewBox="0 0 24 24" width={190} height={190} style={{ position: "absolute", right: 80, top: -20, transform: `scale(${aBolsa})`, opacity: 1 - rampa(frame, ev.e9.venta, 6), filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.25))" }}>
                      <path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z" fill={colorMarca} />
                      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke={colorMarca} strokeWidth="1.8" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Perfil de la marca (e11) */}
          {mezclaPerfil > 0 && (
            <div style={{ position: "absolute", inset: 0, opacity: mezclaPerfil, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 40, padding: `${ALTO_BARRA_FEED + 40}px 40px 30px` }}>
                <div style={{ width: 200, height: 200, borderRadius: "50%", background: `linear-gradient(145deg, ${colorMarca}, ${tema.color_secundario})`, display: "flex", alignItems: "center", justifyContent: "center", color: colorTextoSobre(colorMarca), fontSize: 100, fontWeight: 900 }}>
                  {(tema.nombre_marca ?? "Q").slice(0, 1)}
                </div>
                <div style={{ display: "flex", gap: 34 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 80, height: 28, borderRadius: 14, background: "#2a2a33" }} />
                      <div style={{ width: 100, height: 18, borderRadius: 9, background: "#d9d9df" }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: "0 40px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ width: 300, height: 26, borderRadius: 13, background: "#2a2a33" }} />
                <div style={{ width: "80%", height: 18, borderRadius: 9, background: "#d9d9df" }} />
              </div>
              <div style={{ margin: "40px 40px", height: 110, borderRadius: 24, background: siguiendo ? "#0F7A3C" : colorMarca, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontSize: 48, fontWeight: 800, transform: `scale(${siguiendo ? 1 + 0.05 * (1 - rampa(frame, ev.e11.quiubot + 3, 8)) : 1})` }}>
                {siguiendo ? "Siguiendo" : "Seguir"}
                {siguiendo && <IconoCheck tamano={48} color="#fff" />}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, padding: "0 6px" }}>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} style={{ height: 230, background: i === 0 ? `url(${fotoUrl}) center/cover` : ["#a18cd1", "#fbc2eb", "#84fab0", "#fccb90", "#8fd3f4"][i % 5] }} />
                ))}
              </div>
            </div>
          )}

          {/* Mano: desliza el feed y toca */}
          {manoVisible > 0 && (
            <div style={{ position: "absolute", left: manoX, top: manoY, transform: `scale(${manoEscala}) rotate(-12deg)`, transformOrigin: "30% 10%", filter: "drop-shadow(0 18px 26px rgba(0,0,0,0.35))" }}>
              <IconoMano tamano={240} />
            </div>
          )}
        </Celular>
      </div>

      <Subtitulo linea={linea} frame={frame} tema={tema} />

      {/* Voz: cada escena reproduce sus tramos ya compactados (mismo
          criterio que ReelAutomatico). */}
      {vozUrl && linea.escenas.map((e) => {
        const tramos = tiempos.segmentosAudio.find((s) => s.escena_id === e.id)?.tramos ?? [];
        return (
          <Sequence key={e.id} from={e.desde} durationInFrames={Math.max(1, e.duracion)}>
            {tramos.map((tramo, i) => {
              const desde = Math.round((tramo.compactado.inicio_s - e.inicio_s) * fps);
              const dur = Math.round((tramo.compactado.fin_s - tramo.compactado.inicio_s) * fps);
              if (dur <= 0) return null;
              return (
                <Sequence key={i} from={desde} durationInFrames={dur}>
                  <CapaVoz url={vozUrl} trimBefore={Math.round(tramo.original.inicio_s * fps)} trimAfter={Math.round(tramo.original.fin_s * fps)} duracionCuadros={dur} fps={fps} />
                </Sequence>
              );
            })}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
