// Prototipo de "reel ilustrado" (18 nov 2026): "Por qué tus anuncios no
// venden". Un solo mundo 2.5D (celular, billetera, multitud, cliente,
// gráfica) y una cámara que se mueve por él; cada cambio está amarrado a
// una palabra de la narración. Casi sin texto: solo un subtítulo karaoke
// corto arriba. No toca /contenido ni los visuales de siempre.
//
// Ronda 2: lo que la voz nombra ocupa al menos media pantalla (la cámara
// se acerca, ver mundo.ts), feed y chat con contenido real, foto apagada
// vs. clara con contraste fuerte, y fondo con piso, horizonte y luz.
import { useMemo } from "react";
import { AbsoluteFill, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { familiaDeFuente } from "../fuentes";
import { colorTextoSobre, hexConAlfa, type TemaGuion } from "../tema";
import { paletaNoche } from "../estilos/estilos";
import { CapaVoz } from "../visuales/CapaVoz";
import { IconoMano, IconoCheck } from "../iconos";
import { quitarGlifosFueraDeFuentes } from "../glifos";
import { camaraEnCuadro, construirLineaDeTiempo, type LineaDeTiempo, type TiemposIlustrado } from "./tiempoIlustrado";
import { BILLETERA, BOCA_BILLETERA, CELULAR, CLIENTE, ILUMINADOS, MULTITUD, PANTALLA, RELOJ, TAM_MONEDA, eventosDe, puntosCamara } from "./mundo";
import { ALTO_BARRA_FEED, ALTO_POST, BarraSuperiorFeed, Billetera, Burbuja, Celular, Fondo, Grafica, Moneda, Persona, Post, Reloj, SombraPiso, type TipoPost } from "./Objetos";
import { Ilustracion, IconoAtras, IconoBolsa, IconoRayo, IconoSaludo } from "./Ilustraciones";

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

const CENTRO_CELULAR = { x: CELULAR.x + CELULAR.ancho / 2, y: CELULAR.y + CELULAR.alto / 2 };
const VERDE_RESPUESTA = "#0F7A3C";

export function PrototipoIlustrado({ tiempos, vozUrl, fotoUrl: fotoPropia, tema }: PropsPrototipoIlustrado) {
  const fotoUrl = fotoPropia ?? staticFile("demo-organico/foto-producto-ceramica.jpg");
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const linea = useMemo(() => construirLineaDeTiempo(tiempos, fps), [tiempos, fps]);
  const ev = useMemo(() => eventosDe(linea), [linea]);
  const puntos = useMemo(() => puntosCamara(ev, linea.duracionCuadros), [ev, linea.duracionCuadros]);
  const paleta = paletaNoche(tema);
  const colorMarca = tema.color_primario;
  const aparece = (desde: number, damping = 13) => (frame >= desde ? spring({ frame: frame - desde, fps, config: { damping } }) : 0);

  // Cámara + una deriva leve para que nunca esté quieta.
  const base = camaraEnCuadro(puntos, frame);
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
  const posts: TipoPost[] = ["comida", "anuncio", "paisaje", "mascota", "anuncio", "ropa", "anuncio_apagado", "comida"];
  const brilloFoto = rampa(frame, ev.e7.clara, 12);
  const corazon = frame >= ev.e7.detiene ? spring({ frame: frame - ev.e7.detiene, fps, config: { damping: 9, stiffness: 160 } }) * (1 - rampa(frame, ev.e8.tercero - 6, 8)) : 0;

  const enChat = frame >= ev.e8.tercero && frame < ev.e10.asi;
  const mezclaChat = rampa(frame, ev.e8.tercero, 8) * (1 - rampa(frame, ev.e10.asi, 8));
  const mezclaPerfil = rampa(frame, ev.e11.sigue, 8);

  // "La gente ve tu anuncio": ojos que se abren sobre el anuncio.
  const ojos = [0, 1, 2].map((i) => aparece(ev.e2.ve + i * 4, 12) * (1 - rampa(frame, ev.e2.pasa, 8)));

  // Chat: llegan mensajes, nadie responde; luego respuesta rápida -> venta.
  const msgHola = aparece(ev.e8.te);
  const msgPrecio = aparece(ev.e8.escriben);
  const msgEnvio = aparece(ev.e8.escriben + 6);
  const respuesta = aparece(ev.e9.responde);
  const leido = frame >= ev.e9.rapido + 8;
  const msgLoQuiero = aparece(ev.e9.mensaje);
  const aBolsa = rampa(frame, ev.e9.vuelve, 8);

  // ---- billetera y monedas ----
  const salidas = [ev.e3.pasa, ev.e3.va, ev.e3.moneda];
  const inflado = 1 - 0.2 * salidas.filter((c) => frame >= c).length + 0.25 * rampa(frame, ev.e9.venta + 14, 10) + 0.55 * rampa(frame, ev.e10.volver - 4, 16);

  // ---- multitud ----
  const barrido = frame >= ev.e4.hablas ? ((frame - ev.e4.hablas) / 40) % 1 : -1;
  const centroFoco = 150 + barrido * 1700;
  const todosTenue = rampa(frame, ev.e4.mundo, 10) * (1 - rampa(frame, ev.e5.iluminan, 8));
  const elegidos = rampa(frame, ev.e5.iluminan, 10);

  // ---- cliente y reloj (e8): espera, nadie responde, se va ----
  const relojVisible = rampa(frame, ev.e8.escriben, 8) * (1 - rampa(frame, ev.e9.responde, 8));
  const clienteSeVa = rampa(frame, ev.e8.responde, 26);
  const pasos = Math.abs(Math.sin((frame - ev.e8.responde) / 3)) * 30 * Math.min(1, clienteSeVa * 4);

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
  const manoVisible = frame < ev.e2.gente + 10 || (frame >= ev.e6.segundo + 10 && frame < ev.e8.tercero) || frame >= ev.e11.sigue + 10;
  const enPerfilMano = frame >= ev.e11.sigue;
  const manoY = deslizando ? 1150 - 650 * rampa(frame, deslizando[0], Math.max(6, deslizando[1] - deslizando[0])) : enPerfilMano ? 560 : 1000;
  const manoX = enPerfilMano ? 330 : 420;
  const manoEscala = toque !== undefined ? 1 - 0.18 * Math.sin(Math.min(1, Math.max(0, (frame - (toque - 6)) / 16)) * Math.PI) : 1;

  const siguiendo = frame >= ev.e11.quiubot + 3;
  // Bolsa del chat en coordenadas del mundo (de ahí sale la venta).
  const origenVenta = { x: CELULAR.x + CELULAR.borde + 170, y: CELULAR.y + CELULAR.borde + 900 };

  return (
    <AbsoluteFill style={{ fontFamily: familiaDeFuente(tema.fuente), background: paleta.fondoProfundo, overflow: "hidden" }}>
      <Fondo camX={cam.x} camY={cam.y} fondo={paleta.fondo} profundo={paleta.fondoProfundo} luz={paleta.luz} />

      <div style={{ position: "absolute", left: 0, top: 0, width: 2400, height: 4000, transformOrigin: "0 0", transform: transformMundo }}>
        {/* Foco que barre a la multitud (e4); se apaga cuando se iluminan los elegidos (e5) */}
        {barrido >= 0 && frame < ev.e6.segundo && (() => {
          const ancho = 620 + 1500 * todosTenue;
          const intensidad = 0.34 * (1 - elegidos);
          return (
            <>
              {/* Polígono SVG (no clip-path CSS): mismo camino que ya funciona en el renderizador del navegador. */}
              <svg width={ancho} height={1500} viewBox={`0 0 ${ancho} 1500`} style={{ position: "absolute", left: centroFoco - ancho / 2, top: 2000 }}>
                <defs>
                  <linearGradient id="cono" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#ffffff" stopOpacity={intensidad} />
                    <stop offset="1" stopColor="#ffffff" stopOpacity={intensidad * 0.35} />
                  </linearGradient>
                </defs>
                <polygon points={`${ancho * 0.42},0 ${ancho * 0.58},0 ${ancho},1500 0,1500`} fill="url(#cono)" />
              </svg>
              <div style={{ position: "absolute", left: centroFoco - ancho / 2, top: 3330, width: ancho, height: 300, borderRadius: "50%", background: `radial-gradient(ellipse, ${hexConAlfa("#ffffff", intensidad * 0.8)} 0%, rgba(255,255,255,0) 70%)` }} />
            </>
          );
        })()}

        {MULTITUD.map((p, i) => {
          const elegido = ILUMINADOS.has(p.id);
          const bajoElFoco = barrido >= 0 && Math.abs(p.x - centroFoco) < 280 + 750 * todosTenue && frame < ev.e5.iluminan ? 0.5 : 0;
          const luz = elegido ? Math.max(elegidos, todosTenue * 0.3, bajoElFoco) : Math.max(todosTenue * 0.3, bajoElFoco) * (1 - elegidos);
          const mirar = elegido ? rampa(frame, ev.e5.comprarte, 10) : 0;
          const opacidad = elegido ? 1 : 1 - 0.5 * elegidos;
          return <Persona key={p.id} x={p.x} pies={p.pies} escala={p.escala} luz={luz} colorLuz={paleta.luz} mirarArriba={mirar} opacidad={opacidad} variante={i * 3 + p.fila} />;
        })}

        {/* Gráfica que sube sobre la billetera (e10) */}
        <Grafica avance={rampa(frame, ev.e10.empieza, 26)} color={paleta.luz} />

        <SombraPiso cx={BILLETERA.x + BILLETERA.ancho / 2} y={BILLETERA.y + BILLETERA.alto} ancho={BILLETERA.ancho * 1.15} />
        <Billetera inflado={Math.max(0.2, Math.min(1.1, inflado))} />

        {/* Monedas grandes que se van (e3): saltan de la billetera y caen; la última sigue hacia la multitud (e4) */}
        {salidas.map((c, i) => {
          if (frame < c) return null;
          const t = (frame - c) / fps;
          const ultima = i === salidas.length - 1;
          const y = BOCA_BILLETERA.y - 900 * t + 1500 * t * t;
          return (
            <Moneda
              key={i}
              x={BOCA_BILLETERA.x + (i - 1) * 140 + 160 * t}
              y={Math.min(y, ultima ? 2700 : 2300)}
              tamano={TAM_MONEDA}
              rotacion={t * 320}
              opacidad={ultima ? 1 - rampa(frame, ev.e5.elige, 10) : 1 - rampa(frame, c + 40, 12)}
            />
          );
        })}

        {/* La venta vuelve como moneda a la billetera (e9) */}
        {frame >= ev.e9.venta && frame < ev.e9.venta + 30 && (() => {
          const t = rampa(frame, ev.e9.venta, 22);
          return (
            <Moneda
              x={origenVenta.x + (BOCA_BILLETERA.x - origenVenta.x) * t}
              y={origenVenta.y + (BOCA_BILLETERA.y - origenVenta.y) * t - Math.sin(t * Math.PI) * 300}
              tamano={TAM_MONEDA}
              rotacion={frame * 8}
              opacidad={1 - rampa(frame, ev.e9.venta + 22, 6)}
            />
          );
        })()}

        {/* El presupuesto empieza a volver (e10): lluvia de monedas grandes hacia la billetera */}
        {Array.from({ length: 5 }, (_, i) => {
          const inicio = ev.e10.empieza + i * 4;
          if (frame < inicio || frame > inicio + 26) return null;
          const t = rampa(frame, inicio, 20);
          const desdeX = BOCA_BILLETERA.x + (i - 2) * 160;
          const desdeY = 520;
          return <Moneda key={`v${i}`} x={desdeX + (BOCA_BILLETERA.x - desdeX) * t} y={desdeY + (BOCA_BILLETERA.y - desdeY) * t} tamano={200} rotacion={frame * 9 + i * 40} opacidad={1 - rampa(frame, inicio + 20, 6)} />;
        })}

        {/* Cliente grande que espera junto a un reloj grande (e8); se va si nadie responde */}
        {frame >= ev.e8.tercero && frame < ev.e9.responde + 30 && (
          <>
            <SombraPiso cx={CLIENTE.x + 900 * clienteSeVa} y={CLIENTE.pies} ancho={140 * CLIENTE.escala * 1.1} />
            <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${900 * clienteSeVa}px, ${-pasos}px)` }}>
              <Persona x={CLIENTE.x} pies={CLIENTE.pies} escala={CLIENTE.escala} luz={0.9} colorLuz={paleta.luz} variante={3} conCelular opacidad={1 - rampa(frame, ev.e8.responde + 18, 10)} />
            </div>
          </>
        )}
        {relojVisible > 0 && (
          <Reloj cx={RELOJ.cx} cy={RELOJ.cy} tamano={RELOJ.tamano} angulo={(frame - ev.e8.escriben) * (frame >= ev.e8.nadie ? 30 : 8)} aparicion={relojVisible} />
        )}

        <SombraPiso cx={CENTRO_CELULAR.x} y={CELULAR.y + CELULAR.alto + 10} ancho={CELULAR.ancho * 1.25} />
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
                  <svg key={i} viewBox="0 0 24 24" width={170} height={170} style={{ position: "absolute", left: 70 + i * 190, top: 4 * ALTO_POST - scroll + 180 + (i % 2) * 90, transform: `scale(${o})`, opacity: o, filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.35))" }}>
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
            <div style={{ position: "absolute", inset: 0, opacity: mezclaChat, background: "#F7F7FA", display: "flex", flexDirection: "column", fontFamily: "Poppins, sans-serif" }}>
              <div style={{ height: ALTO_BARRA_FEED + 30, background: "#fff", borderBottom: "2px solid #eee", display: "flex", alignItems: "flex-end", gap: 18, padding: "0 26px 22px" }}>
                <IconoAtras tamano={46} />
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#D65DB1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800 }}>C</div>
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color: "#1c1c22" }}>Camila</span>
                  <span style={{ fontSize: 22, color: "#2B7A3F", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 6, background: "#2BB24C", display: "inline-block" }} />
                    En línea
                  </span>
                </div>
              </div>
              {/* Lugar de cada mensaje reservado desde el inicio: nada se corre cuando llega otro. */}
              <div style={{ display: "flex", flexDirection: "column", gap: 22, padding: "70px 30px 0" }}>
                <Burbuja aparicion={msgHola} hora="10:42">
                  Hola <IconoSaludo tamano={46} />
                </Burbuja>
                <Burbuja aparicion={msgPrecio} hora="10:42">
                  ¿Precio?
                </Burbuja>
                <Burbuja aparicion={msgEnvio} hora="10:43">
                  ¿Tienen envío?
                </Burbuja>
                <div style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, opacity: respuesta }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 20, background: "#FFF4D1", color: "#7A4D00", fontSize: 24, fontWeight: 700 }}>
                    <IconoRayo tamano={28} color="#E8A100" />
                    Al instante
                  </div>
                  <Burbuja propia aparicion={respuesta} color={VERDE_RESPUESTA} hora="10:43" leido={leido}>
                    ¡Sí! Envío gratis
                  </Burbuja>
                </div>
                <div style={{ position: "relative", alignSelf: "flex-start" }}>
                  <div style={{ opacity: 1 - aBolsa, transform: `scale(${1 - 0.6 * aBolsa})`, transformOrigin: "0% 50%" }}>
                    <Burbuja aparicion={msgLoQuiero} hora="10:44">
                      ¡Lo quiero!
                    </Burbuja>
                  </div>
                  {aBolsa > 0 && <IconoBolsa tamano={190} color={colorMarca} estilo={{ position: "absolute", left: 40, top: -40, transform: `scale(${aBolsa})`, opacity: 1 - rampa(frame, ev.e9.venta, 6), filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.25))" }} />}
                </div>
              </div>
            </div>
          )}

          {/* Perfil de la marca (e11) */}
          {mezclaPerfil > 0 && (
            <div style={{ position: "absolute", inset: 0, opacity: mezclaPerfil, background: "#fff", fontFamily: "Poppins, sans-serif", color: "#1c1c22" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 30, padding: `${ALTO_BARRA_FEED + 40}px 36px 30px` }}>
                <div style={{ width: 200, height: 200, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(145deg, ${colorMarca}, ${tema.color_secundario})`, display: "flex", alignItems: "center", justifyContent: "center", color: colorTextoSobre(colorMarca), fontSize: 100, fontWeight: 900 }}>
                  {(tema.nombre_marca ?? "Q").slice(0, 1)}
                </div>
                <div style={{ display: "flex", flex: 1, justifyContent: "space-between" }}>
                  {[
                    ["128", "posts"],
                    ["4.210", "seguidores"],
                    ["310", "seguidos"],
                  ].map(([n, t]) => (
                    <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.2 }}>
                      <span style={{ fontSize: 36, fontWeight: 800 }}>{n}</span>
                      <span style={{ fontSize: 21, color: "#5b5b66" }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: "0 36px", display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
                <span style={{ fontSize: 32, fontWeight: 800 }}>{tema.instagramUsuario ?? tema.nombre_marca}</span>
                <span style={{ fontSize: 26, color: "#3b3b45" }}>Trucos de anuncios para tu negocio</span>
              </div>
              <div style={{ margin: "26px 36px 36px", height: 110, borderRadius: 24, background: siguiendo ? "#0F7A3C" : colorMarca, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontSize: 48, fontWeight: 800, transform: `scale(${siguiendo ? 1 + 0.05 * (1 - rampa(frame, ev.e11.quiubot + 3, 8)) : 1})` }}>
                {siguiendo ? "Siguiendo" : "Seguir"}
                {siguiendo && <IconoCheck tamano={48} color="#fff" />}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, padding: "0 6px" }}>
                {(["anuncio", "comida", "paisaje", "mascota", "ropa", "comida"] as const).map((t, i) => (
                  <div key={i} style={{ height: 230, overflow: "hidden", background: i === 0 ? `url(${fotoUrl}) center/cover` : undefined }}>
                    {t !== "anuncio" && <Ilustracion tipo={t} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mano: desliza el feed y toca */}
          {manoVisible && (
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
