// Lo que la IA necesita saber para componer lugares con el kit (puro).
// La IA escribe SOLO JSON con estas listas cerradas: nunca código ni SVG.
// La cámara la decide el motor con reglas automáticas (encuadreKit.ts):
// la IA no encuadra; solo elige quién está, dónde y qué hace en qué palabra.
import {
  ACCESORIOS,
  COLORES_ROPA,
  EXPRESIONES,
  FONDOS,
  DE_MANO,
  LUGARES_DE_OBJETO,
  LUGARES_PARED,
  LUGARES_PISO,
  MUEBLES,
  VEHICULOS,
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
import { ID_TODOS, VERBOS_TODOS, posicionesCercaDeLaPuerta } from "./composicion";
import { PREFIJO_EXTRA } from "./ambiente";
import { COMPOSICION_SALON } from "./planPrototipoKit";

export const MAX_COMPOSICIONES = 2;

// Ejemplo de la tanda 2: una tienda con el vendedor detrás del mostrador.
export const EJEMPLO_TIENDA = {
  id: "k_tienda",
  fondo: "tienda",
  personajes: [
    { id: "vendedor", tipo: "vendedor", posicion: "centro_derecha", plano: "fondo", mira: "izquierda", mira_a: "cliente" },
    { id: "cliente", tipo: "cliente", posicion: "izquierda", plano: "frente", mira: "derecha", mira_a: "vendedor" },
  ],
  objetos: [
    { id: "mostrador", tipo: "mostrador", lugar: "piso_centro_derecha", plano: "frente" },
    { id: "caja", tipo: "caja", sobre: "mostrador" },
    { id: "celular", tipo: "celular", en_mano_de: "vendedor" },
  ],
};

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
    sentado_en: id de un pupitre o una mesa (uno por mueble) | mira_a: id de otro elemento (hacia dónde mira cuando no pasa nada)
    Opcionales (si no los pones, salen variados): ropa y ropa2 (${lista(COLORES_ROPA)}), piel (${lista(PIELES)}), pelo (${lista(PELOS)}), peinado (${lista(PEINADOS)}), accesorio (${lista(ACCESORIOS)}).
- Objetos: ${TIPOS_OBJETO.map((t) => `${t} (${NOMBRE_OBJETO[t]})`).join("; ")}.
    Cada objeto va en UNO de tres sitios: un "lugar" (pared: ${lista(LUGARES_PARED)}; piso: ${lista(LUGARES_PISO)}), "en_mano_de" un personaje, o "sobre" un mueble (id de un mostrador, vitrina o mesa: "la torta en la vitrina" = "sobre": "vitrina").
    Muebles (${lista(MUEBLES)}) y vehículos (${lista(VEHICULOS)}) van en el piso. Se sostienen o van sobre un mueble: ${lista(DE_MANO)} (caja y bolsa también en el piso). En la pared solo la cartelera y los dibujos. Cada personaje sostiene una sola cosa. Una sola cartelera.
    Dónde tiene sentido cada cosa: ${Object.entries(LUGARES_DE_OBJETO).map(([t, ls]) => `${t} solo en ${ls!.join("/")}`).join("; ")}.
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
  1. Úsalo SOLO si la narración (o la metáfora que elijas) habla de algo que estas piezas muestran tal cual: un salón con profesora y niños; una tienda con vendedor y clientes; una cocina o una calle con una familia, personas mayores, tortas, helados, compras, una moto o un carro. Si no, usa solo el catálogo: no fuerces el kit.
  2. Ids: la composición empieza con "k_" (por ejemplo "k_salon"); los elementos, en minúsculas y cortos ("profesora", "nino", "dibujo_nina"). "${ID_TODOS}" está reservado. La misma persona en otro lugar usa el mismo id (se ve igual).
  3. Pon en la composición todo lo que la narración nombra en ese lugar (quién hace qué y con qué), y nada más. Si alguien da o señala algo, ese algo existe en la composición.
     Nadie de pie justo delante de lo que está en la pared: si la cartelera va en pared_centro, nadie en posicion "centro" (ponlos a los lados o sentados).
     Deja aire: la cámara necesita mostrar cada cosa sin cortar a nadie en el borde, así que no rodees la cartelera de gente por los dos lados; agrupa a los personajes de un lado o ponlos atrás.
  4. Lo que se ve no contradice la frase: si la voz dice "todos aplauden", usa ${ID_TODOS}.aplaude; nadie triste mientras la voz celebra.
  5. La cámara es automática (encuadra lo nombrado, nunca corta caras, cambia de plano cada ~2 s con detalles y reacciones): no la describas. Solo cuida que cada acción nombre a quien la hace.
  8. Pon solo a los protagonistas (los que la narración nombra o que hacen algo): el código completa el lugar con gente de fondo (niños sentados en el salón, clientes en la tienda, gente en la calle), variada y mirando lo que pasa (sus ids empiezan con "${PREFIJO_EXTRA}"; no los uses).
  9. Nunca en fila: con 3 o más personajes usa profundidades distintas (alguien "plano": "fondo" o sentado en un pupitre).
  10. Si la narración dice que alguien se aburre o se distrae, usa <id>.se_distrae (o ${ID_TODOS}.se_distrae): pone cara de aburrido y mira para otro lado.
  11. Llegar e irse: <id>.entra (aparece por la puerta del lugar y camina a su lugar; si lo primero que hace es entrar, antes no está) y <id>.se_va (camina hacia la puerta y desaparece). Quien está sentado no entra ni se va. Solo entra quien no está y solo se va quien está: para que alguien "vuelva", primero <id>.se_va y después <id>.entra. Quien se fue no hace nada hasta que vuelve a entrar. Quien entra o se va tiene que estar cerca de la puerta del lugar (${(["tienda", "cocina", "calle"] as const).map((f) => `en ${f === "calle" ? "la calle" : f === "cocina" ? "la cocina" : "la tienda"}: ${posicionesCercaDeLaPuerta(f).map((x) => `"${x}"`).join(", ")}`).join("; ")}).
      Nadie se va sonriendo de donde no lo atendieron: si se va porque lo ignoraron, lo hicieron esperar o algo salió mal, unas palabras antes pon <id>.se_aburre (o <id>.triste). Ejemplo: "Cuando un cliente entra y nadie lo saluda, se va" = cliente.entra en "un", vendedor.mira_el_celular en "y", cliente.se_aburre en "saluda" y cliente.se_va en "va".
      Para "no se vende solo", "nadie lo mira" o "pasa desapercibido": el producto solo en su lugar (en la vitrina o el estante, con <id>.destaca) y una o dos personas que <id>.pasa_de_largo (cruzan el cuadro mirando al frente, sin mirarlo; no están antes ni después). Ejemplo: "Una torta en la vitrina no se vende sola" = torta "sobre" la vitrina + cliente.pasa_de_largo en "no" y abuela.pasa_de_largo en "sola".
      Para "nadie lo saluda" usa al vendedor con <id>.mira_el_celular (y un celular en su mano). Para "compra", la bolsa en la mano de quien compra ("en_mano_de", "visible": false) y <bolsa>.aparece en la palabra.
  6. En el mismo lugar del kit, deja al menos 1 palabra entre acciones de elementos distintos (la cámara corta a cada uno).
  7. Entre el celular (feed, chat, perfil) y un lugar del kit vale la regla de lugares distintos: la cámara entra por la pantalla del celular.
- Ejemplos de composición (no los copies: compón la que pida TU narración):
${JSON.stringify(COMPOSICION_SALON)}
${JSON.stringify(EJEMPLO_TIENDA)}`;
}
