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
- Toda operación que pueda originarse offline lleva `operation_id` UNIQUE; si llega repetido, el backend devuelve el resultado previo (mismo código HTTP; en éxito, el estado actual del objeto; en error, el mismo error) sin repetir efectos. Mecanismo genérico implementado en `backend/core/idempotencia.py` (HU-045, Bloque 1 de Sprint 3): toda escritura en línea con `operation_id` queda registrada en `OperacionSincronizacion` en la misma transacción que sus efectos.
- Operaciones con efectos en varias tablas (cerrar venta, abono, aplicar consumos, cierre de caja) van en una transacción atómica.
- Módulo desactivado ⇒ el backend rechaza sus operaciones aunque se invoque la ruta directamente. Mecanismo genérico: `core.permissions.ModuloActivoPermission` + un ViewSet solo declara `modulo = "ventas"|"inventario"|"servicios"|"finanzas"` (HU-042). El catálogo y las rutas del núcleo (auth, usuarios, dispositivos, categorías, productos, configuración) no dependen de ninguna bandera.
- D9: `ConfiguracionModulo` y `ConfiguracionPago` (fila única cada una) se crean en la misma transacción que el registro del primer ADMIN (`/api/auth/register/`), con `actualizado_por_id` = ese ADMIN. `ConfiguracionPago` nace solo con efectivo (`acepta_transferencia = acepta_qr = false`): los valores por defecto true/true/true del ERD violarían de inmediato su propio CHECK de `nequi_llave`. Para una BD que ya tenga ADMIN, una migración de datos (`core/migrations/0002_backfill_configuracion.py`) crea las filas si faltan.
- D10: `TIME_ZONE = 'America/Bogota'` (`USE_TZ` sigue en `True`): el Contrato devuelve fechas con `-05:00` y los resúmenes diarios y el cierre de caja dependen del día local.
- D11: `DELETE /api/ventas/{id}/detalles/{detalle_id}/` borra la línea físicamente, y solo si la venta sigue `ABIERTA` (sobre `CERRADA`/`CANCELADA` → 409 `VENTA_YA_CERRADA`). Es la ÚNICA excepción a "nada se borra físicamente" (D7): la línea nunca generó efectos. `operation_id` es opcional en el cuerpo de la petición; si no llega, lo genera el servidor.
- D12: cerrar una venta/sesión valida existencias de TODOS los productos con `controla_stock = true` antes de aplicar cualquier efecto (R-19); si alguna falta, responde 409 `STOCK_INSUFICIENTE` con el detalle de los productos, sin registrar nada, y la venta sigue `ABIERTA` (la mesa sigue `OCUPADA`).
- D13: se agrega `GET /api/ordenes-trabajo/{id}/` (ADMIN y OPERADOR, Bloque 3). No está en el Contrato original, pero el wireframe 5 necesita el detalle de una orden con `saldo_pendiente` y su lista de abonos (`valor`, `medio_pago`, `estado_pago`, `fecha`, `observacion`); al ADMIN también `utilidad_neta`. Los consumos siguen consultándose en su propio GET.
- D14 (Bloque 4, cierra R-22/R-25): el cierre de caja consolida los `MovimientoCaja` `CONFIRMADO` con `cierre_caja_id` nulo cuya fecha sea ≤ `periodo_fin` — el criterio es "no incluido en ningún cierre todavía", no un rango fijo de fechas: un pago confirmado después de su fecha entra en el siguiente cierre. `periodo_inicio` es el `periodo_fin` del último cierre, o la fecha del primer movimiento si no hay cierres previos; `periodo_fin` es el momento del POST. `fecha` (contable, la declara el ADMIN) es UNIQUE en `CierreCaja`; dos cierres para la misma fecha responden 409 `CIERRE_YA_REALIZADO` (código nuevo, no está en el Contrato — necesario para proteger esa UNIQUE). `select_for_update()` sobre los movimientos a consolidar evita que dos cierres simultáneos tomen el mismo movimiento dos veces.
- D15 (Bloque 4, "pago electrónico que nunca llega"): `PATCH /api/movimientos-caja/{id}/anular/`, solo ADMIN y con `motivo` obligatorio. Solo aplica sobre `PENDIENTE_VERIFICACION` (si no, 409 `PAGO_YA_CONFIRMADO`). Agrega `ANULADO` al enum `estado_pago` de `MovimientoCaja`, `Venta` y `Abono`. Un `ANULADO` no entra a ningún cierre ni al resumen. Al anular un abono, su valor vuelve al `saldo_pendiente` de la orden. **No se revierte inventario** (la mercancía ya salió) — desviación intencional del ERD. `MovimientoCaja.motivo_anulacion` es un campo nuevo, no está en el ERD; se necesita para guardar el motivo exigido por esta decisión.

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
- Sprint 2 cerrado y fusionado a `main` (fast-forward, 20/09/2026). HU-001..HU-012 terminadas; 33 pruebas de Sprint 2 en verde sobre PostgreSQL.
- Sprint 3, Bloque 1 ("base transversal") hecho sobre `main`: HU-045 (idempotencia genérica por `operation_id`), HU-042 (config. de módulos + bloqueo `MODULO_DESACTIVADO`), HU-049 (config. de pagos) y HU-044 (CRUD de usuarios) implementadas y probadas. Detalle y desviaciones reportadas en el commit `feat(sprint-3): bloque 1 - idempotencia, módulos, pagos, usuarios`.
- Sprint 3, Bloque 2 ("Ventas y Mesas") hecho sobre `main`: HU-043 (mesas), HU-012/HU-013 (venta rápida con selector de productos), HU-014 (medio de pago), HU-015 (descuento de inventario al cerrar), HU-016..HU-019 (abrir/agregar/cerrar/una sesión por mesa) y HU-048 (cancelar sesión) implementadas y probadas; se adelantó del Sprint 4 la parte de ENTRADA de HU-025 (`POST /api/inventario/movimientos/`, ambos roles) porque sin ella ningún producto con `controla_stock = true` tenía existencias. Nuevos modelos: `ventas.Mesa`, `ventas.Venta`, `ventas.DetalleVenta`, `inventario.MovimientoInventario`, `finanzas.MovimientoCaja`. 91 pruebas backend en verde sobre PostgreSQL (58 de antes + 33 nuevas); frontend con `npx tsc --noEmit`, `npm run lint` y `npm run build` en verde (pantallas Ventas, Mesas, Detalle de sesión e Ingreso de mercancía). Detalle y desviaciones en el commit `feat(sprint-3): bloque 2 - ventas, mesas y sesiones`.
- Sprint 3, Bloque 3 ("Órdenes de trabajo") hecho sobre `main`: HU-020 (registrar orden), HU-021 (cambiar estado, entrega atómica con `select_for_update`), HU-022 (abonos), HU-041 (consumos) y HU-023 (costos operativos y utilidad neta, solo ADMIN) implementadas y probadas, más D13 (`GET /api/ordenes-trabajo/{id}/`). Nuevos modelos en `servicios`: `OrdenTrabajo`, `Abono`, `ConsumoOrden`, `CostoOperativoOrden`. Se cierran las FK `MovimientoInventario.consumo_orden_id` y `MovimientoCaja.abono_id`. 123 pruebas backend en verde sobre PostgreSQL (91 de antes + 32 nuevas). Detalle y desviaciones en el commit `feat(sprint-3): bloque 3 - órdenes de trabajo`.
- Sprint 4, Bloque 4 ("Inventario y Caja en línea") hecho sobre `main`: HU-024 (consulta de stock), HU-026 (MERMA/AJUSTE_MANUAL, solo ADMIN), HU-029 (gastos), HU-050 (confirmar pagos electrónicos), HU-027 (resumen del día) y HU-028 (cierre de caja) implementadas y probadas, más D14 y D15. Nuevo modelo `finanzas.CierreCaja` (ERD §5.16); se cierra la última FK pendiente, `MovimientoCaja.cierre_caja_id`. 163 pruebas backend en verde sobre PostgreSQL (123 de antes + 40 nuevas, en `inventario` y la nueva `finanzas.tests`, incluida concurrencia real de dos cierres simultáneos); frontend con `npx tsc --noEmit`, `npm run lint` y `npm run build` en verde (pantallas Inventario, Caja y Cierre de caja — esta última solo ADMIN). Detalle y desviaciones en el commit `feat(sprint-4): bloque 4 - inventario y caja`.
- Backlog vigente en el repo: `docs/referencia/Backlog_Definitivo.md` v3 (incluye HU-047, HU-006 y HU-049; no tiene HU-050..HU-052 con ese detalle en la v3 exportada). Contrato API vigente: `docs/referencia/05_Contrato_API_SADIM.md`, ya en "Versión 2" con D1-D8, C-01..C-09 y P-01..P-07, todas "Aprobada".
- HU-047 (aplicar correcciones de consistencia a ERD/Contrato/CU/ADR/anteproyecto) sigue "En curso": el Contrato v2 ya corrige varias cosas en su propio texto (sección 17), pero esos ajustes no se han trasladado todavía al ERD v3 ni a los Casos de Uso.
- Los Bloques 1 a 4 se ejecutaron bajo un modo de trabajo puntual que el usuario autorizó solo para cada bloque (sin plan previo, sin actualizar `INCONSISTENCIAS.md`/`TRAZABILIDAD.md`, un solo commit final, migraciones y push a `main` autorizados de antemano). No es el modo por defecto: para lo que sigue rigen de nuevo las reglas de este documento salvo que el usuario indique lo contrario otra vez.
- Orden sugerido para lo que sigue: HU-047 (correcciones de consistencia todavía pendientes de trasladarse al ERD/CU); resto de Sprint 4 (sincronización offline/dispositivos, HU-051, Service Worker HU-033) y del backlog v3.
- Skills disponibles: `/auditar-sprint2`, `/implementar-hu HU-XXX`, `/verificar-consistencia`. Subagente: `revisor-consistencia`.

## Comandos del proyecto
Actualizado el 11/09/2026: el repo se reorganizó en `backend/` (Django) y `frontend/` (Vite+React+TS) para encajar con el plan de commits del equipo. El `venv/` se queda en la raíz (no se movió).

- Activar entorno (Windows), desde la raíz: `venv\Scripts\activate`.
- Backend (Django, DRF, simplejwt, psycopg2-binary sobre PostgreSQL), rutas relativas a la raíz del repo:
  - Verificar proyecto: `python backend/manage.py check`
  - Ver estado de migraciones: `python backend/manage.py showmigrations`
  - Comprobar si faltan migraciones (no crea nada): `python backend/manage.py makemigrations --check --dry-run`
  - Ejecutar pruebas: `python backend/manage.py test usuarios inventario core ventas finanzas servicios` desde la raíz, o `cd backend && python manage.py test` sin argumentos (ambas formas verificadas). Sin nombrar apps y desde la raíz, Django reporta `Ran 0 tests` porque descubre a partir del directorio de trabajo actual, no de `BASE_DIR`; ver detalle en README.md §7. IMP-08 resuelto: 163 pruebas entre `usuarios`, `inventario`, `core`, `ventas`, `servicios` y `finanzas` (Bloque 1 agregó `core` con HU-042/045/049, más HU-044 en `usuarios` y P-07 en `inventario`; Bloque 2 agregó `ventas.tests`; Bloque 3 agregó `servicios.tests`; Bloque 4 agregó `finanzas.tests` con HU-029/050/027/028, incluida concurrencia real de cierres, y sumó pruebas de MERMA/AJUSTE_MANUAL/stock en `inventario`).
- Frontend (Vite + React + TypeScript; sin Service Worker todavía, HU-033/Sprint 4), desde `frontend/`:
  - Instalar dependencias: `npm install`
  - Servidor de desarrollo: `npm run dev` (con el backend corriendo en :8000; el proxy de Vite redirige `/api/*`, sin CORS en el backend)
  - Chequeo de tipos: `npx tsc --noEmit`
  - Lint: `npm run lint`
  - Build: `npm run build`
  - Dependencias nuevas (cierre de Sprint 2, frontend): `dexie` (persistencia local, ERD D-09; solo el almacén `meta` implementado, sesión) y `react-router-dom` (rutas y navegación). La sesión vive únicamente en IndexedDB vía Dexie, nunca en `localStorage`.
  - Dependencia nueva (Bloque 2 de Sprint 3): `uuid`, solo para generar `operation_id` (y los ids de recursos creados en el cliente) en las pantallas de Ventas/Mesas/Inventario — `crypto.randomUUID()` no existe fuera de HTTPS o `localhost` (por ejemplo al probar desde el celular por la red local), así que reemplaza a `crypto.randomUUID()` únicamente en ese código nuevo.
  - HU-008 (login/logout), HU-011 (Catálogo, solo ADMIN), HU-044 (Usuarios, solo ADMIN) y HU-042/HU-049 (Configuración, solo ADMIN) implementadas desde Sprint 2/Bloque 1. Bloque 2 agregó, para ambos roles: Ventas (mapa de mesas y venta rápida, HU-012..HU-014), Detalle de sesión (HU-016..HU-019, HU-048) e Ingreso de mercancía (HU-025 adelantado); Mesas (HU-043) es solo ADMIN. Bloque 3 agregó Órdenes y Detalle de orden (HU-020..HU-023, HU-041) para ambos roles; la sección de costos operativos dentro del detalle es solo ADMIN. Bloque 4 agregó, para ambos roles: Inventario (existencias, alerta de stock mínimo, historial y ajuste MERMA/AJUSTE_MANUAL solo ADMIN, HU-024/HU-026) y Caja (registrar gasto y confirmar pagos pendientes, con anular solo ADMIN, HU-029/HU-050); Cierre de caja (resumen del día y arqueo, HU-027/HU-028) es solo ADMIN.
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
