// Relleno mínimo de ambiente (puro). La IA pone a los protagonistas; el
// código completa el lugar para que nunca se vea vacío (revisión de la v6,
// 24 nov 2026: la composición de la IA tenía 3 personajes en fila y se
// veía más pobre que la hecha a mano).
// Salón: al menos MIN_PERSONAJES_SALON personajes, con al menos
// MIN_SENTADOS_FONDO niños sentados en pupitres al fondo. Los extras varían
// con la semilla (ropa, piel, peinado), respiran, parpadean y miran lo que
// pasa (mira_a: la cartelera o el protagonista).
import { LUGARES_PISO, POSICIONES, type ComposicionKit, type ObjetoKit, type PersonajeKit } from "./catalogoKit";
import { POS_X, hashTexto, problemasComposicion } from "./composicion";
import { PUERTAS, PUERTA_X } from "./dibujoLugares";

export const MIN_PERSONAJES_SALON = 5;
export const MIN_SENTADOS_FONDO = 2;
export const MAX_PERSONAJES_CON_EXTRAS = 7;
export const PREFIJO_EXTRA = "extra";

const POSICION_DE_LUGAR = (lugar: string) => lugar.replace("piso_", "") as PersonajeKit["posicion"];

export function esExtra(id: string): boolean {
  return id.startsWith(PREFIJO_EXTRA);
}

// admite: chequeo extra del que llama (el registro verifica que la cartelera
// siga teniendo un plano limpio con el extra puesto).
// Otros lugares (tanda 2): gente de fondo, de pie, que encaja con el lugar.
export const MIN_PERSONAJES: Record<Exclude<ComposicionKit["fondo"], "salon">, number> = { tienda: 3, calle: 3, cocina: 2, tienda_ropa: 2 };
const EXTRAS_DE: Record<Exclude<ComposicionKit["fondo"], "salon">, PersonajeKit["tipo"][]> = {
  tienda: ["cliente", "abuela", "mama", "papa", "emprendedora"],
  calle: ["cliente", "papa", "abuela", "nino", "mama"],
  cocina: ["nino", "nina"],
  tienda_ropa: ["cliente", "mama", "emprendedora"],
};

export function completarAmbiente(c: ComposicionKit, semilla: string, admite: (c: ComposicionKit) => boolean = () => true): ComposicionKit {
  if (c.fondo !== "salon") return completarOtroLugar(c, semilla, admite);
  const sentadosFondo = c.personajes.filter((p) => p.sentado_en && c.objetos.find((o) => o.id === p.sentado_en)?.plano === "fondo").length;
  let faltan = Math.max(MIN_PERSONAJES_SALON - c.personajes.length, MIN_SENTADOS_FONDO - sentadosFondo, 0);
  faltan = Math.min(faltan, MAX_PERSONAJES_CON_EXTRAS - c.personajes.length);
  if (faltan <= 0) return c;

  const cartelera = c.objetos.find((o) => o.tipo === "cartelera");
  const protagonista = c.personajes.find((p) => p.tipo === "profesora") ?? c.personajes[0];
  const mirarA = cartelera?.id ?? protagonista?.id;
  const xCartelera = cartelera?.lugar === "pared_izquierda" ? 0 : cartelera?.lugar === "pared_derecha" ? 4 : 2;
  // Lugares del fondo sin pupitre; primero los que no quedan detrás de
  // alguien de pie adelante (se verían tapados).
  const ocupadosFondo = new Set(c.objetos.filter((o) => o.tipo === "pupitre" && o.plano === "fondo").map((o) => o.lugar));
  const dePieAdelante = new Set(c.personajes.filter((p) => !p.sentado_en && p.plano === "frente").map((p) => p.posicion));
  const h = hashTexto(`${semilla}:${c.id}:ambiente`);
  const candidatos = LUGARES_PISO.filter((l) => !ocupadosFondo.has(l)).sort((a, b) => {
    const tapado = (l: string) => (dePieAdelante.has(POSICION_DE_LUGAR(l)) ? 1 : 0);
    return tapado(a) - tapado(b) || ((hashTexto(a + h) % 7) - (hashTexto(b + h) % 7));
  });

  let actual = c;
  let n = 0;
  for (const lugar of candidatos) {
    if (n >= faltan) break;
    const id = `${PREFIJO_EXTRA}${n + 1}`;
    const pupitre: ObjetoKit = { id: `pupitre_${id}`, tipo: "pupitre", lugar, plano: "fondo", visible: true };
    const i = LUGARES_PISO.indexOf(lugar);
    const extra: PersonajeKit = {
      id,
      tipo: (h >> n) % 2 === 0 ? "nina" : "nino",
      posicion: POSICION_DE_LUGAR(lugar),
      plano: "fondo",
      mira: i >= xCartelera ? "izquierda" : "derecha",
      pose: "parado",
      expresion: "normal",
      sentado_en: pupitre.id,
      ...(mirarA ? { mira_a: mirarA } : {}),
    };
    const prueba: ComposicionKit = { ...actual, personajes: [...actual.personajes, extra], objetos: [...actual.objetos, pupitre] };
    // Un extra nunca tapa la cartelera ni rompe otra regla.
    if (problemasComposicion(prueba).length > 0 || !admite(prueba)) continue;
    actual = prueba;
    n++;
  }
  return actual;
}

function completarOtroLugar(c: ComposicionKit, semilla: string, admite: (c: ComposicionKit) => boolean): ComposicionKit {
  if (c.fondo === "salon") return c;
  const fondo = c.fondo;
  let faltan = Math.min(MIN_PERSONAJES[fondo] - c.personajes.length, MAX_PERSONAJES_CON_EXTRAS - c.personajes.length);
  if (faltan <= 0) return c;
  const protagonista = c.personajes[0];
  const h = hashTexto(`${semilla}:${c.id}:ambiente`);
  const ocupadas = new Set(c.personajes.filter((p) => !p.sentado_en).map((p) => `${p.posicion}-${p.plano}`));
  const dePieAdelante = new Set(c.personajes.filter((p) => !p.sentado_en && p.plano === "frente").map((p) => p.posicion));
  // Nadie de relleno justo detrás de un mueble o vehículo de adelante (la
  // vitrina, el mostrador, el carro): se ve tapado y le roba el plano al objeto.
  const tapados = new Set<number>();
  for (const o of c.objetos) {
    if (!o.lugar?.startsWith("piso_") || o.plano !== "frente" || !["mostrador", "vitrina", "mesa", "moto", "carro", "perchero", "mesa_ropa"].includes(o.tipo)) continue;
    const i = POSICIONES.indexOf(o.lugar.replace("piso_", "") as (typeof POSICIONES)[number]);
    for (const j of [i - 1, i, i + 1]) tapados.add(j);
  }
  // Ni delante de la puerta: por ahí entra y sale la gente (revisión de la
  // tanda 2: un extra parado en la puerta tapaba al que se iba).
  const enLaPuerta = (pos: (typeof POSICIONES)[number]) => !!PUERTAS[fondo] && Math.abs(POS_X[pos] - PUERTA_X[fondo]) < PUERTAS[fondo]!.ancho;
  const candidatos = POSICIONES.filter((pos) => !ocupadas.has(`${pos}-fondo`) && !tapados.has(POSICIONES.indexOf(pos)) && !enLaPuerta(pos)).sort((a, b) => Number(dePieAdelante.has(a)) - Number(dePieAdelante.has(b)) || (hashTexto(a + h) % 7) - (hashTexto(b + h) % 7));
  let actual = c;
  let n = 0;
  for (const posicion of candidatos) {
    if (faltan <= 0) break;
    const id = `${PREFIJO_EXTRA}${n + 1}`;
    const tipos = EXTRAS_DE[fondo];
    const i = POSICIONES.indexOf(posicion);
    const xProt = protagonista ? POSICIONES.indexOf(protagonista.posicion) : 2;
    const extra: PersonajeKit = {
      id,
      tipo: tipos[(h + n * 3) % tipos.length],
      posicion,
      plano: "fondo",
      mira: i >= xProt ? "izquierda" : "derecha",
      pose: "parado",
      expresion: "normal",
      ...(protagonista ? { mira_a: protagonista.id } : {}),
    };
    const prueba: ComposicionKit = { ...actual, personajes: [...actual.personajes, extra] };
    n++;
    if (problemasComposicion(prueba).length > 0 || !admite(prueba)) continue;
    actual = prueba;
    faltan--;
  }
  return actual;
}
