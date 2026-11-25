// "Historia narrada" (visuales-v2, 24 nov 2026), la parte pura: el prompt,
// la revisión de que la IA siguió el texto del usuario frase por frase (en
// su orden, sin volverlo consejos numerados ni agregar nada), el guion que
// arma el código a partir de esas frases y el cierre con el cartel de
// opciones. La orquestación (IA, plan ilustrado, voz) está en
// app/lib/videoOrganico/generarHistoriaNarrada.ts. Lo usa también
// "Agregar reel" (sugerir el formato).
import type { GanchoTipoOrganico } from "@/video/guion.schema";
import type { TemaGuion } from "@/video/tema";
import type { FrasePlan } from "@/video/ilustrado/motor/plan";
import type { IconoOpcion, OpcionesCartel } from "@/video/ilustrado/motor/catalogo";

export const MIN_FRASES_HISTORIA = 3;
export const MAX_FRASES_HISTORIA = 7;
export const MAX_PALABRAS_FRASE = 24;
// ~30 s de voz a ritmo natural.
export const MAX_PALABRAS_HISTORIA = 90;
export const MAX_CARACTERES_OPCION = 30;

// ¿El texto parece una historia (para sugerir este formato en "Agregar reel")?
// Empieza con "Imagina…", cuenta algo que pasa ("había una vez", "un día") o
// termina pidiendo elegir entre A y B.
export function pareceHistoria(texto: string | null | undefined): boolean {
  const t = normalizar(texto ?? "").trim();
  if (!t) return false;
  return /^imagin(a|ate|e)\b/.test(t) || /\b(habia una vez|erase una vez|un dia\b|una vez\b)/.test(t) || terminaEnOpciones(texto ?? "");
}

// ¿Termina preguntando por A o B? ("Opción A: ... Opción B: ... ¿Qué harías? Comenta A o B")
export function terminaEnOpciones(texto: string): boolean {
  const t = texto.replace(/\s+/g, " ");
  return (/\bopci[oó]n\s+a\b/i.test(t) && /\bopci[oó]n\s+b\b/i.test(t)) || /\bA\s+o\s+B\b/.test(t);
}

// ---------- Prompt ----------
export function construirPromptHistoria(texto: string, negocio: string, erroresPrevios?: string[]): string {
  const conOpciones = terminaEnOpciones(texto);
  const partes = [
    `Eres el guionista de reels de Quiubot. Este reel es una HISTORIA NARRADA: una voz cuenta, frase por frase, el texto que escribió el usuario, y cada frase se ilustra. Español colombiano, tuteo.`,
    `TEXTO DEL USUARIO (es SU historia: síguela, no la cambies):
"""
${texto.trim()}
"""`,
    `Tu trabajo es SOLO adaptarlo a voz:
- Una frase por escena, en el MISMO orden del texto. Entre ${MIN_FRASES_HISTORIA} y ${MAX_FRASES_HISTORIA} frases. Puedes partir una frase larga en dos o juntar dos muy cortas, pero NUNCA cambiar el orden, quitar una idea ni agregar ideas, ejemplos o datos que el usuario no escribió.
- NO lo conviertas en consejos ni en una lista numerada ("uno", "dos", "primero", "consejo"): es un relato.
- Frases cortas y naturales para la voz: máximo ${MAX_PALABRAS_FRASE} palabras por frase y unas ${MAX_PALABRAS_HISTORIA} en total (unos 30 segundos). Usa sus mismas palabras siempre que puedas.
- Números siempre en letras ("trescientos mil pesos", nunca "300.000"). Sin emoji ni signos raros.
- La primera frase es el gancho: la del usuario, o su versión más corta y directa (si empieza con "Imagina", se queda así).
- Datos: solo los que escribió el usuario o los de QUÉ HACE ESTE NEGOCIO. Nunca inventes cifras, precios, nombres ni resultados.`,
    conOpciones
      ? `El texto termina pidiendo elegir entre dos opciones (A o B). Además de las frases, devuelve "opciones": {"a": "...", "b": "...", "pregunta_en": N}:
- "a" y "b": lo esencial de cada opción para un cartel, máximo ${MAX_CARACTERES_OPCION} caracteres cada una, con las palabras del usuario (ej. "Promocionar el post" y "Anuncio nuevo a WhatsApp").
- "pregunta_en": el índice (desde 0) de la frase con la pregunta ("¿Qué harías tú?"). Después de esa frase va SOLO la invitación a comentar A o B (con lo que el usuario dice que pasa después, ej. que el próximo video sigue con la más votada), como última frase.`
      : `El texto no pide elegir entre opciones: "opciones" va en null.`,
    `Escribe también el caption para Instagram ("caption", máx. 2200 caracteres, el gancho en la primera línea; si hay opciones, pide comentar A o B) y "hashtags" (entre 3 y 8, en español, del rubro real del negocio, cada uno empezando con #).`,
    negocio,
    `Responde ÚNICAMENTE con este JSON, sin texto adicional:
{"frases": ["...", "..."], "opciones": ${conOpciones ? `{"a": "...", "b": "...", "pregunta_en": 0}` : "null"}, "caption": "...", "hashtags": ["#...", "#..."]}`,
  ];
  if (erroresPrevios?.length) partes.push(`La respuesta anterior NO pasó la revisión. Corrige exactamente esto y vuelve a responder con el JSON completo:\n${erroresPrevios.map((e) => `- ${e}`).join("\n")}`);
  return partes.join("\n\n");
}

// ---------- Revisión de la respuesta ----------
export type RespuestaHistoria = { frases: string[]; opciones: (OpcionesCartel & { pregunta_en: number }) | null; caption: string; hashtags: unknown };

export function leerRespuestaHistoria(crudo: unknown): { ok: true; r: RespuestaHistoria } | { ok: false; errores: string[] } {
  const o = crudo as Record<string, unknown> | null;
  const frases = Array.isArray(o?.frases) ? (o!.frases as unknown[]).filter((f): f is string => typeof f === "string").map((f) => f.trim()).filter(Boolean) : [];
  if (!frases.length) return { ok: false, errores: ['Falta "frases": la lista de frases de la historia.'] };
  const op = o?.opciones as Record<string, unknown> | null | undefined;
  const opciones = op && typeof op === "object" ? { a: String(op.a ?? "").trim(), b: String(op.b ?? "").trim(), pregunta_en: Number(op.pregunta_en) } : null;
  return { ok: true, r: { frases, opciones, caption: typeof o?.caption === "string" ? o.caption : "", hashtags: o?.hashtags } };
}

function normalizar(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
const PALABRAS_VACIAS = new Set("para pero como cuando donde este esta estos estas esto aquel aquella tiene tienes tengo tenga tenemos sobre entre desde hasta porque pues que quien cual cuales muy mas menos solo sola todo toda todos todas cada otro otra otros otras ese esa esos esas eres somos son fue era sera hace hacer haria harias tuvo tiene".split(" "));
// Los números en letras no cuentan como palabras nuevas ("300.000" -> "trescientos mil").
const NUMEROS = /^(cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|veinti\w*|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|cientos|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil|miles|millon|millones)$/;
function palabrasDeContenido(t: string): string[] {
  return normalizar(t)
    .split(/[^a-zñ0-9]+/)
    .filter((w) => w.length >= 4 && !PALABRAS_VACIAS.has(w) && !/\d/.test(w) && !NUMEROS.test(w));
}
const contar = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
// Frases del texto del usuario (por punto, signo de pregunta o exclamación).
export function frasesDelTexto(texto: string): string[] {
  return texto
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((f) => f.trim())
    .filter((f) => palabrasDeContenido(f).length > 0);
}

export function problemasDeLaHistoria(texto: string, r: RespuestaHistoria): string[] {
  const problemas: string[] = [];
  const { frases } = r;
  if (frases.length < MIN_FRASES_HISTORIA || frases.length > MAX_FRASES_HISTORIA) problemas.push(`Tienen que ser entre ${MIN_FRASES_HISTORIA} y ${MAX_FRASES_HISTORIA} frases (llegaron ${frases.length}).`);
  const total = frases.reduce((a, f) => a + contar(f), 0);
  if (total > MAX_PALABRAS_HISTORIA) problemas.push(`La historia tiene ${total} palabras: acórtala a unas ${MAX_PALABRAS_HISTORIA} (unos 30 segundos) sin quitar ninguna idea del usuario.`);
  frases.forEach((f, i) => {
    if (contar(f) > MAX_PALABRAS_FRASE) problemas.push(`Frase ${i}: "${f}" tiene ${contar(f)} palabras (máximo ${MAX_PALABRAS_FRASE}); pártela en dos.`);
    if (/\d/.test(f)) problemas.push(`Frase ${i}: "${f}" tiene dígitos; escribe los números en letras.`);
  });
  // Ni consejos numerados ni lista, a menos que el usuario los haya escrito así.
  const textoN = normalizar(texto);
  for (const [i, f] of frases.entries()) {
    const m = normalizar(f).match(/^\s*(uno|dos|tres|cuatro|cinco|primero|segundo|tercero|consejo(\s+\w+)?)\s*[:.,-]/);
    if (m && !textoN.includes(m[1])) problemas.push(`Frase ${i}: "${f}" la vuelve una lista o un consejo numerado; es un relato, sigue el texto del usuario.`);
  }
  // Fidelidad: cada frase del usuario está, en su orden; y nada de ideas nuevas.
  const deCadaFrase = frases.map((f) => new Set(palabrasDeContenido(f)));
  const todas = new Set(deCadaFrase.flatMap((s) => [...s]));
  let anterior = 0;
  for (const fu of frasesDelTexto(texto)) {
    const w = [...new Set(palabrasDeContenido(fu))];
    const cubiertas = w.filter((x) => todas.has(x)).length / w.length;
    if (cubiertas < 0.6) {
      problemas.push(`Falta (o cambió demasiado) esta frase del usuario: "${fu}". Síguela con sus palabras.`);
      continue;
    }
    // La frase de la historia donde más está (desde la anterior: el orden se respeta).
    const puntaje = deCadaFrase.map((s) => w.filter((x) => s.has(x)).length);
    const mejor = puntaje.indexOf(Math.max(...puntaje));
    if (mejor < anterior && puntaje[mejor] > puntaje[anterior]) problemas.push(`Cambió el orden: "${fu}" va después de lo anterior, como en el texto del usuario.`);
    else anterior = Math.max(anterior, mejor);
  }
  const delUsuario = new Set(palabrasDeContenido(texto));
  frases.forEach((f, i) => {
    const w = palabrasDeContenido(f);
    if (w.length >= 3 && w.filter((x) => !delUsuario.has(x)).length / w.length > 0.5) problemas.push(`Frase ${i}: "${f}" agrega cosas que el usuario no escribió; quédate con su texto.`);
  });
  // Opciones (solo si el texto las pide).
  if (terminaEnOpciones(texto)) {
    const o = r.opciones;
    if (!o) problemas.push(`Faltan "opciones": el texto termina pidiendo elegir entre A y B.`);
    else {
      for (const [k, v] of [["a", o.a], ["b", o.b]] as const) {
        if (!v) problemas.push(`Falta el texto de la opción ${k.toUpperCase()}.`);
        else if (v.length > MAX_CARACTERES_OPCION) problemas.push(`La opción ${k.toUpperCase()} ("${v}") tiene ${v.length} caracteres; máximo ${MAX_CARACTERES_OPCION}.`);
      }
      if (!Number.isInteger(o.pregunta_en) || o.pregunta_en < 1 || o.pregunta_en > frases.length - 2) problemas.push(`"pregunta_en" tiene que ser el índice de la frase de la pregunta (entre 1 y ${frases.length - 2}); después solo va la invitación a comentar.`);
    }
  } else if (r.opciones) problemas.push(`"opciones" va en null: el texto no pide elegir entre A y B.`);
  return problemas;
}

// ---------- Guion ----------
const cortar = (t: string, max: number) => {
  if (t.length <= max) return t;
  const c = t.slice(0, max - 1);
  return `${c.slice(0, Math.max(c.lastIndexOf(" "), 1)).trim()}…`;
};

// El guion que arma el código: una escena por frase. Lo que se ve lo decide
// el plan ilustrado; estas escenas solo son el respaldo sin ilustración.
// Sin tipo de Guion: el que llama lo valida con GuionSchema.
export function guionDesdeHistoria(r: RespuestaHistoria, base: { tema: TemaGuion; ganchoTipo: GanchoTipoOrganico; pistaId: string | null; hashtags: string[] | null }): Record<string, unknown> {
  const { frases, opciones } = r;
  const ultima = frases.length - 1;
  const estimada = frases.map((f, i) => Math.min(i === 0 ? 2.5 : 5, Math.max(1.5, contar(f) / 2.8)));
  const suma = estimada.reduce((a, b) => a + b, 0);
  const objetivo = Math.min(30, Math.max(4, Math.round(suma)));
  const k = suma > objetivo ? objetivo / suma : 1;
  const usuario = base.tema.instagramUsuario ? `@${base.tema.instagramUsuario.replace(/^@/, "")}` : undefined;
  const escenas = frases.map((f, i) => {
    const id = `e${i + 1}`;
    const duracion_s = Math.round(Math.max(1.5, estimada[i] * k) * 10) / 10;
    if (i === 0) return { id, bloque: "gancho", tipo: "gancho_texto", duracion_s: Math.min(2.5, duracion_s), narracion: f, params: { texto: cortar(f, 60), palabra_clave: cortar(f.split(/\s+/).slice(0, 3).join(" "), 30) } };
    if (i === ultima)
      return {
        id,
        bloque: "cta",
        tipo: "cta",
        duracion_s,
        narracion: f,
        params: opciones ? { accion: "comentar", texto_boton: "Comenta A o B" } : usuario ? { accion: "seguir", texto_boton: "Seguir", usuario } : { accion: "suave", texto_boton: "Cuéntanos" },
      };
    if (opciones && i === opciones.pregunta_en) return { id, bloque: "valor", tipo: "dos_opciones", duracion_s, narracion: f, params: { opcion_a: opciones.a, opcion_b: opciones.b } };
    return { id, bloque: "valor", tipo: "revelacion_marca", duracion_s, narracion: f, params: { frase: cortar(f, 50), mostrar_logo: false } };
  });
  return {
    version: 1,
    formato: "9x16",
    fps: 30,
    uso: "organico",
    receta_organica: "historia_narrada",
    gancho_tipo: base.ganchoTipo,
    duracion_objetivo_s: Math.round(escenas.reduce((a, e) => a + e.duracion_s, 0) * 10) / 10,
    bucle: { texto: opciones ? "¿A o B? Comenta" : "Una historia en voz", abre_en: "e1", cierra_en: `e${frases.length}`, indicador: opciones ? "espera_final" : "ninguno" },
    tema: base.tema,
    musica: { pista_id: base.pistaId, volumen: 0.35 },
    escenas,
    publicacion: { caption: r.caption, hashtags: base.hashtags ?? r.hashtags },
  };
}

// Las frases de la opción A y de la B ("Opción A: ..."), si las hay: cada
// una se ilustra con su propia escena (validarPlan).
export function frasesDeLasOpciones(escenas: { id: string; narracion: string }[]): { a: string; b: string } | undefined {
  const de = (letra: string) => escenas.find((e) => new RegExp(`^\\s*opci[oó]n\\s+${letra}\\b`, "i").test(e.narracion))?.id;
  const a = de("a");
  const b = de("b");
  return a && b ? { a, b } : undefined;
}

// La miniatura de cada opción en el cartel: la escena con que se ilustró
// (likes de la publicación, mensajes del chat, monedas de la billetera).
export function iconoDeFrase(plan: { frases: FrasePlan[] }, escenaId: string): IconoOpcion | undefined {
  const escenas = new Set(plan.frases.find((f) => f.escena_id === escenaId)?.acciones.map((a) => a.escena) ?? []);
  if (escenas.has("chat")) return "mensajes";
  if (escenas.has("publicacion") || escenas.has("feed")) return "likes";
  if (escenas.has("billetera")) return "monedas";
  return undefined;
}

// ---------- Cierre con el cartel de opciones ----------
// La pregunta y la invitación a comentar las ilustra el código (no la IA):
// el cartel aparece en la pregunta, y en la invitación se resaltan A y B
// cuando la voz las nombra y llega el comentario. Es la única excepción a
// "nada de texto grande" del reel ilustrado.
export function frasesDelCartel(escenas: { id: string; narracion: string }[], preguntaEn: number): FrasePlan[] {
  return escenas.slice(preguntaEn).map((e, k) => {
    if (k === 0) return { escena_id: e.id, acciones: [{ escena: "opciones", accion: "aparece", palabra: 0 }] };
    const palabras = e.narracion.split(/\s+/).filter(Boolean);
    const indice = (letra: string, porDefecto: number) => {
      const i = palabras.findIndex((p) => normalizar(p).replace(/[^a-z]/g, "") === letra);
      return i >= 0 ? i : porDefecto;
    };
    const n = palabras.length;
    const ia = indice("a", Math.min(n - 1, Math.floor(n / 3)));
    const ib = Math.max(ia + 1 < n ? ia + 1 : ia, indice("b", Math.min(n - 1, Math.floor((2 * n) / 3))));
    return {
      escena_id: e.id,
      acciones: [
        { escena: "opciones", accion: "comenta", palabra: 0 },
        { escena: "opciones", accion: "resalta_a", palabra: ia },
        { escena: "opciones", accion: "resalta_b", palabra: ib },
      ],
    };
  });
}
