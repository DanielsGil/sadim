Actualizado al commit 7326a5a (03/10/2026)

# 01 — Stack tecnológico y repositorio

> Inventario verificado contra el repositorio local el 02/10/2026 (rama `main`, commit `8910c90`) y actualizado el 03/10/2026 sobre `main` en `7326a5a` (igual a `origin/main`).
> Convención: `ruta:línea` es evidencia directa. «NO ENCONTRADO» indica que se buscó y no existe.
> Solo se citan NOMBRES de variables de entorno; ningún valor de `.env` se leyó ni se copia.

---

## 1. Árbol del repositorio (3 niveles)

Excluye `node_modules/`, `venv/`, `dist/`, `__pycache__/` y `.git/`.

```
sadim_backend/                     ← raíz del repo (nombre histórico; contiene backend y frontend)
├── .claude/                       ← configuración de Claude Code (agente, reglas, skills) — no es parte del producto
│   ├── agents/revisor-consistencia.md
│   ├── rules/ (backend-api.md, backend-modelos.md, frontend-pwa.md)
│   ├── settings.json
│   └── skills/ (auditar-sprint2, implementar-hu, verificar-consistencia)
├── backend/                       ← API Django + DRF (monolito modular, ADR-002)
│   ├── core/                      ← proyecto Django (settings/urls/wsgi) + núcleo transversal: errores, permisos,
│   │                                 idempotencia, sincronización, configuración, dispositivos, health, SPA
│   ├── usuarios/                  ← modelo Usuario, registro del ADMIN inicial, login/refresh, CRUD de usuarios
│   ├── inventario/                ← Categoria, Producto (catálogo) y MovimientoInventario, stock
│   ├── ventas/                    ← Mesa, Venta, DetalleVenta (venta rápida y sesión dinámica)
│   ├── servicios/                 ← OrdenTrabajo, Abono, ConsumoOrden, CostoOperativoOrden
│   ├── finanzas/                  ← MovimientoCaja, CierreCaja (gastos, confirmación, resumen, cierre)
│   ├── staticfiles/               ← salida de collectstatic (admin y DRF); está en .gitignore/.dockerignore
│   ├── db.sqlite3                 ← archivo SQLite residual del scaffold inicial (no se usa: ver 08 §2)
│   └── manage.py
├── docs/
│   ├── referencia/                ← documentos de diseño aprobados (Anteproyecto, ADR, ERD, CU, Wireframes, Contrato, Backlog)
│   ├── evidencias/sprint-2.md     ← evidencia del cierre de Sprint 2 (salida de 33 pruebas y ejemplos HTTP)
│   ├── GUIA_CAMBIOS_DOCUMENTOS.md ← correcciones definidas para HU-047, aún no aplicadas a docs/referencia
│   ├── GUIA_CLAUDE_CODE.md
│   ├── INCONSISTENCIAS.md         ← registro de inconsistencias (INC-, VAC-, IMP-)
│   ├── TRAZABILIDAD.md            ← matriz HU ↔ CU (copia del backlog v2, 11/09/2026)
│   └── insumos_documentacion/     ← ESTA carpeta (00–09 + informe 10); NO versionada (git status: untracked)
├── frontend/                      ← PWA React + TypeScript + Vite
│   ├── public/ (favicon.svg, logo-sadim.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png)
│   ├── src/
│   │   ├── api/                   ← clientes HTTP por recurso (19 archivos + 1 de pruebas)
│   │   ├── componentes/           ← formularios, layout, navegación, bandeja, paneles de Inventario y Cierre (19)
│   │   ├── contexto/              ← SesionContext, erroresSesion, inactividad (D27) y su prueba (4)
│   │   ├── db/                    ← Dexie (IndexedDB): baseLocal.ts
│   │   ├── paginas/               ← 14 pantallas
│   │   ├── sync/                  ← cola offline, motor de sincronización, vistas locales, pruebas Vitest
│   │   ├── tipos/                 ← tipos de dominio (dominio.ts)
│   │   ├── utilidades/            ← formato (COP, fechas de Bogotá) y etiquetas, con pruebas (4)
│   │   ├── App.tsx, main.tsx, App.css, index.css, vite-env.d.ts
│   ├── index.html, package.json, package-lock.json
│   ├── vite.config.ts, vitest.config.ts, tsconfig*.json, .oxlintrc.json
│   └── README.md                  ← descripción corta del frontend de SADIM (desde A1, `1bf76fc`)
├── venv/                          ← entorno virtual Python (no versionado)
├── CLAUDE.md                      ← instrucciones de proyecto y bitácora de decisiones D1..D28
├── DESPLIEGUE.md                  ← guía de despliegue Render + Neon
├── Dockerfile, .dockerignore, render.yaml
├── INFORME_ESTADO_SPRINT3.md      ← informe del 19/09/2026, NO versionado (git status: untracked)
├── README.md                      ← arranque local en Windows
├── requirements.txt
├── .env.example                   ← plantilla de variables (no se leyó su contenido; ver §6)
└── .gitignore
```

Evidencia: listado con `find . -maxdepth 3` y `git status` (`?? INFORME_ESTADO_SPRINT3.md`).

---

## 2. Versiones exactas

### 2.1 Backend (Python)

`requirements.txt` declara versiones fijas; se confirmaron con `pip list` en `venv/`.

| Nombre | Versión | Para qué se usa |
|---|---|---|
| Python | 3.12.10 (local, `venv/Scripts/python --version`); 3.12 en la imagen Docker (`Dockerfile:13` `python:3.12-slim`) | Lenguaje del backend |
| Django | 6.1.1 (`requirements.txt:1`) | Framework web, ORM, migraciones, admin |
| djangorestframework | 3.18.0 (`requirements.txt:2`) | API REST (ViewSets, serializers, permisos) |
| djangorestframework-simplejwt | 5.5.1 (`requirements.txt:3`) | Autenticación JWT (access/refresh) |
| PyJWT | 2.13.0 (dependencia transitiva de simplejwt) | Firma de tokens |
| psycopg2-binary | 2.9.12 (`requirements.txt:4`) | Driver de PostgreSQL |
| python-dotenv | 1.2.3 (`requirements.txt:5`) | Lee `.env` en desarrollo (`backend/core/settings.py:27`) |
| dj-database-url | 3.0.1 (`requirements.txt:6`) | Parsea `DATABASE_URL` de Neon (`settings.py:121-125`) |
| gunicorn | 23.0.0 (`requirements.txt:7`) | Servidor WSGI de producción (`Dockerfile:36`) |
| whitenoise | 6.11.0 (`requirements.txt:8`) | Sirve estáticos y el build de la PWA (`settings.py:86`, `:190-200`) |
| PostgreSQL | 18 local (README «PostgreSQL 18»; servicio `postgresql-x64-18`); en producción Neon (versión NO ENCONTRADA en el repo) | Base de datos (ADR-001) |

### 2.2 Frontend (Node)

`package.json` usa rangos `^`/`~`; la columna «Instalada» es la versión real en `node_modules` (leída de cada `package.json`).

| Nombre | Rango declarado | Instalada | Tipo | Para qué se usa |
|---|---|---|---|---|
| Node.js | — | 22.14.0 local; `node:22-alpine` en Docker (`Dockerfile:5`) | runtime | Build y desarrollo |
| npm | — | 10.9.2 | herramienta | Gestor de paquetes |
| react | ^19.2.8 | 19.3.0 | prod | UI |
| react-dom | ^19.2.8 | 19.3.0 | prod | Render en el DOM |
| react-router-dom | ^7.18.4 | 7.18.4 | prod | Rutas y navegación (`src/App.tsx`) |
| dexie | ^4.4.6 | 4.4.6 | prod | IndexedDB (`src/db/baseLocal.ts`) |
| uuid | ^14.0.2 | 14.0.2 | prod | `operation_id` e ids de objetos generados en el cliente |
| typescript | ~6.0.2 | 6.0.3 | dev | Tipado; `tsc -b` en el build |
| vite | ^8.3.0 | 8.3.0 | dev | Bundler y servidor de desarrollo |
| @vitejs/plugin-react | ^6.1.1 | 6.1.1 | dev | Soporte React en Vite |
| vite-plugin-pwa | ^1.3.0 | 1.3.0 | dev | Manifest + service worker (Workbox) |
| workbox-build / workbox-window | (transitivas) | 7.4.1 | dev | Generación del SW y registro en el cliente |
| vitest | ^5.0.1 | 5.0.1 | dev | Pruebas unitarias de la lógica del cliente (`sync/`, `api/`, `contexto/`, `utilidades/`) |
| oxlint | ^1.81.0 | 1.82.0 | dev | Linter (`npm run lint`) |
| @types/react | ^19.2.18 | 19.3.0 | dev | Tipos |
| @types/react-dom | ^19.2.7 | (no verificada) | dev | Tipos |
| @types/node | ^24.13.3 | 24.13.4 | dev | Tipos para `vite.config.ts` |

Librería de UI o de estilos: **NO ENCONTRADA**. Los estilos son CSS propio en `src/index.css` (tokens del template de Vite) y `src/App.css` (1 196 líneas). No hay Tailwind, MUI, Bootstrap ni similares en `package.json`.

Scripts (`frontend/package.json`): `dev` = `vite`; `build` = `tsc -b && vite build`; `lint` = `oxlint`; `preview` = `vite preview`; `test` = `vitest run`.

---

## 3. Herramientas

| Herramienta | Estado | Evidencia |
|---|---|---|
| Linter frontend | oxlint 1.82.0 con plugins react/typescript/oxc | `frontend/.oxlintrc.json` |
| Formateador frontend (Prettier u otro) | NO ENCONTRADO | `package.json` |
| Linter/formateador backend (ruff, flake8, black) | NO ENCONTRADO | `pip list`, `requirements.txt`; CLAUDE.md lo declara pendiente |
| Docker | Dockerfile multi-etapa | `Dockerfile` (ver 06) |
| Orquestación de despliegue | Render Blueprint | `render.yaml` |
| CI (GitHub Actions u otro) | NO ENCONTRADO | no existe `.github/`; `git ls-files` sin workflows |
| Jira | Solo mención documental: HU-007 «Repositorio inicial, README y Jira configurado» | `docs/referencia/Backlog_Definitivo.md:13`. No hay URL ni claves de Jira en el repo |
| Figma | Solo mención: criterio de HU-004 «Mockups en Figma de módulos y dashboard» | `Backlog_Definitivo.md:11`. No hay enlaces ni archivos de Figma |
| Claude Code | Configuración del asistente | `.claude/`, `CLAUDE.md`; 59 de 61 commits llevan el trailer `Co-Authored-By: Claude …` (`git log`) |

---

## 4. Métricas

`cloc` no está instalado; se usó `wc -l` (líneas físicas, incluye comentarios y líneas en blanco).

### 4.1 Líneas por lenguaje

| Lenguaje | Archivos versionados | Líneas aprox. (03/10) | 02/10 |
|---|---|---|---|
| Python (backend, sin migraciones ni pruebas) | — | 5 372 | 5 259 |
| Python — pruebas (`*/tests.py`) | 6 | 3 050 | 2 970 |
| Python — migraciones | 22 | 901 | 901 |
| TypeScript/TSX en `src/` sin pruebas | 73 | ≈ 8 110 | ≈ 6 850 |
| TypeScript — pruebas Vitest | 7 | 790 | 411 |
| CSS | 2 | 1 290 (`App.css` 1 196 + `index.css` 94) | 778 |
| Markdown versionado (docs + raíz) | 23 | ≈ 5 270 | ≈ 5 250 |
| Docker/YAML | 2 | 59 | 59 |

Archivos versionados por extensión (`git ls-files`, total **217**, antes 202): py 89, ts 49, tsx 33, md 23, json 7, png 4, svg 2, css 2, yaml 1, html 1, otros 6. Cambios: +4 PNG y `logo-sadim.svg`; se borraron `hero.png`, `react.svg`, `vite.svg` e `icons.svg`; se borraron `paginas/IngresoMercancia.tsx` y `paginas/CierreCaja.tsx` y se agregaron 15 archivos TS/TSX.

### 4.2 Líneas por módulo

| Módulo backend | Código (sin tests/migr.) | Pruebas | Migraciones |
|---|---|---|---|
| core | 1 816 | 656 | 152 |
| usuarios | 390 | 289 | 75 |
| inventario | 650 | 569 | 286 |
| ventas | 922 | 553 | 99 |
| servicios | 764 | 438 | 107 |
| finanzas | 808 (antes 725) | 545 (antes 465) | 182 |

| Carpeta frontend (`src/`) | Archivos | Líneas | 02/10 |
|---|---|---|---|
| paginas | 14 | 2 848 | 16 / 2 901 |
| api | 20 | 1 410 | 18 / 1 269 |
| sync (incluye pruebas) | 14 | 1 477 | 12 / 1 214 |
| componentes | 19 | 2 000 | 14 / 1 198 |
| tipos | 1 | 349 | 1 / 324 |
| db | 1 | 198 | 1 / 172 |
| contexto (incluye `inactividad.test.ts`) | 4 | 353 | 1 / 103 |
| utilidades (incluye pruebas) | 4 | 187 | — |
| raíz (`App.tsx`, `main.tsx`, CSS, `vite-env.d.ts`) | 5 | 1 366 | 5 / 854 |

### 4.3 Git

| Métrica | Valor | Evidencia |
|---|---|---|
| Commits en `main` | **61** (igual en `origin/main`; antes 45) | `git rev-list --count main` |
| Primer commit | `fbc79d8` 2026-09-11 16:15 «chore: configuración base del repositorio» | `git log --reverse` |
| Último commit | `7326a5a` 2026-10-03 23:00 «fix: textos restantes de la cuenta de mesa, icons.svg y cifras en CLAUDE.md» | `git log -1` |
| Merges | 0 (historia lineal; la rama de correcciones entró por fast-forward) | `git log --merges` |
| Contribuidores (autor git) | **Daniel Gil, 61 commits**. No hay commits con autoría de Esteban Garzón Delgado | `git log --format=%an` |
| Coautoría de Claude | 59 de 61 commits con `Co-Authored-By: Claude …` | `git log --grep` |
| Ramas | `main`, `cierre-sprint-2` (ya contenida en `main`), `correcciones-pre-documentacion` (su punta `7326a5a` = `main`), `origin/main` | `git branch -a` |
| Tags | Ninguno | `git tag` |
| Remoto | `github.com/DanielsGil/sadim.git` | `git remote -v` |

Commits por día: 11/09 (4), 16/09 (26), 19/09 (5), 20/09 (1), 21/09 (4), 27/09 (5), **03/10 (16)**.

Commits posteriores al inventario del 02/10 (`8910c90..7326a5a`, todos del 03/10):

| Commit | Mensaje (resumen) | Grupo |
|---|---|---|
| `e90e527` | agregar producto con un clic y cierre de sesión por inactividad [E-10][E-11] | Lote de correcciones 4 |
| `6caa42a` | bandeja de selección, inventario unificado, formularios y ajuste de D27 [E-12]…[E-15] | Lote de correcciones 5 |
| `02ce97b` | cuenta siempre visible, bandeja compacta y persistente, Caja unificada [E-16]…[E-19] | Lote de correcciones 6 |
| `e57e7a6` | SECRET_KEY obligatoria con DEBUG=False [F-13] | Informe 10, B1 |
| `fc6c598` | el service worker no intercepta /api/ ni /admin/ [F-10] | B2 |
| `1bf76fc` | identidad de SADIM: logo, íconos, manifest e index.html [F-16] | A1 |
| `b31ccc0` | formato de moneda COP y fechas de Bogotá [F-17] | A2 |
| `d8bc4bb` | vocabulario de cobro de cuenta en el detalle de mesa [F-8] | A3 |
| `dca9f68` | mensaje del inicio de sesión según la causa [F-3] | A4 |
| `1cf8502` | etiqueta «Anulado» para abonos anulados [F-6] | A6 |
| `e1f2ba3` | etiquetas legibles en historial de inventario y novedades | A7 |
| `1984aec` | las novedades locales guardan el estado real del servidor [F-11] | B5 |
| `20907da` | las ventas encoladas envían el precio del dispositivo [F-9][D19] | B3 |
| `5f89fad` | el mapa de mesas carga sin conexión desde la copia local [F-1] | B4 |
| `3072214` | vista previa del cierre de caja y cierre completo en la PWA [F-4][F-5][CU-15][D28] | A5 |
| `7326a5a` | textos restantes de la cuenta de mesa, icons.svg y cifras en CLAUDE.md | Cierre de la rama |

---

## 5. Resumen del README

`README.md` (raíz) explica solo el arranque local en Windows (la documentación de diseño queda en `docs/referencia/`):
- Requisitos verificados: Python 3.12, Node.js 22 y npm 10, PostgreSQL 18 como servicio de Windows en `localhost:5432`.
- Pasos: activar `venv` e instalar `requirements.txt`; crear rol `sadim` con `CREATEDB` y BD `sadim_db`; copiar `.env.example` a `.env`; `python backend/manage.py migrate`; crear el primer ADMIN con `POST /api/auth/register/` (no se usa `createsuperuser`); levantar `runserver` (8000) y `npm run dev` (5173, proxy `/api` → 8000, sin CORS); correr pruebas con `python backend/manage.py test usuarios inventario core ventas finanzas servicios` o `cd backend && python manage.py test` (advierte que sin argumentos desde la raíz da `Ran 0 tests`).
- `frontend/README.md` describe brevemente el frontend de SADIM (React 19, TypeScript, Vite, service worker y Dexie) y remite al README raíz (A1, `1bf76fc`).

---

## 6. Variables de entorno (solo nombres)

`.env.example` no se abrió (las herramientas de lectura de `.env*` estaban bloqueadas por política). Los nombres se tomaron de `backend/core/settings.py` y `render.yaml`; el detalle completo está en `02b_backend.md §9`.

`SECRET_KEY` (obligatoria con `DEBUG=False` desde B1, `e57e7a6`), `DEBUG`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `DATABASE_URL`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `PORT` (lo inyecta Render; `Dockerfile`). No hay variables nuevas en el frontend.

---

## 7. Documentos de `docs/` con su versión y fecha declaradas

| Archivo | Versión declarada | Fecha declarada | Observación |
|---|---|---|---|
| `referencia/00_Anteproyecto_SADIM_v2.md` | v2 (solo en el nombre) | «2026» (sin día) | Incorporado al repo el 16/09/2026 (`db908c6`). Aún contiene Firebase, SQLite, «clases abstractas», etc. (ver 08) |
| `referencia/01_ADR_Arquitectura_SADIM.md` | sin número | «Sprint 1» | ADR-001..ADR-008 «Aceptado» |
| `referencia/02_ERD_SADIM_v3.md` | **Versión 3** | revisión cruzada 12/09/2026 (`:38`) | Vigente; HU-047 no trasladó aún D7/D8/P-xx |
| `referencia/03_Casos_de_Uso_SADIM.md` | sin número; CU-01..CU-23 | «Sprint 1 … 2026» | 23 CU |
| `referencia/04_Wireframes_SADIM_v2.md` | v2 (nombre) | «Sprint 1» | 7 pantallas de baja fidelidad; las imágenes NO están en el repo (solo los pies de figura) |
| `referencia/05_Contrato_API_SADIM.md` | **Versión 2** | 16/09/2026 (`:5`, `:12`) | P-01..P-07 «Aprobada» (commit `2952f4e`, 19/09) |
| `referencia/Backlog_Definitivo.md` | **v3** | 16/09/2026 (`:1`) | Estados congelados al 16/09: casi todo Sprint 3/4 figura «Pendiente» |
| `GUIA_CAMBIOS_DOCUMENTOS.md` | — | — | Guía de correcciones para HU-047 (referencia a ERD v2) |
| `INCONSISTENCIAS.md` | — | origen 11/09/2026 | INC-01..INC-28, VAC-01..07, IMP-01..12 |
| `TRAZABILIDAD.md` | — | 11/09/2026 (backlog v2) | Desactualizada frente al backlog v3 |
| `evidencias/sprint-2.md` | — | 16/09/2026 | 33 pruebas de Sprint 2 |
| `INFORME_ESTADO_SPRINT3.md` (raíz, no versionado) | — | 19/09/2026 | Estado previo a Sprint 3 |

**¿Hay versiones más nuevas que ERD v3, Contrato API v2, CU-01..CU-23, Wireframes v2, Backlog v3?** NO. No existe en el repo ningún ERD v4, Contrato v3, CU posterior, Wireframes v3 ni Backlog v4. Las decisiones posteriores a esas versiones (D9..D28; D25 se agregó a `CLAUDE.md` el 03/10) quedaron documentadas **únicamente en `CLAUDE.md`** («Invariantes de dominio» y «Estado del proyecto»), en los mensajes de commit y en comentarios del código. HU-047 («aplicar correcciones a ERD/CU/ADR/anteproyecto») sigue «En curso» (`Backlog_Definitivo.md:18`).

---

## Cambios respecto a la versión del 02/10

- Encabezado: actualizado a `7326a5a` (03/10/2026).
- §1 Árbol: `public/` con los íconos y el logo de SADIM; sin `src/assets/`; carpeta `utilidades/`; conteos de `api/`, `componentes/`, `contexto/` y `paginas/`; `frontend/README.md` propio; `CLAUDE.md` con D1..D28; esta carpeta no está versionada.
- §2: dependencias sin cambios (ni en los lotes 4–6 ni en la rama de correcciones). Los PNG se generaron con Pillow fuera del proyecto (informe 10, A1). Vitest cubre más carpetas. `App.css` creció a 1 196 líneas.
- §3: 59 de 61 commits con coautoría de Claude.
- §4: métricas recalculadas (217 archivos versionados; `src/` ≈ 8 110 líneas sin pruebas; 790 de pruebas Vitest; `finanzas` creció por D28); 61 commits; 16 nuevos del 03/10 con su grupo; rama `correcciones-pre-documentacion`.
- §5–§7: README del frontend, `SECRET_KEY` obligatoria, D25 en `CLAUDE.md` y decisiones hasta D28.
