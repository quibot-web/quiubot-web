// Todo lo que el reel ilustrado necesita saber antes de dibujar un
// cuadro (puro, se calcula una vez): línea de tiempo, disparos, dónde va
// cada isla, cámara, qué pantalla muestra el celular y monedas que viajan.
import { camaraEnCuadro, construirLineaDeTiempo, type LineaDeTiempo, type PuntoCamara, type TiemposIlustrado } from "../tiempoIlustrado";
import { BOCA_BILLETERA_LOCAL, MICRO, type IdEscena } from "./catalogo";
import { caminantesDePlan, crearRegistro, REGISTRO_CATALOGO, type Registro } from "./registro";
import { conCobertura, cuerposEnMundo, encuadreDeAccionKit, planDeCamara, pulsoDeCamara, tomasDeCamara, type Puerta, type Toma } from "./camara";
import { encuadrarKit } from "./encuadreKit";
import type { MovimientoCamara } from "../kit/variedad";
import { acercar, desplazar, type Encuadre } from "./geometria";
import { rectPersonaje } from "../kit/composicion";
import { CELULAR_ISLA } from "./catalogo";
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
  // Escenas del catálogo + composiciones del kit de este plan.
  registro: Registro;
  // Cortes de coincidencia celular <-> lugar del kit.
  puertas: Puerta[];
  movimiento?: MovimientoCamara;
};

export const DURACION_VIAJE = 20;

// semilla: varía lo que la IA no fija en el kit (ropa, piel, peinado,
// pared), así dos reels no se ven iguales.
export function prepararReel(tiempos: TiemposIlustrado, plan: PlanIlustrado, fps: number, semilla = ""): ReelPreparado {
  const registro = crearRegistro(plan.composiciones ?? [], semilla, { variedad: plan.variedad, caminantes: caminantesDePlan(plan) });
  const linea = construirLineaDeTiempo(tiempos, fps);
  const disparos = resolverDisparos(plan, linea);
  const recorrido = construirRecorrido(disparos, registro);
  // En el kit, ningún plano igual más de ~2 s (planos de cobertura).
  const tomas = conCobertura(tomasDeCamara(disparos, recorrido, registro), disparos, recorrido, registro, linea.duracionCuadros);
  // Puertas celular <-> lugar del kit (sin viajar por el mundo oscuro).
  const cel = recorrido.celular;
  const plan_ = planDeCamara(tomas, linea.duracionCuadros, fps, {
    esKit: (e) => !!e && !!registro.composicion(e),
    movimiento: plan.variedad?.camara,
    pantalla: cel ? { x: cel.x + CELULAR_ISLA.borde, y: cel.y + CELULAR_ISLA.borde, ancho: CELULAR_ISLA.ancho - 2 * CELULAR_ISLA.borde, alto: CELULAR_ISLA.alto - 2 * CELULAR_ISLA.borde } : null,
    // Encuadre del lugar al cruzar la puerta: la cartelera (lo que el feed
    // "se vuelve") o, sin cartelera, todo lo que quepa del lugar; con las
    // mismas reglas del kit (nadie con la cara cortada).
    // Encuadre del lugar al cruzar la puerta: la cartelera (lo que el feed
    // "se vuelve"), con la misma cadena que cualquier acción del kit (nadie
    // cortado, zoom normal); sin cartelera, el plano con más personajes.
    encuadreKit: (e) => {
      const cu = registro.composicion(e);
      if (!cu) return null;
      const cartelera = cu.objetos.find((o) => o.obj.tipo === "cartelera" && o.rect);
      if (cartelera) return encuadreDeAccionKit(e, `${cartelera.obj.id}.destaca`, undefined, recorrido, registro)?.r.encuadre ?? null;
      const isla = recorrido[e];
      if (!isla) return null;
      return encuadrarKit({ obligatorios: [], deseables: cu.personajes.map((u) => desplazar(rectPersonaje(u), isla.x, isla.y)), cuerpos: cuerposEnMundo(e, recorrido, registro), anclarAbajo: true })?.encuadre ?? null;
    },
  });
  const camara = plan_.puntos;
  const puertas = plan_.puertas;

  // El celular cambia de pantalla amarrado a la acción que la pide:
  // ~0,33 s antes de ella y nunca antes de que termine la acción
  // anterior del celular (staging 23 nov 2026, pieza 67d87ce8: el cambio
  // al empezar la frase mostraba el perfil 3,5 s antes de tiempo y
  // tapaba las acciones del feed de esa misma frase).
  const pantallas: CambioPantalla[] = [];
  let anteriorCelular: number | null = null;
  for (const d of disparos) {
    if (!registro.escena(d.escena)?.celular) continue;
    const actual = pantallas[pantallas.length - 1];
    if (actual?.pantalla !== d.escena && d.accion !== MICRO) {
      const cuadro = actual ? Math.min(d.cuadro, Math.max(actual.cuadro + 10, (anteriorCelular ?? 0) + 12, d.cuadro - 10)) : 0;
      pantallas.push({ cuadro, pantalla: d.escena as IdEscena });
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
  return { linea, disparos, recorrido, tomas, camara, pantallas, viajes, pulsos, registro, puertas, movimiento: plan.variedad?.camara };
}

// Lo que el reel muestra en un cuadro (lo usan el render, el control de
// calidad y las pruebas, para que nunca se separen).
export function pantallaEnCuadro(reel: Pick<ReelPreparado, "pantallas">, cuadro: number): IdEscena | null {
  return [...reel.pantallas].reverse().find((p) => cuadro >= p.cuadro)?.pantalla ?? reel.pantallas[0]?.pantalla ?? null;
}

// La escena que está en cámara: la pantalla activa del celular si la
// toma en curso es del celular; si no, la escena de la isla de la toma.
export function escenaEnCamara(reel: Pick<ReelPreparado, "pantallas" | "tomas" | "disparos"> & { registro?: Registro }, cuadro: number): string | null {
  const registro = reel.registro ?? REGISTRO_CATALOGO;
  const toma = [...reel.tomas].reverse().find((t) => cuadro >= t.desde) ?? reel.tomas[0];
  if (!toma) return null;
  if (toma.celular) return pantallaEnCuadro(reel, cuadro);
  const accion = [...reel.disparos].reverse().find((d) => d.cuadro <= Math.max(cuadro, toma.desde) && !registro.escena(d.escena)?.celular);
  return accion?.escena ?? null;
}


// La cámara exacta de un cuadro: los puntos del plan, más la respiración,
// el pulso de las micro-acciones y una deriva leve para que nunca esté
// quieta. Con el celular en toma, anclada debajo del subtítulo (el celular
// nunca se mete bajo el subtítulo). La usan el render y las pruebas.
// En los lugares del kit no hay pulso: la vida la dan los personajes, y el
// encuadre ya garantiza que nadie quede con la cara cortada.
export function camaraDelCuadro(reel: Pick<ReelPreparado, "camara" | "tomas" | "pulsos"> & { registro?: Registro; movimiento?: MovimientoCamara }, frame: number): Encuadre {
  const base = camaraEnCuadro(reel.camara, frame);
  const toma = [...reel.tomas].reverse().find((t) => frame >= t.desde);
  const enCelular = toma?.celular === true;
  const enKit = !!toma?.escena && !!reel.registro?.composicion(toma.escena);
  const pulso = enKit ? 1 : pulsoDeCamara(frame, reel.pulsos ?? []);
  const conPulso = acercar(base, (1 + Math.sin(frame / 70) * 0.01) * pulso, enCelular ? "arriba" : "centro");
  // En el kit con barrido, la deriva baja (barrido + deriva <= margen de encuadreSeguro).
  const deriva = enKit && (reel.movimiento === "barrer_derecha" || reel.movimiento === "barrer_izquierda") ? 3 : 8;
  return { x: conPulso.x + Math.sin(frame / 40) * deriva, y: conPulso.y + (enCelular ? 0 : Math.cos(frame / 52) * deriva), zoom: conPulso.zoom };
}
