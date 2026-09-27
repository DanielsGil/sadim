# Bloque 6a (D25): una sola imagen para Render (plan Free) que sirve la API
# de Django y la PWA ya construida en el mismo dominio (sin CORS).

# --- Etapa 1: build del frontend (Vite + React + TS) ---
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Etapa 2: backend (Django) + estáticos ---
FROM python:3.12-slim AS backend
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
# El build del frontend queda en frontend/dist, exactamente donde
# core/settings.py (FRONTEND_DIST) y WhiteNoise lo esperan.
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# `collectstatic` solo reúne los estáticos del admin de Django (no necesita
# base de datos ni variables de entorno reales; SECRET_KEY/DEBUG tienen
# valores por defecto de desarrollo que alcanzan para este paso de build).
RUN python backend/manage.py collectstatic --noinput

EXPOSE 8000

# El plan Free de Render no tiene un paso "pre-deploy" separado, así que las
# migraciones se aplican aquí, antes de levantar gunicorn, en cada arranque.
CMD ["sh", "-c", "python backend/manage.py migrate --noinput && gunicorn --pythonpath backend core.wsgi:application --bind 0.0.0.0:${PORT:-8000}"]
