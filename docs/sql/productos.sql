-- ============================================================
-- Catálogo de productos y servicios (punto 4 del plan, después del
-- chat único y la sincronización de metas) -- YA CORRIDO en Supabase.
-- ============================================================
-- Reusa la misma idea que metas_atomicas.sql: tabla con RLS activado
-- sin policies permisivas (todo el acceso va por supabaseAdmin,
-- service role, que siempre bypassa RLS -- esto solo cierra la puerta
-- a la key pública/anon), y notify pgrst al final porque agrega una
-- columna nueva a una tabla existente (campanas_publicadas) que
-- PostgREST también cachea.
create table productos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references usuarios(id) on delete cascade,
  tipo text not null check (tipo in ('producto', 'servicio')),
  nombre text not null,
  precio_cop integer,
  -- Texto libre: garantía, forma de pago, envío, lo que el negocio
  -- quiera destacar -- no tiene estructura fija.
  destacar text,
  -- ids del álbum del usuario (tabla album) -- si una foto se borra
  -- del álbum, el id simplemente deja de resolver y la tarjeta de
  -- "Lo que vendes" lo ignora sin error (nunca falla por un id huérfano).
  album_ids uuid[] not null default '{}',
  url text,
  -- Nunca se borra un producto -- "archivar" es activo = false, para
  -- que todo lo que ya lo referencia (metas.contexto, estrategias,
  -- campanas_publicadas.producto_id) siga teniendo con qué mostrar su
  -- historial.
  activo boolean not null default true,
  ultimo_uso_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Evita duplicados por nombre (sin importar mayúsculas) mientras el
-- producto esté activo -- uno archivado no cuenta, así que el mismo
-- nombre se puede reusar en un producto nuevo más adelante.
create unique index productos_nombre_unico_idx on productos (user_id, lower(nombre)) where activo;

-- Lectura típica: "mis productos activos, para el selector y el
-- contexto del Director" -- siempre filtrado por usuario + activo.
create index productos_user_id_activo_idx on productos (user_id) where activo;

alter table productos enable row level security;

-- La "foto" de qué producto movió cada campaña -- aparte de
-- producto_id (la referencia viva, para poder ver "los productos que
-- más pauta generan"), el propio datos_producto que ya existe en
-- campanas_publicadas sigue siendo la copia de los datos usados en ese
-- momento (nombre/precio/destacar), así que cambiar el producto
-- después nunca altera lo que ya se publicó.
alter table campanas_publicadas
  add column if not exists producto_id uuid references productos(id) on delete set null;

notify pgrst, 'reload schema';
