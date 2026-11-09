# Pruebas manuales de concurrencia — Metas ↔ Director

Por qué son manuales: la garantía real de estos escenarios vive **dentro de
la transacción de Postgres** (`crear_meta_completa`, `cambiar_estado_meta` —
ver `docs/sql/metas_atomicas.sql`), no en el TypeScript. Un mock del cliente
de Supabase no puede verificar una carrera real entre dos inserts
concurrentes; hace falta un Postgres de verdad. Esta máquina no tiene Docker
(2 núcleos, se pondría muy lento), así que por ahora esto se corre a mano en
**staging** — nunca contra producción, y nunca con datos de un cliente real.

Antes de empezar: entrá a staging con un usuario de prueba que tenga
Autopiloto habilitado y ninguna meta activa. Tené dos pestañas/ventanas
listas para los escenarios que las piden.

## 1. Doble clic (misma pestaña, mismo borrador)

1. Abrí la burbuja → "Crear una meta" → completá el flujo hasta que aparezca
   la tarjeta de resumen.
2. Hacé clic en "✓ Crear mi meta" **dos veces muy rápido** (el botón se
   deshabilita al primer clic, pero probá de todas formas — es la primera
   línea de defensa, no la única).
3. **Esperado:** se crea exactamente 1 meta. `select * from metas where
   conversacion_id = '<el id del borrador>'` en Supabase debe devolver 1
   sola fila.

## 2. Dos pestañas (mismo borrador, carrera real)

1. En la pestaña A, abrí la burbuja y llegá hasta la tarjeta de resumen de
   una meta nueva (ej. tipo "leads").
2. En la pestaña B (mismo usuario, sesión ya iniciada), abrí `/metas/crear`
   — debería entrar al **mismo borrador activo** (mismo `conversacion_id`)
   y mostrar la misma tarjeta de resumen.
3. Hacé clic en "✓ Crear mi meta" en las dos pestañas, lo más simultáneo
   posible (ideal: un segundo ayudando, un clic cada uno a la cuenta de 3).
4. **Esperado:** las dos pestañas terminan mostrando la meta creada
   (`router.push("/")`), sin ningún error visible. En la base,
   `select * from metas where conversacion_id = '<ese borrador>'` devuelve
   **1 sola fila** — la que perdió la carrera debe haber recibido la MISMA
   fila de vuelta (verificable comparando el `id` de la meta mostrada en
   ambas pestañas si lo anotás antes de que redirija).
5. **Variante que SÍ debe fallar con mensaje claro:** repetí el experimento
   pero con dos borradores DISTINTOS del mismo tipo (ej. abrí la burbuja dos
   veces desde cero en pestañas distintas, sin que la segunda retome el
   borrador de la primera — forzalo cancelando el borrador de una entre
   medio si hace falta). Al confirmar las dos casi al mismo tiempo, una debe
   crear la meta y la otra debe mostrar *"Ya tienes una meta activa de este
   tipo."* — nunca el texto crudo de Postgres (`duplicate key value...`).

## 3. Crear por formulario con un borrador abierto

1. Abrí la burbuja → "Crear una meta" → avanzá un par de turnos (que quede
   un borrador "activa" con tipo ya decidido, ej. "leads") pero NO lo
   termines.
2. Sin cerrar ese borrador, entrá a `/metas/crear?formulario=1` (o click en
   "Prefiero llenarlo yo") y completá una meta del **mismo tipo** (leads)
   por el formulario.
3. **Esperado:** la meta se crea. Volvé a abrir la burbuja — el chat debe
   mostrar un mensaje tipo *"Vi que creaste tu meta de leads por otro
   camino, así que dejé esta conversación como terminada."* en el hilo del
   borrador viejo, con la tarjeta viva de la meta debajo.
4. Repetí 1-2 pero completando por el formulario una meta de **otro tipo**
   (ej. "visitas_web"). **Esperado:** el borrador de "leads" sigue intacto
   y activo — abrir la burbuja debe retomarlo donde quedó, sin ningún
   mensaje de cierre.

## 4. Pausar desde la página y preguntarle al Director

1. Con una meta activa, entrá a `/metas` y pausala con el botón de la
   tarjeta.
2. Sin recargar nada, abrí la burbuja → Director, y preguntale "¿cómo va mi
   meta de X?" (el tipo que acabás de pausar).
3. **Esperado:** el Director la describe como pausada (contexto fresco,
   `metasActivas` incluye `estado`). Además, el hilo del Director debe
   mostrar un mensaje de "Pausé tu meta de X" con su tarjeta viva, **sin que
   lo hayas pedido** — lo dejó `cambiar_estado_meta` al momento del PATCH.
4. Reanudala desde la MISMA tarjeta viva dentro del chat (no desde `/metas`)
   y confirmá que `/metas` se actualiza sola (evento `quiubot:meta-cambio`),
   sin recargar la página.

## 5. Token vencido entre el resumen y el clic

1. Armá el resumen de una meta de tipo "ventas_web" (necesita el píxel con
   compras recientes) hasta que aparezca la tarjeta.
2. Sin cerrar esa pantalla, desconectá Meta Ads desde Integraciones (o
   esperá/forzá que el token expire, si tenés cómo simularlo en staging).
3. Hacé clic en "✓ Crear mi meta".
4. **Esperado:** `verificarRequisitosMeta` se vuelve a correr dentro del
   POST (no confía en lo ya validado al armar el resumen) y rechaza la
   creación con el mensaje de reconectar Meta — la meta NO se crea.

## 6. "Prefiero llenar mi meta yo mismo" desde el chat (conversación de origen)

Este fue un bug real en staging: tocar este botón mandaba al formulario sin
llevarse el `conversacion_id` -- al crear la meta ahí, el borrador del chat
quedaba "activa" para siempre, y volver a abrir la burbuja mostraba el
mismo flujo de crear meta congelado, como si la meta nunca se hubiera
creado.

1. Abrí la burbuja → "Crear una meta" → contestá 1-2 preguntas (no hace
   falta llegar al resumen, ni siquiera que el Director ya sepa el tipo).
2. Tocá "Prefiero llenar mi meta yo mismo".
3. **Esperado:** el formulario aparece prellenado con lo que ya se alcanzó
   a conversar (tipo, presupuesto -- si ya se habían dicho). El producto
   NO se prellena todavía (el formulario rápido no tiene ese campo).
4. Completá el formulario y creá la meta.
5. Volvé a abrir la burbuja (cerrarla y abrirla de nuevo, o cambiar de
   pestaña y volver). **Esperado:** el chat YA NO muestra el flujo de
   crear meta congelado -- muestra el mensaje real de "Ya quedó creada tu
   meta" con la tarjeta viva de la meta, y el input vuelve a ser para
   charlar libre con el Director (ya no fuerza la intención "crear_meta").
6. **Variante (abandono):** repetí 1-2, pero en el paso 2 cerrá la pestaña
   del formulario sin crear nada. Volvé a abrir la burbuja -- el borrador
   debe seguir activo y el chat debe retomarlo exactamente donde quedó.

---

## Pendiente: automatizar en CI

Montar estos 5 escenarios como tests automáticos corriendo contra un
**Postgres efímero en GitHub Actions**, nunca contra la base real
(staging/producción la comparten):

- Usar la Supabase CLI (`supabase start` / `supabase db reset`) dentro del
  workflow de GitHub Actions para levantar un Postgres local de un solo uso
  por corrida, con `docs/sql/metas_atomicas.sql` aplicado.
- Ahí sí se puede probar la carrera real (dos `fetch` disparados con
  `Promise.all` contra las rutas, o directo dos llamadas a la RPC) sin
  arriesgar nada compartido.
- No se monta todavía porque esta máquina de desarrollo no tiene Docker
  (2 núcleos) para probarlo en local antes de confiarlo al CI -- queda
  anotado para la próxima vez que se trabaje en infraestructura de CI.
