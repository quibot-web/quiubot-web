# Videos de anuncio con código — Fase 1 (plan para Claude Code)

**Estado:** diseño aprobado por Juan José para investigar. **No programes todavía:** primero lee el código real, contrasta este plan y muéstrame el tuyo con lo que cambies.
**Alcance de la Fase 1:** solo admin, sin voz. Videos de anuncio cortos (6–20 s según el objetivo) hechos con Remotion usando el ADN de marca y fotos o videos reales del álbum. **La estructura del video depende del objetivo de la campaña** (sección 3B): no todos son de venta por WhatsApp. Reemplaza en `/video` el flujo de Kling (`generar_video_fragmentos_v18`).

**Principio que no cambia con ningún objetivo:** **gancho → bucle abierto → desarrollo → cierre del bucle → CTA.** Lo que cambia es el enfoque del desarrollo (venta, valor, curiosidad, marca) y qué acción pide el CTA.
**Reglas de siempre:** el SQL lo corre Juan José, nada a `main` sin su confirmación, cada commit compila, `npm run build` antes de cada push, push solo a `dev`, y no crear cuentas ni escribir en la base de datos desde tu lado.

---

## 1. Arquitectura en una línea

`/video` (admin) → **guion con IA** (JSON validado) → **vista previa en vivo** con `@remotion/player`, que no gasta render → **trabajos_ia `render_video_anuncio`** → **worker de render** (servicio aparte en Coolify) → mp4 + portada en Cloudinary → **callback** a la app → pieza nueva en el **álbum** → se usa con el contrato de creativo de video existente y `publicar_estrategia v10` sin cambios.

Las escenas son **un solo código compartido**: el reproductor del navegador y el worker usan exactamente los mismos componentes. Lo que se ve en la vista previa es lo que sale en el mp4.

---

## 2. Estructura de carpetas propuesta

```
video/                      ← código compartido (app + worker)
  escenas/                  ← un componente React por escena
  capas/                    ← subtítulos, logo, música, barra de progreso
  tema.ts                   ← ADN → colores/fuente con chequeo de contraste
  guion.schema.ts           ← zod: esquema y validación del guion v1
  Composicion.tsx           ← arma la secuencia a partir del guion
  fixtures/                 ← 3 guiones de ejemplo para probar
video-worker/               ← servicio de render (Node + Remotion)
  server.ts                 ← POST /render, GET /salud
  Dockerfile
app/api/video/...           ← rutas nuevas de la app
```

Si ves mejor un workspace o paquete interno, propónlo. Lo importante es que no haya dos copias de las escenas.

---

## 3. Escenas iniciales (Fase 1)

Formato principal **9:16 (1080×1920, 30 fps)**. Todo texto e información importante va dentro de la **zona segura de Reels/Stories**: deja libre aproximadamente el 14 % de arriba, el 35 % de abajo y el 6 % a cada lado. Verifica las cifras vigentes en la guía de Meta. Agrega un interruptor "ver zona segura" en la vista previa (solo admin) que la pinte encima.

| # | `tipo` | Bloque típico | Qué muestra | Parámetros (`params`) |
|---|---|---|---|---|
| 1 | `gancho_texto` | gancho | Titular grande que entra palabra por palabra, con una palabra resaltada en el color de marca y un sticker opcional. Base: la escena 1 del reel «Promocionar». | `texto` (≤ 60 car.), `palabra_clave`, `sticker?` (≤ 14 car., ej. "NUEVO", "-20%") |
| 2 | `problema_dato` | problema | Un dato o dolor con contador animado ("Llevas 3 meses buscando…", "$0 ventas"), o una frase de dolor con icono. Base: el contador de dinero y la tarjeta de "0 ventas". | `titulo` (≤ 50), `valor_desde?`, `valor_hasta?`, `prefijo?`, `sufijo?`, `etiqueta?` (≤ 30) |
| 3 | `producto_hero` | producto | **Foto o video real del álbum** a pantalla completa con zoom lento (Ken Burns si es foto, video recortado si es video), nombre del producto y check de marca. Base: "producto con check". | `media_id` (de las piezas elegidas), `nombre` (≤ 40), `etiqueta?` (≤ 20) |
| 4 | `beneficios_lista` | beneficio | 2 o 3 beneficios que entran con check, uno tras otro. Base: los ✓ del carrusel. | `titulo?` (≤ 40), `items` [2–3] (≤ 36 c/u) |
| 5 | `cta` | cta | Cierre obligatorio. Tiene **variantes según `accion`**: `whatsapp` (burbujas de clientes llegando + botón "Escríbenos por WhatsApp"), `web` (botón "Compra en la web" / "Míralo en la web" con cursor que hace clic), `formulario` ("Pide tu cotización gratis" con un formulario corto que se llena), `seguir` (perfil con botón "Seguir" que se presiona y contador que sube), `suave` (solo logo + frase de marca, sin pedir nada, para reconocimiento). Base: chats llegando, selector con cursor y caja de comentario del prototipo. | `accion`, `texto_boton` (≤ 28), `mensajes?` [0–3] (≤ 32 c/u, solo whatsapp), `usuario?` (@handle, solo seguir), `subtexto?` (≤ 40) |
| 6 | `lista_numerada` | valor / bucle | 3 puntos numerados que aparecen uno por uno con contador "1/3, 2/3, 3/3" visible. **Es el bucle natural:** quien ve el 1 quiere ver el 3. Sirve para consejos, razones o pasos. | `titulo` (≤ 45), `items` [3] (≤ 40 c/u) |
| 7 | `revelacion_marca` | marca | Logo, nombre y `frase_corta` del ADN, que entran con las formas y colores de la marca. Para reconocimiento y cierres de valor. | `frase` (≤ 50), `mostrar_logo` |
| 8 (opcional) | `oferta_precio` | oferta | Tarjeta de precio u oferta, con precio anterior tachado opcional. **Solo si el precio vino en `datos_producto` o `info_adicional`.** | `precio`, `precio_antes?`, `nota?` (≤ 30) |
| 9 (opcional) | `objecion_respuesta` | objeción | Pregunta del cliente ("¿Y si no me queda?") que se tacha y se reemplaza por la respuesta ("Cambio gratis en 30 días"). Para volver a impactar. **Solo con datos reales de `info_adicional`.** | `objecion` (≤ 40), `respuesta` (≤ 40) |

La fila 2 (`problema_dato`) también acepta una variante `pregunta` (una pregunta grande sin cifras) para objetivos de valor o curiosidad.

**Capas globales,** que van encima de todas las escenas:
- **Subtítulos** palabra por palabra al ritmo de lectura (unas 2,8 palabras por segundo), con `palabra_clave` en un recuadro del color de marca. En la Fase 1 no hay voz: el subtítulo es el copy en pantalla de cada escena.
- **Logo** de la marca en una esquina dentro de la zona segura, si hay logo en el ADN.
- **Música** de fondo con entrada y salida suave (ver la sección 8).
- **Transiciones** cortas entre escenas, de 6 a 8 cuadros (empuje, escala o barrido). Cambio de plano cada 2–4 s.

- **Capa de bucle** (`bucle`): un indicador pequeño que mantiene abierta la promesa hasta que se cumple. Puede ser "1/3" fijo en una esquina, "👀 espera al final" o una barra de progreso de la promesa. Aparece desde la escena 2 y desaparece en la escena que cierra el bucle.

**Reglas visuales:**
- Cada escena debe verse bien con **cualquier** paleta de ADN.
- Usa la lógica de contraste que ya existe en Mi marca (`colorEspiralA/B`, con respaldo al morado) para garantizar que el texto se lea.
- Si una escena no tiene media del producto, nunca queda un hueco: usa un fondo de marca con forma.

---

## 3B. Recetas por objetivo

Cada objetivo de campaña tiene su **receta**: qué bloques van, en qué orden, cuánto dura y qué pide el CTA. La IA recibe la receta del objetivo y la sigue. El zod valida que el guion la cumpla. **Usa los ids reales de `objetivos_config`** y dime si alguno de esta tabla no existe o se llama distinto.

| Objetivo | Enfoque | Duración | Estructura (bloques en orden) | Bucle típico | CTA (`accion`) |
|---|---|---|---|---|---|
| Ventas por WhatsApp (`conversaciones_whatsapp`) | Venta directa: deseo o dolor → producto real | 10–20 s | gancho → problema → **producto** → beneficio u oferta → cta | "Mira cómo quedó…" o el contador del problema | `whatsapp` |
| Ventas en el sitio web (`ventas_web`) | Venta con urgencia u oferta | 10–20 s | gancho → **producto** → beneficio → oferta (si hay precio) → cta | "Hasta agotar…" u oferta que se revela al final | `web` ("Compra aquí") |
| Contactos (`leads`) | Valor a cambio de datos: lo que recibe al dejar sus datos | 12–20 s | gancho (problema) → bucle con una promesa ("te digo cuánto cuesta…") → valor (lista_numerada o beneficios) → cta | Promesa que se cumple en el formulario | `formulario` ("Pide tu cotización gratis") |
| Visitas al sitio web (`visitas_web`) y Clics al enlace | Curiosidad: mostrar una parte y dejar el resto en la web | 8–15 s | gancho (pregunta) → lista_numerada con **solo 2 de 3** visibles → cta | "La 3ª está en la web" | `web` ("Mira todo aquí") |
| Reconocimiento (`reconocimiento`) | **Menos venta, más valor y recordación.** Un consejo útil, un dato curioso o una emoción ligada a la marca. La marca está presente todo el tiempo con sus colores y su logo pequeño, no como presentación al inicio. | 6–15 s | gancho (dato o pregunta) → valor (lista_numerada o consejo) → **revelacion_marca** → cta suave | "Dato que no sabías…" que se resuelve en el valor | `suave` (sin pedir compra; como máximo "Conócenos") |
| Seguidores en Instagram / Facebook (`seguidores_instagram`, `seguidores_facebook`) | Valor en serie: "esto y más si nos sigues" | 8–15 s | gancho → valor (lista_numerada: consejo, truco o tendencia) → cta | "Parte 1 de…" y "sigue para la parte 2" | `seguir` (con el @ de la cuenta) |
| Volver a impactar (`remarketing`) | Quien ya te conoce: resolver dudas y empujar | 8–15 s | gancho ("¿Todavía lo estás pensando?") → **objecion_respuesta** (1–2) → producto → oferta si hay → cta | La objeción que se tacha | `whatsapp` o `web`, según dónde vende la marca |

**Reglas de retención (para todos los objetivos):**
- **El primer cuadro ya tiene movimiento y texto.** Nada de presentación con logo, ni pantalla en negro ni fundido de entrada. En reconocimiento la marca va integrada, no como intro.
- **El gancho dura ≤ 2,5 s y abre el bucle:** pregunta sin responder, promesa numerada, antes y después tapado, o un dato sorprendente.
- **El bucle se tiene que cerrar.** La promesa del gancho se cumple antes o durante el CTA; si no, el usuario se siente engañado y el anuncio pierde calidad. El zod lo valida (sección 4).
- **Cambio visual cada 2–3 s** (escena, zoom, palabra que entra o contador) para cortar la monotonía.
- **El CTA del video coincide con el botón del anuncio** que publica `publicar_estrategia v10` para ese objetivo (por ejemplo, no decir "Escríbenos por WhatsApp" en una campaña de tráfico web). Revisa qué `call_to_action` usa hoy cada objetivo y alinéalo.
- **Arco de color:** el problema va en tono de alerta y la solución en el color de marca. En reconocimiento y seguidores, todo el video va en colores de marca para reforzar la recordación.

---

## 4. Esquema del guion v1 (`video/guion.schema.ts`, con zod)

```jsonc
{
  "version": 1,
  "formato": "9x16",                 // Fase 1: solo "9x16". "4x5" queda para después.
  "fps": 30,
  "objetivo": "reconocimiento",      // id real de objetivos_config; define la receta
  "duracion_objetivo_s": 12,         // dentro del rango de la receta del objetivo
  "bucle": {                         // la promesa que mantiene la atención
    "texto": "3 trucos para que tu café dure más",
    "abre_en": "e1",                 // escena donde se abre (normalmente el gancho)
    "cierra_en": "e3",               // escena donde se cumple (antes o en el CTA)
    "indicador": "contador"          // "contador" (1/3) | "espera_final" | "ninguno"
  },
  "tema": {
    "color_primario": "#E91E63",     // del ADN, ya pasado por el chequeo de contraste
    "color_secundario": "#F48FB1",
    "color_fondo": "#0D0A22",
    "color_texto": "#FFFFFF",
    "fuente": "impacto",             // "impacto" | "moderna" | "elegante" | "amigable"
    "logo_url": null
  },
  "musica": { "pista_id": "uuid-o-null", "volumen": 0.35 },
  "escenas": [
    {
      "id": "e1",
      "bloque": "gancho",            // gancho | problema | producto | beneficio | valor | oferta | objecion | marca | cta
      "tipo": "gancho_texto",
      "duracion_s": 2.2,             // 1.5–5
      "subtitulo": { "texto": "¿Tus tenis no aguantan?", "palabra_clave": "aguantan" },
      "params": { "texto": "¿Tus tenis no aguantan el día?", "palabra_clave": "aguantan", "sticker": "NUEVO" }
    }
    // … más escenas
  ],
  "cta": { "accion": "suave", "texto_boton": "Conócenos" }
}
```

**Validaciones** (en la app al recibir el guion de la IA y otra vez en el worker antes de renderizar):
- La suma de `duracion_s` está en el rango de la **receta del objetivo** (sección 3B) y no se aleja más de ±2 s de `duracion_objetivo_s`.
- Son entre 3 y 7 escenas, en el **orden de bloques de la receta**. La **primera** es `bloque: "gancho"` y dura ≤ 2,5 s. La **última** es `tipo: "cta"`, con la `accion` que corresponde al objetivo.
- **Bucle:** `bucle.abre_en` y `bucle.cierra_en` existen, `abre_en` va antes que `cierra_en`, y `cierra_en` va antes o es la escena del CTA. Si `indicador` es `contador`, la escena que cierra es una `lista_numerada` con el mismo número de ítems.
- En objetivos de venta y volver a impactar hay **al menos una** `producto_hero` si se eligieron piezas del álbum. En reconocimiento y seguidores el producto es opcional.
- Hay `revelacion_marca` en reconocimiento. `objecion_respuesta` solo se acepta en volver a impactar.
- Cada `params` cumple el esquema de su `tipo`: es una unión discriminada por `tipo`, con los límites de caracteres de la tabla.
- `media_id` solo puede ser uno de los ids que se mandaron a la IA. **La IA nunca escribe URLs.**
- `oferta_precio` solo se acepta si en la entrada había un precio. Precios en COP con formato `$89.900`.
- Pasa los textos por el **detector de frases de descargo** que ya existe para el copy. Si hay alguna, se pide reescribir el guion una vez.
- Si la validación falla, se reintenta la generación **una sola vez** con los errores de zod en el prompt. Si vuelve a fallar, se muestra un error claro.

---

## 5. Guion con IA

- **Dónde corre:** propongo hacerlo **en la app**, con la llave OpenAI del usuario (BYOK) y Structured Outputs con el JSON Schema derivado del zod. Así queda todo en un repo y es fácil de probar. Si ves que encaja mejor como webhook de n8n, como los otros flujos de IA, dímelo y lo decidimos. En ese caso el JSON del workflow lo construye Juan José sobre el exportado real.
- **Modelo:** `gpt-4o-mini` por costo (menos de USD 0,01 por guion). Deja el modelo en una constante.
- **Entradas:** ADN de la marca (titular, frase_corta, rasgos_cortos, colores, tono), `info_adicional`, `datos_producto` (texto del formulario), **objetivo de la campaña** con su receta (sección 3B), duración, @ de Instagram o página si el objetivo es seguidores, y la lista de piezas elegidas (`media_id`, `tipo` imagen/video, duración si es video).
- **Reglas del prompt:**
  - Siempre **gancho → bucle abierto → desarrollo → cierre del bucle → CTA**, con la receta del objetivo.
  - En objetivos de venta se usan las reglas **COPY QUE VENDE** que ya existen.
  - En **reconocimiento y seguidores**, el enfoque es **valor, no venta**: un consejo útil, un dato o una emoción relacionada con el rubro de la marca, sin precios ni "compra ya".
  - Español colombiano, tuteo, frases cortas.
  - Nada inventado: precios, cifras, garantías o respuestas a objeciones solo si vienen en la entrada.
- **Prompts separados por receta:** deja la receta de cada objetivo en un archivo propio (por ejemplo `video/recetas/reconocimiento.ts`, con bloques, rangos, CTA y ejemplos), para poder ajustarlas sin tocar el resto.

---

## 6. Worker de render (`video-worker/`)

- **Dónde:** un **servicio nuevo en Coolify**, separado del contenedor de la app y construido desde el mismo repo con su propio Dockerfile. Para la Fase 1 (solo admin, poco volumen) puede vivir en el mismo servidor con **límites de recursos** (unos 2 CPU y 2–3 GB de RAM) y **un render a la vez**. Si algún día compite con la app, se mueve a otra máquina o a Remotion Lambda.
- **Docker:** Node LTS + Chrome Headless Shell de Remotion (`npx remotion browser ensure` en el build), dependencias de sistema de Chromium y **fuentes instaladas localmente**. Nada se descarga de internet al renderizar, salvo los medios del álbum desde Cloudinary.
- **Fuentes:** una por estilo (`impacto`, `moderna`, `elegante`, `amigable`), con licencia OFL de Google Fonts. Por ejemplo Bebas Neue o Anton, Inter o Poppins, Playfair Display y Nunito. El ADN se mapea al estilo en `tema.ts` a partir de `rasgos_cortos.tipografia`.
- **API:**
  - `GET /salud` → `{ ok, ocupado, cola }`.
  - `POST /render` con `Authorization: Bearer VIDEO_WORKER_SECRET` (comparado con `timingSafeEqual`). Cuerpo: `{ trabajo_id, guion, medios: {media_id: url}, subida: {...firma de Cloudinary...}, callback_url }`. Responde `202` y encola. Cola en memoria, concurrencia 1. Si el mismo `trabajo_id` ya está en curso, responde `200` sin duplicarlo.
- **Proceso:**
  1. Valida el guion con el mismo zod.
  2. Precarga los medios con transformaciones de Cloudinary: imágenes `w_1080,q_auto`; videos recortados al tramo necesario, en mp4 H.264.
  3. `renderMedia` en H.264, CRF unos 20, `yuv420p`, audio AAC.
  4. `renderStill` de la escena `producto_hero` como portada .jpg.
  5. Sube los dos archivos a Cloudinary del **usuario** con la **subida firmada** que le manda la app. **El worker nunca ve el `cloudinary_secret`.**
  6. Hace `POST` al `callback_url` con `{ trabajo_id, estado: "listo"|"error", url_video, url_imagen, duracion_s, error? }`, firmado con el mismo secreto.
  7. Reporta el progreso con `POST` al callback cada ~10 % (`{ trabajo_id, progreso }`).
- **Tiempo límite:** 10 min por render. Si se pasa, se aborta y se manda `error`.
- **Variables de entorno:** `VIDEO_WORKER_SECRET`, `APP_URL`. Dime cuáles más necesitas.
- **Red:** si la app y el worker están en el mismo servidor de Coolify, usa la red interna y no expongas el worker a internet. Si no, HTTPS con el secreto.

---

## 7. Conexión con `trabajos_ia`

- **Tipo nuevo:** `render_video_anuncio`. Antes revisa las columnas reales de `trabajos_ia` y cómo lo usan `publicar_estrategia` y `agregar_anuncios`; mismo patrón de `lock_id` más relectura.
- **Entrada** (en el campo de parámetros que ya use la tabla): `{ guion, media_ids, formato }`. **Resultado:** `{ url_video, url_imagen, duracion_s, album_id }`.
- **Progreso:** si la tabla no tiene dónde guardarlo, dame el SQL de una columna `progreso int` (lo corro yo) o guárdalo dentro del resultado jsonb. Tú decides y me explicas.
- **Reglas:** un solo trabajo activo de este tipo por usuario; límite de 15 min. El cron `vencer-propuestas` (o el que haga de respaldo) marca como error los que pasen ese límite. Sin reintentos automáticos: botón **Reintentar** en la interfaz, como en los demás.
- **Rutas nuevas** (todas solo admin en la Fase 1):
  - `POST /api/video/guion` → genera y valida el guion y lo devuelve (no crea trabajo).
  - `POST /api/video/render` → valida el guion, crea el trabajo, y en `after()` firma la subida de Cloudinary y llama al worker.
  - `POST /api/video/render/callback` → lo llama solo el worker, con el secreto. Actualiza progreso o estado. Al quedar `listo`, **crea la pieza en `album_creativos`** con el contrato que ya usa el álbum para videos (revisa cómo se guardan hoy `url_imagen` y `tipo` en los videos subidos y respétalo).
  - El estado se consulta con el mismo polling que usan los otros trabajos. Reutiliza la llave de localStorage `quiubot_video_job_activo` para retomar si se recarga la página.

---

## 8. Música

- Revisa las tablas `pistas_musicales` y `colaboradores_musica`, que ya existen (del flujo de Kling), y dime qué tienen. Si sirven, úsalas como biblioteca.
- Si no hay pistas, en la Fase 1 basta con 3–5 pistas libres de derechos que Juan José sube a Cloudinary. Antes de usarlas, **verifica que la licencia permita uso comercial en anuncios**.
- La IA no elige la pista en la Fase 1: el admin la escoge en el formulario o se usa una por defecto. Volumen 0,35, entrada y salida de 0,5 s.

---

## 9. Qué cambia en `/video`

Flujo nuevo en 3 pasos, solo admin:

1. **Brief:** **objetivo de la campaña** (mismas tarjetas del paso 3 de `/estrategia`; al elegirlo se ajusta el rango de duración y se muestra en una línea qué tipo de video se va a hacer, por ejemplo "Reconocimiento: video de valor, sin venta directa"), producto o servicio (texto), qué destacar (`datos_producto`), elegir **1 a 3 piezas** del álbum con el `SelectorAlbum` existente (que en esta pantalla permita varias, o que se abra varias veces), duración (dentro del rango de la receta; por defecto el punto medio) y música. Botón **"Generar guion"**.
2. **Guion y vista previa:**
   - a la izquierda, la lista de escenas **editable**: texto, palabra clave, duración, cambiar la pieza del álbum, reordenar y borrar o duplicar, siempre validando con el mismo zod;
   - a la derecha, el **`@remotion/player`** reproduciendo el guion en vivo con los colores del ADN, más el interruptor "ver zona segura";
   - botones **"Regenerar guion"** y **"Renderizar video"**.
3. **Render y resultado:** barra de progreso. Al terminar: reproductor con el mp4, "Descargar", aviso "Guardado en tu álbum" y el botón **"Usar en una estrategia"**, que lleva a `/estrategia`, donde ya se puede elegir del álbum.

**Kling:** no borres nada en la Fase 1. Esconde el flujo de Kling de la interfaz (si quieres, déjalo detrás de un enlace pequeño "flujo anterior" visible solo para admin). El workflow `generar_video_fragmentos_v18` de n8n lo desactiva y renombra Juan José cuando confirme que el nuevo funciona. La tabla `video_jobs` no se toca.

---

## 10. Orden de commits sugerido (cada uno compila; push solo a `dev`)

1. `video/`: tema, esquema zod, recetas por objetivo, las escenas (primero 1–7; las opcionales 8 y 9 al final), las capas y **un guion de ejemplo por receta**, más un script para abrir **Remotion Studio** en local. Sin tocar la app.
2. `video-worker/`: servidor, Dockerfile y un script `render:muestra` que renderiza un ejemplo a mp4 en local.
3. Rutas `/api/video/guion`, `/api/video/render` y `/callback`, más el tipo de `trabajos_ia`.
4. `/video` nueva: brief → guion editable + Player → render → resultado.
5. Esconder el flujo de Kling.

En el paso 2, mándame la lista exacta de lo que debo crear en Coolify (servicio, Dockerfile, variables, recursos y red) y el SQL si hace falta.

---

## 11. Pruebas (en la cuenta de Juan José)

- Renderizar un ejemplo por receta (venta WhatsApp con foto, venta web con video, leads, visitas web, reconocimiento, seguidores y volver a impactar). Revisar duración, zona segura, contraste con una paleta clara y otra oscura, que la portada sea la escena del producto (o la `revelacion_marca` si no hay producto) y que el bucle se cierre.
- Generar 2 guiones reales por objetivo con el ADN de Juan José y revisar que no inventen precios ni garantías, y que reconocimiento y seguidores **no** suenen a venta.
- Medir el tiempo de render de un video de 15 s en el servidor y reportármelo.
- Publicar **un anuncio en pausa** con el video desde `/estrategia` (elegido del álbum) con `publicar_estrategia v10`, revisarlo en el Administrador de anuncios y **borrarlo** después.

---

## 12. Decisiones que necesito de ti en el plan

1. ¿Guion en la app (mi propuesta) o en n8n?
2. ¿El worker en el mismo servidor de Coolify con límites, o hace falta otra máquina desde ya? Dime qué recursos tiene hoy el servidor.
3. ¿Qué hay en `pistas_musicales` y `plantillas_video_segmentos`? ¿Sirve algo?
4. ¿Cómo guarda hoy el álbum los videos (`url_imagen` con el mp4, o hay otra columna)?
5. Versión exacta de Remotion que vas a fijar (sin `^`). **Licencia:** Remotion es gratis para empresas con fines de lucro de **hasta 3 empleados**. Quiubot cumple hoy; si el equipo crece más, hay que comprar la licencia de empresa. Anótalo en el README del worker.
