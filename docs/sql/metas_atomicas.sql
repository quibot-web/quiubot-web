-- ============================================================
-- 1) Clave de idempotencia: conversacion_id en metas
-- ============================================================
-- unique en Postgres ignora los NULL (varias metas por formulario,
-- sin conversacion_id, pueden coexistir sin chocar). FK a
-- conversaciones_meta(id) porque esas filas nunca se borran (solo se
-- cierran por estado), así que no hace falta ON DELETE.
alter table metas
  add column conversacion_id uuid unique references conversaciones_meta(id) on delete set null;


-- ============================================================
-- 2) crear_meta_completa -- atómica: inserta la meta, cierra el/los
--    borrador(es), deja los eventos en director_conversaciones y en
--    bitacora, todo en una sola transacción.
-- ============================================================
-- Idempotencia real: si conversacion_id ya tiene una meta asociada
-- (reintento, o la otra pestaña ganó la carrera), devuelve esa fila sin
-- tocar nada más -- nunca inserta dos veces para el mismo
-- conversacion_id, ni bajo concurrencia real (ver EXCEPTION abajo).
--
-- Validaciones de negocio (requisitos del tipo, presupuesto > 0, etc.)
-- NO viven acá -- eso sigue en TypeScript (verificarRequisitosMeta),
-- exactamente como hoy. Esta función asume que el caller ya validó
-- todo y solo necesita la persistencia atómica.
--
-- p_nivel_autonomia: antes iba fijo en 'copiloto' adentro de la
--   función -- ahora lo decide el TypeScript (hoy es literal "copiloto"
--   en POST /api/metas, pero esa decisión no debe vivir acá: si cambia
--   el valor por defecto en TS, esta función no debería necesitar
--   tocarse). estado='activa' y pausado_autopiloto=false SÍ quedan
--   fijos -- son estructuralmente así para cualquier meta nueva, igual
--   que hoy en el POST (ahí también son literales, nunca calculados).
--
-- p_mensaje_meta_creada: el texto para el hilo del borrador que
--   disparó esta creación (si vino de un conversacion_id).
-- p_mensaje_meta_creada_otro_borrador: el texto para cualquier OTRO
--   borrador activo del MISMO tipo que quede obsoleto (ej. se creó por
--   el formulario mientras había una conversación sin terminar de ese
--   tipo) -- un borrador de un tipo distinto nunca se toca. Ambos
--   textos los arma el TypeScript (ETIQUETA_TIPO_META ya existe ahí);
--   el COALESCE de abajo es solo una red de seguridad -- mensaje NOT
--   NULL en director_conversaciones no debe ser lo que tumbe la
--   transacción si alguna vez llega null por error.
create or replace function crear_meta_completa(
  p_user_id metas.user_id%type,
  p_tipo metas.tipo%type,
  p_cantidad_objetivo metas.cantidad_objetivo%type,
  p_fecha_inicio metas.fecha_inicio%type,
  p_fecha_fin metas.fecha_fin%type,
  p_presupuesto_maximo_cop metas.presupuesto_maximo_cop%type,
  p_costo_objetivo_cop metas.costo_objetivo_cop%type,
  p_roas_minimo metas.roas_minimo%type,
  p_valor_inicial metas.valor_inicial%type,
  p_contexto metas.contexto%type,
  p_nivel_autonomia metas.nivel_autonomia%type,
  p_conversacion_id metas.conversacion_id%type,
  p_mensaje_meta_creada text,
  p_mensaje_meta_creada_otro_borrador text
)
returns metas
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_meta metas;
  v_borrador_id uuid;
begin
  if p_conversacion_id is not null then
    select * into v_meta from metas where conversacion_id = p_conversacion_id;
    if found then
      return v_meta;
    end if;
  end if;

  insert into metas (
    user_id, tipo, cantidad_objetivo, fecha_inicio, fecha_fin,
    presupuesto_maximo_cop, costo_objetivo_cop, roas_minimo, valor_inicial,
    contexto, nivel_autonomia, conversacion_id, estado, pausado_autopiloto
  ) values (
    p_user_id, p_tipo, p_cantidad_objetivo, p_fecha_inicio, p_fecha_fin,
    p_presupuesto_maximo_cop, p_costo_objetivo_cop, p_roas_minimo, p_valor_inicial,
    p_contexto, p_nivel_autonomia, p_conversacion_id, 'activa', false
  )
  returning * into v_meta;

  -- Cierra el borrador que disparó esta creación (si vino de la
  -- conversación) y deja el mensaje normal ahí.
  if p_conversacion_id is not null then
    update conversaciones_meta
      set estado = 'completada', meta_id = v_meta.id, actualizado_en = now()
      where id = p_conversacion_id and user_id = p_user_id and estado = 'activa';

    insert into director_conversaciones (user_id, rol, mensaje, contenido, conversacion_meta_id)
      values (
        p_user_id, 'assistant', coalesce(p_mensaje_meta_creada, 'Ya quedó creada tu meta.'),
        jsonb_build_object('tipoEvento', 'meta_creada', 'metaId', v_meta.id),
        p_conversacion_id
      );
  end if;

  -- Cualquier OTRO borrador activo del MISMO tipo queda obsoleto (se
  -- creó por otro camino) -- se cierra y se avisa en SU hilo. Uno de
  -- otro tipo nunca se toca.
  for v_borrador_id in
    select id from conversaciones_meta
      where user_id = p_user_id
        and estado = 'activa'
        and (p_conversacion_id is null or id <> p_conversacion_id)
        and borrador->>'tipo' = p_tipo
  loop
    update conversaciones_meta
      set estado = 'completada', meta_id = v_meta.id, actualizado_en = now()
      where id = v_borrador_id;

    insert into director_conversaciones (user_id, rol, mensaje, contenido, conversacion_meta_id)
      values (
        p_user_id, 'assistant', coalesce(p_mensaje_meta_creada_otro_borrador, 'Vi que ya creaste esa meta por otro camino, así que cierro esta conversación.'),
        jsonb_build_object('tipoEvento', 'meta_creada', 'metaId', v_meta.id),
        v_borrador_id
      );
  end loop;

  insert into bitacora (user_id, meta_id, propuesta_id, tipo_evento, detalle)
    values (
      p_user_id, v_meta.id, null, 'meta_creada',
      jsonb_build_object('tipo', p_tipo, 'cantidad_objetivo', p_cantidad_objetivo, 'fecha_fin', p_fecha_fin, 'presupuesto_maximo_cop', p_presupuesto_maximo_cop)
    );

  return v_meta;
exception
  when unique_violation then
    -- Carrera real (doble clic en dos pestañas, mismo conversacion_id):
    -- la llamada que pierda la carrera no falla, devuelve la fila que
    -- la otra ya insertó. Si el choque fue por OTRO índice único (el de
    -- meta activa por tipo, no por conversacion_id), esto no encuentra
    -- nada y relanza el error tal cual, para que el TypeScript lo
    -- traduzca a un mensaje claro.
    if p_conversacion_id is not null then
      select * into v_meta from metas where conversacion_id = p_conversacion_id;
      if found then
        return v_meta;
      end if;
    end if;
    raise;
end;
$$;

revoke all on function crear_meta_completa from public, anon, authenticated;
grant execute on function crear_meta_completa to service_role;


-- ============================================================
-- 3) cambiar_estado_meta -- atómica: aplica el cambio (pausar,
--    reanudar, cancelar, editar presupuesto, o el cierre del cron por
--    vencimiento/cumplimiento), deja el evento en bitacora y
--    (opcional) en director_conversaciones, todo en una transacción.
-- ============================================================
-- Igual que hoy: siempre exige que la meta siga "activa" en el
-- momento del UPDATE (mismo filtro que ya tenía PATCH /api/metas/[id])
-- -- si alguien ya la pausó/canceló/venció entre que se leyó y se
-- llamó a esta función, esto devuelve NULL en vez de pisar ese cambio.
--
-- costo_objetivo_cop se recalcula ACÁ (presupuesto / cantidad_objetivo
-- de la fila, leída dentro de la misma transacción) cuando se manda un
-- presupuesto nuevo -- nunca confía en un valor ya calculado del lado
-- del cliente, que podría estar desactualizado.
--
-- La validación de negocio de "el presupuesto nuevo no puede ser menor
-- a lo ya gastado" NO vive acá -- necesita calcularAvanceMeta()
-- (lee campañas/snapshots de Meta Ads), así que se revisa en
-- TypeScript ANTES de llamar a esta función, igual que
-- verificarRequisitosMeta() en la creación.
--
-- p_tipo_evento: SIN valor por defecto, a propósito -- el TypeScript
-- tiene que mandar uno propio por acción (meta_pausada,
-- meta_reanudada, meta_cancelada, presupuesto_actualizado,
-- meta_vencida, meta_cumplida). Si se dejara un default genérico,
-- la ventana de deduplicación de 10s de una acción distinta pero sin
-- tipo propio podría comerse un evento legítimo que sí debía
-- insertarse.
--
-- p_evitar_duplicado_evento: si ya existe un evento igual (mismo
-- meta_id + tipo_evento) en los últimos 10 segundos, no inserta de
-- nuevo ni en bitacora ni en el hilo del Director -- protege contra un
-- doble clic o un reintento de red, sin bloquear transiciones
-- legítimas repetidas más adelante (pausar → reanudar → pausar de
-- nuevo sigue funcionando).
create or replace function cambiar_estado_meta(
  p_meta_id metas.id%type,
  p_user_id metas.user_id%type,
  p_tipo_evento text,
  p_pausado_autopiloto metas.pausado_autopiloto%type default null,
  p_estado_nuevo metas.estado%type default null,
  p_presupuesto_maximo_cop metas.presupuesto_maximo_cop%type default null,
  p_detalle jsonb default '{}'::jsonb,
  p_mensaje_director text default null,
  p_evitar_duplicado_evento boolean default true
)
returns metas
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_meta metas;
  v_ya_existe boolean := false;
begin
  update metas set
    pausado_autopiloto = coalesce(p_pausado_autopiloto, pausado_autopiloto),
    estado = coalesce(p_estado_nuevo, estado),
    presupuesto_maximo_cop = coalesce(p_presupuesto_maximo_cop, presupuesto_maximo_cop),
    costo_objetivo_cop = case
      -- Igual que hoy en TS (presupuesto / cantidad, insertado en una
      -- columna entera) -- pero acá presupuesto y cantidad son ambos
      -- enteros, y "entero / entero" en Postgres TRUNCA en vez de
      -- redondear (a diferencia de la división de punto flotante que
      -- hace JS). Por eso el cast explícito a numeric antes de dividir.
      when p_presupuesto_maximo_cop is not null then round(p_presupuesto_maximo_cop::numeric / cantidad_objetivo)
      else costo_objetivo_cop
    end,
    actualizado_en = now()
  where id = p_meta_id
    and user_id = p_user_id
    and estado = 'activa'
  returning * into v_meta;

  if v_meta.id is null then
    return null;
  end if;

  if p_evitar_duplicado_evento then
    select exists(
      select 1 from bitacora
      where meta_id = v_meta.id
        and tipo_evento = p_tipo_evento
        and creado_en > now() - interval '10 seconds'
    ) into v_ya_existe;
  end if;

  if not v_ya_existe then
    insert into bitacora (user_id, meta_id, propuesta_id, tipo_evento, detalle)
      values (p_user_id, v_meta.id, null, p_tipo_evento, p_detalle);

    if p_mensaje_director is not null then
      insert into director_conversaciones (user_id, rol, mensaje, contenido)
        values (
          p_user_id, 'assistant', p_mensaje_director,
          jsonb_build_object('tipoEvento', 'meta_evento', 'metaId', v_meta.id, 'evento', p_tipo_evento)
        );
    end if;
  end if;

  return v_meta;
end;
$$;

revoke all on function cambiar_estado_meta from public, anon, authenticated;
grant execute on function cambiar_estado_meta to service_role;
