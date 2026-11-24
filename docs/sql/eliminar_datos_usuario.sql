-- ============================================================================
-- Procesar una solicitud de eliminación de datos de UN usuario
-- (quiubot.site/eliminar-datos). Preparado el 23 nov 2026, NO se ha corrido.
--
-- Borra todas sus filas en todas las tablas del esquema public (inventario
-- hecho sobre el esquema real, en solo lectura), incluidas sus piezas de
-- Contenido (publicaciones_organicas). NO toca lo que ya está publicado en su
-- Instagram ni los archivos en SU cuenta de Cloudinary (son suyos, ver la
-- sección 3 de /eliminar-datos).
--
-- Staging y producción comparten la base: se corre una sola vez.
--
-- CÓMO USARLO (en el editor SQL de Supabase):
--   0. Reemplaza CORREO_A_ELIMINAR (en todo el archivo) y corre el PASO 0.
--      Copia el id que devuelve y reemplaza ID_A_ELIMINAR (en todo el archivo).
--   1. Corre el PASO 1: cuántas filas tiene en cada tabla (antes).
--   2. Corre el PASO 2: borra todo en UNA transacción. Si algo falla, no se
--      borra nada. Se niega a correr si el correo y el id no coinciden, o si
--      la cuenta es admin.
--   3. Corre el PASO 3: los mismos conteos; todos tienen que dar 0.
--   4. Avísale por correo que terminó (plazo: 30 días desde que se confirmó
--      su identidad).
--
-- ÓRDENES DE PAGO: el paso 2 las borra (variable borrar_ordenes_pago). Antes
-- de correrlo, confirma si por obligación contable o tributaria tienes que
-- conservar el soporte de los pagos; si es así, ponla en false y quedan
-- solo esas filas (ligadas al correo, sin el resto de la cuenta).
--
-- Si se agrega una tabla nueva con datos de usuario, súmala aquí: el test
-- docs/sql/eliminar_datos_usuario.test.ts falla si una tabla del código no
-- aparece en este archivo ni en su lista de tablas sin datos de usuario.
-- ============================================================================


-- ---------------------------------------------------------------- PASO 0
select id, email, nombre, rol, plan, creado_en
from usuarios
where lower(email) = lower('CORREO_A_ELIMINAR');


-- ---------------------------------------------------------------- PASO 1 y PASO 3
-- (la misma consulta: antes y después de borrar)
with u as (select 'ID_A_ELIMINAR'::uuid as id, lower('CORREO_A_ELIMINAR') as email),
campanas as (select c.id from campanas_publicadas c, u where c.user_id = u.id)
select tabla, filas from (
            select 'usuarios' as tabla, count(*) as filas from usuarios, u where usuarios.id = u.id or lower(usuarios.email) = u.email
  union all select 'publicaciones_organicas', count(*) from publicaciones_organicas, u where publicaciones_organicas.user_id = u.id
  union all select 'album_creativos', count(*) from album_creativos, u where album_creativos.user_id = u.id
  union all select 'productos', count(*) from productos, u where productos.user_id = u.id
  union all select 'marcas', count(*) from marcas, u where lower(marcas.email) = u.email
  union all select 'campanas_publicadas', count(*) from campanas_publicadas, u where campanas_publicadas.user_id = u.id
  union all select 'campanas_snapshots', count(*) from campanas_snapshots, u where campanas_snapshots.user_id = u.id or campanas_snapshots.campana_id in (select id from campanas)
  union all select 'campanas_snapshots_backup_monitoreo_30d', count(*) from campanas_snapshots_backup_monitoreo_30d, u where campanas_snapshots_backup_monitoreo_30d.user_id = u.id
  union all select 'notificaciones', count(*) from notificaciones, u where notificaciones.user_id = u.id or notificaciones.campana_id in (select id from campanas)
  union all select 'metas', count(*) from metas, u where metas.user_id = u.id
  union all select 'conversaciones_meta', count(*) from conversaciones_meta, u where conversaciones_meta.user_id = u.id
  union all select 'director_conversaciones', count(*) from director_conversaciones, u where director_conversaciones.user_id = u.id
  union all select 'propuestas', count(*) from propuestas, u where propuestas.user_id = u.id
  union all select 'bitacora', count(*) from bitacora, u where bitacora.user_id = u.id
  union all select 'mensajes_equipo', count(*) from mensajes_equipo, u where mensajes_equipo.user_id = u.id
  union all select 'chats_equipo_leido', count(*) from chats_equipo_leido, u where chats_equipo_leido.user_id = u.id
  union all select 'instagram_seguidores_snapshots', count(*) from instagram_seguidores_snapshots, u where instagram_seguidores_snapshots.user_id = u.id
  union all select 'usuarios_tutoriales_vistos', count(*) from usuarios_tutoriales_vistos, u where usuarios_tutoriales_vistos.user_id = u.id
  union all select 'asistente_conversaciones', count(*) from asistente_conversaciones, u where asistente_conversaciones.user_id = u.id
  union all select 'senales_registro', count(*) from senales_registro, u where senales_registro.usuario_id = u.id
  union all select 'trabajos_ia', count(*) from trabajos_ia, u where trabajos_ia.user_id = u.id
  union all select 'video_jobs', count(*) from video_jobs, u where video_jobs.user_id = u.id
  union all select 'estrategias_jobs', count(*) from estrategias_jobs, u where estrategias_jobs.user_id = u.id
  union all select 'estrategias_generadas', count(*) from estrategias_generadas, u where estrategias_generadas.user_id = u.id
  union all select 'creativos_jobs', count(*) from creativos_jobs, u where creativos_jobs.user_id = u.id
  union all select 'errores_publicacion', count(*) from errores_publicacion, u where errores_publicacion.user_id = u.id or lower(errores_publicacion.email) = u.email
  union all select 'colaboradores_musica', count(*) from colaboradores_musica, u where lower(colaboradores_musica.email) = u.email
  union all select 'admin_contactos', count(*) from admin_contactos, u where lower(admin_contactos.email) = u.email
  union all select 'User_Config', count(*) from "User_Config", u where lower("User_Config"."User_Email") = u.email
  union all select 'ordenes_pago', count(*) from ordenes_pago, u where lower(ordenes_pago.email) = u.email
  -- Referencias desde filas de OTROS usuarios (no se borran: el paso 2 las deja en null).
  union all select '(otros) propuestas.decidido_por', count(*) from propuestas, u where propuestas.decidido_por = u.id and propuestas.user_id <> u.id
  union all select '(otros) colaboradores_musica.agregado_por', count(*) from colaboradores_musica, u where colaboradores_musica.agregado_por = u.id and lower(colaboradores_musica.email) <> u.email
) conteos
order by tabla;


-- ---------------------------------------------------------------- PASO 2
do $$
declare
  v_id uuid := 'ID_A_ELIMINAR';
  v_email text := lower('CORREO_A_ELIMINAR');
  -- Ver la nota de ÓRDENES DE PAGO arriba antes de correr.
  borrar_ordenes_pago boolean := true;
  v_rol text;
  n integer;
begin
  select rol into v_rol from usuarios where id = v_id and lower(email) = v_email;
  if not found then
    raise exception 'El id % no corresponde al correo %: no se borra nada.', v_id, v_email;
  end if;
  if v_rol = 'admin' then
    raise exception 'La cuenta % es admin: no se borra desde este script.', v_email;
  end if;

  -- Ciclo metas <-> conversaciones_meta, y referencias desde filas de otros.
  update conversaciones_meta set meta_id = null where user_id = v_id;
  update metas set conversacion_id = null where user_id = v_id;
  update propuestas set decidido_por = null where decidido_por = v_id and user_id <> v_id;
  update colaboradores_musica set agregado_por = null where agregado_por = v_id;
  update bitacora set meta_id = null where user_id <> v_id and meta_id in (select id from metas where user_id = v_id);
  update bitacora set propuesta_id = null where user_id <> v_id and propuesta_id in (select id from propuestas where user_id = v_id);
  update publicaciones_organicas set producto_id = null where user_id <> v_id and producto_id in (select id from productos where user_id = v_id);
  update publicaciones_organicas set album_id = null where user_id <> v_id and album_id in (select id from album_creativos where user_id = v_id);
  update campanas_publicadas set producto_id = null where user_id <> v_id and producto_id in (select id from productos where user_id = v_id);

  -- Hijos primero, después lo que referencian.
  delete from bitacora where user_id = v_id;
  delete from notificaciones where user_id = v_id or campana_id in (select id from campanas_publicadas where user_id = v_id);
  delete from campanas_snapshots where user_id = v_id or campana_id in (select id from campanas_publicadas where user_id = v_id);
  delete from campanas_snapshots_backup_monitoreo_30d where user_id = v_id;
  delete from director_conversaciones where user_id = v_id;
  delete from propuestas where user_id = v_id;
  delete from mensajes_equipo where user_id = v_id;
  delete from chats_equipo_leido where user_id = v_id;
  delete from instagram_seguidores_snapshots where user_id = v_id;
  delete from usuarios_tutoriales_vistos where user_id = v_id;
  delete from asistente_conversaciones where user_id = v_id;
  delete from senales_registro where usuario_id = v_id;
  delete from trabajos_ia where user_id = v_id;
  delete from video_jobs where user_id = v_id;
  delete from estrategias_jobs where user_id = v_id;
  delete from estrategias_generadas where user_id = v_id;
  delete from creativos_jobs where user_id = v_id;
  delete from errores_publicacion where user_id = v_id or lower(email) = v_email;
  delete from publicaciones_organicas where user_id = v_id;
  delete from campanas_publicadas where user_id = v_id;
  delete from metas where user_id = v_id;
  delete from conversaciones_meta where user_id = v_id;
  delete from productos where user_id = v_id;
  delete from album_creativos where user_id = v_id;
  delete from marcas where lower(email) = v_email;
  delete from colaboradores_musica where lower(email) = v_email;
  delete from admin_contactos where lower(email) = v_email;
  delete from "User_Config" where lower("User_Email") = v_email;
  if borrar_ordenes_pago then
    delete from ordenes_pago where lower(email) = v_email;
  end if;
  delete from usuarios where id = v_id;
  get diagnostics n = row_count;
  raise notice 'Listo: usuario % eliminado (% fila en usuarios). Corre el PASO 3 para verificar.', v_email, n;
end $$;
