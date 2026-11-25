// Escenas "isla" del reel ilustrado: objetos del mundo con su propio
// lugar. Cada una dibuja en coordenadas de su isla (el motor la ubica) y
// reacciona a los cuadros de sus acciones (d). Sin texto.
import { spring } from "remotion";
import { Billetera, Grafica, Moneda, Persona, Reloj, SombraPiso } from "../../Objetos";
import { rampa, cuantas, latido, primero } from "../animacion";
import { BILLETERA_LOCAL, BOCA_BILLETERA_LOCAL, CARTEL_LOCAL, CLIENTE_LOCAL, ELEGIDOS_MULTITUD, GRAFICA_LOCAL, ISLAS, PERSONAS_MULTITUD, RELOJ_LOCAL } from "../catalogo";
import { IconoBurbuja } from "../../../iconos";
import { colorTextoSobre } from "../../../tema";
import { quitarGlifosFueraDeFuentes } from "../../../glifos";
import type { PropsEscena } from "./tipos";
import { ImagenFija } from "../../imagenesFijas";

export const TAM_MONEDA = 260;

// ---------- Billetera ----------
export function IslaBilletera({ frame, fps, d }: PropsEscena) {
  const salidas = d.sale_moneda ?? [];
  const cierre = primero(d.se_cierra);
  const llena = primero(d.se_llena);
  const recibidas = cuantas(d.recibe_moneda, frame);
  const recibeAnim = (d.recibe_moneda ?? []).reduce((acc, c) => acc + rampa(frame, c + 14, 10), 0);
  const inflado = 1 - 0.2 * Math.min(3, cuantas(salidas, frame)) + 0.25 * Math.min(recibidas, recibeAnim) + 0.55 * rampa(frame, llena === undefined ? undefined : llena + 16, 16);
  const candado = cierre !== undefined && frame >= cierre ? spring({ frame: frame - cierre, fps, config: { damping: 11 } }) : 0;
  return (
    <>
      {/* Micro-acción: la billetera se mece un poco. */}
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${BOCA_BILLETERA_LOCAL.x}px ${BILLETERA_LOCAL.y + BILLETERA_LOCAL.alto}px`, transform: `rotate(${4 * latido(frame, d.micro) * Math.sin((frame / 4) * Math.PI)}deg)` }}>
        <Billetera inflado={Math.max(0.2, Math.min(1.1, inflado))} rect={BILLETERA_LOCAL} />
      </div>
      {/* Monedas grandes que saltan de la billetera y caen */}
      {salidas.map((c, i) => {
        if (frame < c || frame > c + 50) return null;
        const t = (frame - c) / fps;
        return (
          <Moneda
            key={i}
            x={BOCA_BILLETERA_LOCAL.x + ((i % 3) - 1) * 140 + 160 * t}
            y={BOCA_BILLETERA_LOCAL.y - 900 * t + 1500 * t * t}
            tamano={TAM_MONEDA}
            rotacion={t * 320}
            opacidad={1 - rampa(frame, c + 38, 12)}
          />
        );
      })}
      {/* "Deja de irse": un candado dorado cierra la billetera */}
      {candado > 0 && (
        <ImagenFija nombre="candado" ancho={220} alto={220} estilo={{ position: "absolute", left: BOCA_BILLETERA_LOCAL.x - 110, top: BILLETERA_LOCAL.y + 40, transform: `scale(${candado})` }} />
      )}
      {/* "Se llena": lluvia de monedas grandes desde arriba */}
      {llena !== undefined &&
        Array.from({ length: 5 }, (_, i) => {
          const inicio = llena + i * 4;
          if (frame < inicio || frame > inicio + 26) return null;
          const t = rampa(frame, inicio, 20);
          const desdeX = BOCA_BILLETERA_LOCAL.x + (i - 2) * 150;
          const desdeY = -300;
          return <Moneda key={`v${i}`} x={desdeX + (BOCA_BILLETERA_LOCAL.x - desdeX) * t} y={desdeY + (BOCA_BILLETERA_LOCAL.y - desdeY) * t} tamano={200} rotacion={frame * 9 + i * 40} opacidad={1 - rampa(frame, inicio + 20, 6)} />;
        })}
    </>
  );
}

// ---------- Multitud ----------
export function IslaMultitud({ frame, d, recursos }: PropsEscena) {
  const inicioBarrido = primero(d.foco_barre) ?? primero(d.todos_tenues);
  const tenues = primero(d.todos_tenues);
  const iluminan = primero(d.se_iluminan);
  const miran = primero(d.miran_arriba);
  const barrido = inicioBarrido !== undefined && frame >= inicioBarrido ? ((frame - inicioBarrido) / 40) % 1 : -1;
  const ancho = ISLAS.multitud.ancho;
  const centroFoco = 150 + barrido * (ancho - 300);
  const todosTenue = rampa(frame, tenues, 10) * (1 - rampa(frame, iluminan, 8));
  const elegidos = rampa(frame, iluminan, 10);
  const anchoCono = 620 + 1500 * todosTenue;
  const intensidad = 0.34 * (1 - elegidos);
  return (
    <>
      {barrido >= 0 && intensidad > 0.01 && (
        <>
          {/* Cono (imagen fija 1000 x 1300): se mueve y se ensancha desde su
              contenedor. Polígono SVG dentro de la imagen,
              SVG, no clip-path CSS. */}
          <div style={{ position: "absolute", left: centroFoco - 500, top: -150, width: 1000, height: 1300, opacity: intensidad / 0.34, transform: `scaleX(${anchoCono / 1000})` }}>
            <ImagenFija nombre="cono" ancho={1000} alto={1300} />
          </div>
          <ImagenFija nombre="brillo-blanco" ancho={anchoCono} alto={300} estilo={{ position: "absolute", left: centroFoco - anchoCono / 2, top: 1030, opacity: intensidad / 0.34 }} />
        </>
      )}
      {PERSONAS_MULTITUD.map((p, i) => {
        const elegido = ELEGIDOS_MULTITUD.has(p.id);
        const bajoElFoco = barrido >= 0 && Math.abs(p.x - centroFoco) < 280 + 750 * todosTenue && (iluminan === undefined || frame < iluminan) ? 0.5 : 0;
        const luz = elegido ? Math.max(elegidos, todosTenue * 0.3, bajoElFoco) : Math.max(todosTenue * 0.3, bajoElFoco) * (1 - elegidos);
        const opacidad = elegido ? 1 : 1 - 0.5 * elegidos;
        // Micro-acción: la gente se balancea (cada uno con su fase).
        const balanceo = latido(frame, d.micro, 30) * Math.sin(frame / 3 + i) * 14;
        return (
          <div key={p.id} style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${balanceo}px)` }}>
            <Persona brilloUrl={recursos.brilloLuz} x={p.x} pies={p.pies} escala={p.escala} luz={luz} mirarArriba={elegido ? rampa(frame, miran, 10) : 0} opacidad={opacidad} variante={i * 3 + p.fila} />
          </div>
        );
      })}
    </>
  );
}

// ---------- Reloj + cliente ----------
export function IslaRelojCliente({ frame, d, recursos }: PropsEscena) {
  const acelera = primero(d.reloj_acelera);
  const seVa = primero(d.cliente_se_va);
  const velocidad = acelera !== undefined && frame >= acelera ? 30 : 6;
  const angulo = frame * 6 + (acelera !== undefined && frame >= acelera ? (frame - acelera) * (velocidad - 6) : 0);
  // Primero se impacienta (~0,35 s, la cámara alcanza a llegar) y
  // después se va caminando.
  const arranca = seVa === undefined ? undefined : seVa + 10;
  const salida = rampa(frame, arranca, 36);
  const impaciente = seVa !== undefined && frame >= seVa && salida === 0 ? Math.abs(Math.sin((frame - seVa) / 2)) * 14 : 0;
  // Micro-acción: el cliente se mueve inquieto.
  const inquieto = latido(frame, d.micro, 24) * Math.abs(Math.sin(frame / 2.5)) * 18;
  const pasos = (arranca !== undefined ? Math.abs(Math.sin((frame - arranca) / 3)) * 30 * Math.min(1, salida * 4) + impaciente : 0) + inquieto;
  return (
    <>
      <Reloj cx={RELOJ_LOCAL.cx} cy={RELOJ_LOCAL.cy} tamano={RELOJ_LOCAL.tamano} angulo={angulo} aparicion={1} />
      <SombraPiso cx={CLIENTE_LOCAL.x + 900 * salida} y={CLIENTE_LOCAL.pies} ancho={140 * CLIENTE_LOCAL.escala * 1.1} />
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${900 * salida}px, ${-pasos}px)` }}>
        <Persona brilloUrl={recursos.brilloLuz} x={CLIENTE_LOCAL.x} pies={CLIENTE_LOCAL.pies} escala={CLIENTE_LOCAL.escala} luz={0.9} variante={3} conCelular opacidad={1 - rampa(frame, arranca === undefined ? undefined : arranca + 28, 10)} />
      </div>
    </>
  );
}

// ---------- Gráfica ----------
export function IslaGrafica({ frame, d, paleta }: PropsEscena) {
  return <Grafica avance={rampa(frame, primero(d.sube), 26)} color={paleta.luz} rect={GRAFICA_LOCAL} />;
}

// ---------- Cartel de opciones (Historia narrada) ----------
// La pregunta final: A y B con su letra y la invitación a comentar. Es el
// único texto grande del reel ilustrado (lo pone el código, no la IA).
export function IslaOpciones({ frame, fps, d, tema, opciones }: PropsEscena) {
  if (!opciones) return null;
  const aparece = primero(d.aparece);
  if (aparece === undefined || frame < aparece) return null;
  const entrada = spring({ frame: frame - aparece, fps, config: { damping: 13 } });
  const a = rampa(frame, primero(d.resalta_a), 8);
  const b = rampa(frame, primero(d.resalta_b), 8);
  const comenta = primero(d.comenta);
  const burbuja = comenta !== undefined && frame >= comenta ? spring({ frame: frame - comenta, fps, config: { damping: 11 } }) : 0;
  const late = 1 + 0.02 * latido(frame, d.micro);
  const { x, y, ancho, alto } = CARTEL_LOCAL;
  // Resaltada: más grande y con el color de su letra; la otra se apaga un poco
  // (cuando se resalta la B, la A vuelve a normal).
  const enfoqueA = a * (1 - b);
  const fila = (letra: "A" | "B", texto: string, color: string, enfoque: number, apagada: number, top: number) => (
    <div style={{ position: "absolute", left: 50, right: 50, top, height: 330, borderRadius: 40, background: enfoque > 0 ? mezclar("#F3F1F8", color, 0.18 * enfoque) : "#F3F1F8", border: `${6 + 4 * enfoque}px solid ${enfoque > 0 ? color : "#E2DEEC"}`, display: "flex", alignItems: "center", gap: 36, padding: "0 40px", opacity: 1 - 0.45 * apagada, transform: `scale(${1 + 0.06 * enfoque})` }}>
      <div style={{ width: 150, height: 150, flexShrink: 0, borderRadius: "50%", background: color, color: colorTextoSobre(color), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96, fontWeight: 900 }}>{letra}</div>
      <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.12, color: "#1E1B2E" }}>{quitarGlifosFueraDeFuentes(texto)}</div>
    </div>
  );
  return (
    <div style={{ position: "absolute", inset: 0, opacity: Math.min(1, entrada * 1.4), transformOrigin: "50% 50%", transform: `scale(${(0.85 + 0.15 * entrada) * late})` }}>
      {/* Sombra (sin box-shadow: el render del navegador no la dibuja). */}
      <div style={{ position: "absolute", left: x + 14, top: y + 26, width: ancho, height: alto, borderRadius: 64, background: "rgba(20,16,40,0.22)" }} />
      <div style={{ position: "absolute", left: x, top: y, width: ancho, height: alto, borderRadius: 64, background: "#FFFFFF" }}>
        {fila("A", opciones.a, tema.color_primario, enfoqueA, b, 90)}
        {fila("B", opciones.b, tema.color_secundario === "#FFFFFF" ? tema.color_primario : oscurecerSiClaro(tema.color_secundario), b, enfoqueA, 470)}
        {/* Invitación a comentar. */}
        <div style={{ position: "absolute", left: 90, right: 90, top: 880, height: 190, borderRadius: 95, background: tema.color_primario, color: colorTextoSobre(tema.color_primario), display: "flex", alignItems: "center", justifyContent: "center", gap: 28, fontSize: 64, fontWeight: 900, opacity: Math.min(1, burbuja * 1.5), transform: `scale(${0.6 + 0.4 * burbuja})` }}>
          <IconoBurbuja tamano={84} />
          <span>Comenta A o B</span>
        </div>
      </div>
    </div>
  );
}
function mezclar(a: string, b: string, k: number): string {
  const n = (h: string) => parseInt(h.slice(1), 16);
  const [x, y] = [n(a), n(b)];
  const c = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`;
}
// Un secundario muy claro (casi blanco) no se ve sobre el cartel blanco.
function oscurecerSiClaro(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const luz = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luz > 0.75 ? mezclar(hex, "#1E1B2E", 0.45) : hex;
}

