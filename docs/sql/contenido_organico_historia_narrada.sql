-- Receta nueva "historia_narrada" (visuales-v2, 24 nov 2026): el CHECK de
-- publicaciones_organicas.receta_organica tiene que aceptarla (ver
-- RECETAS_ORGANICAS_IDS en video/guion.schema.ts). SIN CORRER: lo corre
-- Juan José en el editor SQL de Supabase antes de probar en staging.
-- No toca filas: solo cambia la lista de valores permitidos.

begin;

-- Quita el CHECK actual de receta_organica, se llame como se llame.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'publicaciones_organicas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%receta_organica%'
  loop
    execute format('alter table publicaciones_organicas drop constraint %I', c.conname);
  end loop;
end $$;

alter table publicaciones_organicas
  add constraint publicaciones_organicas_receta_organica_check check (
    receta_organica in (
      'consejos_numerados', 'mito_verdad', 'producto_en_uso',
      'serie_partes', 'pregunta_comunidad', 'detras_de_marca',
      'historia_narrada'
    )
  );

commit;

-- Verificación (debe listar el CHECK con 'historia_narrada'):
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'publicaciones_organicas'::regclass and contype = 'c';
