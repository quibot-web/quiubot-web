-- ============================================================
-- Contenido orgánico -- Fase O1 (ver docs/diseno/plan_contenido_organico.md).
-- Tabla + RPC para el calendario semanal de reels y el publicador de
-- Instagram. Mismo criterio que metas_atomicas.sql/productos.sql: RLS
-- activado sin policies permisivas (todo el acceso va por
-- supabaseAdmin, service_role, que siempre bypassa RLS -- esto solo
-- cierra la puerta a la key pública/anon), y notify pgrst al final
-- porque agrega una función RPC nueva que PostgREST también cachea.
-- ============================================================

create table publicaciones_organicas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references usuarios(id) on delete cascade,

  -- "tiktok" todavía no se publica por API en la Fase O1 (solo
  -- "Descargar video + copiar texto", sección 1 del plan) -- se deja
  -- el valor ya aceptado para no tener que tocar esta columna cuando
  -- llegue la Fase O3 (TikTok por API, sección 10).
  plataforma text not null check (plataforma in ('instagram', 'tiktok')),

  -- Ids reales de video/recetas/organico/ (RECETAS_ORGANICAS_IDS en
  -- video/guion.schema.ts) -- si se agrega una receta nueva ahí,
  -- agregarla también acá con un ALTER TABLE ... DROP CONSTRAINT /
  -- ADD CONSTRAINT.
  receta_organica text not null check (
    receta_organica in (
      'consejos_numerados', 'mito_verdad', 'producto_en_uso',
      'serie_partes', 'pregunta_comunidad', 'detras_de_marca'
    )
  ),

  -- Si el calendario eligió un producto del catálogo para la pieza.
  -- "set null" (no "cascade"): archivar o borrar un producto nunca
  -- debe arrastrar la pieza ya programada o publicada.
  producto_id uuid references productos(id) on delete set null,

  -- null mientras la pieza está en "borrador" (todavía no se le pidió
  -- guion a la IA) o "generando" (la IA lo está armando en after()).
  guion jsonb,
  caption text,
  hashtags text[],

  programada_para timestamptz not null,

  estado text not null default 'borrador' check (
    estado in (
      'borrador', 'generando', 'aprobada', 'renderizando', 'lista',
      'publicando', 'procesando', 'publicada', 'error', 'vencida', 'cancelada'
    )
  ),

  -- Se llena al pasar a "generando", se limpia al salir de ese estado
  -- -- lo usa el cron vencer-propuestas (ya existente) para marcar
  -- "error" (tipo_error "timeout_guion") lo que lleve más de 10 min
  -- generando el guion en lote.
  generando_desde timestamptz,

  url_video text,
  cloudinary_public_id text,
  -- Pieza ya guardada en el álbum (album_creativos), con el mismo
  -- contrato que ya usan los videos ahí (url_imagen con el mp4,
  -- tipo "video", public_id) -- ver sección 6 del plan.
  album_id uuid references album_creativos(id) on delete set null,

  ig_container_id text,
  ig_media_id text,
  permalink text,

  error text,
  -- Sin check constraint a propósito -- igual que trabajos_ia/
  -- estrategias_jobs.tipo_error, es texto libre categorizado por
  -- TypeScript (hoy: "reconexion", "timeout_guion"; el publicador
  -- puede sumar otros más adelante sin tocar el esquema).
  tipo_error text,
  intentos integer not null default 0,

  -- Lunes de la semana (para agrupar el calendario) -- se calcula en
  -- TypeScript con hoyBogota(), nunca en SQL (misma razón que el resto
  -- del proyecto: la zona horaria vive en un solo lugar del código).
  semana date not null,

  -- Solo para receta_organica = 'serie_partes': a qué pieza continúa
  -- esta (la "parte 1"). "set null" porque si la parte 1 se borra, la
  -- continuación simplemente deja de estar encadenada -- nunca debe
  -- arrastrar el borrado de la parte 2. La validación real ("¿toda
  -- parte 1 tiene su parte 2?", aviso "La parte 1 promete una parte 2")
  -- es código (función pura sobre las piezas del calendario, igual que
  -- la variedad semanal), no una restricción de esta tabla -- un CHECK
  -- no puede representar "la parte 2 todavía no existe, pero va a
  -- crearse en el mismo calendario". Que la parte 1 y la parte 2 sean
  -- del mismo usuario también es código, no una columna ni un CHECK acá
  -- -- un self-FK no tiene forma de comparar el user_id de la fila que
  -- apunta contra el de la fila apuntada.
  continua_de_id uuid references publicaciones_organicas(id) on delete set null,

  creado_en timestamptz not null default now(),
  -- Sin trigger -- confirmado contra el resto del proyecto (trabajos_ia,
  -- estrategias_jobs, publicarEstrategiaJobs.ts, etc.): actualizado_en
  -- siempre lo pone el código en cada .update(), nunca un trigger de
  -- Postgres. Todas las rutas y el RPC de abajo tienen que mandarlo
  -- explícito (el RPC ya lo hace con now()).
  actualizado_en timestamptz not null default now(),

  -- Una fila nunca puede ser su propia "parte 2".
  constraint publicaciones_organicas_continua_de_id_no_self check (continua_de_id is null or continua_de_id <> id)
);

-- Lectura típica del cron: "piezas listas con programada_para vencida".
create index publicaciones_organicas_estado_programada_idx on publicaciones_organicas (estado, programada_para);

-- Lectura típica de /contenido: "el calendario de esta semana".
create index publicaciones_organicas_user_semana_idx on publicaciones_organicas (user_id, semana);

-- FK sin índice propio en Postgres (solo el lado referenciado lo tiene)
-- -- "¿qué pieza continúa a esta?" es una consulta real de la UI cada
-- vez que se recalcula el aviso de la parte 2.
create index publicaciones_organicas_continua_de_id_idx on publicaciones_organicas (continua_de_id) where continua_de_id is not null;

alter table publicaciones_organicas enable row level security;

-- ============================================================
-- reclamar_publicaciones_organicas_vencidas -- atómica: toma hasta
-- p_limite piezas "lista" con programada_para ya vencida y las pasa a
-- "publicando" en una sola sentencia con FOR UPDATE SKIP LOCKED, para
-- que dos corridas del cron (o staging y producción, aunque
-- PUBLICADOR_ORGANICO_ACTIVO ya lo evita en staging) nunca reclamen la
-- misma pieza dos veces. El UPDATE de afuera también filtra
-- estado = 'lista' (no solo el id que ya vino filtrado del SELECT de
-- adentro) -- nunca confía en que nada cambió el estado de la fila
-- entre una cosa y la otra, mismo criterio defensivo que ya usa
-- cambiar_estado_meta en metas_atomicas.sql.
-- ============================================================
create or replace function reclamar_publicaciones_organicas_vencidas(p_limite integer default 10)
returns setof publicaciones_organicas
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  return query
    update publicaciones_organicas
    set estado = 'publicando', actualizado_en = now()
    where estado = 'lista'
      and id in (
        select id from publicaciones_organicas
        where estado = 'lista' and programada_para <= now()
        order by programada_para
        limit p_limite
        for update skip locked
      )
    returning *;
end;
$$;

revoke all on function reclamar_publicaciones_organicas_vencidas from public, anon, authenticated;
grant execute on function reclamar_publicaciones_organicas_vencidas to service_role;

notify pgrst, 'reload schema';


-- ============================================================
-- ============================================================
-- ROLLBACK -- correr SOLO si algo sale mal y hay que deshacer todo lo
-- de arriba. NUNCA correr esto junto con lo de arriba en la misma
-- pestaña del SQL Editor. Borra la tabla y la función por completo,
-- incluidos los datos que ya tenga publicaciones_organicas.
-- ============================================================
-- ============================================================

-- drop function if exists reclamar_publicaciones_organicas_vencidas(integer);
-- drop table if exists publicaciones_organicas;
-- notify pgrst, 'reload schema';
