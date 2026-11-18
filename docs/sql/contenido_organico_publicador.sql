-- ============================================================
-- Publicador automático de contenido orgánico (paso 4 del plan de
-- integración Fase B v2.0, ver docs/diseno/plan_contenido_organico.md
-- sección 7). Reemplaza reclamar_publicaciones_organicas_vencidas
-- (definida en contenido_organico.sql) con 2 filtros nuevos, pedidos
-- explícitos de Juan José (17-nov-2026):
--
-- 1. Una pieza "forzada" (control de calidad no aprobado, el admin la
--    subió igual desde /contenido) nunca se publica sola -- solo si el
--    admin la marcó aparte con "Publicar de todos modos"
--    (control_calidad.publicarIgual = true). Pieza sin control_calidad
--    (recetas del pipeline viejo, que no corren este control) o con
--    aprobado != false sigue su camino normal, sin tocar nada.
-- 2. Nunca publicar una pieza cuya música no tenga licencia para
--    Instagram (pistas_musicales.licencia_url + 'instagram' dentro de
--    plataformas_permitidas) -- "IMPOSIBLE DE OLVIDAR" en el plan
--    original. Pieza sin música (pista_id null) no aplica, sigue de
--    largo.
-- 3. Solo plataforma = 'instagram' (agregado en el paso 4, antes de
--    correr este archivo): una pieza de TikTok también llega a "lista"
--    (se descarga y se sube a mano) y sin este filtro el cron la
--    publicaría en Instagram.
--
-- Robustez (pedido de Juan José antes de correrlo, 17-nov-2026): la
-- función NUNCA castea datos de la pieza, así que un valor vacío,
-- inválido o de tipo raro no puede tumbarla (y con ella el cron para
-- todas las demás piezas). Una pieza con un valor así simplemente no
-- se publica:
--   - aprobado/publicarIgual se comparan como jsonb (= 'true'::jsonb),
--     nunca con ::boolean. Solo cuentan los booleanos JSON reales; un
--     "true" en texto, un número o un null explícito no pasan.
--     control_calidad que no sea un objeto JSON tampoco pasa.
--   - pista_id: vacío ('') o ausente = sin música (nullif). Cualquier
--     otro valor tiene que tener formato uuid Y existir como pista con
--     licencia para Instagram, comparando como TEXTO (m.id::text), no
--     con ::uuid -- un valor no-uuid simplemente no encuentra pista
--     ("música no verificable") y la pieza no se publica.
-- El mismo criterio está repetido en app/lib/publicadorOrganico.ts
-- (motivoBloqueoPublicacion) como segunda barrera.
--
-- 4. Ventana de retraso (18-nov-2026, después del caso real en staging:
--    la primera vuelta reclamó 2 piezas de prueba de hace 2-3 días):
--    solo reclama piezas con programada_para dentro de los últimos
--    p_retraso_maximo_minutos. Es RESPALDO -- el cron ya pasa a
--    "vencida" las más atrasadas antes de llamar a esta función. El
--    valor NO vive acá: lo manda el código
--    (RETRASO_MAXIMO_PUBLICACION_HORAS en app/lib/contenido.ts), y el
--    parámetro no tiene valor por defecto a propósito, para que nunca
--    se llame sin ventana. Por eso primero se borra la firma vieja de
--    1 solo parámetro (si no, quedarían las 2 versiones y la vieja, sin
--    ventana, se podría seguir llamando).
--
-- Mismo criterio atómico de siempre (FOR UPDATE SKIP LOCKED, el UPDATE
-- de afuera vuelve a filtrar estado='lista') -- solo cambian los
-- filtros del SELECT de adentro.
-- ============================================================
drop function if exists reclamar_publicaciones_organicas_vencidas(integer);

create or replace function reclamar_publicaciones_organicas_vencidas(p_limite integer, p_retraso_maximo_minutos integer)
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
        select p.id from publicaciones_organicas p
        where p.estado = 'lista'
          and p.programada_para <= now()
          and p.programada_para >= now() - make_interval(mins => p_retraso_maximo_minutos)
          and p.plataforma = 'instagram'
          and (
            p.control_calidad is null
            or jsonb_typeof(p.control_calidad) = 'null'
            or (
              jsonb_typeof(p.control_calidad) = 'object'
              and (
                not (p.control_calidad ? 'aprobado')
                or p.control_calidad->'aprobado' = 'true'::jsonb
                or (
                  p.control_calidad->'aprobado' = 'false'::jsonb
                  and p.control_calidad->'publicarIgual' = 'true'::jsonb
                )
              )
            )
          )
          and (
            nullif(p.guion->'musica'->>'pista_id', '') is null
            or (
              (p.guion->'musica'->>'pista_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              and exists (
                select 1 from pistas_musicales m
                where m.id::text = lower(p.guion->'musica'->>'pista_id')
                  and m.licencia_url is not null
                  and m.plataformas_permitidas is not null
                  and 'instagram' = any(m.plataformas_permitidas)
              )
            )
          )
        order by p.programada_para
        limit p_limite
        for update skip locked
      )
    returning *;
end;
$$;

revoke all on function reclamar_publicaciones_organicas_vencidas(integer, integer) from public, anon, authenticated;
grant execute on function reclamar_publicaciones_organicas_vencidas(integer, integer) to service_role;

notify pgrst, 'reload schema';
