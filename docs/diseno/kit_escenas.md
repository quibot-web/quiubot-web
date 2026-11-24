# Kit de escenas del reel ilustrado (visuales-v2)

**Rama:** `visuales-v2`.
**Estado:** tanda 1 y su prototipo listos para revisión del estilo (23 nov 2026). La IA todavía no usa el kit: eso llega después de aprobar el estilo.
**Objetivo:** que cada reel represente lo que dice la narración. Si habla de una profesora, se ve una profesora; si habla de una cartelera, se ve una cartelera. Sin repetir siempre las mismas escenas.

## Cómo funciona

- **La IA solo compone en JSON.** El plan ilustrado suma `composiciones`: un lugar (`fondo`), personajes y objetos, todos de listas cerradas validadas con Zod estricto (`video/ilustrado/kit/catalogoKit.ts`).
  - Cada personaje lleva tipo, casilla (izquierda … derecha), plano (frente o fondo), hacia dónde mira, pose, expresión, y opcionalmente ropa, piel, pelo, peinado y accesorio.
  - Cada objeto va en un lugar de la pared o del piso, o en la mano de un personaje.
  - Nunca escribe código, SVG ni texto en pantalla.
- **Las acciones siguen amarradas a palabras**, con el formato de siempre `{escena, accion, palabra}`. En el kit, `accion = "elemento.verbo"` (por ejemplo `profesora.senala`, `dibujo_nina.va_al_hueco`), con un `objetivo` opcional (a qué señala).
- **Cada composición es una isla del mundo**, igual que el celular, la billetera o la multitud.
  - Un registro de escenas (`motor/registro.ts`) reemplaza al catálogo fijo en el recorrido, la cámara, el validador y el control de calidad.
  - Cada elemento declara su recuadro, y la cámara lo encuadra para que lo nombrado ocupe ≥50 %.
  - Si varias acciones seguidas ocurren en el mismo lugar ("todos aplauden"), la cámara encuadra al grupo en vez de saltar de uno en uno.
- **Convive con las escenas actuales.** El prototipo pasa del feed al salón y vuelve al feed y al perfil.
- **Personajes por partes:**
  - cuerpo, cabeza por expresión, pelo largo en capa propia, brazo y antebrazo con mano abierta o señalando;
  - hombro y codo articulados (`kit/poses.ts`);
  - los gestos vuelven solos a "parado";
  - señalar apunta al objetivo;
  - los adultos van detrás de los niños, para que un brazo nunca tape una cara.
- **Rendimiento.**
  - Cada parte se dibuja una vez en SVG con sus colores y se convierte a PNG al precargar (`kit/piezas.ts`).
  - El render solo mueve imágenes, sin serializar ningún SVG por cuadro.
  - El prototipo (21 s) se renderizó a **3.08 s por segundo de video** en Chrome (meta: ≤5).
- **Variedad entre reels.** Lo que la IA no fija (ropa, piel, pelo, peinado, accesorio, color de pared) sale de la semilla del reel. Los personajes cambian entre reels sin salir del mismo estilo.

## Tanda 1 (incluida)

- **Lugar:** salón de clases (diorama 2.5D con pizarrón de tiza sin letras, ventana, banderines y piso en perspectiva). Paredes: crema, menta, celeste o durazno.
- **Personajes:** profesora, niño y niña.
- **Poses:**
  - parado (base);
  - señalar, celebrar y aplaudir;
  - ofrecer: agregada porque el prototipo la necesita (el niño que le trae dulces a la profesora).
- **Expresiones:** normal (base), feliz y triste.
- **Objetos:**
  - cartelera de corcho con 11 dibujos y un solo espacio libre;
  - dibujos infantiles (12 motivos, sin texto);
  - bolsa de dulces.

## Ronda v4 del prototipo (24 nov 2026)

- **Lugar a pantalla completa:** la pared y el piso cubren todo el ancho y
  se extienden más allá del cuadro (`ENTORNO`). No hay bandas oscuras ni
  bordes de caja.
- **Puesta en escena con profundidad:** `pupitre` (con silla) y dos campos
  nuevos para la IA: `sentado_en` (un pupitre) y `mira_a` (un id). Lo que
  está más atrás se dibuja antes; la silla va detrás de quien se sienta y
  el pupitre delante.
- **Vida:**
  - parpadeo con período propio de cada personaje;
  - respiración;
  - cabeza y ojos que giran hacia lo que pasa (`atencionesDe`: señalar,
    ofrecer, levantar la mano, el dibujo que vuela);
  - giro suavizado en 8 cuadros.
- **Puerta celular↔lugar:** la cámara entra a la pantalla del celular y la
  cartelera aparece dentro de ella. Al volver, corta a la cartelera
  abierta, se cierra hasta llenarla y pasa al celular. Nunca se ve el
  mundo oscuro.
- **Expresiones más marcadas:** feliz con la boca abierta, triste con
  lágrima y sorprendido con boca en O.
- **Cámara dentro de un lugar:** corta, no viaja. Con tomas cada ~1 s, los
  viajes de 0,5–1,5 s atrasaban la imagen respecto a la voz, hasta ~3 s al
  final. Otras reglas:
  - mínimo 12 cuadros entre cortes;
  - dos acciones muy seguidas van en un plano abierto (zoom ≥0,55).
- **Rendimiento:** no se dibuja lo que la cámara no ve (personajes,
  cartelera). Medido en Chrome: 3,5–4,3 s por segundo de video.
- **Regla de guion:** un visual no contradice la frase. El niño de los
  dulces se pone triste cuando la profesora elige otro dibujo, y en
  "todos aplauden" ya sonríe.

## Reglas automáticas de cámara en el kit (v5, 24 nov 2026)

Valen para cualquier composición, también las que arme la IA. Están en
`video/ilustrado/motor/encuadreKit.ts` y las prueba `kit/encuadre.test.ts`,
que incluye 30 composiciones al azar.

1. **Sin piso vacío:**
   - el encuadre se calcula sobre lo nombrado, no sobre el lugar completo;
   - va centrado en la franja útil, entre el subtítulo y la interfaz de
     Instagram;
   - el zoom es ≥0,8 y lo nombrado ocupa ≥50 %.
2. **Nunca una cara cortada:** la cabeza y el torso de cada personaje
   (con el hombro) quedan enteros o del todo fuera. Se verifica con el
   acercamiento lento (+2 % en el kit), la respiración y la deriva de la
   cámara. Para lograrlo se abre más solo si no queda otra salida: primero
   0,65 y en último recurso 0,5.
3. **Un protagonista por toma:** entre los encuadres válidos se elige el
   más cercano al ideal. Los demás quedan enteros al fondo o fuera.
4. **Acción de grupo `todos.<verbo>`** (aplaude, celebra, feliz, triste,
   sorprendido, levanta_la_mano): todos los personajes lo hacen en la
   misma palabra. La cámara busca el encuadre con más personajes enteros.
   El id "todos" está reservado.
5. **Acciones seguidas:** se juntan en una toma solo si caben con zoom
   ≥0,8; si no, son dos tomas con al menos 12 cuadros entre cortes.
6. **Puerta celular↔lugar:** el encuadre del lugar sigue las mismas reglas,
   y la pantalla del celular muestra ese mismo encuadre con los
   personajes, así el corte no se nota.

## Pendiente (después de aprobar el estilo)

1. **La IA compone con el kit:** prompt con las listas cerradas, elección literal por frase y metáforas completas. Si el concepto no existe, la composición más cercana; nunca texto.
2. **Variedad obligatoria:**
   - no repetir mundo, paleta, recorrido de cámara ni escena de apertura de los últimos 3 reels;
   - reintento si más del ~50 % del plan son escenas genéricas (feed, chat o billetera) cuando la narración nombra personas, lugares u objetos concretos.
3. **Tandas siguientes**, cada una con un video de muestra antes de que la IA pueda usarla:
   - Tanda 2: negocios (tienda, cocina, calle, vendedor, cliente, mamá o papá, persona mayor, torta, helado, caja, bolsa, celular, moto, carro).
   - Tanda 3: escenas de negocio (precio, envío, mapa, reseñas sin números inventados, calendario, horario, antes y después).
   - Tanda 4: oficina, casa, mercado y más poses y objetos.
