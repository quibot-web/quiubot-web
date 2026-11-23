# Evaluación: animaciones Lottie para el reel ilustrado

**Estado:** en pausa hasta después del lanzamiento del 30 nov 2026 (decisión de Juan José, 23 nov 2026).
**Objetivo:** que lo que dice la voz se vea. Si la narración dice "la profesora" o "la cartelera del salón", aparece una profesora que señala y una cartelera. Se usarían animaciones Lottie hechas por diseñadores, orquestadas con las escenas actuales (feed, chat, anuncio, billetera…) y la cámara automática.

## a) ¿Funciona `@remotion/lottie` con `@remotion/web-renderer`?

Sí, pero no directo. Lo medí en Chrome (Mac i5-8210Y), con una composición vertical de 1080×1920, cámara en movimiento (zoom y paneo) y 5 s de video. La composición vacía cuesta **0.9 s/s**. Usé archivos públicos de prueba del repositorio de lottie-web (gatin, happy2016, navidad), guardados fuera del repo. Solo sirven para medir; no son personajes candidatos.

| Enfoque | Caso | Costo total | Extra sobre la composición vacía |
|---|---|---|---|
| `@remotion/lottie`, motor `svg` | 1 animación simple | 1.17 s/s | +0.3 |
| | 4 animaciones simples | 3.21 s/s | +2.3 |
| | 4 escenas con personajes | 3.46 s/s | +2.6 |
| | 1 escena pesada (1.7 MB) | 3.75 s/s | +2.9 |
| `@remotion/lottie`, motor `canvas` | 1 animación | 0.76 s/s | **se dibuja mal**: el renderizador copia el canvas a su tamaño interno e ignora el CSS (tamaño y cámara) |
| **PNG precargado** (cada animación se convierte una vez a PNG por cuadro con lottie-web `canvas` fuera de pantalla; el render solo muestra `<img>`) | 4 simples | 1.75 s/s + conversión 2.0 s | +0.85 |
| | 4 escenas con personajes | 1.94 s/s + conversión 2.4 s | +1.0 |
| | 4 escenas pesadas | 1.40 s/s + conversión 4.8 s | +0.5 |

**Conclusión:** el motor `svg` cuesta más mientras más compleja es la animación, porque el renderizador serializa cada `<svg>` en cada cuadro. Sumado al reel ilustrado (~2.6 s/s) se pasa de la meta de 5 s/s. Con PNG precargado el costo es casi fijo (+0.5 a +1.0 s/s), y el reel completo quedaría estimado en ~3.5 s/s. Su precio es una conversión única de 2–5 s por animación distinta, al precargar en el navegador del cliente. El cuadro convertido se ve igual al de `svg`; lo comparé con una hoja de contacto.

**Nunca** usar `<Lottie renderer="canvas">` dentro del render. Tampoco usar `svg` cuando hay varias animaciones a la vez.

## b) Paquetes con licencia comercial clara (de un solo estilo)

El punto delicado es que Quiubot es una plataforma: muchos clientes generan y publican videos con las piezas. Varias licencias de stock prohíben justo ese uso.

| Fuente | Licencia | Veredicto |
|---|---|---|
| Envato Elements | Prohíbe usar sus piezas en servicios "on demand", donde el usuario final arma su producto. | Descartado. Haría falta una licencia empresarial negociada. |
| Icons8 (animaciones) | Gratis con enlace; la licencia paga quita el enlace. Para herramientas de creación existe una licencia extendida aparte. | No está claro; habría que pedirlo por escrito. |
| IconScout (paquetes Lottie de un autor) | Licencia comercial incluida en los planes pagos. No encontré si cubre que los usuarios finales de una app generen videos. | Posible, con confirmación escrita. |
| LottieFiles (gratis) | "Lottie Simple License": uso comercial sin atribución. Algunas animaciones tienen condiciones del autor (Creative Commons). Los estilos vienen mezclados. | Posible solo con un único autor y revisando la licencia de cada animación. |
| **Kit encargado a un animador** | Obra por encargo con cesión de derechos que permita sublicenciar a los clientes de Quiubot. | **Recomendado:** licencia limpia, un solo estilo, las poses exactas que hacen falta y colores de marca por diseño. |

No pude verificar ningún paquete existente de un solo estilo que traiga profesora, niños, tienda, vendedor, cliente, cocina y objetos comunes con licencia clara para una plataforma. Por eso no anoto cantidades ni muestras.

Encargo sugerido: ~25 animaciones en un estilo.
- **Personajes:** profesora/profesor, niño, niña, vendedor, cliente, mamá/papá, persona mayor.
- **Lugares:** salón, tienda, cocina, calle, oficina, casa, mercado.
- **Objetos:** cartelera, dibujos, torta, helado, caja, bolsa, celular, dulces, moto/carro.
- **Estructura de cada animación:** entrada, espera en bucle y salida, marcadas con marcadores. Capas con nombre para los colores de marca. Sin expresiones, textos ni máscaras complejas.

## c) Colores de marca

Sí. Los colores van en el JSON de Lottie (los valores `c.k` de rellenos y trazos) y se reemplazan antes de convertir a PNG. Funciona bien si el diseño usa una paleta corta con roles definidos (por ejemplo "marca 1", "marca 2", "acento"). La piel, los contornos y los ojos quedan fijos. El contraste de cada par (figura sobre fondo) se revisa con la misma regla de contraste que ya usan los estilos; si no alcanza, se usa la variante clara u oscura del color.

## d) Cómo los elige la IA

Igual que el plan ilustrado actual: solo datos (JSON validado con Zod estricto), nunca código ni SVG. Cada acción indica:
- `animacion`: un id de una lista cerrada, sacada del manifiesto del kit;
- `lugar`: izquierda, centro o derecha, y cerca o lejos;
- `tamano`: S, M o L;
- `palabra`: el índice de la palabra a la que se amarra, con las mismas reglas de ritmo que hoy.

Una tabla de equivalencias convierte un concepto sin animación en la composición más cercana (por ejemplo, "examen" pasa a "cartelera con dibujos"). Nunca se usa texto como recurso. Cada animación declara en el manifiesto su recuadro, que es la unión de sus recuadros en todos los cuadros y se mide al incorporarla. Así la cámara automática la encuadra y cumple la regla de ≥50 % en pantalla.

## e) Riesgos

- **Descarga y memoria:** cada JSON pesa entre 40 KB y 1.7 MB. En PNG, una animación ocupa ~5 MB de memoria y tarda 2–5 s en convertirse. Tope sugerido: ~8 animaciones distintas por reel.
- **Funciones de Lottie que no pasan bien a PNG** (expresiones, mates, textos con fuentes): se validan al incorporar cada archivo al kit.
- **Animaciones que no calzan con la cámara o con la frase:** hacen falta segmentos marcados (entrada, espera, salida) y recuadros medidos.
- **Poses que el paquete no trae:** es la razón principal para encargar el kit en vez de comprar uno.
- **Safari:** la conversión usa `canvas.toBlob`, que funciona en Safari, pero no la medí ahí.

## Prototipo pendiente (cuando se retome)

Idea de la cartelera del salón: Instagram → cartelera con muchos dibujos y un solo espacio libre → la profesora elige el dibujo que les gusta a los niños (no el del niño de los dulces) → niños felices → anuncio con el producto en uso → cierre. Se renderiza en `~/Desktop/videos_quiubot/prototipo_lottie/`. Necesita personajes reales de un solo estilo (punto b).

## Fuentes

- [LottieFiles: licencias de animaciones](https://help.lottiefiles.com/animation-licensing-basics-)
- [LottieFiles: uso comercial de animaciones gratis](https://help.lottiefiles.com/hc/en-us/articles/900002438343-Can-I-use-a-free-animation-on-Lottiefiles-for-commercial-business-use)
- [LottieFiles: animaciones premium](https://docs.lottiefiles.com/en/integrations/after-effects/02_explore/premium-animations)
- [Envato Elements: términos de licencia](https://help.elements.envato.com/hc/en-us/articles/360000628966-License-Terms)
- [IconScout: acuerdo de API](https://www.iconscout.com/legal/api-license-development-agreement)
- [Icons8: Universal Multimedia License](https://intercom.help/icons8-7fb7577e8170/en/articles/5534926-universal-multimedia-license-agreement-for-icons8)
