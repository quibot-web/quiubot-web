-- ============================================================
-- /contenido: eliminar y reprogramar un reel (17-18 nov 2026).
-- Juan José lo corre a mano en Supabase ANTES de que este código
-- llegue a staging -- el código ya lee y escribe esta columna.
--
-- estado_antes_de_vencer: el estado que tenía la pieza en el momento
-- en que se venció (lo llena el código al pasarla a "vencida", nunca
-- un trigger). Al reprogramar una pieza vencida SIN video, vuelve a
-- "aprobada" solo si ya estaba aprobada (o renderizando) antes de
-- vencerse; en cualquier otro caso vuelve a "borrador" -- así nunca se
-- salta la aprobación de un humano. Piezas vencidas antes de esta
-- columna quedan con null -> "borrador" (el lado seguro).
--
-- Sin CHECK a propósito: es un dato de historia, no un estado vivo, y
-- la lista de estados la valida el código (ESTADOS_CONTENIDO).
-- ============================================================
alter table publicaciones_organicas add column if not exists estado_antes_de_vencer text;

notify pgrst, 'reload schema';
