// Arreglos triviales sobre el JSON crudo que devuelve la IA, antes de
// validarlo con zod -- pedido explícito tras el caso real del 14 nov
// 2026: un guion que falla solo por un detalle mecánico (duraciones que
// no cuadran, hashtags repetidos o de más) no debería gastar un
// reintento completo con la IA. Ninguno de estos arreglos cambia el
// CONTENIDO que escribió la IA (ni el texto, ni los items, ni el orden
// de bloques) -- solo ajustan números/duplicados que el código puede
// corregir con certeza. Puros, sin red, para poder probarlos sueltos.

// Mismos topes que el superRefine de GuionSchema (guion.schema.ts): la
// primera escena (el gancho) mide 2.5s o menos; cualquier otra escena
// mide entre 1.5s y 5s (EscenaBase). Si la IA no se acercó a la
// duración pedida, se reescala cada duracion_s proporcionalmente para
// que la suma quede en el objetivo, respetando esos topes -- nunca se
// inventa ni se borra una escena.
export function ajustarDuracionesProporcional(escenasCrudas: unknown, duracionObjetivoS: number): unknown {
  if (!Array.isArray(escenasCrudas) || escenasCrudas.length === 0) return escenasCrudas;

  const duraciones = escenasCrudas.map((e) => {
    const d = (e as Record<string, unknown> | null)?.duracion_s;
    return typeof d === "number" && Number.isFinite(d) && d > 0 ? d : null;
  });
  // Si falta o está mal alguna duracion_s, no se toca nada -- que zod
  // reporte el campo real que está mal, no un número inventado encima.
  if (duraciones.some((d) => d === null)) return escenasCrudas;

  const suma = (duraciones as number[]).reduce((acc, d) => acc + d, 0);
  if (suma <= 0 || Math.abs(suma - duracionObjetivoS) <= 2) return escenasCrudas;

  const factor = duracionObjetivoS / suma;
  return escenasCrudas.map((e, i) => {
    const original = duraciones[i] as number;
    const topeEscena = i === 0 ? 2.5 : 5;
    const ajustada = Math.min(topeEscena, Math.max(1.5, Math.round(original * factor * 10) / 10));
    return { ...(e as Record<string, unknown>), duracion_s: ajustada };
  });
}

// Quita hashtags duplicados (comparando sin "#" y sin mayúsculas, que
// es como Instagram los trata igual) y recorta a 8 si sobran -- nunca
// agrega ninguno si faltan (eso sí necesita contenido real, se deja
// para el reintento con la IA). Devuelve null si la entrada ni
// siquiera es un array, para que zod reporte ese error tal cual.
export function limpiarHashtags(hashtagsCrudos: unknown): string[] | null {
  if (!Array.isArray(hashtagsCrudos)) return null;

  const vistos = new Set<string>();
  const limpios: string[] = [];
  for (const h of hashtagsCrudos) {
    if (typeof h !== "string") continue;
    const recortado = h.trim();
    if (!recortado) continue;
    const clave = recortado.replace(/^#+/, "").toLowerCase();
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    limpios.push(recortado.startsWith("#") ? recortado : `#${recortado}`);
  }
  return limpios.slice(0, 8);
}

// El video ya numera cada item de lista_numerada con un círculo (1, 2,
// 3) -- caso real (revisión de calidad): la IA a veces antepone su
// propio "1/3 " al texto del item, igual que el contador se numeraba
// dos veces. Quita ese prefijo si aparece ("1/3 ", "2. ", "3) "), nunca
// toca el resto del texto. Opera sobre las escenas crudas (antes del
// zod), solo en escenas tipo "lista_numerada" -- las demás quedan tal
// cual.
// "N/M " (contador tipo "1/3") siempre se considera numeración; un
// dígito suelto solo cuenta como numeración si lo sigue una puntuación
// real (". " "): ": ") -- así nunca se come un número que de verdad
// forma parte del consejo (ej. "5 formas de ahorrar" no pierde el "5").
const PREFIJO_NUMERACION = /^\s*(\d+\s*\/\s*\d+|\d+[.):])\s*/;

export function limpiarNumeracionItemsLista(escenasCrudas: unknown): unknown {
  if (!Array.isArray(escenasCrudas)) return escenasCrudas;
  return escenasCrudas.map((e) => {
    const escena = e as Record<string, unknown> | null;
    if (!escena || escena.tipo !== "lista_numerada") return e;
    const params = escena.params as Record<string, unknown> | null;
    if (!params || !Array.isArray(params.items)) return e;
    const itemsLimpios = params.items.map((item) => (typeof item === "string" ? item.replace(PREFIJO_NUMERACION, "").trim() : item));
    return { ...escena, params: { ...params, items: itemsLimpios } };
  });
}
