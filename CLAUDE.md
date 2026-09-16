# SADIM — Instrucciones para Claude Code

SADIM es un proyecto de grado (Ingeniería de Sistemas y Computación, Universidad Antonio Nariño): una PWA offline-first para micro-comercios y negocios de servicios (ventas de mostrador, sesiones dinámicas de mesa, órdenes de trabajo, inventario y caja). Caso de validación: cafetería Aroma & Co. (Chapinero, Bogotá). Equipo: dos estudiantes; tutor como Scrum Master.

## Idioma y forma de trabajar
- Responde siempre en español, tono técnico pero claro, como a un compañero de tesis.
- El equipo no es experto en muchos temas: cuando algo sea nuevo o complejo, explícalo con palabras sencillas y un ejemplo concreto (idealmente de la cafetería) junto con el código.
- Antes de cambios que toquen más de un archivo, presenta un plan corto y espera aprobación.
- Si algo requiere información que no está en `docs/referencia/` ni en el código, dilo. No inventes requisitos, campos ni endpoints.

## Fuente de verdad
Documentos aprobados en `docs/referencia/` (no los modifiques; los actualiza el equipo):

| Documento | Úsalo para |
|---|---|
| `01_ADR_Arquitectura_SADIM.md` | Decisiones ADR-001..ADR-008 |
| `02_ERD_SADIM_v3.md` | Nombres exactos de entidades, campos, tipos, restricciones (§5, diccionario lógico) y reglas de negocio (§7, R-01..R-33). Versión 3: conserva la v2 y la precisa con las decisiones D-01..D-10 (§2) |
| `03_Casos_de_Uso_SADIM.md` | CU-01..CU-23: actores, flujos, excepciones, comportamiento offline |
| `04_Wireframes_SADIM_v2.md` | Referencia visual de pantallas/mockups de la PWA (contexto de interfaz, no especificación de API) |
| `05_Contrato_API_SADIM.md` | Rutas, métodos, roles y JSON exactos; formato de error (§14) |
| `Backlog_Definitivo.md` | HU-XXX, sprint, criterios de aceptación |
| `00_Anteproyecto_SADIM_v2.md` | Alcance, objetivos y exclusiones (contexto, no especificación técnica) |

También: `docs/INCONSISTENCIAS.md` (problemas conocidos, con ID), `docs/TRAZABILIDAD.md` (matriz HU ↔ CU) y `docs/GUIA_CAMBIOS_DOCUMENTOS.md` (correcciones definidas pero aún no aplicadas a los documentos).

**Contradicciones:** nunca las resuelvas en silencio. Si lo pedido o lo existente contradice un documento, detente, cita ambas fuentes (archivo + sección) y pregunta. Si ya está en `INCONSISTENCIAS.md`, menciona su ID; si está "Abierta", pregunta antes de implementar lo afectado; si tiene "Decisión", respétala.

## Decisiones cerradas (no cuestionar salvo petición explícita)
- Backend: Django + Django REST Framework, monolito modular (ADR-002). Módulos: Ventas, Inventario, Servicios, Finanzas.
- BD: PostgreSQL (ADR-001). SQLite solo opcional para pruebas locales.
- Frontend: PWA con React + TypeScript, Service Worker y IndexedDB (ADR-003).
- Offline-first: UUID generados en el cliente + `operation_id` único para idempotencia (ADR-004). Nada de "última escritura gana" en operaciones transaccionales.
- RBAC con roles `ADMIN` y `OPERADOR`; la autorización efectiva está en el backend (ADR-005).
- Módulos activables por configuración, sin carga dinámica de código (ADR-006).
- Una instalación = un negocio. Sin `tenant_id` ni `business_id` (ADR-007).
- `MovimientoCaja` es el detalle histórico; `CierreCaja` es solo resumen (ADR-008).
- Firebase NO forma parte de la arquitectura.

## Invariantes de dominio (las garantiza el backend, nunca el cliente)
- `stock_actual`, `total`, `subtotal`, `saldo_pendiente` y los totales de cierre se calculan SOLO en el backend. El cliente no los envía ni los edita.
- Agregar `DetalleVenta` no descuenta inventario; el descuento ocurre al CERRAR la venta.
- Venta CERRADA ⇒ exactamente un `MovimientoCaja` `INGRESO_VENTA` + las salidas de inventario.
- Abono confirmado ⇒ un `MovimientoCaja` `INGRESO_ABONO`. Abono > 0 y ≤ saldo pendiente.
- `ConsumoOrden` queda `PENDIENTE` hasta finalizar/entregar la orden; ahí genera `SALIDA_SERVICIO` y pasa a `APLICADO`.
- `SESION_DINAMICA` requiere `mesa_id`; una sola sesión `ABIERTA` por mesa; máximo 15 mesas activas.
- `MovimientoInventario` es histórico: no se edita; se corrige con un movimiento nuevo.
- `TRANSFERENCIA` y `QR` no se confirman sin conectividad; `EFECTIVO` sí puede registrarse offline.
- Toda operación que pueda originarse offline lleva `operation_id` UNIQUE; si llega repetido, el backend devuelve el resultado previo o `ALREADY_PROCESSED` sin repetir efectos.
- Operaciones con efectos en varias tablas (cerrar venta, abono, aplicar consumos, cierre de caja) van en una transacción atómica.
- Módulo desactivado ⇒ el backend rechaza sus operaciones aunque se invoque la ruta directamente.

## Convenciones de código
- Nombres de modelos, campos, valores ENUM y rutas EXACTAMENTE como en el ERD y el Contrato (en español, sin traducir): `OrdenTrabajo`, `saldo_pendiente`, `SESION_DINAMICA`, `/api/ordenes-trabajo/{id}/abonos/`.
- PK UUID en todas las entidades. Dinero con `DecimalField(max_digits=10, decimal_places=2)`, nunca `float`.
- Errores con el formato del Contrato §14: `{"code", "message", "details"}` y sus códigos HTTP.
- Lógica de negocio en una capa de servicios, no en views ni serializers (separación inspirada en Clean Architecture, ADR-002).
- Cada HU incluye pruebas de: camino feliz, al menos una excepción del CU, permisos por rol y, si aplica, idempotencia por `operation_id`.
- Reglas detalladas por tipo de archivo en `.claude/rules/` (se cargan solas al tocar modelos, API o frontend).

## Trazabilidad
- Todo trabajo se asocia a una HU; toda HU funcional a un CU-XX. Si falta alguna de las dos, avisa antes de empezar.
- Commits y resúmenes con formato: `feat(ventas): cerrar sesión dinámica [HU-018][CU-04]`.

## Estado del proyecto
- Sprint 2 (31/08–13/09/2026) cerrándose. HU-001..HU-012 están "En revisión" (terminadas, por revisar).
- Backlog v2: 48 HU, con columna de trazabilidad (CU / ADR / RN). HU nuevas: HU-041..HU-048.
- Los documentos de `docs/referencia/` aún NO tienen aplicadas las correcciones de `docs/GUIA_CAMBIOS_DOCUMENTOS.md` (HU-047). Si una tarea depende de una de esas correcciones, pregunta antes.
- Reglas de negocio: se citan como RN-01..RN-16 (numeración de ERD §5 definida en la guía, paso 1.11).
- Primer paso en este repo: `/auditar-sprint2` (solo lectura). No se construye nada de Sprint 3 hasta que el equipo revise ese informe.
- Orden sugerido al iniciar Sprint 3: HU-047 → HU-045 → HU-042 → HU-044 → HU-043 → resto.
- **Pendientes bloqueantes de Sprint 2** (auditoría 11/09/2026, detalle en `docs/INCONSISTENCIAS.md` sección D): sin commits/`.gitignore`/`requirements.txt` (IMP-10, primero); RBAC del catálogo abierto a cualquier autenticado (IMP-03); `/api/auth/register/` no existe (IMP-02); login devuelve `access`/`refresh` en vez de `access_token`/`refresh_token` (IMP-01); DELETE físico en vez de baja lógica (IMP-04); sin exception handler del Contrato §14 (IMP-07); sin pruebas (IMP-08); SQLite en vez de PostgreSQL (IMP-09). No repliques el patrón de `inventario/` (solo `IsAuthenticated`, sin tests) al construir `ventas`, `servicios` o `finanzas`.
- Skills disponibles: `/auditar-sprint2`, `/implementar-hu HU-XXX`, `/verificar-consistencia`. Subagente: `revisor-consistencia`.

## Comandos del proyecto
Actualizado el 11/09/2026: el repo se reorganizó en `backend/` (Django) y `frontend/` (Vite+React+TS) para encajar con el plan de commits del equipo. El `venv/` se queda en la raíz (no se movió).

- Activar entorno (Windows), desde la raíz: `venv\Scripts\activate`.
- Backend (Django, DRF, simplejwt, psycopg2-binary sobre PostgreSQL), rutas relativas a la raíz del repo:
  - Verificar proyecto: `python backend/manage.py check`
  - Ver estado de migraciones: `python backend/manage.py showmigrations`
  - Comprobar si faltan migraciones (no crea nada): `python backend/manage.py makemigrations --check --dry-run`
  - Ejecutar pruebas: `python backend/manage.py test usuarios inventario` (nombrar las apps explícitamente: sin argumentos, desde la raíz, Django reporta `Ran 0 tests` porque descubre a partir del directorio de trabajo actual, no de `BASE_DIR`; ver detalle en README.md §7). IMP-08 resuelto: 29 pruebas entre `usuarios` e `inventario`.
- Frontend (Vite + React + TypeScript, esqueleto inicial sin PWA/Service Worker todavía), desde `frontend/`:
  - Instalar dependencias: `npm install`
  - Servidor de desarrollo: `npm run dev`
  - Chequeo de tipos: `npx tsc --noEmit`
  - Lint: `npm run lint`
  - Build: `npm run build`
- `requirements.txt` en la raíz con las dependencias directas (`pip install -r requirements.txt`).
- `.env.example` en la raíz con las variables reales que lee `backend/core/settings.py` vía `python-dotenv` (única dependencia nueva agregada, aprobada para el cierre de Sprint 2): `SECRET_KEY`, `DEBUG`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`. `.env` (valores reales, no versionado) ya existe en la máquina de desarrollo.
- PostgreSQL 18 instalado como servicio de Windows (`postgresql-x64-18`), rol `sadim` con `CREATEDB` (permite crear la BD de pruebas) y base de datos `sadim_db`; migraciones de `usuarios` e `inventario` aplicadas. IMP-09 resuelto.
- `requirements.txt` en la raíz, solo dependencias directas: Django, djangorestframework, djangorestframework-simplejwt, psycopg2-binary, python-dotenv. IMP-10 (parte de requirements) resuelto.
- Sin linter/formateador de backend instalado (ruff/flake8/black): decidir si se agrega.

## Qué NO hacer
- No modificar `docs/referencia/`.
- No ejecutar `migrate`, `git commit` ni `git push` sin petición explícita.
- No leer ni imprimir `.env` ni secretos.
- No agregar dependencias sin explicar para qué sirven y pedir aprobación.
- No introducir Firebase, multi-tenancy, microservicios ni carga dinámica de módulos.
