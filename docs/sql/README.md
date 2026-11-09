# SQL y funciones de Postgres (RPC) — guía de despliegue

Esta carpeta tiene el SQL que Claude propone y el usuario corre a mano en el
SQL Editor de Supabase (nunca se corre automático desde el código ni desde
un deploy). Reglas para cualquier archivo nuevo o cambio a uno existente:

## Al crear o cambiar una función (`CREATE OR REPLACE FUNCTION`)

1. Correr el `CREATE OR REPLACE FUNCTION` completo.
2. Correr el `REVOKE`/`GRANT` que la acompaña (ninguna función de esta
   carpeta debe quedar ejecutable por `anon`/`authenticated` — solo
   `service_role`, que es el único rol que usa `supabaseAdmin`).
3. **Correr `notify pgrst, 'reload schema';` al final.** Sin este paso,
   PostgREST (la capa que traduce `supabaseAdmin.rpc(...)` a SQL) puede
   seguir devolviendo `Could not find the function public.xxx(...)` aunque
   la función ya exista en la base — cachea el esquema y no se entera solo
   de una función nueva o reemplazada. Esto pasó en vivo la primera vez que
   se corrió `metas_atomicas.sql`.
4. Verificar en el SQL Editor que los permisos quedaron como se espera
   (solo `service_role`, nunca `anon`/`authenticated`):
   ```sql
   select routine_name, grantee, privilege_type
   from information_schema.routine_privileges
   where routine_name in ('crear_meta_completa', 'cambiar_estado_meta');
   ```
   y probar la llamada real desde la app en staging.

## Al agregar una columna

Usar siempre `add column if not exists` -- el script puede volver a
correrse (a mano, por las dudas) sin fallar si la columna ya quedó creada
en un intento anterior.

## Si la app muestra "Could not find the function..." después de correr el SQL

1. Confirmar que el `CREATE OR REPLACE FUNCTION` realmente corrió sin error
   (no quedó a mitad por un error de sintaxis anterior en la misma pestaña
   del SQL Editor).
2. Correr `notify pgrst, 'reload schema';` de nuevo, solo.
3. Si sigue sin aparecer, esperar unos segundos (el reload no es
   instantáneo) y reintentar la acción en la app.

## Errores de Postgres nunca llegan crudos al usuario

Cualquier ruta que llame a una función de esta carpeta debe traducir el
error a un mensaje amable (ver `app/api/metas/route.ts` y
`app/api/metas/[id]/route.ts`) y registrar el detalle técnico con
`registrarError()` -- nunca mostrar `error.message` de Postgres/PostgREST
tal cual en la respuesta al cliente.
