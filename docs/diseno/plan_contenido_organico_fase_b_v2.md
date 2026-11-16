# Fase B v2 — Contenido orgánico con edición desde el audio

**Estado:** aprobado por Juan José el 18 nov 2026 para arrancar la construcción de la Fase B v2.0 (el único reel automático). La Fase B v2.1 (generalización) queda documentada pero no se construye hasta que ese reel se apruebe.

## Contexto

Los bloqueantes del lanzamiento del 30-nov ya están resueltos; la revisión de Meta sigue su curso en paralelo (Juan José la lleva él mismo, ver memoria `pendiente_meta_app_review_live`). Con eso despejado, arranca la Fase B v2 del pivote de contenido orgánico: que los reels automáticos (guion de IA → video) compitan de verdad con el mejor contenido de Reels/TikTok — que muestren en vez de decir, que enganchen y retengan, con voz, música y efectos, al nivel de los 2 reels de referencia ya aprobados como molde (`video/fixtures/organico/referencia/`).

Esto es más ambicioso que la Fase B original (archivada en memoria `plan_completo_pivote_visual_organico`, y en `docs/diseno/plan_contenido_organico.md`): esa v1 solo agregaba un campo `visual` a las escenas de texto existentes. Esta v2 cambia el eje de edición — la duración, los cortes y el ritmo de cada escena ya NO los decide un número que la IA adivina (`duracion_s`), sino el audio real de la narración, con subtítulos palabra por palabra sincronizados a ese audio.

**Orden de construcción, explícito y no negociable:** primero UN reel completo, generado de punta a punta por el sistema (receta `consejos_numerados`, marca Quiubot), sin ningún retoque a mano — se entrega el mp4 para revisión, igual que los 2 reels de referencia. **Solo cuando ese reel se apruebe**, se generaliza a las demás recetas y a la biblioteca completa de visuales. Este plan por lo tanto tiene dos partes: **Fase B v2.0** (lo que se construye ahora, acotado a ese único reel) y **Fase B v2.1** (el diseño de la generalización, documentado pero no construido todavía).

**Reglas de siempre, confirmadas para este plan:** todo en `dev`, solo admin, el SQL se corre a mano (Juan José, nunca automático), y nada llega a `main` sin confirmación explícita.

## Lo que ya existe y se reusa tal cual (investigado a fondo, no se reinventa)

- **`@remotion/web-renderer` ya está en producción de punta a punta**: `app/contenido/ColaDeRender.tsx` (Wake Lock, `beforeunload`, tiempo estimado medido en vivo) + `app/api/contenido/[id]/video-listo/route.ts` (proxy server-side, claim atómico, inserta en `album_creativos`). `<Audio>`/`<Video>` de `@remotion/media` ya migrados (el renderer real rechaza `Audio`/`OffthreadVideo` clásicos con una excepción explícita) — cualquier pista de voz nueva usa `@remotion/media` desde el día uno.
- **El molde visual aprobado** (`video/fixtures/organico/referencia/visuales/`): `molde.tsx` (tema, titular, insignia de marca, botón con estado), `geometria.ts`, `acento.ts` (colores + variantes `_BLOQUE` verificadas con `contrasteSuficiente()`), `CelularChat`, `BucleChip`, `TinteAcento`, `FormasInferior`, `ComparacionFoto`, `TitularMitoVerdad` — con todas las reglas ya aprendidas (contraste, sin pantallas vacías, sin tachado nativo, "→✓✗↓" vía emoji, verdad explícita, sin marcas ajenas). Este plan reusa estos componentes directo para el visual del único reel, no construye una biblioteca nueva de 11 tipos todavía.
- **BYOK OpenAI, patrón exacto a copiar**: `usuarios.openai_key` cifrado (`lib/crypto.ts`, `desencriptarSiHaceFalta`) → gate 400 si falta la llave → 500 si no descifra. 3 ejemplos reales (`/api/video/guion`, `/api/contenido/[id]/guion`, `app/lib/analizarPiezaImagen.ts`) confirman: `fetch` directo (nunca SDK), `AbortController` + timeout, detección de `insufficient_quota|credit_balance_exhausted` → "Tu cuenta de OpenAI no tiene créditos. Agrega saldo en platform.openai.com y vuelve a intentar." (mensaje exacto a reusar). `app/lib/analizarPiezaImagen.ts` es el precedente directo para la llamada de visión del control de calidad — mismo `image_url` content-block, mismo modelo `gpt-4o`, misma validación con zod del JSON que regresa.
- **`video/tema.ts`**: `contrasteSuficiente()`, `colorTextoSobre()`, `respiracion()` — se reusan tal cual para cualquier componente nuevo.
- **Patrón admin-only**: `app/admin/publicar-instagram-prueba/` (page.tsx server-side gate + ruta API con el mismo gate) es el molde más reciente para una pantalla de prueba solo-admin — se reusa igual para el arnés de prueba de este plan.
- **Música con licencia**: `elegirPistaMusicalOrganica()` (`app/lib/contenido.ts`) ya filtra por `licencia_url` no nulo. `plataformas_permitidas` no existe en ningún lado del esquema hoy — confirmado con grep exhaustivo, es concepto 100% nuevo (ver SQL abajo).
- **Terreno 100% nuevo, sin precedente en el repo** (confirmado por búsqueda exhaustiva): TTS/voz, subtítulos sincronizados a audio, control de calidad por visión sobre video renderizado, efectos de sonido con licencia. `video/guion.schema.ts:197` dice hoy explícitamente "sin voz en la Fase 1" — eso es lo que este plan cambia.

## Investigación externa (OpenAI TTS + timestamps + captions en Remotion)

- **TTS (`/v1/audio/speech`)**: modelos `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts` — ninguno devuelve timing por palabra. 13 voces disponibles. Costo irrelevante para un reel (~$0.01-0.02 por narración de 30s). Aviso de deprecación real: estos 3 modelos se apagan el 6-ene-2027 — no bloquea hoy, pero hay que revisarlo antes de esa fecha (el reemplazo sugerido por OpenAI usa la API Realtime por WebSocket, no el mismo endpoint simple).
- **Timestamps por palabra = transcribir el audio generado con Whisper** (`/v1/audio/transcriptions`, `timestamp_granularities:["word"]`, `response_format:"verbose_json"`, solo `whisper-1` lo soporta — los modelos más nuevos de transcripción no). Respuesta: `words: [{word, start, end}]` en segundos. Costo: $0.006/minuto (centavos por reel). Riesgo real documentado por OpenAI: no hay garantía de alineación verbatim exacta — la mitigación es asignar por CONTEO de palabras (cuántas palabras le tocan a cada escena del guion, en orden), nunca por coincidencia de texto.
- **Subtítulos en Remotion**: `@remotion/captions` (tipo `Caption`, `createTikTokStyleCaptions()` para agrupar en "páginas") + `@remotion/openai-whisper` (`openAiWhisperApiToCaptions()`, conversor directo de la respuesta de Whisper a `Caption[]`) — paquetes oficiales, se agregan como dependencia. El resaltado de la palabra activa es una comparación simple de tiempo por cuadro (confirmado en el ejemplo oficial de Remotion, sin necesitar `interpolate`) — se envuelve en el lenguaje visual ya aprobado del molde (texto grande, dentro de zona segura, contraste verificado).
- **Control de calidad por visión**: `gpt-4o`/`gpt-4o-mini` aceptan múltiples imágenes en una sola petición (hasta 1500, documentado). La combinación "visión + salida JSON estructurada" no está confirmada por escrito en la documentación de OpenAI — se trata como riesgo a verificar con una prueba real chica (2-3 imágenes, un schema simple) antes de construir el paso completo, no se asume que funciona.

## SQL pendiente (lo corre Juan José a mano, nunca automático)

Un solo archivo nuevo `docs/sql/contenido_organico_fase_b_v2.sql`, mismo estilo que `metas_atomicas.sql`/`contenido_organico.sql` (`add column if not exists`, RLS sin políticas, `notify pgrst, 'reload schema';` al final):

1. `alter table publicaciones_organicas add column if not exists voz_url text;` — URL de Cloudinary del audio de la narración completa, generado una vez y persistido (igual que la música, nunca se regenera en cada preview/render).
2. `alter table marcas add column if not exists voz_tts text;` — nombre de la voz de OpenAI TTS elegida para esa marca (nullable; si es null, el código elige una por defecto según el estilo de fuente de la marca, nunca lo inventa la IA).
3. `alter table pistas_musicales add column if not exists plataformas_permitidas text[];` — plataformas donde la licencia de esa pista es válida, mismos valores que ya usa `publicaciones_organicas.plataforma` (ej. `{instagram,tiktok}`). Un `check` nuevo: si `licencia_url` no es null, `plataformas_permitidas` tampoco puede serlo (una licencia sin decir para qué plataforma vale no es una licencia usable). `elegirPistaMusicalOrganica()` se extiende para exigir que la plataforma de destino esté en ese arreglo.
4. `alter table publicaciones_organicas add column if not exists control_calidad jsonb;` — resultado del paso de control de calidad (`{intentos, hallazgos: [{tipo, escena_id, detalle}], aprobado: boolean}`), para que el admin vea por qué se regeneró algo o por qué falló.

`notify pgrst, 'reload schema';` al final del archivo.

## Fase B v2.0 — El único reel automático (lo que se construye ahora)

### 1. El guion ya no fija `duracion_s` como verdad final — el audio manda

- `EscenaBase` (`video/guion.schema.ts`) gana un campo nuevo compartido: `narracion: string` (lo que se narra en esa escena — distinto del `subtitulo` que ya existe, que es un titular grande y estático; `narracion` es el guion de voz, del que además se derivan los subtítulos sincronizados). `duracion_s` se queda en el schema como la estimación de la IA (sirve para que el prompt calcule el ritmo al escribir), pero deja de ser lo que el render usa — el render usa tiempos reales calculados después de generar el audio.
- **Duración de la escena: 3-6s de narración, no 1-2.5s.** Cada escena dura lo que dura su `narracion` en voz (3-6s reales, frase completa con una idea desarrollada) — el ritmo visual de 1-2s pedido por el usuario NO se logra troceando en escenas más chicas, sino con **eventos visuales amarrados a palabras específicas dentro de esa misma escena**.
- **`eventos` — nuevo campo, va dentro de cada tipo de `visual` del `VisualSchema` chico de este v2.0 (punto 6 más abajo), no en `EscenaBase`**, porque las acciones válidas dependen de qué visual es (un `celular_chat` puede "recibir notificación", un `boton_estado` puede "aparecer"/"hacer clic", un `contador` puede "subir"). Forma: `eventos: {palabra: number, accion: "..."}[]`, con `accion` restringida por un `z.enum(...)` propio de cada tipo de visual dentro del discriminated union (nunca texto libre) y `palabra` validado con `superRefine` contra la cantidad real de palabras de `narracion` de esa escena (`0 <= palabra < totalPalabras(narracion)`) — si la IA pide un evento en una palabra que no existe, falla la validación. El tiempo REAL de cada evento (en segundos/cuadros) se calcula después, con el `palabra`-ésimo timestamp que devuelve la alineación de voz (punto 3 más abajo) — la IA nunca escribe segundos, solo índices de palabra.
- Regla de ritmo en el prompt (`promptGuionOrganico.ts`): cada escena narra una idea completa en 3-6s, pero debe traer al menos 2-3 `eventos` repartidos a lo largo de esa narración (nunca todos al inicio) para que algo visual cambie cada 1-2s real. El gancho (primera escena) debe tener su frase más fuerte en la primera palabra, no en un "en Quiubot..." de arranque lento, y su primer evento visual debe caer dentro del primer segundo.

### 2. Narración: una interfaz única `generarVoz()`, swappable de proveedor

**Decisión explícita: el resto del sistema (render, QC, prompt) nunca llama a OpenAI TTS/Whisper directo — llama a una sola función `generarVoz()`.** Motivo real, no preferencia de arquitectura por sí sola: tanto los modelos de TTS (`tts-1`/`tts-1-hd`/`gpt-4o-mini-tts`) como los de transcripción con timestamps (`whisper-1`) se apagan a inicios de 2027 — cuando eso pase, cambiar de proveedor debe ser tocar un solo archivo, no perseguir cada lugar del código que hoy asume OpenAI.

- `app/lib/videoOrganico/generarVoz.ts` — única función pública: `generarVoz(textoCompleto: string, opciones: {voz: string}) => Promise<{audioUrl: string, palabras: {texto: string, inicio_s: number, fin_s: number}[]}>`. Todo lo de abajo es implementación PRIVADA de este archivo, nunca importada aparte.
  - Internamente llama a `https://api.openai.com/v1/audio/speech` con la llave BYOK, **modelo `gpt-4o-mini-tts`** (no `tts-1`) porque es el único que admite control de tono por instrucciones — `instructions: "Español latino neutro con calidez colombiana, cercano, enérgico, ritmo de reel."` (nombre exacto del campo a confirmar contra la doc vigente de OpenAI al implementar; la investigación externa ya confirmó que `gpt-4o-mini-tts` admite esto, no así `tts-1`/`tts-1-hd`). Voz resuelta desde `marcas.voz_tts` o un valor por defecto según `estilo_fuente` (nunca inventada por la IA).
  - Internamente sube el audio generado a `/v1/audio/transcriptions` (`whisper-1`, `timestamp_granularities:["word"]`, `response_format:"verbose_json"`) para los timestamps.
  - Sube el audio final a Cloudinary (mismo patrón que `album/subir`) y devuelve su URL ya pública.
  - Sigue el patrón exacto de `llamarDirector.ts`/`analizarPiezaImagen.ts` para cada llamada interna: `AbortController`+timeout, `insufficient_quota` detectado con el mismo mensaje ya usado en el resto del repo, nunca el error crudo de OpenAI al usuario.
- Texto completo pasado a `generarVoz()` = concatenación de todas las `narracion` de las escenas, en orden (con los números ya convertidos a letras y el texto normalizado antes de concatenar — ver punto 3).
- El `audioUrl` se guarda en `publicaciones_organicas.voz_url`; los `palabras[]` se asignan a cada escena (punto 3) y se guardan como `tiemposRender` dentro del jsonb de `guion`.
- Costo real por reel: unos centavos (TTS + Whisper combinados).
- **En el reporte de entrega del primer reel, se dice explícitamente qué voz se usó** (nombre real de la voz de `gpt-4o-mini-tts` elegida, no solo "una voz").

### 3. Alineación robusta entre la narración escrita y los tiempos reales

El riesgo real (confirmado por la investigación externa): Whisper no garantiza alinear palabra por palabra EXACTO con el texto que se le dio a TTS — puede fusionar, separar o transcribir distinto un número o una abreviación. Esto importa mucho acá porque `eventos` (punto 1) depende de índices de palabra exactos.

- **Antes de mandar el texto a `generarVoz()`**: los números se escriben en letras (`"3"` → `"tres"`) dentro de `narracion` — nunca dígitos, para que TTS los diga como una palabra predecible y no como algo que Whisper pueda transcribir distinto. Normalización adicional: minúsculas para contar, espacios únicos, sin saltos de línea.
- **Conteo exacto (caso normal)**: a cada escena le toca `cantidadPalabras(narracion_normalizada)` palabras consecutivas de las que devuelve Whisper, en orden — ya descrito en el punto 1.
- **Si el conteo total no coincide** (`suma de palabras esperadas por escena ≠ palabras que Whisper realmente devolvió`): en vez de fallar o alinear a ciegas, `app/lib/videoOrganico/alinearPalabras.ts` corre una **alineación por similitud de secuencia** (tipo `difflib`/LCS, comparando la lista de palabras normalizadas esperadas contra la lista real de Whisper) para encontrar la mejor correspondencia posible palabra-a-palabra, incluso con fusiones/separaciones puntuales.
- El control de calidad (punto 8) recibe de esta alineación un puntaje de qué tan bien coincidió (ej. proporción de palabras alineadas sin ambigüedad) — **si ese puntaje cae por debajo de un umbral, el control de calidad marca "desfase" explícito** en vez de confiar en una alineación dudosa.

### 4. Si la narración cambia, la voz queda desactualizada hasta regenerarse

`voz_url`/`tiemposRender` se calculan UNA vez y se persisten (punto 2) — pero si después alguien edita cualquier `narracion` de alguna escena (a mano, o porque el control de calidad pidió regenerar esa escena puntual), esa voz y esos tiempos ya no corresponden al texto actual. Antes de cualquier render, el código compara el texto narrado actual contra el que se usó para generar `voz_url` la última vez (un hash/huella simple del texto concatenado, guardado junto a `voz_url`) — si no coincide, `generarVoz()` se vuelve a llamar automáticamente antes de renderizar, nunca se renderiza con audio desactualizado.

### 5. Subtítulos palabra por palabra

- Se agrega `@remotion/captions` y `@remotion/openai-whisper` como dependencias — `openAiWhisperApiToCaptions()` convierte la respuesta de Whisper directo a `Caption[]`, sin glue code.
- Componente nuevo en el molde, `SubtitulosSincronizados` (mismo archivo/convención que `TitularMitoVerdad` etc.): texto dentro de zona segura, la palabra activa resaltada (comparación simple de tiempo contra `useCurrentFrame()`, sin `interpolate`, siguiendo el ejemplo oficial de Remotion), recuadro o degradado oscuro detrás si hay una foto real debajo (regla ya aprendida, verificada con `contrasteSuficiente()`).

### 6. Visual: reusar el molde, no construir la biblioteca de 11 tipos todavía

- `VisualSchema` chico, solo con los tipos que `consejos_numerados` necesita de verdad (los que ya existen en `ReelConsejosNumerados.tsx`): `celular_chat`, `cursor_clic`, `contador`, `boton_estado`. Se promueven esos componentes de `video/fixtures/organico/referencia/visuales/` a `video/visuales/` (ubicación real, no de referencia).
- **Cada miembro del discriminated union trae su propio `eventos: {palabra: number, accion: <enum propio>}[]`** (ver punto 1): `celular_chat` admite `accion: "notificacion_llega"|"numero_sube"`, `cursor_clic` admite `"aparece"|"clic"`, `contador` admite `"sube"`, `boton_estado` admite `"aparece"|"clic"|"cambia_estado"`. El componente real de cada visual (en `video/visuales/`) lee estos eventos + los tiempos reales por palabra (punto 3) para decidir CUÁNDO animar cada cosa — nunca con un `duracion_s`/porcentaje fijo como hoy.
- La IA elige el tipo de visual por escena, sus `eventos` (como índices de palabra, nunca segundos) y los parámetros de texto/número (nunca colores, nunca cifras de resultado inventadas) — la regla "muestra, no digas" ya está en el prompt de `promptGuionOrganico.ts`, se extiende con la sección de visuales (mismo molde que `REFERENCIA_ESCENAS`).
- `medioDeFondo` (ya existe, `Composicion.tsx`) sigue resolviendo una pieza real del álbum para cualquier escena sin visual dedicado propio — sin cambios.

### 7. Sonido en capas

- `capas/Voz.tsx` (nuevo): `<Audio>` de `@remotion/media`, `src=voz_url`, siempre a volumen completo durante las ventanas de narración.
- `capas/Musica.tsx` (ya existe, se extiende): la curva de volumen ya usa `interpolate()` para los fades de entrada/salida — se le agrega una curva de "ducking": baja a ~25% durante las ventanas donde hay narración activa (ya conocidas por `tiemposRender`), vuelve a 70-100% en los silencios. Mismo componente, no uno nuevo.
- `capas/Efectos.tsx` (nuevo, mínimo): clics/pops puntuales en cuadros específicos (ej. cuando `BotonEstado` "hace clic"), mapeo fijo visual→categoría de sonido por código (nunca lo elige la IA) — mismo criterio que la música. Librería de 3-4 efectos de Meta Sound Collection, misma disciplina de licencia (`licencia_url`) que la música.
- `elegirPistaMusicalOrganica()` se extiende para filtrar también por `plataformas_permitidas` (ver SQL).

### 8. Control de calidad automático antes de entregar

Dos capas, nunca solo una:
- **Reglas en código** (sin IA): cada escena tiene `narracion` no vacía y un visual con `eventos` válidos asignado; `contrasteSuficiente()` sobre los colores reales usados en cada combinación texto/fondo del guion; duración total renderizada (`tiemposRender`) dentro de tolerancia del audio real decodificado (mismo truco ya usado para medir -91dB real: `mediabunny`/`AudioBufferSink` en el navegador) — si el audio mezclado sale en silencio, falla aquí, antes de gastar nada en visión; **el puntaje de alineación del punto 3 por debajo del umbral marca "desfase" explícito** aquí mismo.
- **Modelo de visión (BYOK)**, mismo patrón que `analizarPiezaImagen.ts`: se extraen cuadros clave (inicio/mitad/fin de cada escena — confirmar primero, con un spike chico, si `@remotion/web-renderer` puede generar un cuadro fijo sin renderizar el video completo; si no, se extraen del mp4 ya renderizado) y se manda UNA petición con varias imágenes a `gpt-4o` pidiendo detectar: pantallas que se ven vacías, textos superpuestos, bajo contraste visible. Antes de construir este paso completo, probar en chico (2-3 imágenes, un schema JSON simple) que la combinación visión+salida estructurada funciona de verdad — la documentación de OpenAI no lo confirma por escrito.
- Si algo falla: se reintenta regenerar SOLO la parte que falló (la escena puntual, o el paso de audio si fue silencio/desfase — lo que dispara automáticamente el punto 4, `voz_url` desactualizada) hasta 2 veces; si sigue sin pasar, el reel no se entrega — el admin ve un mensaje claro de qué falló, nunca un mp4 silenciosamente roto.

### 9. Arnés de prueba — pantalla admin para el único reel

Nueva pantalla `app/admin/reel-automatico-prueba/` (mismo patrón exacto que `app/admin/publicar-instagram-prueba/`: `page.tsx` con el gate server-side, cliente que llama a una API, solo admin): un botón "Generar reel automático (consejos_numerados, Quiubot)" que corre la cadena completa (guion → narración/`generarVoz()`/alineación → visuales con eventos → sonido en capas → control de calidad → render en el navegador) y entrega el mp4 para descargar — igual que se entregaron los 2 reels de referencia, pero generado 100% por el sistema, sin ningún retoque a mano.

### Orden de commits sugerido

1. SQL (lo corre Juan José).
2. `narracion` en el esquema (sin `duracion_s` como verdad final), ajuste del prompt (escenas de 3-6s, al menos 2-3 eventos repartidos, gancho verbal + primer evento dentro del primer segundo).
3. `generarVoz()` (TTS + transcripción internas) + `alinearPalabras()` (conteo exacto + alineación por similitud de secuencia + puntaje) + persistencia de `voz_url`/hash del texto/`tiemposRender`.
4. `SubtitulosSincronizados` (con `@remotion/captions`/`@remotion/openai-whisper`).
5. `VisualSchema` chico (con `eventos` por tipo) + promoción de los 4 componentes a `video/visuales/`.
6. `capas/Voz.tsx`, ducking en `capas/Musica.tsx`, `capas/Efectos.tsx`.
7. Control de calidad (reglas de código primero, spike de visión después, con la prueba empírica de visión+JSON antes de construir el paso completo).
8. Pantalla admin `reel-automatico-prueba` — generación de punta a punta, entrega del mp4.

## Fase B v2.1 — Generalización (diseño documentado, no se construye todavía)

Solo arranca después de que Juan José apruebe el mp4 del v2.0:
- `VisualSchema` completo (11 tipos del catálogo original de la Fase A/B v1), dispatcher genérico `video/visuales/index.tsx`.
- Aplicar la edición desde el audio a las 5 recetas restantes (no solo `consejos_numerados`).
- Biblioteca de efectos de sonido con infraestructura real (tabla `efectos_sonido`, ruta admin tipo `/api/admin/efectos-sonido`, mismo mirror que `pistas_musicales`).
- Elección de voz por marca con UI real (hoy en v2.0 es solo la columna SQL + un valor por defecto).
- Prueba de genericidad con 2 marcas de rubro distinto.

## Fuera de alcance (explícito)

- Nada de esto llega a `main` sin confirmación explícita, en ningún punto.
- El reel sigue siendo admin-only durante toda la v2.0 — no se abre a clientes hasta después de v2.1.
- Migración de Graph API / Meta App Review: temas aparte, no se tocan en este plan.

## Verificación

1. `npm run video:studio` para cada componente nuevo (subtítulos, capas de audio) antes de integrarlos.
2. Spike chico y descartable para confirmar (a) si `@remotion/web-renderer` puede extraer un cuadro fijo sin render completo, y (b) que visión+JSON estructurado funciona — ambos antes de construir el paso de control de calidad completo.
3. `npm test` limpio en cada commit (mocks de `fetch`/Supabase, nunca contra OpenAI ni la base real — mismo patrón que `app/api/contenido/[id]/guion/route.test.ts`).
4. El mp4 final se escucha completo (voz clara, música audible pero nunca tapando la voz, efectos en el momento correcto) y se revisa cuadro por cuadro igual que los 2 reels de referencia, antes de considerar la v2.0 aprobada.
