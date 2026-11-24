// El mundo del reel ilustrado en un cuadro dado (sin hooks de Remotion
// para el cuadro: lo recibe por props, así se puede probar con
// renderToStaticMarkup). Dibuja solo lo que la cámara ve (rendimiento).
import type { ComponentType } from "react";
import { camaraEnCuadro } from "../tiempoIlustrado";
import { Celular, Fondo, Moneda, SombraPiso } from "../Objetos";
import { rampa } from "./animacion";
import { pulsoDeCamara } from "./camara";
import { CATALOGO, PANTALLA, type IdEscena, type IdIsla } from "./catalogo";
import { ALTO_PANTALLA, ANCHO_PANTALLA, acercar, seTocan, vistaDelMundo } from "./geometria";
import { disparosDeEscena } from "./plan";
import { PISO_Y } from "./recorrido";
import type { ReelPreparado } from "./preparar";
import { IslaBilletera, IslaGrafica, IslaMultitud, IslaRelojCliente, TAM_MONEDA } from "./escenas/Islas";
import { PantallaChat, PantallaFeed, PantallaPerfil } from "./escenas/Pantallas";
import type { MarcaIlustrada, PaletaIlustrada, PropsEscena } from "./escenas/tipos";
import type { TemaGuion } from "../../tema";
import { recursosSinGenerar, type RecursosGenerados } from "../imagenesGeneradas";
import { ENTORNO, EscenaKit, PuertaEnPantalla } from "../kit/EscenaKit";
import type { ImagenesKit } from "../kit/piezas";

const ISLAS_DEL_MUNDO: Partial<Record<IdIsla, ComponentType<PropsEscena>>> = {
  billetera: IslaBilletera,
  multitud: IslaMultitud,
  reloj_cliente: IslaRelojCliente,
  grafica: IslaGrafica,
};
const PANTALLAS: Partial<Record<IdEscena, ComponentType<PropsEscena>>> = {
  feed: PantallaFeed,
  chat: PantallaChat,
  perfil: PantallaPerfil,
};
// Margen chico para decidir si una isla se ve; lo que se sale de su
// rectángulo lo declara cada isla (el cliente que se va camina 900 a la
// derecha; las monedas de la billetera saltan y caen por fuera).
const MARGEN_CULLING = 60;
const SE_SALE: Partial<Record<IdIsla, { izquierda: number; derecha: number; arriba: number; abajo: number }>> = {
  reloj_cliente: { izquierda: 0, derecha: 1000, arriba: 0, abajo: 0 },
  billetera: { izquierda: 200, derecha: 400, arriba: 600, abajo: 900 },
  multitud: { izquierda: 0, derecha: 0, arriba: 200, abajo: 0 },
};
// Composiciones del kit: el lugar continúa más allá de la isla (ENTORNO).
const SE_SALE_KIT = { izquierda: ENTORNO.izquierda, derecha: ENTORNO.derecha, arriba: ENTORNO.arriba, abajo: ENTORNO.abajo };
function rectVisible(id: string, r: { x: number; y: number; ancho: number; alto: number }, esKit = false) {
  const e = esKit ? SE_SALE_KIT : SE_SALE[id as IdIsla];
  if (!e) return r;
  return { x: r.x - e.izquierda, y: r.y - e.arriba, ancho: r.ancho + e.izquierda + e.derecha, alto: r.alto + e.arriba + e.abajo };
}
const FUNDIDO_PANTALLA = 8;

export type PropsMundo = {
  frame: number;
  fps: number;
  reel: ReelPreparado;
  paleta: PaletaIlustrada;
  tema: TemaGuion;
  marca: MarcaIlustrada;
  fotoUrl: string;
  // Foto apagada/clara y halo horneados (ReelIlustrado los genera al precargar).
  recursos?: RecursosGenerados;
  // Piezas del kit (personajes, fondos, objetos) ya en PNG.
  imagenesKit?: ImagenesKit;
};

export function MundoIlustrado({ frame, fps, reel, paleta, tema, marca, fotoUrl, recursos = recursosSinGenerar(fotoUrl), imagenesKit = {} }: PropsMundo) {
  // Cámara + una deriva leve para que nunca esté quieta.
  const base = camaraEnCuadro(reel.camara, frame);
  // Deriva y pulso de las micro-acciones; con el celular en toma, anclados
  // debajo del subtítulo (el celular nunca se mete bajo el subtítulo).
  const enCelular = reel.tomas.length > 0 && [...reel.tomas].reverse().find((t) => frame >= t.desde)?.celular === true;
  const conPulso = acercar(base, (1 + Math.sin(frame / 70) * 0.01) * pulsoDeCamara(frame, reel.pulsos ?? []), enCelular ? "arriba" : "centro");
  const cam = { x: conPulso.x + Math.sin(frame / 40) * 8, y: conPulso.y + (enCelular ? 0 : Math.cos(frame / 52) * 8), zoom: conPulso.zoom };
  const vista = vistaDelMundo(cam);
  const pisoEnPantalla = ALTO_PANTALLA / 2 + (PISO_Y - cam.y) * cam.zoom;
  const props = (escena: string): PropsEscena => ({ frame, fps, d: disparosDeEscena(reel.disparos, escena), paleta, tema, marca, fotoUrl, recursos });

  const islas = Object.keys(reel.recorrido).filter((id) => seTocan(rectVisible(id, reel.recorrido[id], !!reel.registro.composicion(id)), vista, MARGEN_CULLING));

  // Pantallas del celular: la actual y, durante el fundido, la anterior.
  const iActual = reel.pantallas.reduce((acc, p, i) => (frame >= p.cuadro ? i : acc), 0);
  const actual = reel.pantallas[iActual];
  // La primera pantalla está completa desde el cuadro 0 (sin fundido de entrada).
  const mezcla = actual && iActual > 0 ? rampa(frame, actual.cuadro, FUNDIDO_PANTALLA) : 1;
  const anterior = iActual > 0 && mezcla < 1 ? reel.pantallas[iActual - 1] : null;

  return (
    <>
      <Fondo camX={cam.x} horizonte={pisoEnPantalla - 240 * cam.zoom} fondo={paleta.fondo} profundo={paleta.fondoProfundo} luz={paleta.luz} brilloUrl={recursos.brilloLuz} />
      <div style={{ position: "absolute", left: 0, top: 0, width: ANCHO_PANTALLA, height: ALTO_PANTALLA, transformOrigin: "0 0", transform: `translate(${540 - cam.x * cam.zoom}px, ${960 - cam.y * cam.zoom}px) scale(${cam.zoom})` }}>
        {islas.map((id) => {
          const r = reel.recorrido[id]!;
          if (id === "celular") {
            return (
              <div key={id} style={{ position: "absolute", left: r.x, top: r.y, width: r.ancho, height: r.alto }}>
                <SombraPiso cx={r.ancho / 2} y={r.alto + 10} ancho={r.ancho * 1.25} />
                <Celular>
                  {anterior && <CapaPantalla Componente={PANTALLAS[anterior.pantalla]} props={{ ...props(anterior.pantalla), desdePantalla: anterior.cuadro }} opacidad={1} />}
                  {actual && <CapaPantalla Componente={PANTALLAS[actual.pantalla]} props={{ ...props(actual.pantalla), desdePantalla: actual.cuadro }} opacidad={mezcla} />}
                  {/* Puerta al lugar del kit: el feed se transforma en la cartelera (y al revés al volver). */}
                  {(reel.puertas ?? []).map((pu) => {
                    const cu = reel.registro.composicion(pu.kit);
                    if (!cu) return null;
                    const opacidad = pu.desde === "celular" ? rampa(frame, pu.cuadro - 16, 12) * (frame < pu.cuadro ? 1 : 0) : frame >= pu.cuadro ? 1 - rampa(frame, pu.cuadro + 4, 12) : 0;
                    return <PuertaEnPantalla key={pu.cuadro} cu={cu} frame={frame} d={disparosDeEscena(reel.disparos, pu.kit)} imagenes={imagenesKit} ancho={PANTALLA.ancho} alto={PANTALLA.alto} opacidad={opacidad} />;
                  })}
                </Celular>
              </div>
            );
          }
          const cu = reel.registro.composicion(id);
          if (cu) {
            return (
              <div key={id} style={{ position: "absolute", left: r.x, top: r.y, width: r.ancho, height: r.alto }}>
                <EscenaKit
                  cu={cu}
                  frame={frame}
                  fps={fps}
                  d={disparosDeEscena(reel.disparos, id)}
                  imagenes={imagenesKit}
                  objetivos={reel.disparos.filter((x) => x.escena === id && x.objetivo).map((x) => ({ accion: x.accion, cuadro: x.cuadro, objetivo: x.objetivo! }))}
                  vista={{ x: vista.x - r.x, y: vista.y - r.y, ancho: vista.ancho, alto: vista.alto }}
                />
              </div>
            );
          }
          const Isla = ISLAS_DEL_MUNDO[id as IdIsla];
          const escena = (Object.keys(CATALOGO) as IdEscena[]).find((e) => CATALOGO[e].isla === id)!;
          return Isla ? (
            <div key={id} style={{ position: "absolute", left: r.x, top: r.y, width: r.ancho, height: r.alto }}>
              <Isla {...props(escena)} />
            </div>
          ) : null;
        })}
        {reel.viajes.map((v, i) => {
          if (frame < v.cuadro || frame > v.cuadro + v.duracion + 4) return null;
          const t = rampa(frame, v.cuadro, v.duracion);
          return (
            <Moneda
              key={i}
              x={v.desde.x + (v.hacia.x - v.desde.x) * t}
              y={v.desde.y + (v.hacia.y - v.desde.y) * t - Math.sin(t * Math.PI) * 300}
              tamano={TAM_MONEDA}
              rotacion={frame * 8}
              opacidad={1 - rampa(frame, v.cuadro + v.duracion, 4)}
            />
          );
        })}
      </div>
    </>
  );
}

function CapaPantalla({ Componente, props, opacidad }: { Componente: ComponentType<PropsEscena> | undefined; props: PropsEscena; opacidad: number }) {
  if (!Componente) return null;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: opacidad, background: "#fff" }}>
      <Componente {...props} />
    </div>
  );
}
