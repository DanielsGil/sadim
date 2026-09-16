# SADIM — Sistema de Gestión Modular

PWA offline-first para micro-comercios y negocios de servicios (ventas de mostrador, sesiones dinámicas de mesa, órdenes de trabajo, inventario y caja). Proyecto de grado — Ingeniería de Sistemas y Computación, Universidad Antonio Nariño. Caso de validación: cafetería Aroma & Co. (Chapinero, Bogotá).

La documentación de arquitectura, modelo de datos, casos de uso y contrato de API vive en `docs/referencia/`. Ese es el origen de verdad; este README solo explica cómo levantar el entorno de desarrollo en Windows.

## Requisitos previos

- Python 3.13+ (el `venv/` del repositorio ya está creado en la raíz).
- PostgreSQL 18 instalado y corriendo como servicio de Windows (`postgresql-x64-18`), escuchando en `localhost:5432`.
- Node.js y npm (para el frontend, ver `frontend/README.md`).

## 1. Activar el entorno virtual

Desde la raíz del repositorio, en PowerShell o Git Bash:

```
venv\Scripts\activate
```

## 2. Instalar dependencias del backend

```
pip install -r requirements.txt
```

`requirements.txt` solo lista las dependencias directas: Django, Django REST Framework, djangorestframework-simplejwt, psycopg2-binary y python-dotenv.

## 3. Configurar variables de entorno

Copia `.env.example` a `.env` en la raíz del repositorio y completa los valores reales (nunca se commitea: está en `.gitignore`):

```
copy .env.example .env
```

Variables que lee `backend/core/settings.py` mediante `python-dotenv`:

| Variable | Uso |
|---|---|
| `SECRET_KEY` | Clave secreta de Django. Genera una propia para tu entorno. |
| `DEBUG` | `True` en desarrollo, `False` en producción. |
| `DB_NAME` | Nombre de la base de datos PostgreSQL (por defecto `sadim_db`). |
| `DB_USER` | Rol de PostgreSQL con permisos sobre esa base (por defecto `sadim`). |
| `DB_PASSWORD` | Contraseña del rol anterior. |
| `DB_HOST` | Host de PostgreSQL (por defecto `localhost`). |
| `DB_PORT` | Puerto de PostgreSQL (por defecto `5432`). |

## 4. Preparar la base de datos

Si el rol y la base de datos todavía no existen, créalos una vez desde `psql` (requiere la contraseña del superusuario `postgres`):

```sql
CREATE ROLE sadim WITH LOGIN PASSWORD 'tu-contraseña' CREATEDB;
CREATE DATABASE sadim_db OWNER sadim;
```

`CREATEDB` es necesario para que el mismo rol pueda crear la base de datos temporal de pruebas cuando ejecutes `manage.py test`.

## 5. Aplicar migraciones

```
python backend/manage.py migrate
```

## 6. Crear el primer usuario Administrador

SADIM no tiene un `createsuperuser` de uso normal: el primer ADMIN se crea vía API, y ese endpoint se bloquea automáticamente en cuanto existe algún usuario (Contrato §3). Con el servidor corriendo (`python backend/manage.py runserver`):

```
curl -X POST http://localhost:8000/api/auth/register/ ^
  -H "Content-Type: application/json" ^
  -d "{\"nombre_completo\": \"Nombre Apellido\", \"username\": \"admin\", \"password\": \"una-contraseña-segura\"}"
```

Respuesta esperada (201): `{"usuario_id": "...", "rol": "ADMIN"}`. Un segundo intento de registro responde `409 INSTALACION_YA_INICIALIZADA`: los usuarios siguientes se crean con `/api/usuarios/` autenticado como ADMIN.

## 7. Ejecutar las pruebas

```
python backend/manage.py test
```

Las pruebas corren contra PostgreSQL: Django crea y destruye automáticamente una base de datos temporal (`test_sadim_db`) usando el mismo rol de `.env`, por lo que ese rol necesita el permiso `CREATEDB` del paso 4.

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `python backend/manage.py check` | Verifica el proyecto sin tocar la base de datos. |
| `python backend/manage.py showmigrations` | Muestra el estado de las migraciones. |
| `python backend/manage.py makemigrations --check --dry-run` | Indica si faltan migraciones, sin crearlas. |

## Frontend

El frontend (Vite + React + TypeScript) tiene sus propias instrucciones en `frontend/README.md`.
