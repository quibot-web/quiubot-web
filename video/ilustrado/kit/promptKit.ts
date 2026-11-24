// Lo que la IA necesita saber para componer lugares con el kit (puro).
// La IA escribe SOLO JSON con estas listas cerradas: nunca código ni SVG.
// La cámara la decide el motor con reglas automáticas (encuadreKit.ts):
// la IA no encuadra; solo elige quién está, dónde y qué hace en qué palabra.
import {
  ACCESORIOS,
  COLORES_ROPA,
  EXPRESIONES,
  FONDOS,
  LUGARES_PARED,
  LUGARES_PISO,
  MOTIVOS_DIBUJO,
  NOMBRE_FONDO,
  NOMBRE_OBJETO,
  NOMBRE_PERSONAJE,
  PAREDES,
  PEINADOS,
  PELOS,
  PIELES,
  POSES,
  POSICIONES,
  TIPOS_OBJETO,
  TIPOS_PERSONAJE,
  VERBOS_OBJETO,
  VERBOS_PERSONAJE,
} from "./catalogoKit";
import { ID_TODOS, VERBOS_TODOS } from "./composicion";
import { PREFIJO_EXTRA } from "./ambiente";
import { COMPOSICION_SALON } from "./planPrototipoKit";

export const MAX_COMPOSICIONES = 2;

const lista = (xs: readonly string[] | Record<string, unknown>) => (Array.isArray(xs) ? xs : Object.keys(xs)).join(", ");

export function catalogoKitTexto(): string {
  const verbosPersonaje = Object.entries(VERBOS_PERSONAJE)
    .map(([v, d]) => `    · <id>.${v}: ${d.descripcion}${v === "senala" || v === "ofrece" ? ' (con "objetivo": a quién o qué)' : ""}`)
    .join("\n");
  const verbosGrupo = Object.entries(VERBOS_TODOS)
    .map(([v, d]) => `    · ${ID_TODOS}.${v}: ${d}`)
    .join("\n");
  const verbosObjeto = TIPOS_OBJETO.filter((t) => Object.keys(VERBOS_OBJETO[t]).length)
    .map((t) => `    · ${t}: ${Object.entries(VERBOS_OBJETO[t]).map(([v, d]) => `<id>.${v} (${d})`).join("; ")}`)
    .join("\n");
  return `KIT DE LUGARES (opcional): además del catálogo, puedes armar hasta ${MAX_COMPOSICIONES} lugares ilustrados ("composiciones") con estas piezas, para mostrar LITERALMENTE lo que dice la narración.
- Fondos: ${FONDOS.map((f) => `${f} (${NOMBRE_FONDO[f]})`).join(", ")}.
- Personajes (máximo 5): ${TIPOS_PERSONAJE.map((t) => `${t} (${NOMBRE_PERSONAJE[t]})`).join(", ")}.
    posicion: ${lista(POSICIONES)} | plano: frente, fondo | mira: izquierda, derecha
    pose inicial: ${lista(POSES)} | expresion inicial: ${lista(EXPRESIONES)}
    sentado_en: id de un pupitre (un niño por pupitre) | mira_a: id de otro elemento (hacia dónde mira cuando no pasa nada)
    Opcionales (si no los pones, salen variados): ropa y ropa2 (${lista(COLORES_ROPA)}), piel (${lista(PIELES)}), pelo (${lista(PELOS)}), peinado (${lista(PEINADOS)}), accesorio (${lista(ACCESORIOS)}).
- Objetos: ${TIPOS_OBJETO.map((t) => `${t} (${NOMBRE_OBJETO[t]})`).join("; ")}.
    Cada objeto va en un "lugar" (pared: ${lista(LUGARES_PARED)}; piso: ${lista(LUGARES_PISO)}) o "en_mano_de" un personaje (uno de los dos). Los pupitres van en el piso; los dibujos, en la pared o en una mano. Cada personaje sostiene una sola cosa. Una sola cartelera.
    dibujo: "motivo" opcional (${lista(MOTIVOS_DIBUJO)}). "visible": false si no se ve hasta su acción "aparece". "plano": frente o fondo (en el piso).
- Pared: ${lista(PAREDES)} (opcional).
- Acciones en un lugar del kit: "escena" = el id de la composición; "accion" = "<id del elemento>.<verbo>".
  Personajes:
${verbosPersonaje}
  Todos a la vez (un solo personaje no alcanza para "todos aplauden"):
${verbosGrupo}
  Objetos:
${verbosObjeto}
- REGLAS DEL KIT:
  1. Úsalo SOLO si la narración (o la metáfora que elijas) habla de algo que estas piezas muestran tal cual (un salón, una profesora, niños, una cartelera con dibujos, dulces, pupitres). Si no, usa solo el catálogo: no fuerces el kit.
  2. Ids: la composición empieza con "k_" (por ejemplo "k_salon"); los elementos, en minúsculas y cortos ("profesora", "nino", "dibujo_nina"). "${ID_TODOS}" está reservado.
  3. Pon en la composición todo lo que la narración nombra en ese lugar (quién hace qué y con qué), y nada más. Si alguien da o señala algo, ese algo existe en la composición.
     Nadie de pie justo delante de lo que está en la pared: si la cartelera va en pared_centro, nadie en posicion "centro" (ponlos a los lados o sentados).
     Deja aire: la cámara necesita mostrar cada cosa sin cortar a nadie en el borde, así que no rodees la cartelera de gente por los dos lados; agrupa a los personajes de un lado o ponlos atrás.
  4. Lo que se ve no contradice la frase: si la voz dice "todos aplauden", usa ${ID_TODOS}.aplaude; nadie triste mientras la voz celebra.
  5. La cámara es automática (encuadra lo nombrado, nunca corta caras, cambia de plano cada ~2 s con detalles y reacciones): no la describas. Solo cuida que cada acción nombre a quien la hace.
  8. Pon solo a los protagonistas (los que la narración nombra o que hacen algo): el código completa el lugar con niños sentados al fondo, variados y mirando lo que pasa (sus ids empiezan con "${PREFIJO_EXTRA}"; no los uses).
  9. Nunca en fila: con 3 o más personajes usa profundidades distintas (alguien "plano": "fondo" o sentado en un pupitre).
  10. Si la narración dice que alguien se aburre o se distrae, usa <id>.se_distrae (o ${ID_TODOS}.se_distrae): pone cara de aburrido y mira para otro lado.
  6. En el mismo lugar del kit, deja al menos 1 palabra entre acciones de elementos distintos (la cámara corta a cada uno).
  7. Entre el celular (feed, chat, perfil) y un lugar del kit vale la regla de lugares distintos: la cámara entra por la pantalla del celular.
- Ejemplo de composición (no la copies: compón la que pida TU narración):
${JSON.stringify(COMPOSICION_SALON)}`;
}
