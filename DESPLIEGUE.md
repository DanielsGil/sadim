# Despliegue de SADIM (Render + Neon, plan Free)

D25: un solo Web Service en Render (Docker) sirve la API de Django y la PWA
ya construida en el mismo dominio; PostgreSQL vive en Neon. Al ser un solo
dominio no hace falta configurar CORS.

## 1. Base de datos (Neon)

1. Crea una cuenta/proyecto en [neon.tech](https://neon.tech), región **us-east-1**.
2. Crea una base de datos (por ejemplo `sadim`).
3. Copia el **connection string** que da Neon (empieza con `postgresql://...`,
   incluye `?sslmode=require`). Ese valor es `DATABASE_URL`.

## 2. Web Service (Render)

1. En [render.com](https://render.com), "New" → "Blueprint", apunta al
   repositorio de GitHub de SADIM. Render lee `render.yaml` y propone el
   servicio `sadim` (Docker, plan Free, región **Virginia**).
2. Al crearlo, Render pide los valores de las variables marcadas
   `sync: false` en `render.yaml` — configúralas en el dashboard del
   servicio (pestaña "Environment"), nunca en el repositorio:
   - `SECRET_KEY`: una clave larga y aleatoria, distinta a cualquiera usada
     en desarrollo (por ejemplo, generada con `python -c "import secrets; print(secrets.token_urlsafe(50))"` en tu máquina, fuera de este repo).
   - `ALLOWED_HOSTS`: el dominio que asigna Render (por ejemplo
     `sadim.onrender.com`), sin `https://` ni barra final. Si agregas un
     dominio propio después, súmalo separado por comas.
   - `CSRF_TRUSTED_ORIGINS`: el mismo dominio, con esquema, por ejemplo
     `https://sadim.onrender.com`.
   - `DATABASE_URL`: el connection string de Neon del paso 1.
   - `DEBUG` ya viene en `False` desde `render.yaml` — no la cambies.
3. Guarda y despliega. El primer build tarda varios minutos (compila el
   frontend, instala dependencias de Python, corre `collectstatic`).
4. Render usa `GET /api/health/` como health check: no toca la base de
   datos, así que el servicio puede "despertar" (plan Free se duerme sin
   tráfico) sin gastar conexiones de Neon.

## 3. Primer ADMIN

Una vez el servicio esté arriba (visita `https://<tu-dominio>/api/health/`
y confirma `200 OK`), crea el primer ADMIN desde cualquier cliente HTTP
(curl, Postman, o el propio formulario de la PWA si expone registro):

```
POST https://<tu-dominio>/api/auth/register/
{"username": "...", "password": "...", "nombre_completo": "..."}
```

Esto deja creado el ADMIN y, en la misma transacción (D9), las filas únicas
de `ConfiguracionModulo` y `ConfiguracionPago`. A partir de ahí, el resto de
usuarios se crean desde `/api/usuarios/` (HU-044), ya logueado como ese
ADMIN.

## Notas

- Las migraciones se aplican solas en cada arranque del contenedor (antes de
  levantar gunicorn) — no hay un paso manual de `migrate`.
- Un `git push` a la rama conectada dispara un nuevo build y despliegue.
