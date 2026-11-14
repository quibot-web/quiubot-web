# Contenido orgánico en Quiubot — Fase O1 (plan ajustado por Claude Code)

**Estado:** Juan José aprobó el enfoque el 14 nov 2026, revisó el plan ajustado el mismo día y confirmó arrancar el spike (commit 1). El permiso `instagram_content_publish` lo agrega él mismo en la configuración de login del panel de Meta — no es tarea de este plan.
**Leer junto con:** `plan_video_anuncios_fase1.md`, `anexo_reglas_copy_y_cta.md` (mismo directorio) y `estado_quiubot.md` (el usuario lo pegó directo en el chat — no vive en el repo).
**Compartido entre staging y producción:** staging y producción usan la misma base de datos y el mismo n8n. El publicador de Instagram (sección 7) solo se ejecuta de verdad si `PUBLICADOR_ORGANICO_ACTIVO=true`, variable que solo existe en producción — en staging la ruta del cron responde 200 sin hacer nada. Esto evita que probar el flujo en staging publique algo real en Instagram.
**Reglas de siempre:**
- El SQL lo corre Juan José.
- Nada va a `main` sin su confirmación.
- Push solo a `dev`, y cada commit compila.
- Verificación en limpio antes de cada push (`rm -rf node_modules .next && npx npm@10.9.0 ci && npm run build && npm run test`).
- No crees cuentas ni escribas en la base de datos.
- Las pruebas en Meta se hacen solo en la cuenta de Juan José, y se borra lo publicado después.
- Nunca se inventan precios ni ofertas.

---

## 0. Estado real del código (verificado, no asumido)

Antes de tocar nada, esto es lo que realmente existe hoy en el repo — porque varias partes de este plan dependen de que la Fase 1 de video-anuncios estuviera más avanzada de lo que está:

- **Sí existe y funciona:** `video/` (tema, escenas, capas, `guion.schema.ts`, recetas por objetivo, `promptGuion.ts`), `POST /api/video/guion` (síncrono, llama a OpenAI con la llave BYOK del usuario, modelo `gpt-5.6-sol`), `/video` con su flujo de brief → guion editable + `@remotion/player` → "Descargar JSON". `SelectorProducto` y `SelectorAlbum` (con selección múltiple) ya están wireados en `/estrategia`, `/video` y metas — reutilizables tal cual para este plan.
- **NO existe:** ningún worker de render server-side, ninguna ruta `/api/video/render`, ningún tipo `render_video_anuncio` en `trabajos_ia`, ninguna subida del video resultante a Cloudinary ni guardado en álbum. El único "render" real hoy es `npm run render` (`video/render.ts`), un script de línea de comandos que un dev corre a mano en su máquina ("Fase 1a"). La Fase 1b (worker server-side) sigue sin construirse.
- **Esto ayuda al plan O1:** como los reels se van a renderizar en el navegador de la marca, no dependen de ese worker inexistente. Pero significa que **toda la tubería de "navegador → Cloudinary → álbum" es código nuevo**, no hay nada que reutilizar ahí salvo el patrón de subida servidor-proxy que ya usa el resto del repo (ver sección 5).
- **Tampoco existe** ningún tipo de `trabajos_ia` ni patrón de cola para generar guiones en lote — `/api/video/guion` genera uno a la vez, síncrono, dentro de la misma petición HTTP.

---

## 1. Qué es y alcance

Sin cambios respecto al original. Las marcas hacen su **contenido orgánico** dentro de Quiubot. Una vez por semana pasa esto:
1. El Director propone un calendario de reels.
2. La marca lo revisa.
3. Los videos se **renderizan en el navegador de la marca** (gratis, sin servidor de render).
4. Se suben a su Cloudinary.
5. Un cron los **publica solos en Instagram** a la hora programada.

**Fase O1 (este plan):**
- Instagram Reels por la API oficial de Meta.
- Render en el navegador con `@remotion/web-renderer`.
- Recetas orgánicas, calendario y publicador.
- TikTok solo con "Descargar video + copiar texto" para que la marca lo publique a mano.

**Fuera de O1:**
- O2: métricas por reel y aprendizaje del Director.
- O3: TikTok por API, con la auditoría de TikTok.
- Worker de render en servidor (Fase 1b de anuncios) — sigue sin existir; se reutiliza si algún día hace falta 100 % automático o si el render en navegador no resulta confiable (ver sección 5, riesgo de estabilidad).

**Principio:** Quiubot piensa, decide y publica. El computador de la marca solo pone la fuerza para fabricar los mp4 unos minutos a la semana. El VPS (KVM 1) solo hace trabajo liviano: guiones, cola y llamadas a Meta.

---

## 2. Flujo del usuario (pantalla nueva, `/contenido`)

Sin cambios de fondo respecto al original — confirmado como pantalla nueva, no pestaña de `/video` (ver decisión 5).

1. **Calendario de la semana:** tarjetas por día con estado (borrador, aprobada, lista, publicada, error). Botón "Pedir propuesta al Director" y botón "Agregar reel".
2. **Propuesta:** el Director arma N piezas (por defecto 5, rango 1-7). Cada pieza: receta orgánica, tema, producto opcional del catálogo (reusando `SelectorProducto`), fotos del álbum (reusando `SelectorAlbum` con selección múltiple), fecha y hora (`hoyBogota`).
   - **Importante, confirmado contra el código real:** el Director nunca escribe estas filas directamente. Sigue el mismo patrón exacto de `crearMetaDesdeResumen` en `PanelDirectorGeneral.tsx` — la IA propone en el chat ("Te preparé 5 reels para esta semana") con un botón, y **solo al hacer clic** el cliente llama a la API que de verdad crea las piezas en `borrador`. Nada se inserta en la base solo porque la IA lo dijo.
3. **Revisión:** igual que `/video`. Guion editable a la izquierda, `@remotion/player` a la derecha, caption + hashtags editables abajo. "Aprobar" y "Aprobar todas".
4. **"Preparar mis videos":** renderiza en el navegador, una pieza a la vez, solo las aprobadas sin video; barra de progreso; sube cada mp4 vía el servidor (ver sección 5) y la pieza pasa a `lista`.

**Ajustes pedidos por Juan José para el commit 4 (anotados ahora, se construyen cuando se llegue a `/contenido`):**

- **Render al aprobar, no todo junto al final:** apenas se aprueba una pieza, entra sola a una cola y empieza a renderizarse en el navegador mientras la marca sigue revisando las demás — una a la vez, nunca en paralelo (mismo límite de "un render a la vez" que ya pedía el plan original, ahora disparado por cada aprobación en vez de por el botón). El botón **"Preparar mis videos"** se mantiene, pero solo para las piezas aprobadas que para ese momento todavía no tengan video (las que ya se renderizaron solas mientras tanto, no vuelven a pasar por el botón).
- **Tiempo estimado visible, calculado con datos reales, no un número fijo:** "Faltan ~X min" se arma con el tiempo que el render REAL de la primera pieza (o las que ya terminaron en esa sesión) tomó por segundo de video, multiplicado por los segundos que faltan por renderizar — nunca una constante hardcodeada, porque el tiempo real depende muchísimo de la máquina de cada marca (ver los números de abajo: en esta misma máquina, un reel de 19s fue de 44s a 78s según cuánto se usó `pistaUrl`/video real y si hubo CPU limitada).
- **Wake Lock + `beforeunload`:** se mantienen tal cual los pedía el plan original (sección 5) — Wake Lock si el navegador lo soporta (`navigator.wakeLock`, cae en silencio si no existe, sin romper nada) para que el computador no se suspenda solo mientras renderiza, y el aviso `beforeunload` mientras haya algo en cola o renderizando.
- **Pestaña en segundo plano / ventana minimizada — medido con un spike real (commit 1), resultado tranquilizador:**
  - En Chromium headless no logré que `document.visibilityState` pasara a `"hidden"` ni llevando otra pestaña al frente ni con ninguna API de Playwright disponible — es una limitación conocida de probar esto en modo headless, no algo que se pueda confiar en medir con precisión fina (throttling "suave" de timers) desde este entorno.
  - Lo que sí pude probar de verdad, con el protocolo real de Chrome (`Page.setWebLifecycleState`, el mismo mecanismo que usa Chrome para congelar una pestaña oculta o una ventana minimizada bajo presión de memoria — más agresivo que el throttling normal de una pestaña en segundo plano, así que es el peor caso, no el típico): **congelé un render real a los 9s de empezar, lo dejé congelado 10s, y lo descongelé.** El render **sobrevivió completo y sin errores**, con solo ~2-4s de atraso total frente a un render sin congelar (no los 10s completos) — probablemente porque el trabajo pesado de `@remotion/web-renderer`/Mediabunny corre en Web Workers y WebCodecs, que Chrome no detiene igual que el hilo principal de la página.
  - **Propuesta, dado que el peor caso ya probado se banca bien pero no hay forma de garantizar el comportamiento exacto de cada versión de Chrome/sistema operativo:** aviso claro y persistente en pantalla durante todo el render — algo como *"Deja esta pestaña abierta en primer plano hasta que termine — si la minimizas o cambias de pestaña, puede demorar más (no se rompe, solo se hace más lento)"* — en vez de prometer que nunca pasa nada, porque no se puede garantizar para todos los navegadores/sistemas. No hace falta mover el render a un Web Worker propio como mitigación aparte: `@remotion/web-renderer` ya delega lo pesado a Workers internamente, y el freeze test ya mostró que eso aguanta bien.
- **Aviso "La parte 1 promete una parte 2", pedido por Juan José:** si la marca cancela o borra una pieza que era la parte 2 de una `serie_partes` (columna `continua_de_id`, sección 6), la parte 1 muestra ese aviso en su tarjeta del calendario. Se recalcula con la misma función pura que ya valida la variedad semanal, cada vez que algo cambia en el calendario (aprobar, cancelar, borrar) — ver el detalle completo en la sección 9 (Director), que es quien crea la pareja de piezas la primera vez.
5. **Listo:** "Tus reels quedaron programados". El cron publica a la hora indicada.
6. Si cierra la pestaña a mitad de camino, retoma al volver ("Tienes 2 videos por preparar").
7. **TikTok (O1):** "Descargar mp4" y "Copiar texto para TikTok" en cada pieza lista.

**Avisos de seguridad del flujo:** sin cambios — aviso 2h antes si falta video, `vencida` si llega la hora sin video.

---

## 3. Recetas orgánicas (`video/recetas/organico/`)

Mismo enfoque: gancho → bucle abierto → desarrollo → cierre del bucle → CTA, con valor en vez de venta. Tabla sin cambios:

| id receta | Enfoque | Duración | Estructura | CTA |
|---|---|---|---|---|
| `consejos_numerados` | 3 consejos útiles | 15–30 s | gancho → lista_numerada → revelacion_marca → cta | `seguir` |
| `mito_verdad` | Desmentir 1-2 mitos | 15–25 s | gancho → objecion_respuesta → cta | `seguir`/`comentar` |
| `producto_en_uso` | Producto real resolviendo algo | 12–25 s | gancho → producto_hero → beneficios_lista → cta | `suave`/`seguir` |
| `serie_partes` | "Parte 1 de 3" | 15–30 s | gancho → lista_numerada (2 de 3) → cta | `seguir` |
| `pregunta_comunidad` | Elige A o B, opina | 10–20 s | gancho (pregunta) → dos_opciones → cta | `comentar` |
| `detras_de_marca` | Valores con `info_adicional` | 15–30 s | gancho → valor → revelacion_marca → cta | `suave` |

**Verificado contra `video/guion.schema.ts` real — esto es lo que de verdad hace falta construir:**
- `BLOQUES` ya incluye `"gancho"`, `"valor"`, `"marca"`, `"objecion"`, `"producto"`, `"beneficio"`, `"cta"` — casi todas las recetas de arriba calzan con bloques existentes **sin tocar ese enum**.
- `consejos_numerados`, `serie_partes`, `detras_de_marca` → reusan `lista_numerada`/`beneficios_lista`/`revelacion_marca` tal cual existen.
- `mito_verdad` → reusa `objecion_respuesta` tal cual (hoy solo permitido en `retargeting`; hay que permitirlo también en recetas orgánicas).
- `producto_en_uso` → reusa `producto_hero` + `beneficios_lista` tal cual.
- **`pregunta_comunidad` necesita una escena nueva de verdad**: no existe ningún tipo "dos opciones" en el `discriminatedUnion` de `EscenaSchema`. Hay que agregar `tipo: "dos_opciones"` con sus propios `params` (`opcion_a`, `opcion_b`, ambas ≤ ~30 car.) y su componente React en `video/escenas/`. Esto no estaba explícito en el plan original.
- **CTA `"comentar"` necesita sus propios `params`** (algo como `palabra_clave_comentario?`, ≤20 car., para la palabra que debe escribir el usuario) y su propio `superRefine`, igual que ya existe para `mensajes` (solo whatsapp) y `usuario` (solo seguir).

**Nuevo valor de `cta.accion`: `comentar`.** Caja de comentario que escribe una palabra. **Variedad semanal:** sin repetir receta más de 2 veces por semana, ganchos distintos — validarlo en código. Revisar duración máxima de Reels y specs de video vigentes en Meta (ver sección 7, ya verificado: 3s–15min, máx. 300MB — las duraciones de estas recetas están lejos de cualquier límite, no es un riesgo real).

**Caption:** gancho en la primera línea + valor + CTA. `hashtags[]` de 3 a 8, español. Límite de caption de Instagram: 2.200 caracteres (límite estable y de uso general). Pasa por el detector de descargos existente (`video/reglasCopy.ts`).

---

## 4. Cambios al guion (`video/guion.schema.ts`)

**Ajustado tras leer el archivo real línea por línea.** El esquema hoy es un objeto único validado con `superRefine` (no un discriminated union por tipo) — para no arriesgar el pipeline de anuncios ya en producción, se extiende con el mismo estilo, no se reestructura:

- `uso: z.enum(["anuncio", "organico"]).default("anuncio")` — nuevo. Compatibilidad: sin este campo, se trata como `"anuncio"` (ya es el default).
- Con `"organico"`: `objetivo` se vuelve opcional y se exige `receta_organica` (enum de la tabla de la sección 3) en su lugar — validado en el `superRefine` existente, igual que ya valida `objetivo`/`cta.accion` hoy.
- Bloque nuevo `publicacion: { caption: string, hashtags: string[] }`, opcional, **requerido solo cuando `uso === "organico"`**.
- **`duracion_objetivo_s` hoy tiene `max(25)` (línea 198 real) — hay que subirlo** (a 30, o un poco más por margen). Ninguna receta de anuncio pasa de 20 s hoy, así que no hay riesgo de romper nada ya en producción.
- `objecion_respuesta` hoy solo se acepta en `retargeting` — hay que permitirlo también cuando `uso === "organico"` (para `mito_verdad`).
- Nueva escena `dos_opciones` (ver sección 3).
- Nuevo `accion: "comentar"` en `ACCIONES_CTA` + sus `params` propios.
- Las validaciones existentes (bucle, primera escena ≤2.5s, `media_id` solo de la lista recibida, "la IA nunca escribe URLs") se mantienen exactamente iguales para ambos usos.
- **Un solo código de escenas**, confirmado: el `@remotion/player`, el render en navegador y `npm run render` usan los mismos componentes de `video/escenas/` y `video/Composicion.tsx` sin cambios estructurales.

---

## 5. Render en el navegador (`@remotion/web-renderer`)

**Verificado en npm y en la documentación oficial de Remotion, no asumido:**

- `@remotion/web-renderer` existe exactamente en la versión **4.0.540**, la misma ya fijada para todo `@remotion/*` en este repo. **No hace falta subir de versión.** Se instala con `npx remotion add @remotion/web-renderer` (el instalador propio de Remotion). Peer deps: `react`/`react-dom` `>=18` (el repo usa React 19, cumple).
- **Actualizado tras leer la documentación real de la API, no solo buscarla:** la página de overview hoy dice explícitamente **"The API is stable from v4.0.491"**, sin ningún aviso de experimental — la señal contradictoria que se había visto antes venía de una página distinta/desactualizada en el caché de búsqueda. Se trata como confiable; el spike es la confirmación final en la práctica, no una duda abierta.
- **Firmas reales de la API (confirmadas, no genéricas):**
  - `renderMediaOnWeb({ composition: {id, component, durationInFrames, fps, width, height}, inputProps, container, videoCodec, audioCodec, scale, onProgress, signal, licenseKey, ... })` → `Promise<{ getBlob(): Promise<Blob> }>`.
  - `canRenderMediaOnWeb({ width, height, scale, container, videoCodec, audioCodec, ... })` → `Promise<{ canRender, issues: {type, message, severity}[], resolvedVideoCodec, resolvedAudioCodec, resolvedOutputTarget }>`.
  - **Ninguna de las dos páginas menciona el átomo `moov` ni "fast start"** — no se puede confirmar desde la doc, solo probándolo (ver el hallazgo de la sección 7).
- Requiere **WebCodecs** del navegador: Chrome lo soporta bien; Safari necesita versión 26+. El aviso "Abre Quiubot desde un computador con Chrome" (si `canRenderMediaOnWeb()` falla) queda confirmado como necesario.
- **Licencia y telemetría, confirmado:** gratis para equipos ≤3 personas (Quiubot cumple). La telemetría manda la license key + la IP de la máquina que renderiza — nunca el contenido del video ni datos del usuario. Como el render corre en el navegador de la marca (no en infraestructura de Quiubot), **no aplica el tier "Automators" de pago** (ese es solo para render server-side auto-hospedado, con gasto mínimo de USD 100/mes). Hay que pasar `licenseKey: "free-license"` explícito en las llamadas a `canRenderMediaOnWeb()`/`renderMediaOnWeb()`. Anotar esto en el README junto a la nota de licencia que ya existe para la Fase 1 de anuncios.
- **Resultado real del spike (ejecutado, no solo leído en la doc):** se instaló `@remotion/web-renderer@4.0.540` (`npx remotion add`) y se corrió `renderMediaOnWeb`/`canRenderMediaOnWeb` en un Chromium real (Playwright, headless) contra el código **sin modificar** de `video/Composicion.tsx`/escenas/capas, con `fixtureCompleta` y media pública de prueba (MDN, con CORS — nunca datos de un usuario real):
  - **Sin video ni música** (`Img`, texto, transiciones, logo, fuentes locales, las 7 escenas restantes): renderiza bien. 2,56 MB, ~36 s de render para 19 s de video en este Mac.
  - **Átomo `moov` — confirmado, no hace falta ningún paso extra:** se inspeccionaron los bytes del mp4 resultante (sin ffprobe, leyendo los átomos directamente) y `moov` ya queda **antes** de `mdat` — el archivo sale fast-start de una vez. Se descarta la alternativa de transcodificar por Cloudinary para esto.
  - **Dos bloqueos reales, confirmados con el error exacto que lanza el propio Remotion (no un bug, una validación a propósito):**
    - `OffthreadVideo` (usado en `TratamientoMedia.tsx`, `ProductoHero.tsx`, `GanchoTexto.tsx`): *"`<OffthreadVideo>` is not supported in `@remotion/web-renderer`. Use `<Video>` from `@remotion/media` instead."*
    - `Audio` del paquete `remotion` (usado en `capas/Musica.tsx`): mismo patrón exacto, pide `<Audio>` de `@remotion/media`.
  - **No es un callejón sin salida:** el resto del pipeline (fuentes, imágenes, transiciones, texto animado, logo) funciona sin tocar nada. Es un cambio acotado a 4 archivos (migrar esos dos componentes a `@remotion/media`, la misma API que ya usa el ejemplo oficial).

**Ronda 2 del spike — migración a `@remotion/media` aplicada, probada contra medios reales de Cloudinary (solo lectura):**
- Se migraron los 4 archivos (`TratamientoMedia.tsx`, `ProductoHero.tsx`, `GanchoTexto.tsx` → `Video` de `@remotion/media`; `Musica.tsx` → `Audio` de `@remotion/media`, con el volumen precalculado por cuadro en vez del callback que la doc actual marca "no longer recommended"). Typecheck del proyecto limpio.
- **CORS, confirmado que NO es el problema:** Cloudinary ya sirve estos videos con `access-control-allow-origin: *`.
- **Bug real encontrado probando con un video real (no estaba en el plan, ni es nuevo de esta migración):** `urlOptimizadaCloudinary()` (usada hoy en `ProductoHero`/`GanchoTexto` para pedir el video a 1080px) inserta `f_auto,q_auto,w_1080` — con un video real que Cloudinary puede servir en varios códecs, `f_auto` a veces le entrega VP9 a un cliente tipo Chrome aunque la URL termine en `.mp4`, y el navegador lo rechaza (`Unsupported codec vp9 for format mp4`, confirmado con las cabeceras reales de la respuesta). Pasa igual en `@remotion/player` (probado, degrada sin tumbar el render pero sin mostrar el video) — no es algo que introdujo `@remotion/media`, es una fragilidad ya existente de `urlOptimizadaCloudinary` aplicada a video, recién descubierta porque este spike fue el primero en probarla con un video real complejo.
- **Arreglo aplicado y confirmado contra medios reales (ya en el código, no solo probado suelto):** nuevas funciones `urlVideoCompatible()` y `urlFondoDifuminadoVideo()` en `app/lib/cloudinaryUrl.ts` (`f_mp4,vc_h264` en vez de `f_auto` — mismo principio que `urlReducidaParaIA()`). `urlOptimizadaCloudinary()` y `urlFondoDifuminado()` quedan igual, solo para imágenes. `TratamientoMedia.tsx` ahora elige el helper correcto según `media.tipo` **adentro** del componente (ya no lo decide quien llama, para que nadie pueda pasar por error el helper de imagen a una pieza que resultó ser video). `ProductoHero.tsx`/`GanchoTexto.tsx` actualizados igual. Con esto, la URL real que antes fallaba responde `206` con `codecs=avc1`.
- **Búsqueda en todo el repo (no solo `video/`):** el único lugar que aplicaba `f_auto` a un video era este (`TratamientoMedia.tsx`, `ProductoHero.tsx`, `GanchoTexto.tsx`). Todos los demás `<video>` del repo (álbum, `ElegirEstrategia`, `/video/kling`, `/estrategia`, miniaturas del brief de `/video`, `/bienvenida`) usan la URL **sin transformar** como `src` — ningún otro lugar tiene este riesgo hoy. Las únicas otras veces que `urlOptimizadaCloudinary`/`urlFondoDifuminado` tocan algo relacionado con video es sobre la **portada fija** (`urlPortadaVideo`, que ya fuerza `.jpg` — un still, no el video) en `album/page.tsx` y `AlbumUI.tsx`: eso ya es imagen en ese punto, sin riesgo. **No hace falta ningún commit aparte para otros call sites** — el arreglo quedó contenido en `video/`.
- **Límite de transformación de video al vuelo en Cloudinary, verificado en la doc oficial (no en guías de terceros):** no hay un tope fijo de MB para transformar al vuelo — el tope documentado es de **duración**: 60 min para ABR y **30 min para MP4 progresivo** (que es nuestro caso); una solicitud más larga que eso se procesa async y devuelve `423` hasta terminar. No hay cifra de MB porque depende del plan, pero no es relevante aquí: **se probó con el video más pesado real del álbum (9,2 MB, sin transformaciones previas encima)** y respondió bien, sin asomo de `423` ni de cola async — a años luz del límite de 30 minutos. **Conclusión: con los tamaños reales de hoy (reels de pocos MB, 15–30 s) no hace falta ninguna estrategia de recorte con `so_`/`du_`** — se deja anotado para revisar si algún día se suben videos de varios minutos al álbum.
- **Publicador de Instagram (Fase O1, cuando se construya):** debe pedir el video siempre con `urlVideoCompatible()`, nunca con `urlOptimizadaCloudinary()` — mismo motivo exacto. Ya quedó anotado en el comentario de la función para que no se pierda cuando se llegue a esa parte del plan (sección 7).
- **Números reales, con video y música reales de Cloudinary, con el arreglo ya aplicado:**
  - Sin limitar CPU: **78,4 s** de render para un guion de 19 s, mp4 de **4,6 MB**.
  - Con CPU limitado a 4x (simulando un portátil de marca más modesto): **148,7 s** — no escala 4x parejo (casi 2x), probablemente porque buena parte del trabajo de decodificación/codificación usa WebCodecs con aceleración que el throttling de CPU no golpea igual que el trabajo en JS puro.
  - **Estimado para 5 reels de ~20 s cada uno, uno a la vez** (como pide el plan): **~6,5 minutos** en un portátil normal, **~12,4 minutos** con CPU limitado. Reels más largos (hasta 30 s, el máximo de las recetas orgánicas) tomarían proporcionalmente más.
  - El mp4 resultante tiene pista de audio (AAC) y de video (H.264) confirmadas, y `moov` sigue al frente.
- **Punto 1 (sin regresiones), confirmado con video real:** capturé pantallas de `@remotion/player` con el código ya migrado y el arreglo aplicado — el video real aparece correctamente de fondo en el gancho, las transiciones, el texto animado, el logo y el bucle se ven idénticos a como se veían antes de tocar nada.
- **Proceso por pieza (ajustado, ver próximo punto sobre subida):**
  1. `renderMediaOnWeb` (mp4 H.264 + AAC, 1080×1920, 30 fps, `licenseKey: "free-license"`).
  2. El navegador manda el blob del mp4 a `POST /api/contenido/[id]/video-listo` (multipart).
  3. El servidor sube a Cloudinary con las llaves BYOK del usuario (ver abajo) y marca la pieza `lista`.
- **Experiencia:** progreso por pieza y total, aviso `beforeunload`, Wake Lock si está disponible, una pieza a la vez, si falla una se marca `error_render` y sigue con la siguiente.
- Guarda también cada mp4 como pieza del álbum (ver sección 6).

### Subida a Cloudinary — decisión tomada: proxy por el servidor, no firma directa

**Verificado: no existe en todo el repo ningún patrón de subida firmada cliente→Cloudinary.** Todo lo que hay hoy (`album/subir`, `subir-fotos`, etc.) es servidor-proxy: el server descifra las llaves BYOK del usuario (`usuarios.cloudinary_key`/`cloudinary_secret`, ya existentes) y sube él mismo con el SDK de Cloudinary.

**Decisión confirmada por Juan José:** usar ese mismo patrón para el video renderizado, en vez de construir un endpoint nuevo de subida firmada directa (que el plan original proponía). El navegador manda el blob (3-10 MB por reel) a una ruta de la app, el server lo sube con `cloudinary.uploader.upload(..., { resource_type: "video" })` — exactamente igual que `album/subir/route.ts`. Cero patrón de seguridad nuevo, carga mínima en el VPS (un relay, no transcodifica nada).

**`POST /api/contenido/[id]/video-listo` ya construida (commit 3), con dos ajustes pedidos por Juan José, ambos ya en el código:**
- **Atomicidad:** el paso a `lista` es un `update` condicional (`.eq("id", id).in("estado", ["aprobada","renderizando"]).select("id")`), revisando que haya afectado 1 fila. Si afectó 0 (otra pestaña ya la reclamó mientras subía), no se crea la pieza del álbum y se borra de Cloudinary el archivo recién subido (`cloudinary.uploader.destroy`) — nunca queda basura huérfana ni una pieza duplicada.
- **Reintento sin re-render:** si Cloudinary falla, la ruta NO marca `error` en el primer intento — cuenta el intento en la columna `intentos` y deja la pieza en el mismo estado (`aprobada`/`renderizando`), devolviendo `reintentable: true`. Solo al segundo fallo seguido pasa a `error` (`tipo_error: "subida"`). **Pendiente para el commit 4 (código de `/contenido`, no de esta ruta):** el navegador debe conservar el blob ya renderizado en memoria y, si la subida falla, mostrar "Reintentar subida" (reenviando el mismo blob a esta misma ruta, sin volver a renderizar) antes de aceptar el `error` final que la ruta ya devuelve en el segundo intento.

**Prueba de tamaño en staging (lo que pude confirmar desde el código, y lo que falta probar en vivo):**
- `next.config.ts` ya fija `experimental.proxyClientMaxBodySize: "25mb"` — el límite del propio proxy de Next.js para el body que bufferea en memoria, puesto ahí por un incidente real anterior (la subida de música se truncaba en silencio por encima de 10MB, el default de Next). El navegador manda el mp4 como blob binario normal dentro del multipart (nunca base64, que pesaría ~33% más) — un reel de 3-10MB queda muy por debajo de ese tope de 25MB, así que **del lado de Next.js esto ya está cubierto**.
- **Lo que no pude probar yo:** si Coolify/Traefik (el reverse proxy delante de la app, fuera de este repo) tiene su propio límite de tamaño de body configurado en el panel de Coolify — eso no vive en ningún archivo de este repositorio, así que no lo puedo confirmar leyendo código, y no tengo una sesión real de staging para probarlo en vivo yo mismo.
- **Prueba concreta que puedes hacer ahora mismo, sin esperar al commit 4:** `/api/contenido/[id]/video-listo` todavía no tiene ninguna fila real de `publicaciones_organicas` contra la cual probarse de punta a punta (la tabla está vacía hasta que exista `/contenido`). Pero el límite de tamaño se aplica en la capa de Next.js/Coolify/Traefik **antes** de que la ruta específica entre a correr, así que probar con una ruta que YA existe y ya acepta multipart de video real — `/api/album/subir`, subiendo un video de tu álbum de ~10MB desde staging — prueba exactamente el mismo límite de infraestructura. Si eso pasa sin cortarse, `video-listo` va a comportarse igual (misma capa de proxy, mismo tipo de body). Si se corta, dime el error exacto (timeout, 413, conexión cortada a la mitad) para saber si hay que subir `proxyClientMaxBodySize` o si el límite está en Coolify/Traefik.

---

## 6. Datos (SQL propuesto: lo escribe Code y lo corre Juan José)

Nombre de archivo: `docs/sql/contenido_organico.sql` (sigue la convención de `metas_atomicas.sql`/`productos.sql`, ya existentes en `docs/sql/`).

Tabla `publicaciones_organicas`:
- **Columnas:** igual que el plan original, más tres nuevas pedidas por Juan José — `id uuid pk`, `user_id`, `producto_id null`, `plataforma`, `receta_organica`, `guion jsonb`, `caption`, `hashtags text[]`, `programada_para timestamptz`, `estado` (`borrador | generando | aprobada | renderizando | lista | publicando | procesando | publicada | error | vencida | cancelada`), **`generando_desde timestamptz null`** (se llena al pasar a `generando` -- generación del guion en lote vía `after()`, sección 9 -- se limpia al salir de ese estado), `url_video`, `cloudinary_public_id`, `album_id`, `ig_container_id`, `ig_media_id`, `permalink`, `error`, **`tipo_error`** (incluye el valor `"reconexion"` para token vencido/permiso faltante, ver sección 7), `intentos int default 0`, `semana date`, **`continua_de_id uuid references publicaciones_organicas(id) on delete set null`** (solo para `serie_partes`: a qué pieza continúa esta -- ver el aviso de la sección 2/9 más abajo, "la parte 1 promete una parte 2"), `creado_en`, `actualizado_en`.
- **`continua_de_id`, pedido por Juan José para los commits 4 y 7 (se agrega la columna ahora porque la tabla recién se crea -- más barato que una migración después):** cuando se arma el calendario, cada pieza `serie_partes` que no es la última de su serie se vincula con la que la continúa, poniendo en la pieza-continuación `continua_de_id = id de la pieza anterior`. La validación ("¿toda parte 1 tiene su parte 2?") es código, no una restricción de SQL -- igual que la variedad semanal, es una función pura que corre sobre las piezas del calendario, no un `CHECK` de la tabla (la pieza siguiente puede no existir todavía mientras se arma el calendario, o puede borrarse después; un `CHECK` no puede representar "todavía no, pero va a existir").
- **Cron `vencer-propuestas` (ya existente) se extiende**, no se crea uno nuevo: además de lo que ya vence, pasa a `error` (con `tipo_error: "timeout_guion"`) cualquier pieza en `generando` con `generando_desde` de más de 10 minutos. En la UI de `/contenido` esa pieza muestra "Reintentar" (mismo patrón de botón que ya usan `publicar_estrategia`/`creativos_jobs`).
- **Rescate de piezas atascadas, pedido por Juan José — es código (TypeScript dentro de `vencer-propuestas`), no SQL:** esta tabla no tiene una columna de "desde cuándo" para `renderizando`/`publicando`/`procesando` (a diferencia de `generando_desde`), así que el cron compara `actualizado_en` contra 30 minutos para estos tres estados:
  - `renderizando` de más de 30 min → vuelve a `aprobada` (el render corre en el navegador de la marca; si se atascó, no hay nada publicado todavía, así que es seguro simplemente dejar que se vuelva a intentar).
  - `publicando` o `procesando` de más de 30 min → pasa a `error` con `tipo_error: "revisar_publicacion"`, **sin reintento automático** (a diferencia de los demás timeouts) — en este punto puede que Instagram ya haya publicado el reel o no, y reintentar a ciegas podría publicarlo dos veces. Aparece el aviso correspondiente y el mensaje del asistente `publicador` en `mensajes_equipo`, pidiendo revisar manualmente en Instagram antes de decidir si hace falta volver a programarlo.
- **Sin cambios de la tabla `album_creativos`** — verificado: el mp4 se guarda en `url_imagen` (sí, aunque sea video), `tipo: "video"`, `public_id`, exactamente igual que ya hace `video-jobs/[id]/route.ts` y `album/subir/route.ts`. No hay columna de duración ni de portada en esa tabla, y no hace falta agregarla: la duración se saca de `sum(guion.escenas[].duracion_s)`, y **la portada se genera con una transformación de URL de Cloudinary sobre el propio mp4** (Cloudinary genera thumbnails de video al vuelo), no hace falta subir un .jpg aparte como proponía el plan original.
- **Índices:** `(estado, programada_para)` para el cron; `(user_id, semana)`.
- **RLS** activado sin políticas (la app usa service_role), igual que las demás tablas.
- **RPC atómico `reclamar_publicaciones_organicas_vencidas(p_limite)`:** mismo estilo que `crear_meta_completa`/`cambiar_estado_meta` en `metas_atomicas.sql` (`security invoker`, `set search_path = public, pg_temp`, `revoke all ... grant execute to service_role`) — toma `lista` con `programada_para <= now()` y las pasa a `publicando` con `FOR UPDATE SKIP LOCKED`, para que dos corridas del cron nunca publiquen la misma pieza.
- Mensajes nuevos en `mensajes_equipo` (confirmado el patrón real — ver sección 7) con plantillas en `textosEquipo.ts`, sin IA.
- `notify pgrst, 'reload schema';` al final.
- **`actualizado_en`, confirmado contra el resto del proyecto:** no hay trigger en ninguna tabla — siempre lo pone el código en cada `.update()` (`new Date().toISOString()`), igual en `trabajos_ia`/`estrategias_jobs`/etc. Todas las rutas nuevas de este plan (subida, `video-listo`, el publicador) tienen que mandarlo explícito; el RPC ya lo pone con `now()`.
- `continua_de_id` tiene un `check` para que una fila nunca sea su propia "parte 2" (`continua_de_id <> id`). Que la parte 1 y la parte 2 sean del mismo usuario es código, no SQL — un self-FK no puede comparar `user_id` entre la fila que apunta y la apuntada.
- El RPC también filtra `estado = 'lista'` en el `UPDATE` de afuera, no solo en el `SELECT` de adentro — mismo criterio defensivo que `cambiar_estado_meta`.

---

## 7. Publicador de Instagram (cron)

**Verificado contra el código real de Meta/OAuth:**

- **Token a reusar:** `usuarios.meta_access_token` — un **user token de larga duración** (no de página), siempre contra la API **v21.0**, igual que `publicarEstrategiaJobs`/`metaInstagramSalud.ts`. No hay columna guardada del id de la cuenta de Instagram: se resuelve en vivo cada corrida con `GET /{meta_page_id}?fields=instagram_business_account{id,username}&access_token=...`, exactamente como ya hace el código existente.
- **Ruta** `POST /api/cron/publicar-organico`, Bearer `ADMIN_SECRET` comparado con `timingSafeEqual` — mismo patrón exacto que los 7 crons existentes (`vencer-propuestas`, `sync-meta-insights`, etc., todos verificados con el mismo código de auth).
- **Gate de entorno, pedido por Juan José:** como staging y producción comparten base de datos y n8n, la ruta solo actúa de verdad si `process.env.PUBLICADOR_ORGANICO_ACTIVO === "true"` — variable que solo se configura en producción. En staging responde `200` sin reclamar nada ni llamar a Meta, así que programar/probar reels en staging nunca publica algo real.
- **Graph API v21.0 — verificado en la doc oficial, pedido por Juan José:** v21.0 se retira el **21 de enero de 2027** (Meta la quita dos años después de su sucesora, v22.0, lanzada el 21 de enero de 2025) — hoy (14 nov 2026) quedan **poco más de dos meses**, así que sí es pronto. La versión más reciente confirmada es **v26.0** (anunciada el 29 de julio de 2026). **Propongo migrar todas las llamadas a Graph API del repo (no solo las nuevas de este plan) a v26.0** antes de construir el publicador — es un cambio aparte, pequeño por archivo pero que toca varios (`meta/callback`, `publicar-estrategia`, `metaInstagramSalud.ts`, `cron/sync-meta-insights`, etc.) y **afecta también los workflows de n8n** que llamen directo a Graph API, así que lo levanto como un commit propio antes de este plan, no mezclado con él. Confirmar el número exacto contra `developers.facebook.com/docs/graph-api/changelog/versions` al momento de hacerlo, por si sale una v27 entre tanto.
- **En cada ejecución:**
  1. Reclamar vencidas con el RPC (máx. ~10).
  2. Revisar cupo con `GET /{ig-user-id}/content_publishing_limit`.
  3. Crear contenedor: `POST /{ig-user-id}/media` con `media_type=REELS`, `video_url`, `caption`, `share_to_feed=true`. Guardar `ig_container_id`, pasar a `procesando`.
  4. En corridas siguientes, para `procesando`: `GET /{container-id}?fields=status_code` → `FINISHED` publica con `media_publish`; `ERROR`/`EXPIRED` → `error`. **Los contenedores vencen a las 24h — confirmado en la documentación oficial de Meta, se crean a la hora de publicar, nunca antes.**
- **Especificaciones de Meta para el archivo, confirmadas en la doc oficial (no en guías de terceros):** contenedor MP4/MOV con el átomo `moov` al inicio del archivo, 3 s–15 min, máximo 300 MB. **Riesgo técnico concreto a revisar en el spike:** si el mp4 que produce Remotion/Mediabunny en el navegador necesita un paso extra para mover el `moov` al frente del archivo (`faststart`) antes de que Instagram lo acepte vía `video_url` — se confirma probando un reel real end-to-end en la cuenta de Juan José (sección 12).
- **Reintentos:** máximo 3 para errores transitorios (red, 5xx, límite de tasa). **Token vencido o permiso faltante — sin reintentos, pedido explícito de Juan José:** la pieza pasa a `error` directo con `tipo_error: "reconexion"`, aparece el aviso "Reconecta tu Instagram" en `/contenido` (reusa `MENSAJE_META_TOKEN_VENCIDO`/`ACCION_RECONECTAR_META` de `app/lib/metaErrors.ts`, ya existentes) y el mensaje correspondiente del asistente `publicador` en `mensajes_equipo`.
- **Detector de permiso faltante (`instagram_content_publish`):** hoy el código **solo reacciona** al error 190 (token vencido), no detecta proactivamente permisos faltantes. Esto sí sería código nuevo (`GET /me/permissions`), como ya anticipaba el plan original — aunque Juan José va a agregar el permiso él mismo en el dashboard de Meta, el detector sigue siendo útil para el día que el token se desconecte o alguien revoque el permiso después.
- **Errores, confirmado contra `estado_quiubot.md`:** todo pasa por `registrarError` — nunca se le muestra al usuario un error crudo de Meta/Postgres/OpenAI, igual que en el resto de la app.

---

## 8. Permisos de Meta

- `instagram_content_publish` — **confirmado contra la documentación oficial de Meta que ese es el nombre correcto** para la vía de login que ya usa este proyecto (Facebook Login for Business, vía `config_id`; no `instagram_business_content_publish`, que es de una vía de login distinta que el repo no usa). **Juan José lo agrega directamente en la configuración de login del panel de Meta** — no es tarea de código, el `config_id` no vive en este repo.
- Usuarios ya conectados sin el permiso nuevo: detectarlo (`GET /me/permissions`) y mostrar "Reconecta Meta para publicar en Instagram" — código nuevo, el `state` con nonce ya existe y queda igual.
- Estos permisos van en la misma revisión de Meta ya pendiente. Preparar el texto de uso de cada permiso y el guion del video de pantalla.
- **Cuentas Business/Creator:** confirmado por el propio comportamiento del código existente — la cuenta de Instagram se resuelve siempre a través del edge `instagram_business_account` de la Página de Facebook, que solo existe para cuentas profesionales (Business o Creator). Una cuenta personal simplemente no devuelve ese id, el mismo modo de fallo que ya tiene cualquier otra función que dependa de esto (ej. la meta `seguidores_instagram`) — no hace falta un aviso nuevo, el flujo ya falla de forma segura ahí.

---

## 9. Director

- **Acción nueva:** `proponer_calendario_organico`. Usa ADN, `info_adicional`, catálogo real, álbum y piezas de semanas anteriores para no repetir temas.
- **Confirmado contra el patrón real (`crearMetaDesdeResumen`):** la IA **nunca** inserta piezas en `borrador` por su cuenta. Propone en el chat con una tarjeta-resumen y un botón ("Te preparé 5 reels para esta semana, ¿los creo?"); solo al hacer clic el cliente llama a la API real. Esto es más estricto que "crea las piezas en borrador" tal como lo decía el plan original — se aclara explícitamente para no insertar nada sin confirmación humana.
- El guion de cada pieza se genera igual que `/api/video/guion` — mismo modelo, misma validación zod, un reintento.
- **Generación en lote sin `trabajos_ia` nuevo:** en vez de un tipo de job nuevo, la ruta que crea el calendario responde de inmediato (filas en `borrador` sin guion) y usa `after()` para generar los guiones uno por uno en segundo plano — mismo patrón ya usado en `publicar-estrategia` para evitar que el proxy de Coolify corte la conexión. Menos infraestructura nueva que lo que el plan original asumía.
- **Las piezas `serie_partes` quedan encadenadas, con la validación explícita que pidió Juan José:** la parte 2 va en un día posterior del mismo calendario, con `continua_de_id` apuntando a la parte 1 (columna de la sección 6). Al proponer el calendario, el Director siempre crea las dos piezas juntas (nunca una parte 1 suelta). **Validado en código, igual que la variedad semanal** (función pura sobre las piezas del calendario, ejecutada en `/contenido` cada vez que algo cambia -- aprobar, cancelar o borrar una pieza): toda pieza `serie_partes` que no tenga ninguna otra pieza activa con `continua_de_id` apuntándole dispara el aviso **"La parte 1 promete una parte 2"** sobre esa pieza -- se muestra si la marca cancela o borra la parte 2 después de que el Director ya las había creado juntas, no solo al crear el calendario.

---

## 10. Fase O2 y O3

Sin cambios respecto al plan original — solo para tener en cuenta en el diseño, no se construyen en O1.

---

## 11. Orden de commits sugerido (reordenado por pedido de Juan José: el spike va primero)

1. **Spike de compatibilidad del renderizador del navegador** (primer commit, antes de tocar el zod). Instalar `@remotion/web-renderer` (`npx remotion add @remotion/web-renderer`), botón de prueba solo-admin en `/video` que llame `canRenderMediaOnWeb()`/`renderMediaOnWeb()` con `licenseKey: "free-license"` sobre las escenas/guiones que **ya existen hoy** (los fixtures de `video/fixtures/`, sin esperar a las recetas orgánicas), y descargue el mp4. Comparar contra `npm run render`. Revisar si `renderMediaOnWeb`/Mediabunny tienen alguna opción de fast-start (moov al frente); si no, probar si una URL de Cloudinary transcodificada del mismo mp4 sí lo entrega con moov al frente. **Si el spike falla o el resultado se ve muy distinto de `npm run render`, se detiene ahí y se muestran los resultados reales antes de seguir con el paso 2.**
2. `video/`: recetas orgánicas (`video/recetas/organico/`), campos `uso`/`receta_organica`/`publicacion` en el zod, tope de `duracion_objetivo_s` subido, CTA `comentar`, escena nueva `dos_opciones`, `objecion_respuesta` habilitado para orgánico, guion de ejemplo por receta. Sin tocar la app.
3. SQL de `publicaciones_organicas` + RPC (`docs/sql/contenido_organico.sql`, mismo estilo que `metas_atomicas.sql`), para que lo corra Juan José. Incluye la ruta de subida proxy y `video-listo`.
4. `/contenido` — **dividido en sub-commits más chicos, pedido por Juan José** (es el paso grande del plan):
   - **4a. Calendario:** tarjetas por día, estados, "Pedir propuesta al Director" (sin la acción real del Director todavía, eso es el commit 7) y "Agregar reel" a mano. **Capturas antes de seguir con 4c.**
   - **4b. Revisión:** guion editable + `@remotion/player`, caption/hashtags, "Aprobar"/"Aprobar todas". **Capturas antes de seguir con 4c.**
   - **4c. Render en cola y subida:** apenas se aprueba una pieza entra a renderizarse (sección 2), "Preparar mis videos" para las que falten, llama a `/api/contenido/[id]/video-listo`, tiempo estimado real, Wake Lock/`beforeunload`, "Reintentar subida" sin re-render.
   - **4c.2. Rediseño del calendario (pedido explícito tras ver 4a-4c en uso real):** estilo Meta Business Suite/Metricool. Vista semana (7 columnas lunes-domingo, hoy resaltado, días pasados atenuados) con toggle a vista mes (cuadrícula de semanas completas, días fuera del mes también atenuados). Cada pieza como miniatura vertical 9:16: portada real del video via `urlMiniaturaReel()` (nueva, `app/lib/cloudinaryUrl.ts`) cuando ya hay `url_video`, o color primario del ADN de marca (`construirTemaDesdeAdn`, `video/tema.ts`, ya reusado tal cual) con el nombre de la receta encima si todavía no hay video. Punto de color por estado (`colorPuntoEstado()`, `app/lib/contenido.ts` -- agrupado por progreso: gris=sin arrancar, amarillo=trabajando, azul=lista, verde=publicada, rojo=necesita atención; deliberadamente distinto de `ESTADOS_INFO.color`). "+" por día no pasado, pre-llena la fecha en "Agregar reel". Arrastrar y soltar para reprogramar (`PATCH /api/contenido/[id]` acción `reprogramar`, nunca para piezas `publicada`/`publicando`/`procesando` ni hacia el pasado -- mismo `esFechaFutura`). Resumen "N reels · N listos · N publicados · N por aprobar". Cola de render (commit 4c) y el aviso "promete parte 2" (de `serie_partes`) integrados en el mismo diseño. Responsive: por debajo de 700px, la cuadrícula de 7 columnas pasa a una lista vertical de días (uno por fila) -- en mes+móvil queda una agenda larga (un scroll por todos los días de la grilla, al estilo Google Calendar mobile), aceptado tal cual por ahora. `GET /api/contenido` ahora también acepta `?desde=&hasta=` (rango real de `programada_para`, para la vista de mes) además de `?semana=`. Capturas entregadas antes de seguir con 4d, pedido explícito.
   - **4d. Avisos:** pestaña en segundo plano, "La parte 1 promete una parte 2", 2h antes sin video, `vencida`. Descarga para TikTok.
   Al principio solo admin.
5. Publicador: ruta del cron (con el gate `PUBLICADOR_ORGANICO_ACTIVO`), RPC, estados (incluyendo `generando`/`generando_desde` y `tipo_error: "reconexion"`), mensajes del Equipo (`creativo` para preparación, `publicador` para publicación — ambos ya existentes, sin cambios de UI), pruebas con vitest y mocks de Meta.
6. Permisos de Meta y el aviso de reconexión (el permiso en sí lo agrega Juan José en el dashboard).
7. Acción del Director `proponer_calendario_organico` (con botón de confirmación, nunca auto-ejecutada; estado `generando` mientras `after()` genera los guiones en lote).
8. Abrir a clientes después de probar en la cuenta de Juan José.

**Aparte de este plan, commit propio antes del paso 5:** migrar las llamadas a Graph API de v21.0 a la versión vigente (hoy v26.0, confirmar al momento) — afecta código ya existente y los workflows de n8n, no solo lo nuevo de contenido orgánico.

---

## 12. Pruebas

Sin cambios de fondo respecto al plan original, con un ítem nuevo:

- **Unitarias (vitest, con mocks):** zod de cada receta (incluida `dos_opciones` y CTA `comentar`), variedad semanal, máquina de estados del publicador, que el RPC no publique dos veces.
- **Render:** un reel por receta en Chrome de escritorio (duración, zona segura, música, contraste claro/oscuro), tiempo de render de 20s en portátil normal, qué pasa en celular.
- **Resuelto en el spike (commit 1): `moov` ya queda al frente sin ningún paso extra** — confirmado inspeccionando los átomos reales de un mp4 producido por `renderMediaOnWeb`. No hace falta la alternativa de transcodificar por Cloudinary.
- **Meta (solo cuenta de Juan José):** programar 1 reel a 10 min, verificar publicación sola, revisar caption y portada, **borrarlo después**.
- Probar cierre de pestaña a mitad de render y reanudación.
- Build siempre con `next build --webpack` (Turbopack falla en este repo — confirmado en `estado_quiubot.md`), pruebas con vitest y mocks, nunca contra la base de datos real.

---

## 13. Decisiones — respondidas tras revisar el código real

1. **¿La versión actual de Remotion soporta el render en el navegador estable, o hay que subir de versión? ¿Rompe algo?**
   Sí la soporta: `@remotion/web-renderer` existe exactamente en `4.0.540`, la misma versión ya fijada para todo `@remotion/*` — no hace falta subir nada, no rompe nada. Leyendo la documentación real de la API (no solo buscándola), la página de overview dice "estable desde 4.0.491" sin ningún aviso de experimental — la contradicción que parecía haber era de una fuente desactualizada. El spike (ahora commit 1) es la confirmación final en la práctica.

2. **¿Qué escenas o capas no funcionan con el renderizador del navegador y qué propones?**
   No se puede saber sin probarlo — nadie ha usado este paquete todavía en el repo. Lo que sí se puede adelantar leyendo el código: las escenas usan `OffthreadVideo`/`Audio`/`Img` del paquete `remotion` clásico, mientras que el ejemplo oficial de `renderMediaOnWeb` usa `<Video>`/`<Audio>` de `@remotion/media` (API más nueva) — ese es el punto más probable de incompatibilidad, y el spike lo prueba primero tal cual está hoy, sin adaptar nada, antes de decidir si hace falta migrar. El commit 1 es exactamente ese spike — ahí se entrega la lista real.

3. **¿Qué token y qué permisos de Instagram hay hoy, y qué cambia en el OAuth?**
   El token es `usuarios.meta_access_token`, un user token de larga duración, usado siempre contra la API v21.0. No hay id de cuenta de Instagram guardado — se resuelve en vivo cada vez vía el edge `instagram_business_account` de la Página. El login usa `config_id` (Facebook Login for Business) sin scope explícito en el código, así que **solo Juan José puede confirmar en el dashboard de Meta si `instagram_content_publish` ya está pedido** para esa configuración — si no, se agrega ahí, no en el repo.

4. **¿Cron en n8n cada 5 min o prefieres otro mecanismo? ¿Qué carga agrega al VPS?**
   El patrón de autenticación (`Bearer ADMIN_SECRET` + `timingSafeEqual`) es idéntico en los 7 crons que ya existen hoy — técnicamente no hay nada especial en bajar a 5 minutos. No hay visibilidad desde el código de las specs/carga real del VPS KVM1 — eso queda a criterio de Juan José, que es quien lo administra.

5. **¿`/contenido` como pantalla nueva o como pestaña dentro de `/video`?**
   Pantalla nueva. `/video` tiene un flujo propio centrado en `ObjetivoVideo` (objetivos de Meta Ads) y su mapeo a botones/CTA de anuncios; meter orgánico ahí mezclaría ese concepto con `receta_organica` en la misma UI. Reutiliza `video/` como librería compartida, pero la pantalla es otra.

6. **¿El guion orgánico se genera en la app, como `/api/video/guion`, o en n8n?**
   En la app — mismo lugar, mismo patrón exacto que `/api/video/guion` (BYOK OpenAI, zod, un reintento con los errores). Es precedente directo ya en producción, no hay motivo para hacerlo distinto.

---

## 14. Cambios frente al plan original (resumen)

- **Orden de commits:** el spike del renderizador va primero (commit 1, probado contra las escenas que ya existen), no después del zod — pedido de Juan José. Si falla o se ve muy distinto de `npm run render`, se detiene ahí y se muestran resultados antes de seguir.
- **Render:** confirmado que `@remotion/web-renderer@4.0.540` ya calza con la versión fijada — sin bump de versión, se instala con `npx remotion add`. Leyendo la doc real de la API (no solo buscándola): está confirmada como estable desde 4.0.491, sin aviso de experimental vigente. Firmas reales de `renderMediaOnWeb`/`canRenderMediaOnWeb` documentadas en la sección 5. Se agrega `licenseKey: "free-license"` explícito. Riesgo real encontrado: las escenas usan `OffthreadVideo` clásico, no `@remotion/media`'s `<Video>` (el que usa el ejemplo oficial) — el spike lo prueba tal cual antes de decidir si migrar.
- **Subida del video:** se abandona la propuesta de firma-directa-a-Cloudinary (no existe ese patrón en el repo) a favor de un proxy por el servidor, reusando exactamente el código ya existente en `album/subir`/`subir-fotos` — decisión confirmada por Juan José.
- **Portada del reel:** se genera por transformación de URL de Cloudinary sobre el propio mp4, en vez de subir un .jpg aparte (no hay columna para eso en `album_creativos` y no hace falta crearla).
- **Sin `trabajos_ia` nuevo:** ni para el render (corre en el navegador) ni para generar el calendario en lote (se usa el mismo patrón `after()` que ya usa `publicar-estrategia`), ahora con estado `generando`/`generando_desde` y el cron `vencer-propuestas` extendido para vencerlo a los 10 min, con botón "Reintentar" — pedido de Juan José.
- **`video/guion.schema.ts` necesita más cambios de los explícitos en el plan original:** subir el tope de `duracion_objetivo_s` (hoy 25, hace falta 30), una escena nueva (`dos_opciones`, para `pregunta_comunidad`) que no tenía equivalente, y habilitar `objecion_respuesta` también para `uso: "organico"` (hoy solo permitido en `retargeting`).
- **Mensajes de equipo:** se usan los asistentes `creativo` (preparación de videos) y `publicador` (eventos de publicación) — ambos ya existen en el selector de chats, cero cambios de UI. Se descarta la idea de un asistente nuevo.
- **Permisos de Meta:** confirmado que `instagram_content_publish` es el nombre correcto para la vía de login que ya usa el repo. Juan José lo agrega él mismo en el dashboard — no es tarea de código.
- **Graph API v21.0 (nuevo, pedido de Juan José):** se retira el 21 de enero de 2027, unos dos meses desde hoy — sí es pronto. Propongo migrar a v26.0 (última confirmada), en un commit aparte antes del publicador, porque afecta también los workflows de n8n.
- **Especificaciones de Meta para Reels, verificadas en doc oficial:** 3s–15min, máx. 300MB, contenedor MOV/MP4 con `moov` al frente, vence a las 24h. **Confirmado con el spike (commit 1, ejecutado):** el mp4 de `renderMediaOnWeb` ya sale con `moov` antes de `mdat` — sin pasos extra, sin necesidad de transcodificar por Cloudinary.
- **Token vencido o permiso faltante:** sin reintentos (antes decía "reintentos para esto también" de forma ambigua) — pasa directo a `error` con `tipo_error: "reconexion"`, aviso "Reconecta tu Instagram" y mensaje del asistente `publicador`.
- **Entornos:** nuevo gate `PUBLICADOR_ORGANICO_ACTIVO` (solo en producción) para que el cron nunca publique de verdad desde staging, ya que comparten base de datos y n8n.
- **Director:** se precisa que `proponer_calendario_organico` nunca inserta nada en la base sin que el usuario haga clic en un botón de confirmación — mismo patrón ya verificado en `crearMetaDesdeResumen`.
- **Build/pruebas, confirmado contra `estado_quiubot.md`:** `next build --webpack` (Turbopack falla en este repo), vitest con mocks (nunca la base real), zona horaria `hoyBogota`, errores siempre por `registrarError`.
