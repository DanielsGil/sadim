Actualizado al commit 7326a5a (03/10/2026)

# 06 — Despliegue e instalación

> Sin credenciales: solo nombres de variables. Fuentes: `Dockerfile`, `render.yaml`, `.dockerignore`, `DESPLIEGUE.md`, `README.md`, `backend/core/settings.py`, historial de git.

---

## 1. Despliegue real (D25: Render + Neon)

### 1.1 Dockerfile (`Dockerfile`, 36 líneas)

| Etapa | Imagen base | Qué hace | Líneas |
|---|---|---|---|
| 1 `frontend-build` | `node:22-alpine` | `npm ci` con `package.json` + `package-lock.json`; copia `frontend/`; `npm run build` (= `tsc -b && vite build`) → `frontend/dist` | `:5-10` |
| 2 `backend` | `python:3.12-slim` | `PYTHONDONTWRITEBYTECODE=1`, `PYTHONUNBUFFERED=1`; `pip install -r requirements.txt`; copia `backend/`; copia `frontend/dist` desde la etapa 1 a `/app/frontend/dist`; `collectstatic --noinput` (estáticos del admin y DRF); `EXPOSE 8000` | `:13-31` |
| Arranque | — | `sh -c "python backend/manage.py migrate --noinput && gunicorn --pythonpath backend core.wsgi:application --bind 0.0.0.0:${PORT:-8000}"` | `:36` |

- Servidor WSGI: **gunicorn 23** con la configuración por defecto (sin `--workers` ni `--timeout` explícitos → 1 worker síncrono, inferido del default de gunicorn).
- `.dockerignore` excluye `.env*` (salvo `.env.example`), `venv/`, `node_modules/`, `frontend/dist/`, `backend/staticfiles/`, `backend/db.sqlite3`, `__pycache__`, `.git/`, `.claude/`, `docs/` y todos los `*.md` salvo `DESPLIEGUE.md`.

### 1.2 `render.yaml` (Blueprint)

Un solo servicio `type: web`, `name: sadim`, `runtime: docker`, `plan: free`, `region: virginia`, `dockerfilePath: ./Dockerfile`, `healthCheckPath: /api/health/`. Variables: `DEBUG` = `"False"`; `SECRET_KEY`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `DATABASE_URL` con `sync: false` (se cargan a mano en el dashboard).

### 1.3 API y PWA en el mismo dominio

- WhiteNoise (`whitenoise.middleware.WhiteNoiseMiddleware`, `settings.py:86`) sirve `frontend/dist` como raíz del sitio (`WHITENOISE_ROOT`, `:190-191`) y los estáticos del admin en `/static/`.
- Caché: `/assets/*` (archivos con hash) inmutables un año; `index.html`, `sw.js`, `manifest.webmanifest`, `registerSW.js`, `favicon.svg` con `max-age=0` (`:199-200`). Desde A1 también se sirven `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` y `logo-sadim.svg` desde `frontend/dist`.
- Rutas de la API bajo `/api/`, admin bajo `/admin/`; cualquier otra ruta la atiende `spa_view` devolviendo `index.html` (`core/urls.py`, `core/views.py:33-45`). Al ser un solo dominio **no se configura CORS**.
- Con `DEBUG=False`: `SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO','https')`, `SECURE_SSL_REDIRECT=True`, cookies de sesión y CSRF seguras (`settings.py:242-246`).
- **`SECRET_KEY` obligatoria con `DEBUG=False`** (B1, commit `e57e7a6`): si falta o está vacía, Django lanza `ImproperlyConfigured` («SECRET_KEY no está definida. En producción (DEBUG=False) es obligatorio configurarla como variable de entorno.») al importar `settings.py` y el contenedor no arranca. Antes usaba en silencio la clave de desarrollo (F-13). El `collectstatic` del build no se ve afectado: el `Dockerfile` no declara `ARG`/`ENV` para `DEBUG`, así que en ese paso `DEBUG` vale `True` y se usa la clave de desarrollo (`Dockerfile:26-29`; verificado por comandos en el informe 10 §1, B1).

### 1.4 Conexión a Neon

`DATABASE_URL` (cadena `postgresql://…?sslmode=require` que entrega Neon) → `dj_database_url.parse(_DATABASE_URL, conn_max_age=600, ssl_require=True)` (`settings.py:121-125`). Región recomendada en `DESPLIEGUE.md`: Neon **us-east-1** y Render **Virginia**.

### 1.5 Migraciones, health check y estáticos

| Aspecto | Valor |
|---|---|
| Migraciones | Automáticas en cada arranque del contenedor, antes de gunicorn (no hay paso pre-deploy en el plan Free) — `Dockerfile:33-36`, `DESPLIEGUE.md` «Notas» |
| Health check | `GET /api/health/` → `200 {"status": "ok"}`, público y sin consultar la base (`core/views.py:21-30`) |
| Estáticos | `collectstatic` en el build (`Dockerfile:31`) → `backend/staticfiles`, servido por WhiteNoise con `CompressedManifestStaticFilesStorage` (`settings.py:177-184`) |
| Primer ADMIN | `POST https://<dominio>/api/auth/register/` (`DESPLIEGUE.md` §3) |

### 1.6 URL pública

NO ENCONTRADA en el repo. Solo aparece `sadim.onrender.com` como **ejemplo** en `DESPLIEGUE.md:25-28` y en un comentario de `settings.py:52`.

---

## 2. Limitaciones del plan gratuito

| Limitación | Documentada en el repo | Inferida de la configuración |
|---|---|---|
| El servicio Free de Render «se duerme sin tráfico»; el health check permite despertarlo sin gastar conexiones de Neon | Sí: `DESPLIEGUE.md` §2.4; `core/views.py:22-24` | — |
| No hay paso pre-deploy; las migraciones corren en cada arranque | Sí: `Dockerfile:33-35` | Un arranque en frío incluye `migrate` + gunicorn: la primera petición tras un periodo de inactividad tarda más |
| Primer build lento (compila frontend, dependencias Python, `collectstatic`) | Sí: `DESPLIEGUE.md` §2.3 | — |
| Un solo worker de gunicorn | No | Sí (sin `--workers`): peticiones concurrentes se atienden de a una por proceso |
| Neon Free suspende el cómputo por inactividad y tiene límites de almacenamiento/horas | No | Inferido del uso de Neon Free; afecta la latencia de la primera consulta |
| Sistema de archivos efímero | No | La app no sube archivos, así que no la afecta |
| Mientras el servicio duerme, la PWA sigue abriendo (shell en caché) y las escrituras se encolan; la sincronización espera a que el servicio despierte | No | Inferido de `frontend/src/sync/enrutador.ts` |

---

## 3. Instalación local en Windows (cmd)

### 3.1 Requisitos

| Requisito | Versión verificada | Evidencia |
|---|---|---|
| Python | 3.12 (3.12.10 local) | `README.md`; commit `df58816` |
| Node.js / npm | 22 (22.14.0) / 10 (10.9.2) | idem |
| PostgreSQL | 18 (18.6 según commit `df58816`), servicio `postgresql-x64-18` en `localhost:5432` | `README.md` |
| Git | cualquiera reciente | — |

### 3.2 Clonar

```
git clone https://github.com/DanielsGil/sadim.git
cd sadim
```

### 3.3 Entorno virtual y dependencias

`venv/` no se versiona; en un clon nuevo hay que crearlo (el README asume que ya existe):

```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 3.4 Archivo `.env`

```
copy .env.example .env
```
Completar (solo nombres): `SECRET_KEY`, `DEBUG`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`. En local no hacen falta `DATABASE_URL`, `ALLOWED_HOSTS` ni `CSRF_TRUSTED_ORIGINS`. Con `DEBUG=True` (valor por defecto) `SECRET_KEY` puede quedar vacía; si en local se prueba `DEBUG=False`, hay que definirla (B1).

### 3.5 Base de datos y migraciones

En `psql` como superusuario `postgres`:
```
CREATE ROLE sadim WITH LOGIN PASSWORD 'tu-contraseña' CREATEDB;
CREATE DATABASE sadim_db OWNER sadim;
```
Luego, desde la raíz:
```
python backend\manage.py migrate
```

### 3.6 Datos iniciales

No hay fixtures ni comandos de carga. Con el backend corriendo (paso 3.7), crear el primer ADMIN:
```
curl -X POST http://localhost:8000/api/auth/register/ ^
  -H "Content-Type: application/json" ^
  -d "{\"nombre_completo\": \"Ana Torres\", \"username\": \"admin.aroma\", \"password\": \"una-contraseña-segura\"}"
```
Respuesta esperada `201 {"usuario_id": "...", "rol": "ADMIN"}`. El resto (mesas, catálogo, operadores, dispositivo) se configura desde la app (ver `04b §1`).

### 3.7 Levantar backend y frontend

Terminal 1:
```
venv\Scripts\activate
python backend\manage.py runserver
```
Terminal 2:
```
cd frontend
npm install
npm run dev
```
Abrir `http://localhost:5173` (el proxy de Vite envía `/api/*` a `http://localhost:8000`, `frontend/vite.config.ts:38-48`).

### 3.8 Build de producción

```
cd frontend
npm run build
cd ..
python backend\manage.py collectstatic --noinput
python backend\manage.py runserver
```
Con `frontend/dist` presente, Django sirve la PWA en `http://localhost:8000/` (WhiteNoise + `spa_view`). Para emular producción con gunicorn haría falta Linux/WSL o Docker (gunicorn no corre en Windows nativo — inferido; no documentado en el repo).

### 3.9 Pruebas

```
venv\Scripts\activate
python backend\manage.py test usuarios inventario core ventas finanzas servicios
cd frontend
npm test
npx tsc -b
npm run lint
```

---

## 4. Despliegue desde cero en Render + Neon

Según `DESPLIEGUE.md`:

1. **Neon**: crear proyecto en us-east-1 y una base (p. ej. `sadim`); copiar el *connection string* (`postgresql://…?sslmode=require`) → será `DATABASE_URL`.
2. **Render**: «New» → «Blueprint» → apuntar al repo de GitHub; Render lee `render.yaml` y propone el servicio `sadim` (Docker, Free, Virginia).
3. Variables en «Environment» (nunca en el repo):
   - `SECRET_KEY`: clave larga aleatoria (p. ej. `python -c "import secrets; print(secrets.token_urlsafe(50))"`). **Obligatoria**: sin ella el servicio no arranca (B1). Configurarla **antes** del primer despliegue, y confirmarla antes de cualquier push a `main` posterior a `e57e7a6` (informe 10 §7).
   - `ALLOWED_HOSTS`: dominio de Render sin `https://` (p. ej. `sadim.onrender.com`).
   - `CSRF_TRUSTED_ORIGINS`: mismo dominio con esquema (`https://…`).
   - `DATABASE_URL`: cadena de Neon.
   - `DEBUG`: ya viene en `False`.
4. Desplegar; verificar `https://<dominio>/api/health/` → 200.
5. Crear el primer ADMIN con `POST https://<dominio>/api/auth/register/`.
6. Cada `git push` a la rama conectada dispara build y despliegue.

---

## 5. Solución de problemas técnicos

| Síntoma | Causa | Solución | Fuente |
|---|---|---|---|
| `Ran 0 tests` | Se corrió `manage.py test` desde la raíz sin nombrar apps | Nombrar las 6 apps o correr desde `backend/` | `README.md` §6 |
| Las pruebas fallan al crear `test_sadim_db` | El rol de `.env` no tiene `CREATEDB` | `ALTER ROLE sadim CREATEDB;` | `README.md` §2 |
| `psql` no se reconoce | La carpeta `bin` de PostgreSQL no está en el PATH | Agregar `C:\Program Files\PostgreSQL\18\bin` al PATH | inferido del PATH local |
| `501 El frontend no está construido (falta frontend/dist/index.html; corre \`npm run build\` en frontend/).` en `localhost:8000/` | No existe `frontend/dist` | `cd frontend && npm run build`, o usar `npm run dev` (puerto 5173) | `core/views.py:38-44` |
| Errores CORS en el navegador | Se abrió el frontend en otro origen llamando directo a `:8000` | En desarrollo usar el proxy de Vite (`localhost:5173`); en producción servir todo desde el mismo dominio (no hay `django-cors-headers`) | `vite.config.ts:38-48` |
| `400 Bad Request` en Render | El dominio no está en `ALLOWED_HOSTS` | Agregarlo (separado por comas si hay varios) | `settings.py:53-55` |
| Error CSRF al entrar a `/admin/` en producción | Falta `CSRF_TRUSTED_ORIGINS` con `https://` | Configurarlo | `settings.py:57-60` |
| Error de conexión/SSL con Neon | `DATABASE_URL` sin SSL o mal copiada | Usar la cadena con `sslmode=require` (el código además fuerza `ssl_require=True`) | `settings.py:121-125` |
| El contenedor se reinicia en bucle | Una migración falla en el arranque (se ejecuta antes de gunicorn) | Revisar logs de Render; localmente `python backend\manage.py makemigrations --check --dry-run` y `migrate` | `Dockerfile:36` |
| Reactivar una mesa daba `500 ERROR_INTERNO` | `select_for_update()` fuera de transacción (`TransactionManagementError`) | Corregido en `9542665` (E-05): `editar_mesa` abre su `transaction.atomic()` | commit `9542665` |
| Cierre de caja respondía `409 CIERRE_YA_REALIZADO` falso de forma intermitente | `periodo_inicio == periodo_fin` al microsegundo (más notorio en Windows) violaba el CHECK y se reportaba mal | Corregido en `df58816` | commit `df58816` |
| IDs inexistentes devolvían 500 en vez de 404 | El manejador propio no traducía `Http404` de Django | Corregido en `5528831` | commit `5528831` |
| Montos salían como texto `"3500.00"` | DRF serializa Decimal como string por defecto | `COERCE_DECIMAL_TO_STRING=False` (`401b81f`) | commit `401b81f` |
| Los usuarios ven una versión vieja de la app | El SW anterior sigue activo hasta recargar | Con `autoUpdate` basta cerrar y abrir la app; si persiste, DevTools → Application → Service Workers → «Unregister». **No usar «Clear site data» con operaciones pendientes**: borra IndexedDB (cola, sesión e id del dispositivo, que luego hay que volver a registrar y autorizar) | `vite.config.ts:14`; `db/baseLocal.ts:98-110` |
| `/admin/` muestra la PWA en vez del admin de Django | En versiones anteriores a `fc6c598`, el SW atendía toda navegación con `index.html` | **Corregido** (B2): `navigateFallbackDenylist: [/^\/api\//, /^\/admin\//]`. Si todavía pasa, abrir la app una vez para que se active el SW nuevo (o desregistrar el viejo) | `vite.config.ts:39-42` |
| El servicio no arranca en Render y el log muestra `django.core.exceptions.ImproperlyConfigured: SECRET_KEY no está definida. En producción (DEBUG=False) es obligatorio configurarla como variable de entorno.` | Falta `SECRET_KEY` (o está vacía) con `DEBUG=False` | Render → servicio `sadim` → *Environment* → agregar `SECRET_KEY` con una clave larga aleatoria y volver a desplegar. No reutilizar la clave de desarrollo | `backend/core/settings.py:37-49`; commit `e57e7a6` |
| `ImproperlyConfigured: SECRET_KEY no está definida…` en local | Se puso `DEBUG=False` en `.env` sin `SECRET_KEY` | Definir `SECRET_KEY` en `.env` o volver a `DEBUG=True` | `backend/core/settings.py:35-49` |
| Error `crypto.randomUUID is not a function` al probar desde el celular por `http://192.168.x.x` | `randomUUID` y el service worker solo existen en contexto seguro | Probar por `localhost` o HTTPS (Render) | `db/baseLocal.ts:107` |
| `409 INSTALACION_YA_INICIALIZADA` al registrar | Ya existe al menos un usuario | Iniciar sesión con el ADMIN existente; nuevos usuarios desde «Usuarios» | `usuarios/services.py:24-32` |
| `403 DISPOSITIVO_NO_AUTORIZADO` y la cola no baja | El equipo no está registrado/autorizado o se borraron los datos del navegador (nuevo id) | ADMIN → Dispositivos → registrar y autorizar este equipo | `core/services.py:61-87` |
| Pruebas lentas | PBKDF2 en cada login | Ya resuelto: en `test` se usa MD5 (`948cedc`) | `settings.py:231-237` |

---

## Cambios respecto a la versión del 02/10

- §1.3: `SECRET_KEY` obligatoria con `DEBUG=False` (B1, `e57e7a6`) y por qué el `collectstatic` del build no se ve afectado; íconos nuevos servidos por WhiteNoise (A1).
- §3.4: nota de `SECRET_KEY` en local.
- §4: `SECRET_KEY` marcada como obligatoria antes de desplegar. `origin/main` ya apunta a `7326a5a`, que incluye B1: el servicio de Render solo arranca si la variable está definida (no se pudo verificar desde el repo).
- §5: dos filas nuevas por la falta de `SECRET_KEY` (Render y local); la fila de `/admin/` pasa a «corregido» (B2, `fc6c598`).
- Referencias de `core/settings.py` corridas (+8 líneas desde la sección de `SECRET_KEY`).
- Los lotes de corrección 4–6 no cambiaron el despliegue.
