-- ============================================================
-- Contenido orgánico -- Fase B v2.0 (ver
-- docs/diseno/plan_contenido_organico_fase_b_v2.md). Edición desde el
-- audio: voz generada con TTS, tiempos por palabra, y la plataforma
-- donde una pista de música tiene licencia real. Mismo criterio que
-- contenido_organico.sql: add column if not exists (se puede volver a
-- correr sin fallar), RLS ya activado en estas 3 tablas desde antes
-- (no se toca), notify pgrst al final porque no hay función RPC nueva
-- en este archivo pero sí por disciplina si algo quedó cacheado.
-- ============================================================

-- Audio de la narración completa de un reel orgánico, generado una
-- vez por generarVoz() y persistido -- nunca se regenera en cada
-- preview/render, igual que la música (guion->musica->pista_id).
alter table publicaciones_organicas add column if not exists voz_url text;

-- Resultado del control de calidad automático (reglas de código +
-- visión): {intentos, hallazgos: [{tipo, escena_id, detalle}],
-- aprobado: boolean}. Para que el admin vea por qué se regeneró algo
-- o por qué un reel no se llegó a entregar.
alter table publicaciones_organicas add column if not exists control_calidad jsonb;

-- Voz de OpenAI TTS elegida para esa marca (nombre real de la voz,
-- ej. "alloy"/"nova"/etc.) -- nullable: si es null, el código elige
-- una por defecto según el estilo de fuente de la marca, nunca lo
-- inventa la IA. Hoy (Fase B v2.0) no hay UI para elegirla a mano,
-- solo esta columna + el valor por defecto del código.
alter table marcas add column if not exists voz_tts text;

-- Plataformas donde la licencia de esa pista es válida -- mismos
-- valores que ya usa publicaciones_organicas.plataforma
-- (contenido_organico.sql), nunca un enum nuevo aparte.
alter table pistas_musicales add column if not exists plataformas_permitidas text[];

-- Una licencia sin decir para qué plataforma vale no es una licencia
-- usable: si hay licencia_url, plataformas_permitidas no puede quedar
-- vacío. Se agrega como constraint nuevo, no como NOT NULL, porque
-- las pistas sin licencia (licencia_url null, la mayoría hoy) siguen
-- sin necesitar este campo. Postgres no soporta "ADD CONSTRAINT IF NOT
-- EXISTS" -- se hace re-corrible con drop-then-add, igual que el resto
-- de este archivo.
alter table pistas_musicales drop constraint if exists pistas_musicales_licencia_requiere_plataformas;
alter table pistas_musicales add constraint pistas_musicales_licencia_requiere_plataformas
  check (licencia_url is null or (plataformas_permitidas is not null and array_length(plataformas_permitidas, 1) > 0));

notify pgrst, 'reload schema';

-- ============================================================
-- Para deshacer SOLO lo de este archivo, sin tocar nada de
-- contenido_organico.sql (correr en el SQL Editor, de abajo hacia
-- arriba si se quiere deshacer todo):
-- ============================================================

-- alter table pistas_musicales drop constraint if exists pistas_musicales_licencia_requiere_plataformas;
-- notify pgrst, 'reload schema';

-- alter table pistas_musicales drop column if exists plataformas_permitidas;
-- notify pgrst, 'reload schema';

-- alter table marcas drop column if exists voz_tts;
-- notify pgrst, 'reload schema';

-- alter table publicaciones_organicas drop column if exists control_calidad;
-- notify pgrst, 'reload schema';

-- alter table publicaciones_organicas drop column if exists voz_url;
-- notify pgrst, 'reload schema';
