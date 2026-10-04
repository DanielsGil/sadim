Actualizado al commit 49e6f17 (04/10/2026)

# 05 — Pruebas y calidad

---

## 1. Backend

### 1.1 Framework y comando (Windows, cmd)

- Framework: `django.test` (`TestCase` y `TransactionTestCase`) con `rest_framework.test.APIClient`. Sin pytest.
- Comandos (desde la raíz del repo, en `cmd`):

```
venv\Scripts\activate
python backend\manage.py test usuarios inventario core ventas finanzas servicios
```
o bien
```
cd backend
python manage.py test
```
(sin nombrar las apps y desde la raíz da `Ran 0 tests`, `README.md` §6).

### 1.2 Base de datos de pruebas

PostgreSQL: Django crea y destruye `test_sadim_db` con el rol de `.env` (requiere `CREATEDB`). No se usa SQLite. En pruebas el hasher es MD5, para que vayan más rápido (`backend/core/settings.py:236-237`).

### 1.3 Ejecución real (03/10/2026, PostgreSQL 18 local, commit `7326a5a`)

```
Found 194 test(s).
System check identified no issues (0 silenced).
Ran 194 tests in 12.428s
OK
Destroying test database for alias 'default'...
```
194 pasadas, 0 fallidas, 0 errores (antes 188; +6 de `VistaPreviaCierreTests`, commit `3072214`). `makemigrations --check --dry-run` → «No changes detected» (informe 10 §8).

### 1.4 Desglose por archivo

| Archivo | Pruebas | Clases | Qué cubre |
|---|---|---|---|
| `usuarios/tests.py` | 21 | `UsuarioModeloTests`, `RegistroInicialTests`, `LoginRefreshTests`, `UsuarioViewSetTests` | Sin cambios desde el 02/10 |
| `inventario/tests.py` | 41 | `RestriccionesBDTests`, `RBACTests`, `CatalogoTests`, `MovimientoInventarioAPITests`, `StockAPITests` | Sin cambios |
| `ventas/tests.py` | 34 | `MesaTests`, `MesaSinTransaccionImplicitaTests`, `VentaRapidaTests`, `SesionDinamicaTests`, `ConcurrenciaSesionesTests` | Sin cambios |
| `servicios/tests.py` | 32 | `RegistrarOrdenTests`, `DetalleOrdenTests`, `CambiarEstadoTests`, `AbonoTests`, `ConsumoOrdenTests`, `CostoOperativoTests`, `ModuloDesactivadoTests` | Sin cambios |
| `finanzas/tests.py` | **35** (29 + 6) | `GastoTests`, `ConfirmarTests`, `AnularTests`, `ResumenTests`, `CierreTests`, **`VistaPreviaCierreTests`** (`:398-475`), `ConcurrenciaCierreTests` | Lo anterior + vista previa (D28): coincide campo a campo con lo que guarda el cierre y no crea `CierreCaja`; montos como números JSON; OPERADOR → 403 `PERMISO_INSUFICIENTE`; módulo apagado → 403 `MODULO_DESACTIVADO`; sin movimientos → ceros; un pago pendiente no aparece; un gasto en efectivo baja `efectivo_esperado` pero no `por_medio_pago` |
| `core/tests.py` | 31 | `ConfiguracionModuloTests`, `ModuloActivoPermissionTests`, `ConfiguracionPagoTests`, `RegistroCreaConfiguracionTests`, `IdempotenciaTests`, `DispositivoAPITests`, `SincronizacionAPITests`, `NovedadSincronizacionAPITests` | Sin cambios |
| **Total** | **194** | | |

`SECRET_KEY` obligatoria (B1, `e57e7a6`) no tiene prueba automatizada: se verificó con comandos (`DEBUG=False` sin clave → `ImproperlyConfigured`; con clave → `check` sin problemas; `collectstatic` con `DEBUG=True` y clave vacía → funciona), según el informe 10 §1.

### 1.5 Cobertura

`coverage` **no está instalado** (`pip list`), así que no hay reporte de cobertura.

---

## 2. Frontend

| Herramienta | Estado | Conteo |
|---|---|---|
| Vitest 5.0.1 (`npm test`, entorno `node`) | Existe | **50 pruebas en 8 archivos** |
| Testing Library | NO ENCONTRADO | — |
| Playwright / Cypress (E2E) | NO ENCONTRADO | — |
| Pruebas de componentes/pantallas | NO ENCONTRADO (sin entorno DOM; por eso A4, la bandeja, F-21, F-22 y F-23 no tienen prueba de pantalla) | — |

Ejecución real (04/10/2026, `49e6f17`): `Test Files 8 passed (8) · Tests 50 passed (50) · Duration 381ms`.

| Archivo | Pruebas | Qué cubre | Origen |
|---|---|---|---|
| `src/sync/motor.test.ts` | 9 | Orden de envío; depuración APLICADA/DUPLICADA y paso de RECHAZADA/CONFLICTO a novedades (con aserción del estado real); `filaNovedadLocal` guarda CONFLICTO (`:130`); cola intacta ante 403 y 401; no sincroniza sin conexión; regla de ruteo (3 casos) | Bloque 5b + B5 (`1984aec`, +1) |
| `src/sync/enrutador.test.ts` | 9 | Órdenes (crear offline, estado en línea, abono encolado, transferencia nunca confirmada, cadena offline) y gastos (efectivo/QR offline, en línea, encolado con cola) | Bloque 5c |
| `src/contexto/inactividad.test.ts` | 14 | D27: cierre a los 30 min con aviso; la actividad reinicia; no cierra con cola y cierra al vaciarse; E-15 (actividad después de expirar reinicia la cuenta); no cierra sin conexión. F-19: no cierra si el servidor no responde; cierra cuando vuelve; la actividad durante la comprobación cancela el cierre sin comprobaciones dobles. F-20: con 10 min transcurridos cierra 20 min después; con la cuenta vencida aplica la regla de inmediato; `calcularInicioInactividad` (sin valor, < 30 min, ≥ 30 min, valor en el futuro) | E-11 (`e90e527`, 4) + E-15 (`6caa42a`, 1) + F-19 (`24e7c46`, 3) + F-20 (`7688cb7`, 6) |
| `src/api/salud.test.ts` | 3 | F-19: `servidorDisponible` hace `GET /api/health/` sin encabezados y con `cache: 'no-store'`, true solo con 200; false con 503 o error de red; false si no contesta en 5 s | F-19 (`24e7c46`) |
| `src/api/ventas.test.ts` | 2 | D19: `ventas.detalles` encolado lleva `precio_unitario` y en línea no; venta rápida encolada con precio por detalle, omitido si el producto no está en la copia local | B3 (`20907da`) |
| `src/sync/vistaLocalMesas.test.ts` | 3 | Mapa de mesas local: cuenta abierta offline ocupa la mesa; precio del dispositivo, quitar línea y cobro sobre la copia del servidor; mesas inactivas ocultas | B4 (`5f89fad`) |
| `src/utilidades/formato.test.ts` | 7 | Moneda COP (enteros, decimales, texto no numérico), fecha y hora de Bogotá, hora UTC que cambia de día, fecha sin hora que no se corre, `fechaHoyBogota` a las 21:00 de Bogotá | A2 (`b31ccc0`) |
| `src/utilidades/etiquetas.test.ts` | 3 | Etiqueta «Anulado», ajuste manual según el sentido, recurso desconocido tal cual | A6/A7 (`1cf8502`, `e1f2ba3`) |
| **Total** | **50** | | antes 17 |

Evolución: 17 (02/10) → 21 (E-11) → 22 (E-15) → 38 (rama de correcciones: +7 formato, +3 etiquetas, +1 novedades, +2 precio, +3 mapa local) → 50 (rama `correcciones-sesion-y-cierre`: +6 F-19, +6 F-20).

Otras verificaciones (informe 11 §4, 04/10/2026, `49e6f17`): `npx tsc -b` sin errores; `npm run lint` con 0 errores y las mismas 12 advertencias previas que en `7326a5a` (`react(set-state-in-effect)` y una `only-export-components`); `npm run build` correcto (precache de 16 entradas, 545.55 KiB). Backend: 194 pruebas en verde, sin cambios.

---

## 3. Pruebas por tema transversal

| Tema | Pruebas (archivo:clase.método) |
|---|---|
| Idempotencia (`operation_id`) | Igual que el 02/10: `core` `IdempotenciaTests` (3); `inventario` (4); `ventas` (2); `servicios` (2); sync `test_reenvio_del_mismo_lote_devuelve_duplicada` |
| Conflictos de sincronización | Igual que el 02/10 (`core/tests.py::SincronizacionAPITests`, 8 escenarios) + frontend `motor.test.ts` (403/401 y estado real de la novedad) |
| Módulo desactivado | Lo del 02/10 + `finanzas` `VistaPreviaCierreTests.test_modulo_finanzas_desactivado_responde_403` (primera prueba HTTP de módulo desactivado en `finanzas`) |
| Permisos por rol | Lo del 02/10 + `VistaPreviaCierreTests.test_operador_recibe_403` |
| Concurrencia real | `core` `IdempotenciaTests`, `ventas` `ConcurrenciaSesionesTests`, `finanzas` `ConcurrenciaCierreTests` (sigue en verde tras extraer `calcular_totales_cierre`) |
| Cálculo compartido del cierre | `VistaPreviaCierreTests.test_vista_previa_coincide_con_lo_que_guarda_el_cierre` |
| Offline en el cliente | `motor.test.ts`, `enrutador.test.ts`, `vistaLocalMesas.test.ts`, `api/ventas.test.ts` |
| Sesión e inactividad (D21/D27) | `inactividad.test.ts` (14) y `salud.test.ts` (3): incluye servidor que no responde (F-19) y cuenta guardada entre aperturas (F-20). D21 en `SesionContext` sigue **sin** prueba automatizada |

---

## 4. Validación funcional y con usuarios

| Evidencia | Estado |
|---|---|
| HU-037 (validación en entorno real con Aroma & Co.): actas, checklists, resultados | **NO ENCONTRADO** en el repo |
| HU-038 (retroalimentación y ajustes) | **NO ENCONTRADO**. Los lotes E-01…E-19 (27/09 y 03/10) son ajustes de interfaz; el repo no dice de dónde salió la retroalimentación |
| Evidencia de Sprint 2 | `docs/evidencias/sprint-2.md` |
| Evidencias de Sprints 3–4 | Solo mensajes de commit, `CLAUDE.md` y esta carpeta (que **no** está versionada, informe 10 §6.9) |
| Pruebas manuales en navegador / capturas | NO ENCONTRADO. El informe 10 §5 deja una lista de 8 verificaciones manuales sin ejecutar |
| Prueba de la imagen Docker | No se pudo construir localmente (Docker no instalado, commit `ef5d035`) |

---

## 5. Auditorías Lighthouse o accesibilidad

NO ENCONTRADO (sin reportes, sin `lighthouserc`, sin `axe`). Observaciones visibles en el código: los campos usan `<label htmlFor>`; errores con `role="alert"`; contador con `aria-label`; diálogo de salida de la mesa con `role="alertdialog"`; desde A1, `<html lang="es">`. Los íconos de navegación siguen siendo emojis (con `aria-hidden`).

---

## 6. Bugs conocidos y deuda técnica

### 6.1 Marcadores en el código

`TODO`, `FIXME`, `XXX`: **ninguno** en `backend/` ni `frontend/src/`.

### 6.2 Documentados en el repo

| Origen | Contenido |
|---|---|
| `docs/INCONSISTENCIAS.md` | Sin actualizar desde Sprint 2 |
| Backlog v3, «Decisiones pendientes» | «Capacidad y MVP», «Calendario», «Documento de requerimientos» siguen «Abierta» |
| Commit `8910c90` | E-06 no cubrió errores por campo en Caja ni Dispositivos (el cierre ahora vive en `PanelCierreCaja.tsx`, tampoco usa errores por campo) |
| Informe 10 §6 | Precache con entradas repetidas; 12 advertencias de lint; detección de «sin red» por `TypeError` en el login; resumen frente a vista previa; carpeta no versionada |
| `CLAUDE.md` | Sin linter/formateador de backend; HU-047 en curso |

### 6.3 Defectos: estado de los hallazgos F-x

| ID | Severidad (estimada) | Descripción | Estado en `49e6f17` | Commit / evidencia |
|---|---|---|---|---|
| F-1 | Alta | El mapa de mesas no cargaba sin conexión | **Corregido** | `5f89fad` (B4); prueba `vistaLocalMesas.test.ts` |
| F-2 | Media | El catálogo no se puede editar sin conexión (no usa la cola) | **Abierto** | `frontend/src/api/catalogo.ts` |
| F-3 | Media | El mensaje de D21 en el login se reemplazaba por «No se pudo iniciar sesión.» | **Corregido** | `dca9f68` (A4); sin prueba automatizada |
| F-4 | Baja | El mensaje de éxito del cierre no se veía | **Corregido** | `3072214` (A5) |
| F-5 | Media | Fecha por defecto del cierre en UTC | **Corregido** | `3072214` (A5); prueba de `fechaHoyBogota` en `formato.test.ts` |
| F-6 | Baja | Estado ANULADO del abono sin etiqueta | **Corregido** | `1cf8502` (A6); `etiquetas.test.ts` |
| F-8 | Baja | El cobro de la mesa se llamaba «Cerrar sesión» | **Corregido** | `d8bc4bb` (A3) y `7326a5a` (dos textos restantes) |
| F-9 | Media | El frontend no enviaba `precio_unitario` en la cola | **Corregido** | `20907da` (B3); `api/ventas.test.ts` |
| F-10 | Media | El SW respondía `/admin/` con la app | **Corregido** | `fc6c598` (B2); verificado en `dist/sw.js` |
| F-11 | Baja | Novedades locales siempre como `RECHAZADA` | **Corregido** | `1984aec` (B5); `motor.test.ts:130` |
| F-12 | Media | `crypto.randomUUID()` falla fuera de HTTPS/localhost | **Abierto** | `frontend/src/db/baseLocal.ts:107` |
| F-13 | Media | Sin `SECRET_KEY` en producción se usaba la clave de desarrollo | **Corregido** | `e57e7a6` (B1); `backend/core/settings.py:37-49` |
| F-14 | Baja | `saldo_pendiente` del abono y `details` de stock como texto | **Abierto** | `backend/servicios/views.py:130` |
| F-15 | Baja | Enums sin CHECK en PostgreSQL (solo `rol`) | **Abierto** | `02a §2.18` |
| F-16 | Baja | Identidad visual del template de Vite | **Corregido** | `1bf76fc` (A1) y `7326a5a` (borra `icons.svg`) |
| F-17 | Baja | Montos sin formato COP y fechas ISO | **Corregido** | `b31ccc0` (A2); `formato.test.ts` |
| F-18 | Info | Sin CI | **Abierto** | sin `.github/` |
| F-19 | Media | D27 cerraba la sesión con `navigator.onLine`, sin comprobar el servidor: con wifi sin internet o el servicio dormido, el usuario podía quedar sin poder volver a entrar | **Corregido** | `24e7c46`; `frontend/src/api/salud.ts`; `inactividad.test.ts` (3) y `salud.test.ts` (3) |
| F-20 | Baja | La inactividad no se guardaba entre aperturas de la app | **Corregido** | `7688cb7`; `meta.ultima_actividad`; `inactividad.test.ts` (6) |
| F-21 | Baja | La pestaña «Cierre» no mostraba `por_medio_pago` ni `cantidad_movimientos` de la vista previa | **Corregido** | `f1c58f2`; `PanelCierreCaja.tsx:183-191`; sin prueba automatizada (informe 11 §5, prueba 8) |
| F-22 | Baja | «Fecha» en la pestaña «Cierre» parecía un filtro de la vista previa y compartía estado con el resumen | **Corregido** | `d782bbd`; `PanelCierreCaja.tsx:213-223`; sin prueba automatizada (informe 11 §5, prueba 8) |
| F-23 | Baja | El diálogo de salida de la mesa decía que la bandeja se descartaba; con el gesto «atrás» se conservaba | **Corregido** | `49e6f17`; `DetalleSesion.tsx:506-531`; sin prueba automatizada (informe 11 §5, prueba 10) |

(F-7 de `04a` era el mismo hallazgo que F-17.)

---

## Cambios respecto a la versión del 03/10 (`7326a5a`)

- §2: 50 pruebas Vitest en 8 archivos (antes 38 en 7): `inactividad.test.ts` pasa de 5 a 14 y se agrega `salud.test.ts` (3); ejecución, lint y build del informe 11.
- §3: sesión e inactividad con F-19 y F-20.
- §6.3: F-19…F-23 corregidos, con su commit y su prueba (o la prueba manual que los cubre). Quedan abiertos F-2, F-12, F-14, F-15 y F-18.

## Cambios respecto a la versión del 02/10

- §1.3–§1.4: 194 pruebas de backend (antes 188), +6 en `finanzas` (`VistaPreviaCierreTests`); ejecución repetida hoy en verde. Nota sobre B1, verificado sin prueba automatizada.
- §2: 38 pruebas Vitest en 7 archivos (antes 17 en 2), con el origen de cada archivo y la evolución 17 → 21 → 22 → 38; lint, tipos y build del informe 10.
- §3: temas nuevos (cálculo compartido del cierre, sesión e inactividad); primera prueba de módulo desactivado en `finanzas`.
- §4: lotes E-10…E-19 sin origen documentado; lista manual del informe 10 pendiente.
- §5: `lang="es"`.
- §6.3: estado de cada F-x con su commit (12 corregidos, 5 abiertos, 5 nuevos).
