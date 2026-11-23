// Todo lo que el reel ilustrado necesita saber antes de dibujar un
// cuadro (puro, se calcula una vez): línea de tiempo, disparos, dónde va
// cada isla, cámara, qué pantalla muestra el celular y monedas que viajan.
import { construirLineaDeTiempo, type LineaDeTiempo, type PuntoCamara, type TiemposIlustrado } from "../tiempoIlustrado";
import { BOCA_BILLETERA_LOCAL, CATALOGO, MICRO, type IdEscena } from "./catalogo";
import { puntosCamaraAutomatica, tomasDeCamara, type Toma } from "./camara";
import { resolverDisparos, type Disparo, type PlanIlustrado } from "./plan";
import { construirRecorrido, type Recorrido } from "./recorrido";

export type CambioPantalla = { cuadro: number; pantalla: IdEscena };
export type Viaje = { desde: { x: number; y: number }; hacia: { x: number; y: number }; cuadro: number; duracion: number };

export type ReelPreparado = {
  linea: LineaDeTiempo;
  disparos: Disparo[];
  recorrido: Recorrido;
  tomas: Toma[];
  camara: PuntoCamara[];
  pantallas: CambioPantalla[];
  viajes: Viaje[];
  // Cuadros de las micro-acciones (acercamiento corto de cámara).
  pulsos: number[];
};

export const DURACION_VIAJE = 20;

export function prepararReel(tiempos: TiemposIlustrado, plan: PlanIlustrado, fps: number): ReelPreparado {
  const linea = construirLineaDeTiempo(tiempos, fps);
  const disparos = resolverDisparos(plan, linea);
  const recorrido = construirRecorrido(disparos);
  const tomas = tomasDeCamara(disparos, recorrido);
  const camara = puntosCamaraAutomatica(tomas, linea.duracionCuadros, fps);

  // El celular cambia de pantalla al empezar la frase de la primera
  // acción de la nueva pantalla (así ya está cuando llega la cámara).
  const pantallas: CambioPantalla[] = [];
  for (const d of disparos) {
    if (CATALOGO[d.escena].isla !== "celular" || d.accion === MICRO) continue;
    const actual = pantallas[pantallas.length - 1];
    if (actual?.pantalla === d.escena) continue;
    const cuadro = actual ? Math.max(actual.cuadro + 10, Math.min(d.inicioFrase, d.cuadro - 10)) : 0;
    pantallas.push({ cuadro, pantalla: d.escena });
  }

  // Monedas que viajan entre islas: la venta sale del celular y llega a
  // la billetera (sin celular, cae desde arriba).
  const viajes: Viaje[] = [];
  const billetera = recorrido.billetera;
  if (billetera) {
    const hacia = { x: billetera.x + BOCA_BILLETERA_LOCAL.x, y: billetera.y + BOCA_BILLETERA_LOCAL.y };
    const cel = recorrido.celular;
    for (const d of disparos) {
      if (d.escena !== "billetera" || d.accion !== "recibe_moneda") continue;
      const desde = cel ? { x: cel.x + cel.ancho / 2, y: cel.y + 900 } : { x: hacia.x, y: hacia.y - 1200 };
      viajes.push({ desde, hacia, cuadro: d.cuadro - 8, duracion: DURACION_VIAJE });
    }
  }
  const pulsos = disparos.filter((d) => d.accion === MICRO).map((d) => d.cuadro);
  return { linea, disparos, recorrido, tomas, camara, pantallas, viajes, pulsos };
}
