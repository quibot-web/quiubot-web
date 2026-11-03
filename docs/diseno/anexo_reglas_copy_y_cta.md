# Anexo para el plan de video Fase 1: reglas de copy y CTA (copiado de n8n)

Copiado literal de los workflows activos que exportó Juan José, para que Code lo replique en `video/` sin tener acceso a n8n.

## 1. COPY QUE VENDE (de `generar_estrategia v5`, nodo "armar prompt reparación")
Úsalo en el prompt del guion para los objetivos de **venta, leads, tráfico y volver a impactar**. En **reconocimiento y seguidores** aplica solo la parte de "prohibido" y "no inventar"; la parte de "que escriba ya" no, porque ahí el enfoque es valor.

```text
COPY QUE VENDE — REGLA OBLIGATORIA (tan importante como la estructura):
"No inventar datos" NO significa "escribir sin vender". Un anuncio existe para que la persona QUIERA el producto y escriba ya.
- Vende con beneficios reales: lo que el producto le permite hacer, lograr, sentir o ahorrar a la persona. Puedes usar los beneficios propios de la categoria del producto que ves (lo que cualquier experto sabe que hace ese tipo de producto; ej.: una soldadora inverter es liviana y portatil, un taladro percutor perfora concreto, una crema hidratante deja la piel suave), sin inventar cifras exactas (potencia, medidas, duracion, precios, descuentos) que no esten en la imagen ni en los DATOS COMERCIALES DEL NEGOCIO.
- Los DATOS COMERCIALES DEL NEGOCIO (precio, envios, garantia, combos, promociones, diferenciales) son verdad dicha por el dueno: usalos en el copy y en "copy.descripcion" siempre que existan.
- Escribe con seguridad, como el dueno de un negocio que conoce y respalda lo que vende. Tono de vendedor experto y cercano, nunca de notario ni de abogado.
- PROHIBIDO en titulo, texto y descripcion: frases de descargo o de duda sobre la propia oferta, como "confirma que incluye", "te confirmamos precio y disponibilidad", "informacion comercial disponible", "antes de decidir", "antes de comprar", "verifica", "contenido exacto de la oferta", "no asumas", "sujeto a", "condiciones disponibles", "especificaciones disponibles".
- PROHIBIDO hablar de la imagen como si fuera una pieza: "los equipos mostrados", "las herramientas mostradas", "opciones visibles", "visible en la pieza", "en la grafica", "en la imagen". Habla del PRODUCTO, no de la foto.
- Si no tienes precio, NO lo conviertas en una duda: convierte la falta del dato en una invitacion con valor ("Escribenos y te cotizamos hoy", "Pregunta por el combo", "Te asesoramos para que te lleves el que tu trabajo necesita").
- La duda del cliente es un angulo valido (objecion_resuelta), pero se RESUELVE con seguridad ("Te asesoramos por WhatsApp y te llevas exactamente lo que necesitas"), no se amplifica ("¿Todo viene incluido? No asumas").
- Si no hay urgencia ni prueba social reales, no las inventes y NO las reemplaces con advertencias: compensa con un beneficio concreto, un gancho fuerte y un CTA claro.
- "copy.descripcion": un beneficio o dato de venta corto ("Envios a todo el pais", "Para taller y obra", "Asesoria por WhatsApp"), nunca una referencia a la imagen.
Estas frases de descargo se detectan automaticamente en codigo: un anuncio que las use sera rechazado y reescrito.
```

## 2. Detector de frases de descargo (de `generar_estrategia v5`, nodo "validar diversidad")
Replícalo en `video/reglasCopy.ts` y pásalo por **todos los textos del guion** (subtítulos y `params`), normalizando a minúsculas y sin tildes como hace el original. Si hay coincidencias, se reescribe el guion una vez con los motivos.

```js
const DESCARGOS = [
  [/confirm(a|ar|amos|e)\b[^.]{0,40}(incluye|precio|disponibilidad|especificacion|condicion)/, "pide confirmar precio, disponibilidad o contenido"],
  [/informacion comercial/, "dice \"informacion comercial\""],
  [/antes de (decidir|comprar|tomar)/, "dice \"antes de decidir/comprar\""],
  [/\bverific(a|ar|amos|ues)\b/, "pide verificar"],
  [/contenido exacto/, "dice \"contenido exacto\""],
  [/no asumas/, "dice \"no asumas\""],
  [/sujet[oa]s? a /, "dice \"sujeto a\""],
  [/(condiciones|especificaciones|informacion) disponibles?/, "habla de informacion/condiciones \"disponibles\""],
  [/(equipos?|herramientas?|productos?|opciones|elementos?) (mostrad|visible)/, "habla de lo \"mostrado\" en la imagen"],
  [/\bvisibles?\b/, "habla de lo \"visible\" en la imagen"],
  [/en la (pieza|grafica|imagen|foto)\b/, "se refiere a la pieza o la imagen"],
];
function motivosCopy(a) {
  const c = a.copy || {};
  const t = [c.titulo, c.texto, c.descripcion].join(" \n ")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return DESCARGOS.filter(([re]) => re.test(t)).map(([, m]) => `copy timido: ${m}`);
}

// Devuelve la lista de anuncios a reparar en una estrategia.
// Siempre se conserva el PRIMER anuncio de cada par en conflicto y se
// repara el segundo, asi nunca se reparan los dos a la vez.
```

## 3. Botón de Meta por objetivo (de `publicar_estrategia v10`, nodo "Preparar datos y mapear objetivo")
El texto del CTA del video tiene que ser coherente con el botón que Meta muestra debajo del anuncio.

```js
let linkDestino = "";
let ctaDefault = "LEARN_MORE";

if (objetivoId === "venta_directa_whatsapp") {
  const numero = (usuario.whatsapp_numero || "").replace(/\D/g, "");
  // Clic a WhatsApp (documentacion de Meta): link fijo a api.whatsapp.com
  // y boton WHATSAPP_MESSAGE con app_destination WHATSAPP. Meta usa el
  // numero de WhatsApp vinculado a la Pagina. Con MESSAGE_PAGE (Messenger)
  // Meta rechaza el creativo: error 2490279, destino inconsistente.
  linkDestino = "https://api.whatsapp.com/send";
  ctaDefault = "WHATSAPP_MESSAGE";
} else if (objetivoId === "seguidores_instagram") {
  // Visitas al perfil de Instagram (probado en Meta: PROFILE_VISIT + INSTAGRAM_PROFILE).
  // La app manda la cuenta en body.instagram = { id, username }.
  const ig = body.instagram || {};
  if (!ig.id || !ig.username) {
    throw new Error("Falta la cuenta de Instagram (body.instagram.id y username) para publicar una campaña de seguidores de Instagram.");
  }
  linkDestino = `https://www.instagram.com/${ig.username}`;
  ctaDefault = "VIEW_INSTAGRAM_PROFILE";
} else if (objetivoId === "seguidores_facebook") {
  // "Me gusta" de la pagina: el anuncio lleva a la propia Pagina de Facebook.
  linkDestino = usuario.meta_page_id ? `https://www.facebook.com/${usuario.meta_page_id}` : "";
  ctaDefault = "LIKE_PAGE";
} else {
  // Si no hay sitio web configurado (comun en reconocimiento/retargeting/
  // leads/trafico_mensajes, que no siempre dependen de un sitio externo),
  // se usa la URL de la propia Pagina de Facebook como respaldo -- Meta
  // exige un link en el creativo aunque el objetivo principal sea solo
  // "reconocimiento", y la Pagina siempre existe en este punto porque
  // conectar Meta ya es requisito previo mas arriba en el workflow. Sin
  // este respaldo, un link vacio hace que Meta rechace la publicacion.
  linkDestino = usuario.sitio_web || (usuario.meta_page_id ? `https://www.facebook.com/${usuario.meta_page_id}` : "");
  ctaDefault = objetivoId === "venta_directa_web" ? "SHOP_NOW" : "LEARN_MORE";
}

// CTA por PALABRAS CLAVE en vez de texto exacto -- la IA no siempre repite
// la misma frase literal ("Compra ahora" vs "Comprar ahora"), asi que un
// diccionario de coincidencia exacta fallaba en silencio y caia al CTA
// generico por defecto sin avisar.
function resolverCTA(ctaTexto, fallback) {
  const t = String(ctaTexto || "").toLowerCase();
  if (/compr|carrito|tienda|oferta|descuento|colecci/.test(t)) return "SHOP_NOW";
  if (/mensaje|whatsapp|escrib|chat/.test(t)) return "MESSAGE_PAGE";
  if (/registr|inscrib|apunta/.test(t)) return "SIGN_UP";
  if (/contact|llama|habla con|asesor/.test(t)) return "CONTACT_US";
  if (/descarga/.test(t)) return "DOWNLOAD";
  if (/conoce|m[aá]s info|aprende|descubre|explora/.test(t)) return "LEARN_MORE";
  return fallback;
}

const presupuestoCop = body.estrategia?.campana?.presupuesto_diario_cop || 20000;

let adAccountId = usuario.meta_ad_account_id || "";
if (adAccountId && !adAccountId.startsWith("act_")) {
  adAccountId = "act_" + adAccountId;
}

// El boton tiene que coincidir con el destino del conjunto (error 2490279):
// - WhatsApp: SIEMPRE WHATSAPP_MESSAGE, diga lo que diga el texto del CTA.
// - Web/trafico/leads/reconocimiento: nunca un boton de mensajeria
//   (MESSAGE_PAGE abre Messenger, que choca con destino sitio web).
function ctaCoherente(ctaTexto) {
  if (objetivoId === "venta_directa_whatsapp") return "WHATSAPP_MESSAGE";
  if (objetivoId === "seguidores_facebook") return "LIKE_PAGE";
  if (objetivoId === "seguidores_instagram") return "VIEW_INSTAGRAM_PROFILE";
  const cta = resolverCTA(ctaTexto, ctaDefault);
  return cta === "MESSAGE_PAGE" ? "CONTACT_US" : cta;
}
```

Equivalencia propuesta (texto del botón de Meta en español → `accion` y texto del CTA del video):

| Objetivo | Botón de Meta | `accion` del video | Texto sugerido del CTA del video |
|---|---|---|---|
| venta_directa_whatsapp | WHATSAPP_MESSAGE ("Enviar mensaje de WhatsApp") | whatsapp | "Escríbenos por WhatsApp" |
| venta_directa_web | SHOP_NOW por defecto ("Comprar") | web | "Compra aquí" |
| trafico_mensajes, visitas_web | LEARN_MORE por defecto ("Más información") | web | "Mira todo aquí" |
| retargeting | LEARN_MORE o SHOP_NOW según el texto del CTA, link al sitio | web | "Míralo aquí" / "Compra aquí" |
| leads | según el texto del CTA (formulario instantáneo) | formulario | "Pide tu cotización gratis" |
| reconocimiento | LEARN_MORE ("Más información"), link al sitio o a la página | suave | Logo + frase de marca, opcional "Conócenos" |
| seguidores_facebook | LIKE_PAGE ("Me gusta la página") | seguir | "Síguenos en Facebook" |
| seguidores_instagram | VIEW_INSTAGRAM_PROFILE ("Ver perfil de Instagram") | seguir | "Síguenos en Instagram @usuario" |

Nota: `retargeting` en `objetivos_config` tiene destino `sitio_web`, así que su CTA del video es `web`, no WhatsApp.
