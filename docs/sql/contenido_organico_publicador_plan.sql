-- Publicador orgánico: reclamar solo piezas de dueños con un plan que
-- incluye Contenido (23 nov 2026, decisión de Juan José: si un cliente baja
-- a Arranque, sus reels programados quedan en pausa en vez de publicarse, y
-- se reanudan solos si vuelve a subir de plan; los que pasan de 2 h de
-- atraso quedan vencidos como siempre).
--
-- Reemplaza reclamar_publicaciones_organicas_vencidas con LA MISMA firma y
-- los mismos filtros de docs/sql/contenido_organico_publicador.sql, más el
-- filtro 5 (plan). Sin este filtro el código igual nunca publica esas piezas
-- (app/lib/publicadorOrganico.ts las devuelve a "lista"), pero la RPC las
-- seguiría reclamando en cada vuelta y podrían ocupar el cupo de 10 por
-- corrida de otros clientes.
--
-- Staging y producción comparten base: correrlo una sola vez alcanza.

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
          -- 5. (23 nov 2026) Solo si el dueño tiene un plan con Contenido al
          --    día: admin, o plan crecimiento/escala con prueba gratis sin
          --    vencer o pago con fecha_vencimiento futura. Misma regla que
          --    app/lib/planContenido.ts (puedeCrearContenido). Las demás
          --    quedan en "lista" (en pausa) y se reanudan solas si sube de plan.
          and exists (
            select 1 from usuarios u
            where u.id = p.user_id
              and (
                u.rol = 'admin'
                or (
                  u.plan in ('crecimiento', 'escala')
                  and (
                    (u.en_trial is true and u.trial_termina_en >= now())
                    or (u.activo is true and u.fecha_vencimiento >= now())
                  )
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
