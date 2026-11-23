// Pantallas del celular del reel ilustrado (feed, chat, perfil). El
// celular es una sola isla; el motor decide qué pantalla se ve. Cada
// pantalla arma su animación desde los cuadros de sus acciones.
import { spring } from "remotion";
import { colorTextoSobre } from "../../../tema";
import { IconoCheck } from "../../../iconos";
import { ALTO_BARRA_FEED, ALTO_POST, BarraSuperiorFeed, Burbuja, Post, type TipoPost } from "../../Objetos";
import { IconoBolsa } from "../../Ilustraciones";
import { ImagenFija } from "../../imagenesFijas";
import { claves, latido, primero, rampa } from "../animacion";
import { PANTALLA } from "../catalogo";
import type { PropsEscena } from "./tipos";

// ---------- Feed ----------
const POSTS: TipoPost[] = ["comida", "anuncio", "paisaje", "mascota", "anuncio", "ropa", "anuncio", "comida", "paisaje", "anuncio", "mascota", "ropa", "anuncio", "comida"];
const centrar = (k: number) => k * ALTO_POST - (PANTALLA.alto - ALTO_BARRA_FEED - ALTO_POST) / 2;
const siguienteAnuncio = (desde: number) => {
  const i = POSTS.findIndex((t, k) => k > desde && t === "anuncio");
  return i === -1 ? Math.min(POSTS.length - 1, Math.floor(desde) + 1) : i;
};
const ACCIONES_CON_MANO = new Set(["aparece_anuncio", "pasa_de_largo", "desliza", "se_detiene"]);
const ACCIONES_QUE_DESLIZAN = new Set(["aparece_anuncio", "pasa_de_largo", "desliza", "foto_apagada", "foto_se_aclara", "vuelve"]);

type EstadoFeed = {
  pares: [number, number][]; // [cuadro, posición en publicaciones]
  fotoApagada: number | null; // índice del anuncio con la foto apagada
  corazones: { post: number; cuadro: number }[];
  ojos: { post: number; cuadro: number; hasta: number }[];
  mano: { cuadro: number; accion: string }[];
};

// Puro: de la lista de acciones del feed (en orden) a la coreografía.
export function coreografiaFeed(acciones: { accion: string; cuadro: number }[]): EstadoFeed {
  const ordenadas = [...acciones].sort((a, b) => a.cuadro - b.cuadro);
  let pos = 0;
  const historial: number[] = [];
  const res: EstadoFeed = { pares: [], fotoApagada: null, corazones: [], ojos: [], mano: [] };
  let ultimoCuadro = 0;
  ordenadas.forEach((a, i) => {
    const desde = i === 0 ? 0 : Math.max(a.cuadro, ultimoCuadro);
    let destino = pos;
    switch (a.accion) {
      case "aparece_anuncio":
        destino = siguienteAnuncio(Math.round(pos));
        if (i === 0) pos = destino - 0.7;
        break;
      case "pasa_de_largo":
        destino = pos + 1.25;
        break;
      case "desliza":
        destino = Math.round(pos) + 1;
        break;
      case "foto_apagada":
        destino = siguienteAnuncio(Math.round(pos));
        res.fotoApagada = destino;
        break;
      case "foto_se_aclara":
        destino = res.fotoApagada ?? Math.round(pos);
        break;
      case "vuelve":
        destino = historial[historial.length - 1] ?? pos;
        break;
      case "se_detiene":
        destino = Math.round(pos);
        res.corazones.push({ post: destino, cuadro: a.cuadro });
        break;
      case "micro":
        // Se desliza un poco, sin cambiar de publicación.
        destino = Math.round(pos + 0.12) === Math.round(pos) ? pos + 0.12 : pos - 0.12;
        break;
      case "lo_miran":
        res.ojos.push({ post: Math.round(pos), cuadro: a.cuadro, hasta: ordenadas[i + 1]?.cuadro ?? Infinity });
        break;
    }
    if (i === 0) res.pares.push([0, pos]);
    if (ACCIONES_QUE_DESLIZAN.has(a.accion) || destino !== pos) {
      if (Math.round(pos) !== Math.round(destino)) historial.push(Math.round(pos));
      res.pares.push([desde, pos]);
      res.pares.push([desde + 14, destino]);
      ultimoCuadro = desde + 14;
      pos = destino;
    }
    if (ACCIONES_CON_MANO.has(a.accion)) res.mano.push({ cuadro: i === 0 ? 0 : a.cuadro, accion: a.accion });
  });
  if (res.pares.length === 0) res.pares.push([0, 0]);
  return res;
}

export function PantallaFeed({ frame, fps, d, marca, fotoUrl, recursos }: PropsEscena) {
  const acciones = Object.entries(d).flatMap(([accion, cuadros]) => cuadros.map((cuadro) => ({ accion, cuadro })));
  const c = coreografiaFeed(acciones);
  const pos = claves(c.pares, frame);
  const scroll = centrar(pos);
  const aclara = primero(d.foto_se_aclara);
  // Solo se dibujan las publicaciones que se ven (rendimiento).
  const visibles = POSTS.map((tipo, i) => ({ tipo, i })).filter(({ i }) => (i + 1) * ALTO_POST > scroll && i * ALTO_POST < scroll + PANTALLA.alto);
  const mano = [...c.mano].reverse().find((m) => frame >= m.cuadro - 10) ?? null;
  // La mano aparece para el gesto y se va al terminarlo (no tapa lo que sigue).
  const manoVisible = mano !== null && frame <= mano.cuadro + 26;
  const opacidadMano = mano ? 1 - rampa(frame, mano.cuadro + 18, 8) : 0;
  const tocando = mano?.accion === "se_detiene";
  const progresoMano = mano ? rampa(frame, mano.cuadro, 14) : 0;
  const manoY = tocando ? 1000 : 1150 - 650 * progresoMano;
  const manoEscala = tocando && mano ? 1 - 0.18 * Math.sin(Math.min(1, Math.max(0, (frame - (mano.cuadro - 6)) / 16)) * Math.PI) : 1;
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: ALTO_BARRA_FEED, bottom: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: -scroll, height: POSTS.length * ALTO_POST }}>
          {visibles.map(({ tipo, i }) => {
            const corazon = c.corazones.find((h) => h.post === i && frame >= h.cuadro);
            return (
              <Post
                key={i}
                tipo={i === c.fotoApagada ? "anuncio_apagado" : tipo}
                indice={i}
                fotoUrl={fotoUrl}
                fotoApagadaUrl={recursos.fotoApagada}
                fotoClaraUrl={recursos.fotoClara}
                brillo={rampa(frame, aclara, 12)}
                colorMarca={marca.colorMarca}
                nombreTienda={marca.nombreTienda}
                corazon={corazon ? spring({ frame: frame - corazon.cuadro, fps, config: { damping: 9, stiffness: 160 } }) : 0}
              />
            );
          })}
        </div>
        {/* Ojos sobre la publicación: "la gente ve tu anuncio" */}
        {c.ojos.flatMap((o) =>
          [0, 1, 2].map((k) => {
            const v = (frame >= o.cuadro + k * 4 ? spring({ frame: frame - o.cuadro - k * 4, fps, config: { damping: 12 } }) : 0) * (1 - rampa(frame, o.hasta, 8));
            if (v <= 0.01) return null;
            return (
              <div key={`${o.cuadro}-${k}`} style={{ position: "absolute", left: 70 + k * 190, top: o.post * ALTO_POST - scroll + 180 + (k % 2) * 90, width: 170, height: 170, transform: `scale(${v})`, opacity: v }}>
<ImagenFija nombre="ojo" ancho={170} alto={170} />
              </div>
            );
          })
        )}
      </div>
      <BarraSuperiorFeed />
      {manoVisible && <Mano x={420} y={manoY} escala={manoEscala} opacidad={opacidadMano} />}
    </>
  );
}

function Mano({ x, y, escala, opacidad = 1 }: { x: number; y: number; escala: number; opacidad?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: opacidad, transform: `scale(${escala}) rotate(-12deg)`, transformOrigin: "30% 10%" }}>
      <ImagenFija nombre="mano" ancho={240} alto={240} />
    </div>
  );
}

// ---------- Chat ----------
const VERDE_RESPUESTA = "#0F7A3C";
const HORAS = ["10:42", "10:42", "10:43", "10:43", "10:44", "10:44"];

export function PantallaChat({ frame, fps, d, marca }: PropsEscena) {
  const aparece = (desde: number) => (frame >= desde ? spring({ frame: frame - desde, fps, config: { damping: 13 } }) : 0);
  const items = [
    ...(d.llega_mensaje ?? []).map((cuadro, k) => ({ tipo: "cliente" as const, cuadro, texto: marca.chat.cliente[k % marca.chat.cliente.length] })),
    ...(d.responde ?? []).slice(0, 1).map((cuadro) => ({ tipo: "tienda" as const, cuadro, texto: marca.chat.respuesta })),
  ].sort((a, b) => a.cuadro - b.cuadro);
  const venta = primero(d.se_vuelve_venta);
  const indiceBolsa = venta === undefined ? -1 : items.map((it, i) => ({ it, i })).filter(({ it }) => it.tipo === "cliente" && it.cuadro <= venta).pop()?.i ?? -1;
  const aBolsa = rampa(frame, venta, 8);
  // Micro-acción del chat: la cliente aparece "escribiendo" un momento.
  const escribiendo = (d.micro ?? []).some((c) => frame >= c && frame <= c + 36);
  return (
    <div style={{ position: "absolute", inset: 0, background: "#F7F7FA", display: "flex", flexDirection: "column", fontFamily: "Poppins, sans-serif" }}>
      <div style={{ height: ALTO_BARRA_FEED + 30, background: "#fff", borderBottom: "2px solid #eee", display: "flex", alignItems: "flex-end", gap: 18, padding: "0 26px 22px" }}>
        <ImagenFija nombre="ico-atras" ancho={46} alto={46} />
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#D65DB1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800 }}>C</div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: "#1c1c22" }}>Camila</span>
          <span style={{ fontSize: 22, color: "#2B7A3F", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: "#2BB24C", display: "inline-block" }} />
            {escribiendo ? "escribiendo" : "En línea"}
          </span>
        </div>
      </div>
      {/* Lugar de cada mensaje reservado desde el inicio: nada se corre cuando llega otro. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 22, padding: "70px 30px 0" }}>
        {items.map((it, i) => {
          const a = aparece(it.cuadro);
          if (it.tipo === "tienda") {
            return (
              <div key={i} style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, opacity: a }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 20, background: "#FFF4D1", color: "#7A4D00", fontSize: 24, fontWeight: 700 }}>
                  <ImagenFija nombre="ico-rayo" ancho={28} alto={28} />
                  Al instante
                </div>
                <Burbuja propia aparicion={a} color={VERDE_RESPUESTA} hora={HORAS[i] ?? "10:44"} leido={frame >= it.cuadro + 20}>
                  {it.texto}
                </Burbuja>
              </div>
            );
          }
          const esBolsa = i === indiceBolsa;
          return (
            <div key={i} style={{ position: "relative", alignSelf: "flex-start" }}>
              <div style={{ opacity: esBolsa ? 1 - aBolsa : 1, transform: esBolsa ? `scale(${1 - 0.6 * aBolsa})` : undefined, transformOrigin: "0% 50%" }}>
                <Burbuja aparicion={a} hora={HORAS[i] ?? "10:44"}>
                  {it.texto}
                  {/^hola/i.test(it.texto) && <ImagenFija nombre="ico-saludo" ancho={46} alto={46} />}
                </Burbuja>
              </div>
              {esBolsa && aBolsa > 0 && <IconoBolsa tamano={190} color={marca.colorMarca} estilo={{ position: "absolute", left: 40, top: -40, transform: `scale(${aBolsa})` }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Perfil ----------
// Sin contadores (publicaciones, seguidores): nunca se inventan.
export function PantallaPerfil({ frame, d, marca, fotoUrl }: PropsEscena) {
  const toque = primero(d.toque_seguir);
  const siguiendo = toque !== undefined && frame >= toque + 3;
  const manoVisible = toque !== undefined && frame >= toque - 24 && frame <= toque + 40;
  const manoEscala = toque !== undefined ? 1 - 0.18 * Math.sin(Math.min(1, Math.max(0, (frame - (toque - 6)) / 16)) * Math.PI) : 1;
  return (
    <div style={{ position: "absolute", inset: 0, background: "#fff", fontFamily: "Poppins, sans-serif", color: "#1c1c22" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 30, padding: `${ALTO_BARRA_FEED + 40}px 36px 30px` }}>
        <div style={{ width: 200, height: 200, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(145deg, ${marca.colorMarca}, ${marca.colorSecundario})`, display: "flex", alignItems: "center", justifyContent: "center", color: colorTextoSobre(marca.colorMarca), fontSize: 100, fontWeight: 900 }}>
          {marca.inicial}
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 }}>
          <span style={{ fontSize: 36, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden" }}>{marca.nombreTienda}</span>
          {marca.descripcionPerfil && <span style={{ fontSize: 26, color: "#3b3b45" }}>{marca.descripcionPerfil}</span>}
        </div>
      </div>
      <div style={{ margin: "40px 36px 36px", height: 110, borderRadius: 24, background: siguiendo ? "#0F7A3C" : marca.colorMarca, color: siguiendo ? "#fff" : colorTextoSobre(marca.colorMarca), display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontSize: 48, fontWeight: 800, transform: `scale(${(siguiendo && toque !== undefined ? 1 + 0.05 * (1 - rampa(frame, toque + 3, 8)) : 1) * (1 + 0.04 * latido(frame, d.micro))})` }}>
        {siguiendo ? "Siguiendo" : "Seguir"}
        {siguiendo && <IconoCheck tamano={48} color="#fff" />}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, padding: "0 6px" }}>
        {(["foto", "comida", "paisaje", "mascota", "ropa", "foto"] as const).map((t, i) => (
          <div key={i} style={{ height: 230, overflow: "hidden" }}>
            {/* <img>, no background url(): el renderizador del navegador no dibuja fondos con imagen. */}
            {t === "foto" ? (
              // eslint-disable-next-line @next/next/no-img-element -- dibujo del video; precargada en ReelIlustrado
              <img src={fotoUrl} alt="" decoding="sync" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <ImagenFija nombre={`ilu-${t}`} ancho="100%" alto="100%" estilo={{ objectFit: "cover" }} />
            )}
          </div>
        ))}
      </div>
      {manoVisible && <Mano x={330} y={470} escala={manoEscala} />}
    </div>
  );
}
