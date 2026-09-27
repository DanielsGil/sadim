# SADIM — Sistema de Gestión Modular

PWA offline-first para micro-comercios y negocios de servicios (ventas de mostrador, sesiones dinámicas de mesa, órdenes de trabajo, inventario y caja). Proyecto de grado — Ingeniería de Sistemas y Computación, Universidad Antonio Nariño. Caso de validación: cafetería Aroma & Co. (Chapinero, Bogotá).

La documentación de arquitectura, modelo de datos, casos de uso y contrato de API vive en `docs/referencia/`. Ese es el origen de verdad; este README solo explica cómo levantar el entorno de desarrollo en Windows desde cero.

## Requisitos (versiones verificadas en este entorno)

- Python 3.12 (`venv/` del repositorio ya está creado en la raíz).
- Node.js 22 y npm 10 (para el frontend).
- PostgreSQL 18, instalado y corriendo como servicio de Windows (`postgresql-x64-18`), escuchando en `localhost:5432`.

## 1. Activar el entorno virtual e instalar dependencias del backend

Desde la raíz del repositorio, en PowerShell o Git Bash:

```
venv\Scripts\activate
pip install -r requirements.txt
```

`requirements.txt` lista solo las dependencias directas: Django, Django REST Framework, djangorestframework-simplejwt, psycopg2-binary, python-dotenv, y (para despliegue, Bloque 6a) dj-database-url, gunicorn y whitenoise.

## 2. Base de datos y variables de entorno

Si el rol y la base de datos todavía no existen, créalos una vez desde `psql` (requiere la contraseña del superusuario `postgres`):

```sql
CREATE ROLE sadim WITH LOGIN PASSWORD 'tu-contraseña' CREATEDB;
CREATE DATABASE sadim_db OWNER sadim;
```

`CREATEDB` es necesario para que ese mismo rol pueda crear la base de datos temporal de pruebas.

Copia `.env.example` a `.env` en la raíz y completa tus propios valores (nunca se commitea, está en `.gitignore`):

```
copy .env.example .env
```

`backend/core/settings.py` lee, vía `python-dotenv`: `SECRET_KEY`, `DEBUG`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`. Para desarrollo local basta con eso — las variables de producción (`DATABASE_URL`, `ALLOWED_HOSTS`, etc., Bloque 6a) solo aplican al desplegar en Render y no hacen falta aquí.

## 3. Migraciones

```
python backend/manage.py migrate
```

## 4. Crear el primer usuario Administrador

SADIM no usa `createsuperuser`: el primer ADMIN se crea vía API, y ese endpoint se bloquea automáticamente en cuanto existe algún usuario (Contrato §3). Con el servidor corriendo (paso 5):

```
curl -X POST http://localhost:8000/api/auth/register/ ^
  -H "Content-Type: application/json" ^
  -d "{\"nombre_completo\": \"Ana Torres\", \"username\": \"admin.aroma\", \"password\": \"una-contraseña-segura\"}"
```

Respuesta esperada (201): `{"usuario_id": "...", "rol": "ADMIN"}`. Ese registro también crea, en la misma transacción, la configuración de módulos y de medios de pago (D9). Un segundo intento responde `409 INSTALACION_YA_INICIALIZADA`; los usuarios siguientes (OPERADOR) se crean autenticado como ADMIN con `/api/usuarios/`.

## 5. Levantar backend y frontend

Backend (puerto 8000):

```
python backend/manage.py runserver
```

Frontend (puerto 5173), en otra terminal:

```
cd frontend
npm install
npm run dev
```

El proxy de Vite (`vite.config.ts`) redirige `/api/*` a `http://localhost:8000`, así que el backend no necesita CORS. La sesión (`access_token`, `refresh_token`, `usuario_id`, `rol`) se guarda con Dexie en IndexedDB, nunca en `localStorage`.

## 6. Ejecutar las pruebas

Backend, desde la raíz (nombrando las apps) o parado dentro de `backend/`:

```
python backend/manage.py test usuarios inventario core ventas finanzas servicios
```
```
cd backend && python manage.py test
```

Ambas formas están verificadas. **Ojo:** `python backend/manage.py test` sin argumentos, ejecutado desde la raíz, reporta `Ran 0 tests` — Django descubre pruebas a partir del directorio de trabajo actual, no de `BASE_DIR`, y `manage.py` vive en `backend/`. Usa una de las dos formas de arriba.

Las pruebas corren contra PostgreSQL: Django crea y destruye una base de datos temporal (`test_sadim_db`) con el mismo rol de `.env` (necesita `CREATEDB`, paso 2).

Frontend (Vitest, solo el módulo de cola/sincronización offline):

```
cd frontend
npm test
```

Otros comandos útiles del frontend: `npm run build` (compila y genera la build de producción, incluye manifest y service worker de la PWA), `npx tsc -b` (chequeo de tipos) y `npm run lint`.
