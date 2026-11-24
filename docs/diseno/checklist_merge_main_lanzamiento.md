# Checklist: merge de dev a main (lanzamiento de /contenido y el publicador)

**Para:** Juan José, al momento de hacer el merge. **Estado:** preparado el 23 nov 2026. El merge solo se hace con tu confirmación.
**Por qué ahora:** la revisión de Meta exige que el revisor pruebe la función en una URL https y que el video de demostración se grabe ahí (https://quiubot.site).

Datos clave:
- Staging y producción **comparten la base de datos**. Este lanzamiento no trae SQL: la verificación de esquema confirma que las 29 columnas que espera el código existen.
- `dev` tiene 107+ commits que `main` no tiene, y `main` no tiene nada que `dev` no tenga, así que no hay conflictos.
- El publicador solo actúa en el despliegue que tenga `PUBLICADOR_ORGANICO_ACTIVO=true`. **Nunca puede estar en `true` en los dos a la vez.**

## 0. Antes de empezar (en staging)

- [ ] Probar en staging la voz arreglada (d3252dc) con 2 piezas nuevas.
- [ ] Probar con la cuenta de prueba de rol `usuario` (plan Escala o Crecimiento): crear → generar → aprobar → renderizar → publicar.
- [ ] Probar con una cuenta Arranque: ve Contenido con el aviso y no puede crear.
- [ ] Correr el `curl` de 30 MB contra staging para medir el límite de Traefik/Coolify (401 = pasa, 413 = corta). El reel más largo pesa ~19.5 MiB, así que basta con que deje pasar 25 MB.
- [ ] Anotar el commit exacto de `dev` que se va a llevar.

## 1. Variables de entorno

**Producción (Coolify, app de quiubot.site):**

| Variable | Valor | Cuándo |
|---|---|---|
| `PUBLICADOR_ORGANICO_ACTIVO` | `true` | Recién en el paso 6, después de apagarla en staging. |
| `REELS_ILUSTRADOS_EMAILS` | vacía, o solo tu correo | Antes del deploy. Los clientes reciben los estilos de siempre. |
| `SOURCE_COMMIT` | (la pone Coolify) | Nada que hacer. |

Revisar que ya existan y tengan el valor de producción: `ADMIN_SECRET`, `NEXTAUTH_URL=https://quiubot.site`, `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID` y `META_REDIRECT_URI=https://quiubot.site/api/meta/callback`.

**`ENCRYPTION_KEY` tiene que ser la misma que en staging.** Como la base es compartida, las llaves de OpenAI y Cloudinary guardadas cifradas por un despliegue tienen que poder leerse en el otro.

**Staging:** `PUBLICADOR_ORGANICO_ACTIVO=false` (o borrarla) desde el paso 1.

## 2. Orden de pasos

1. **Apagar el publicador en staging:** `PUBLICADOR_ORGANICO_ACTIVO=false` y reiniciar staging. Verificar:
   ```
   curl -s -X POST -H "Authorization: Bearer <ADMIN_SECRET de staging>" https://<staging>/api/cron/publicar-organico
   ```
   Debe responder `{"ok":true,"activo":false}`.
2. **Pausar en n8n** el workflow "publicar-organico" (Schedule Trigger cada 5 min).
3. **Merge** (yo lo hago cuando lo confirmes):
   - `git checkout main && git pull --ff-only`
   - `git merge --no-ff origin/dev`
   - Verificación en un clon limpio del commit de merge: `npm ci && npm run build && npm run test`.
   - `git push origin main`
   - Volver a alinear dev: `git checkout dev && git merge --ff-only main && git push origin dev`.
4. **Deploy en Coolify** de `main`. Mirar el log del build hasta que termine bien.
5. **Verificación rápida** (sección 3, puntos a–c).
6. **Encender el publicador en producción:** `PUBLICADOR_ORGANICO_ACTIVO=true` y reiniciar.
7. **n8n:**
   - En el workflow "publicar-organico", cambiar la URL del HTTP Request a `https://quiubot.site/api/cron/publicar-organico`, con el header `Authorization: Bearer <ADMIN_SECRET de producción>`.
   - Ejecutarlo una vez a mano: debe responder `{"ok":true,"activo":true,...}`.
   - Activarlo.
8. **Verificación completa** (sección 3, puntos d–g).

## 3. Verificar después del deploy

- [ ] a. En `/admin`, el commit que se muestra es el del merge.
- [ ] b. URLs públicas sin sesión: `/privacidad`, `/terminos` y `/eliminar-datos` responden **200**; `/contenido` redirige al login.
  ```
  for u in /privacidad /terminos /eliminar-datos /contenido; do curl -s -o /dev/null -w "$u %{http_code}\n" https://quiubot.site$u; done
  ```
- [ ] c. `POST /api/cron/publicar-organico` sin secreto responde 401; con el secreto, `{"ok":true,...}`.
- [ ] d. Con tu cuenta admin en Chrome: Contenido → Agregar reel → Generar guion → Aprobar → el video se arma y pasa el control → "Lista" → "Publicar ahora" → aparece en Instagram.
- [ ] e. Con la cuenta de prueba `usuario`: el mismo flujo. No ve las piezas de otro, y "Forzar de todos modos" no aparece.
- [ ] f. En n8n, las ejecuciones cada 5 min responden 200.
- [ ] g. `/admin/errores` no muestra errores nuevos del publicador ni de contenido.

## 4. Cómo revertir si algo sale mal

1. **Detener la publicación de inmediato:** `PUBLICADOR_ORGANICO_ACTIVO=false` en producción y reiniciar, y pausar el workflow de n8n. Así nada más se publica mientras se decide.
2. **Volver al código anterior** (cualquiera de las dos):
   - En Coolify, "Redeploy" del deployment anterior (commit `cecf7c3` de `main`).
   - O `git revert -m 1 <commit del merge>` en `main`, `push` y deploy. `dev` conserva todo.
3. **Si hace falta seguir publicando desde staging mientras tanto:** `PUBLICADOR_ORGANICO_ACTIVO=true` en staging y n8n apuntando de nuevo a staging. Nunca en los dos.
4. **Base de datos:** no hay nada que revertir (este lanzamiento no trae SQL). Las piezas creadas en producción siguen en la base y se ven también en staging.

## 5. Qué tiene que existir en producción para la revisión de Meta

**URLs para la configuración de la app en Meta:**

| Campo en Meta | URL | Estado (23 nov 2026, producción actual) |
|---|---|---|
| Política de privacidad | https://quiubot.site/privacidad | **Hoy redirige al login (falla).** Arreglado en dev: queda pública con el merge. |
| Términos del servicio | https://quiubot.site/terminos | 200 |
| Instrucciones de eliminación de datos | https://quiubot.site/eliminar-datos | 200. Es una página de instrucciones (Meta acepta instrucciones o un callback; no hay callback implementado). |
| URI de redirección de OAuth válida (Facebook Login for Business) | https://quiubot.site/api/meta/callback | Tiene que estar en la lista del panel de Meta. |
| Dominio de la app | quiubot.site | |

**Política de privacidad.** Hoy habla de Meta e Instagram para anuncios, pero no dice que Quiubot **publica reels en la cuenta de Instagram del usuario**. El revisor del permiso `instagram_content_publish` lo busca. Texto propuesto para agregar (pendiente de tu aprobación; no lo cambié):

> **Publicación de contenido en Instagram:** cuando programas o apruebas un reel en la sección Contenido, Quiubot lo publica en la cuenta de Instagram profesional que conectaste, en la fecha y hora que elegiste, usando los permisos que autorizaste al conectar tu cuenta de Meta. Quiubot solo publica lo que tú aprobaste y no lee ni publica nada más en tu cuenta. Puedes desconectar Meta en cualquier momento desde Integraciones o desde la configuración de tu cuenta de Facebook.

**Flujo que el revisor debe poder recorrer en https://quiubot.site:**
1. **Ingresar a Quiubot.** El login de la app es con correo y contraseña (o Google); el de Facebook no es el login de la app. Hay que darle al revisor una cuenta de prueba en las instrucciones de la revisión: rol `usuario`, plan Escala vigente, llave de OpenAI con saldo y Cloudinary configurado.
2. **Integraciones → "Conectar Meta"** (`/api/meta/conectar`). Este es el **Facebook Login for Business** con `config_id`; el revisor autoriza la página y la cuenta de Instagram. La configuración de login en el panel de Meta tiene que incluir `instagram_content_publish` (más `instagram_basic`, `pages_show_list` y los que ya usa la app).
3. **Contenido → "Agregar reel"** → "Generar guion".
4. **Aprobar** → el video se arma en el navegador (Chrome) y pasa el control de calidad → queda "Lista".
5. **"Publicar ahora"** (o esperar la hora programada; el cron corre cada 5 min) → el reel aparece en Instagram.

**Video de demostración:** grabarlo en producción recorriendo los pasos 1–5, mostrando la URL https://quiubot.site en la barra y el reel ya publicado en Instagram al final.
