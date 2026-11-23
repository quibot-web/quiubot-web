// Escenas "isla" del reel ilustrado: objetos del mundo con su propio
// lugar. Cada una dibuja en coordenadas de su isla (el motor la ubica) y
// reacciona a los cuadros de sus acciones (d). Sin texto.
import { spring } from "remotion";
import { hexConAlfa } from "../../../tema";
import { Billetera, Grafica, Moneda, Persona, Reloj, SombraPiso } from "../../Objetos";
import { rampa, cuantas, primero } from "../animacion";
import { BILLETERA_LOCAL, BOCA_BILLETERA_LOCAL, CLIENTE_LOCAL, ELEGIDOS_MULTITUD, GRAFICA_LOCAL, ISLAS, PERSONAS_MULTITUD, RELOJ_LOCAL } from "../catalogo";
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
      <Billetera inflado={Math.max(0.2, Math.min(1.1, inflado))} rect={BILLETERA_LOCAL} />
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
export function IslaMultitud({ frame, d, paleta }: PropsEscena) {
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
          <div style={{ position: "absolute", left: centroFoco - anchoCono / 2, top: 1030, width: anchoCono, height: 300, borderRadius: "50%", background: `radial-gradient(ellipse, ${hexConAlfa("#ffffff", intensidad * 0.8)} 0%, rgba(255,255,255,0) 70%)` }} />
        </>
      )}
      {PERSONAS_MULTITUD.map((p, i) => {
        const elegido = ELEGIDOS_MULTITUD.has(p.id);
        const bajoElFoco = barrido >= 0 && Math.abs(p.x - centroFoco) < 280 + 750 * todosTenue && (iluminan === undefined || frame < iluminan) ? 0.5 : 0;
        const luz = elegido ? Math.max(elegidos, todosTenue * 0.3, bajoElFoco) : Math.max(todosTenue * 0.3, bajoElFoco) * (1 - elegidos);
        const opacidad = elegido ? 1 : 1 - 0.5 * elegidos;
        return <Persona key={p.id} x={p.x} pies={p.pies} escala={p.escala} luz={luz} colorLuz={paleta.luz} mirarArriba={elegido ? rampa(frame, miran, 10) : 0} opacidad={opacidad} variante={i * 3 + p.fila} />;
      })}
    </>
  );
}

// ---------- Reloj + cliente ----------
export function IslaRelojCliente({ frame, d, paleta }: PropsEscena) {
  const acelera = primero(d.reloj_acelera);
  const seVa = primero(d.cliente_se_va);
  const velocidad = acelera !== undefined && frame >= acelera ? 30 : 6;
  const angulo = frame * 6 + (acelera !== undefined && frame >= acelera ? (frame - acelera) * (velocidad - 6) : 0);
  // Primero se impacienta (~0,35 s, la cámara alcanza a llegar) y
  // después se va caminando.
  const arranca = seVa === undefined ? undefined : seVa + 10;
  const salida = rampa(frame, arranca, 36);
  const impaciente = seVa !== undefined && frame >= seVa && salida === 0 ? Math.abs(Math.sin((frame - seVa) / 2)) * 14 : 0;
  const pasos = arranca !== undefined ? Math.abs(Math.sin((frame - arranca) / 3)) * 30 * Math.min(1, salida * 4) + impaciente : 0;
  return (
    <>
      <Reloj cx={RELOJ_LOCAL.cx} cy={RELOJ_LOCAL.cy} tamano={RELOJ_LOCAL.tamano} angulo={angulo} aparicion={1} />
      <SombraPiso cx={CLIENTE_LOCAL.x + 900 * salida} y={CLIENTE_LOCAL.pies} ancho={140 * CLIENTE_LOCAL.escala * 1.1} />
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${900 * salida}px, ${-pasos}px)` }}>
        <Persona x={CLIENTE_LOCAL.x} pies={CLIENTE_LOCAL.pies} escala={CLIENTE_LOCAL.escala} luz={0.9} colorLuz={paleta.luz} variante={3} conCelular opacidad={1 - rampa(frame, arranca === undefined ? undefined : arranca + 28, 10)} />
      </div>
    </>
  );
}

// ---------- Gráfica ----------
export function IslaGrafica({ frame, d, paleta }: PropsEscena) {
  return <Grafica avance={rampa(frame, primero(d.sube), 26)} color={paleta.luz} rect={GRAFICA_LOCAL} />;
}
