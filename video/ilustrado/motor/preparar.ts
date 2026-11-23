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

  // El celular cambia de pantalla amarrado a la acción que la pide:
  // ~0,33 s antes de ella y nunca antes de que termine la acción
  // anterior del celular (staging 23 nov 2026, pieza 67d87ce8: el cambio
  // al empezar la frase mostraba el perfil 3,5 s antes de tiempo y
  // tapaba las acciones del feed de esa misma frase).
  const pantallas: CambioPantalla[] = [];
  let anteriorCelular: number | null = null;
  for (const d of disparos) {
    if (CATALOGO[d.escena].isla !== "celular") continue;
    const actual = pantallas[pantallas.length - 1];
    if (actual?.pantalla !== d.escena && d.accion !== MICRO) {
      const cuadro = actual ? Math.min(d.cuadro, Math.max(actual.cuadro + 10, (anteriorCelular ?? 0) + 12, d.cuadro - 10)) : 0;
      pantallas.push({ cuadro, pantalla: d.escena });
    }
    anteriorCelular = d.cuadro;
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

// Lo que el reel muestra en un cuadro (lo usan el render, el control de
// calidad y las pruebas, para que nunca se separen).
export function pantallaEnCuadro(reel: Pick<ReelPreparado, "pantallas">, cuadro: number): IdEscena | null {
  return [...reel.pantallas].reverse().find((p) => cuadro >= p.cuadro)?.pantalla ?? reel.pantallas[0]?.pantalla ?? null;
}

// La escena que está en cámara: la pantalla activa del celular si la
// toma en curso es del celular; si no, la escena de la isla de la toma.
export function escenaEnCamara(reel: Pick<ReelPreparado, "pantallas" | "tomas" | "disparos">, cuadro: number): IdEscena | null {
  const toma = [...reel.tomas].reverse().find((t) => cuadro >= t.desde) ?? reel.tomas[0];
  if (!toma) return null;
  if (toma.celular) return pantallaEnCuadro(reel, cuadro);
  const accion = [...reel.disparos].reverse().find((d) => d.cuadro <= Math.max(cuadro, toma.desde) && CATALOGO[d.escena].isla !== "celular");
  return accion?.escena ?? null;
}

