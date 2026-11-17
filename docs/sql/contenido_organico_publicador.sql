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
--
-- Mismo criterio atómico de siempre (FOR UPDATE SKIP LOCKED, el UPDATE
-- de afuera vuelve a filtrar estado='lista') -- solo cambian los
-- filtros del SELECT de adentro.
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
        select p.id from publicaciones_organicas p
        where p.estado = 'lista'
          and p.programada_para <= now()
          and (
            p.control_calidad is null
            or (p.control_calidad->>'aprobado')::boolean is not false
            or (p.control_calidad->>'publicarIgual')::boolean is true
          )
          and (
            p.guion->'musica'->>'pista_id' is null
            or exists (
              select 1 from pistas_musicales m
              where m.id = (p.guion->'musica'->>'pista_id')::uuid
                and m.licencia_url is not null
                and m.plataformas_permitidas is not null
                and 'instagram' = any(m.plataformas_permitidas)
            )
          )
        order by p.programada_para
        limit p_limite
        for update skip locked
      )
    returning *;
end;
$$;

revoke all on function reclamar_publicaciones_organicas_vencidas from public, anon, authenticated;
grant execute on function reclamar_publicaciones_organicas_vencidas to service_role;

notify pgrst, 'reload schema';
