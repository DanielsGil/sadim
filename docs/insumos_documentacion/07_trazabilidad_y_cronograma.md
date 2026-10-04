Actualizado al commit 49e6f17 (04/10/2026)

# 07 — Trazabilidad y cronograma

> Estados usados: **IMPLEMENTADO Y PROBADO** (código + prueba automatizada que lo ejercita), **IMPLEMENTADO SIN PRUEBA**, **PARCIAL**, **NO IMPLEMENTADO**, **DIFERENTE AL DISEÑO**.
> Pruebas: `backend/<app>/tests.py::Clase` o `frontend/src/<carpeta>/<archivo>.test.ts`. Pantallas: IDs de `04a` (P-11 quedó integrada en P-10; P-12/P-13 son pestañas de Caja).

---

## 1. Matriz CU → HU → endpoint → pantalla → prueba → estado

| CU | HU | Endpoint(s) | Pantalla(s) | Prueba(s) | Estado |
|---|---|---|---|---|---|
| CU-01 Venta rápida | HU-012, HU-013, HU-014, HU-015, HU-050 | `POST /api/ventas/` (RAPIDA) | P-04, P-05 | `ventas::VentaRapidaTests` (8); `api/ventas.test.ts` (precio del dispositivo en la cola, D19) | IMPLEMENTADO Y PROBADO. Diferencia: no muestra comprobante/resumen tras registrar (CU-01 paso 8). Interfaz con bandeja de selección y botón «Cobrar» (E-12) |
| CU-02 Abrir sesión | HU-016, HU-019, HU-043 | `POST /api/ventas/` (SESION_DINAMICA), `GET /api/mesas/`, `GET /api/ventas/` | P-04, P-06 | `ventas::SesionDinamicaTests`, `ConcurrenciaSesionesTests`; `vistaLocalMesas.test.ts` (mapa sin conexión) | IMPLEMENTADO Y PROBADO; **DIFERENTE AL DISEÑO** en interfaz (D26: la cuenta se abre al agregar el primer producto, ahora con «Agregar a la mesa» desde la bandeja, E-12). Offline completo desde `5f89fad` (F-1 corregido) |
| CU-03 Consumo en sesión | HU-017, HU-012 | `POST/DELETE /api/ventas/{id}/detalles/…` | P-06 | `ventas::SesionDinamicaTests` (agregar/quitar, D24) | IMPLEMENTADO Y PROBADO. La interfaz envía una petición por producto de la bandeja y agrupa en pantalla las líneas del mismo producto (E-10/E-12) |
| CU-04 Cerrar y cobrar / cancelar | HU-018, HU-048, HU-014, HU-015, HU-050 | `PATCH /api/ventas/{id}/cerrar/`, `…/cancelar/` | P-06 | `ventas::SesionDinamicaTests`; sync `test_sesion_completa_offline…`, `test_stock_insuficiente_al_cerrar…` | IMPLEMENTADO Y PROBADO |
| CU-05 Catálogo | HU-010, HU-011 | `/api/categorias/`, `/api/productos/` | P-15 | `inventario::CatalogoTests`, `RBACTests`, `RestriccionesBDTests` | IMPLEMENTADO Y PROBADO en línea; PARCIAL offline (F-2) |
| CU-06 Registrar pedido | HU-020 | `POST /api/ordenes-trabajo/` | P-07, P-08 | `servicios::RegistrarOrdenTests` | IMPLEMENTADO Y PROBADO (abono inicial se hace después, en el detalle) |
| CU-07 Estado de la orden | HU-021 | `PATCH /api/ordenes-trabajo/{id}/estado/` | P-09 | `servicios::CambiarEstadoTests` | IMPLEMENTADO Y PROBADO |
| CU-08 Abono | HU-022, HU-050 | `POST …/abonos/` | P-09 | `servicios::AbonoTests`; `finanzas::ConfirmarTests`, `AnularTests` | IMPLEMENTADO Y PROBADO |
| CU-09 Consumo en orden | HU-041 | `GET/POST …/consumos/` | P-09 | `servicios::ConsumoOrdenTests`, `CambiarEstadoTests.test_entrega_*` | IMPLEMENTADO Y PROBADO |
| CU-10 Costos y utilidad | HU-023 | `GET/POST …/costos/` | P-09 (sección ADMIN) | `servicios::CostoOperativoTests` | IMPLEMENTADO Y PROBADO |
| CU-11 Consultar stock | HU-024 | `GET /api/inventario/stock/` | P-10 | `inventario::StockAPITests` | IMPLEMENTADO Y PROBADO |
| CU-12 Ingreso de mercancía | HU-025 | `POST /api/inventario/movimientos/` (ENTRADA), `GET …?producto=` | P-10 (pestaña «Ingreso»; P-11 integrada, E-13) | `inventario::MovimientoInventarioAPITests` | IMPLEMENTADO Y PROBADO |
| CU-13 Ajuste manual | HU-026 | `POST /api/inventario/movimientos/` (MERMA/AJUSTE_MANUAL) | P-10 | `inventario::MovimientoInventarioAPITests` | IMPLEMENTADO Y PROBADO |
| CU-14 Gasto | HU-029, HU-050 | `POST /api/movimientos-caja/` | P-12 (pestaña «Gastos») | `finanzas::GastoTests`; `enrutador.test.ts` (gastos) | IMPLEMENTADO Y PROBADO. Diferencia: la interfaz no pide «fecha» (usa la del servidor/dispositivo) ni ofrece «Caso extra» |
| CU-15 Cierre de caja | HU-028 | `POST/GET /api/cierres-caja/`, `GET /api/cierres-caja/vista-previa/` (D28) | P-13 (pestaña «Cierre» de Caja) | `finanzas::CierreTests`, `VistaPreviaCierreTests` (6), `ConcurrenciaCierreTests`; sync `test_venta_sincronizada_con_fecha_de_periodo_ya_cerrado…` | IMPLEMENTADO Y PROBADO; **DIFERENTE AL DISEÑO**: E-05 lo valida solo el frontend con la cola local; R-25 (`MOVIMIENTO_EN_PERIODO_CERRADO`) reemplazado por D14/D18; los totales por medio de pago no se guardan en `CierreCaja` ni se muestran en la pestaña (F-21). Desde A5 hay vista previa del servidor y lista de cierres anteriores (F-4/F-5 corregidos) |
| CU-16 Configurar módulos | HU-042 | `GET/PATCH /api/configuracion/modulos/` | P-18 | `core::ConfiguracionModuloTests`, `ModuloActivoPermissionTests`; sync `test_modulo_desactivado…` | IMPLEMENTADO Y PROBADO |
| CU-17 Iniciar sesión | HU-008, HU-046 | `POST /api/auth/login/`, `…/refresh/`, `…/register/` | P-01, P-02 | `usuarios::LoginRefreshTests`, `RegistroInicialTests`; `motor.test.ts` (401); `inactividad.test.ts` (D27, 5) | Login en línea: IMPLEMENTADO Y PROBADO; mensajes por causa (A4). Continuar offline (HU-046): IMPLEMENTADO SIN PRUEBA. Cierre por inactividad (D27): IMPLEMENTADO Y PROBADO en su lógica, **no está en CU-17** (decisión posterior; riesgo F-19, `03 §9`) |
| CU-18 Usuarios | HU-044 | `/api/usuarios/` | P-17 | `usuarios::UsuarioViewSetTests` | IMPLEMENTADO Y PROBADO |
| CU-19 Mesas | HU-043 | `/api/mesas/` | P-16 | `ventas::MesaTests`, `MesaSinTransaccionImplicitaTests` | IMPLEMENTADO Y PROBADO |
| CU-20 Resumen diario | HU-027 | `GET /api/movimientos-caja/resumen/` | P-13 (pestaña «Resumen del día» de Caja, solo ADMIN) | `finanzas::ResumenTests` | IMPLEMENTADO Y PROBADO. Desde A5 la pantalla muestra también Transferencia y QR |
| CU-21 Dispositivos | HU-051 | `/api/dispositivos/` | P-19 | `core::DispositivoAPITests` | IMPLEMENTADO Y PROBADO (sin opción `es_caja` en la interfaz) |
| CU-22 Medios de pago | HU-049 | `GET/PATCH /api/configuracion/pagos/` | P-18 | `core::ConfiguracionPagoTests` | IMPLEMENTADO Y PROBADO |
| CU-23 Novedades | HU-052 | `GET/PATCH /api/sync/novedades/` | P-14 | `core::NovedadSincronizacionAPITests`, `motor.test.ts` (incluido el estado real, B5) | IMPLEMENTADO Y PROBADO; recursos con nombres legibles (A7) |

---

## 2. Estado final del backlog

Versión más reciente en el repo: **Backlog v3 (16/09/2026)**. Sus estados quedaron congelados a esa fecha (casi todo Sprint 3–4 figura «Pendiente»). La columna «Estado real» se deduce del código, las pruebas y los commits.

| HU | Sprint (backlog) | Estado en backlog v3 | Estado real | Evidencia |
|---|---|---|---|---|
| HU-001 ADR | 1 | Terminada | Terminada | `docs/referencia/01_ADR…` |
| HU-002 ERD | 1 | Terminada | Terminada (v3) | `02_ERD_SADIM_v3.md` |
| HU-003 CU | 1 | Terminada | Terminada | `03_Casos_de_Uso…` |
| HU-004 Wireframes | 1 | Terminada | Terminada como texto; **imágenes y Figma no están en el repo** | `04_Wireframes_SADIM_v2.md` |
| HU-005 Contrato | 1 | Terminada | Terminada (v2) | `05_Contrato_API…` |
| HU-006 Firebase vs Django | 3 | En curso | **No terminada**: el anteproyecto aún menciona Firebase/SQLite | `00_Anteproyecto…:299`, `:447` |
| HU-007 Repo y Jira | 2 | Terminada | Terminada (Jira no verificable) | commits 11–16/09 |
| HU-008 Login | 2 | Terminada | IMPLEMENTADO Y PROBADO | `usuarios/tests.py` |
| HU-009 RBAC | 2 | Terminada | IMPLEMENTADO Y PROBADO | `inventario::RBACTests` |
| HU-010 Modelos base | 2 | Terminada | IMPLEMENTADO Y PROBADO | migraciones; `RestriccionesBDTests` |
| HU-011 Catálogo | 2 | Terminada | IMPLEMENTADO Y PROBADO | `CatalogoTests` |
| HU-012 Catálogo Operador | 3 | En curso | Terminada (selector de productos) | `componentes/SelectorProductos.tsx` |
| HU-013 Venta rápida | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `VentaRapidaTests` |
| HU-014 Medio de pago | 3 | Pendiente | IMPLEMENTADO Y PROBADO | idem |
| HU-015 Descuento al cerrar | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `test_cerrar_sesion_descuenta_stock…` |
| HU-016 Abrir sesión | 3 | Pendiente | IMPLEMENTADO Y PROBADO (D26 cambia el momento en la UI) | `SesionDinamicaTests` |
| HU-017 Agregar productos | 3 | Pendiente | IMPLEMENTADO Y PROBADO (D24) | idem |
| HU-018 Cerrar sesión | 3 | Pendiente | IMPLEMENTADO Y PROBADO | idem |
| HU-019 Una sesión por mesa | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `ConcurrenciaSesionesTests` |
| HU-020 Registrar orden | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `RegistrarOrdenTests` |
| HU-021 Estado de orden | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `CambiarEstadoTests` |
| HU-022 Abonos | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `AbonoTests` |
| HU-023 Costos/utilidad | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `CostoOperativoTests` |
| HU-024 Stock | 4 | Pendiente | IMPLEMENTADO Y PROBADO | `StockAPITests` |
| HU-025 Ingreso mercancía | 4 | Pendiente | IMPLEMENTADO Y PROBADO (adelantado al Bloque 2) | `MovimientoInventarioAPITests` |
| HU-026 Ajustes | 4 | Pendiente | IMPLEMENTADO Y PROBADO | idem |
| HU-027 Dashboard caja diario | 4 | Pendiente | IMPLEMENTADO Y PROBADO como pestaña «Resumen del día» de Caja (no hay «dashboard» independiente ni gráficos) | `ResumenTests` |
| HU-028 Cierre de caja | 4 | Pendiente | IMPLEMENTADO Y PROBADO (D14, D28: vista previa y cierres anteriores) | `CierreTests`, `VistaPreviaCierreTests` |
| HU-029 Gastos | 4 | Pendiente | IMPLEMENTADO Y PROBADO | `GastoTests` |
| HU-030 Operaciones offline | 4 | Pendiente | **PARCIAL**: solo falta el catálogo (F-2). El mapa (F-1) y el precio del dispositivo (F-9) se corrigieron en `5f89fad` y `20907da` | `sync/`, `enrutador.test.ts`, `vistaLocalMesas.test.ts`, `api/ventas.test.ts` |
| HU-031 Cola en IndexedDB | 4 | Pendiente | IMPLEMENTADO Y PROBADO (lógica con almacén en memoria; persistencia Dexie sin prueba) | `motor.test.ts` |
| HU-032 Envío a /api/sync/ | 4 | Pendiente | IMPLEMENTADO Y PROBADO | `core::SincronizacionAPITests`, `motor.test.ts` |
| HU-033 Instalar PWA | 4 | Pendiente | IMPLEMENTADO SIN PRUEBA; identidad propia desde `1bf76fc` (íconos PNG, maskable, apple-touch-icon, `lang es`) y `/admin/` fuera del SW (`fc6c598`). Instalación en Android/iOS no probada (informe 10 §5) | `vite.config.ts`, `index.html` |
| HU-034 Pruebas unitarias e integración | 4 | Pendiente | Terminada en backend (194) y en la lógica del frontend (38 Vitest en 7 archivos); sin pruebas de UI | `05 §1-2` |
| HU-035 Flujo offline-online | 4 | Pendiente | PARCIAL: probado a nivel API (7 escenarios) y lógica de cola; sin prueba de extremo a extremo en navegador | `core/tests.py:412-627` |
| HU-036 Corrección de errores | 4 | Pendiente | PARCIAL: lotes E-01…E-09 (27/09), E-10…E-19 (03/10) y correcciones pre-documentación F-1, F-3…F-6, F-8…F-11, F-13, F-16, F-17 (03/10). Abiertos: F-2, F-12, F-14, F-15, F-18 y los nuevos F-19…F-23 | commits `f783d49`, `9542665`, `8910c90`, `e90e527`, `6caa42a`, `02ce97b`, `e57e7a6`…`7326a5a` |
| HU-037 Validación con Aroma & Co. | 4 | Pendiente | **Sin evidencia en el repo** | — |
| HU-038 Retroalimentación | 4 | Pendiente | **Sin evidencia en el repo** | — |
| HU-039 Documentación técnica y manual | 4 | Pendiente | En curso (este inventario, actualizado al 03/10; la carpeta no está versionada) | `docs/insumos_documentacion/` |
| HU-040 Monografía | 4 | Pendiente | Pendiente (no hay borrador en el repo) | — |
| HU-041 Consumos de orden | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `ConsumoOrdenTests` |
| HU-042 Módulos | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `core::ConfiguracionModuloTests` |
| HU-043 Mesas | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `MesaTests` |
| HU-044 Usuarios | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `UsuarioViewSetTests` |
| HU-045 Idempotencia | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `IdempotenciaTests` |
| HU-046 Sesión offline | 4 | Pendiente | IMPLEMENTADO SIN PRUEBA (D21/D23). El cierre por inactividad que la acompaña (D27) sí tiene 5 pruebas de su lógica | `contexto/SesionContext.tsx`, `contexto/inactividad.test.ts` |
| HU-047 Correcciones documentales | 3 | En curso | **No terminada** (ERD/CU/ADR/anteproyecto sin actualizar) | `docs/referencia/` sin versiones nuevas |
| HU-048 Cancelar sesión | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `test_cancelar_sesion_libera_mesa…` |
| HU-049 Medios de pago | 3 | Pendiente | IMPLEMENTADO Y PROBADO | `ConfiguracionPagoTests` |
| HU-050 Confirmar pagos | 4 | Pendiente | IMPLEMENTADO Y PROBADO (+ anular, D15) | `ConfirmarTests`, `AnularTests` |
| HU-051 Dispositivos | 4 | Pendiente | IMPLEMENTADO Y PROBADO | `DispositivoAPITests` |
| HU-052 Novedades | 4 | Pendiente | IMPLEMENTADO Y PROBADO | `NovedadSincronizacionAPITests` |

**No terminadas / diferidas:** HU-006, HU-047 (documentales), HU-037, HU-038 (validación sin evidencia), HU-039, HU-040 (en curso), HU-030 (solo falta F-2) y HU-035/HU-036 parciales. Los lotes 4–6 y la rama de correcciones no están en el backlog v3 como HU propias; se agrupan bajo HU-036. **Eliminadas:** ninguna (el backlog v3 conserva las 52).

---

## 3. Cronograma real

### 3.1 Plan vs. git

| Sprint | Plan (backlog v3) | Qué muestra git | Commits en la ventana | Entregables reales |
|---|---|---|---|---|
| S1 | 17/08–30/08 | **Sin commits** en esas fechas. Los artefactos de S1 se subieron en un solo commit el 11/09 (`28103a1`) | 0 | ADR, ERD, CU, Contrato, Backlog (docs) |
| S2 | 31/08–13/09 | Primer commit 11/09 (`fbc79d8`, scaffold). El trabajo de S2 se hizo el **16/09** (26 commits) en la rama `cierre-sprint-2`, que llegó a `main` por fast-forward (punta `9f2982c`, 19/09; CLAUDE.md dice 20/09) | 4 (11/09) | Auth, RBAC, catálogo, Dexie/sesión, 33 pruebas |
| S3 | 14/09–27/09 | 16/09: cierre S2 (26). 19/09: Bloques 1 y 2 (`1cfb54f`, `281f078`) + Contrato v2/Backlog v3. 20/09: Bloque 3 (`fbf55ff`). **21/09: Bloques 4, 5a, 5b y 5c** (`b3c8d80`, `aa65178`, `8ff4036`, `3eb01e8`). 27/09: despliegue (`ef5d035`) y 4 commits de correcciones | 41 | Todo el alcance funcional de S3 **y de S4** |
| S4 | 28/09–18/10 | **03/10: 16 commits**: lotes de corrección 4, 5 y 6 (`e90e527`, `6caa42a`, `02ce97b`) y 13 de la rama `correcciones-pre-documentacion` (`e57e7a6` … `7326a5a`), integrada en `main` por fast-forward y publicada (`origin/main` = `7326a5a`) | 16 | Correcciones de interfaz, offline, identidad PWA, cierre de caja con vista previa (D28); validación y documentación siguen pendientes |
| Entrega | 20/10 | — | — | — |

Observaciones:
- Los bloques del Sprint 4 (inventario, caja, offline, PWA) se terminaron el 21/09, una semana **antes** del inicio planeado del Sprint 4.
- Las etiquetas de los commits no son consistentes: «feat(sprint-4): bloque 4» (`b3c8d80`) es anterior a «feat(sprint-3): bloque 5a» (`aa65178`), que `CLAUDE.md` asigna al Sprint 4.
- Todos los commits son de un solo autor git (Daniel Gil): 61 en `main`, 59 con el trailer `Co-Authored-By: Claude …`.
- El anteproyecto planteaba 4 sprints × 3 semanas (12 semanas); el backlog usa 2+2+2+3 semanas (decisión «Calendario» abierta, `Backlog_Definitivo.md:90`).

### 3.2 Commits por bloque

| Bloque | Commit | Fecha | HU |
|---|---|---|---|
| Base repo + docs S1 | `fbc79d8`, `28103a1`, `aa39656`, `ee3b5ed` | 11/09 | HU-001..005, HU-007 |
| Cierre Sprint 2 | 26 commits (`53edb6a` … `5182342`) | 16/09 | HU-007..012, IMP-01..12 |
| Contrato v2 / Backlog v3 | `9f2982c`, `2952f4e` | 19/09 | HU-005, HU-047 |
| Bloque 1 | `1cfb54f` | 19/09 | HU-045, HU-042, HU-049, HU-044 |
| Bloque 2 | `281f078` | 19/09 | HU-043, HU-012..019, HU-048, HU-025 (entrada) |
| Bloque 3 | `fbf55ff` | 20/09 | HU-020..023, HU-041 |
| Bloque 4 | `b3c8d80` | 21/09 | HU-024, 026, 027, 028, 029, 050 |
| Bloque 5a | `aa65178` | 21/09 | HU-051, HU-032, HU-052 |
| Bloque 5b | `8ff4036` | 21/09 | HU-030 (parcial), HU-031, HU-032 cliente, HU-033, HU-046 |
| Bloque 5c | `3eb01e8` | 21/09 | HU-017 (D24), HU-030 |
| Bloque 6a (despliegue) | `ef5d035` | 27/09 | — (D25) |
| Correcciones | `df58816`, `f783d49`, `9542665`, `8910c90` | 27/09 | HU-036 (E-01..E-09) |
| Lote de correcciones 4 | `e90e527` | 03/10 | HU-036 (E-10 agregar con un clic, E-11 cierre por inactividad D27) |
| Lote de correcciones 5 | `6caa42a` | 03/10 | HU-036 (E-12 bandeja, E-13 Inventario unificado, E-14 formularios, E-15 ajuste de D27) |
| Lote de correcciones 6 | `02ce97b` | 03/10 | HU-036 (E-16 cuenta visible en celular, E-17 bandeja compacta, E-18 Caja con pestañas, E-19 bandeja persistente) |
| Correcciones pre-documentación (informe 10) | `e57e7a6` (B1, F-13), `fc6c598` (B2, F-10), `1bf76fc` (A1, F-16), `b31ccc0` (A2, F-17), `d8bc4bb` (A3, F-8), `dca9f68` (A4, F-3), `1cf8502` (A6, F-6), `e1f2ba3` (A7), `1984aec` (B5, F-11), `20907da` (B3, F-9), `5f89fad` (B4, F-1), `3072214` (A5, F-4/F-5, D28), `7326a5a` (textos restantes, `icons.svg`, CLAUDE.md) | 03/10 | HU-036, HU-033, HU-030, HU-028, HU-039 |

---

## 4. Decisiones de implementación y dónde quedaron documentadas

| ID | Decisión (resumen) | Documentada en |
|---|---|---|
| D1 | Códigos de error en línea (NO_AUTENTICADO, CREDENCIALES_INVALIDAS, …) | Contrato v2 (tabla de cambios, §14.3) |
| D2 | Refresh público con `refresh_token` → `access_token` | Contrato v2 §3 |
| D3 | Catálogo solo GET/POST/PATCH; PUT/DELETE 405 | Contrato v2 §5–6 |
| D4 | ADMIN ve productos inactivos; OPERADOR no | Contrato v2 §6 |
| D5 | `costo_produccion` oculto al OPERADOR | Contrato v2 §2, §6 |
| D6 | `operation_id` opcional en línea (lo genera el servidor) | Contrato v2 §2 |
| D7 | Todas las FK con PROTECT | Backlog v3 «Decisiones», Contrato v2 §17 (pendiente en ERD) |
| D8 | Columna `password_hash` VARCHAR(255) | idem |
| C-01..C-09 | Correcciones del Contrato | Contrato v2 tabla de cambios |
| P-01..P-07 | Venta rápida atómica, confirmación de pagos, idempotencia, mapa de rutas por módulo, reglas de órdenes, usuarios, `controla_stock` | Contrato v2 («Aprobada», commit `2952f4e`) |
| D9 | `ConfiguracionModulo/Pago` creados con el ADMIN; pagos nacen solo con efectivo | `CLAUDE.md`; código `usuarios/services.py` |
| D10 | `TIME_ZONE = America/Bogota` | `CLAUDE.md`; `settings.py:163-167` |
| D11 | Borrado físico de un detalle de venta ABIERTA | `CLAUDE.md` |
| D12 | Validar todas las existencias antes de cerrar | `CLAUDE.md` |
| D13 | `GET /api/ordenes-trabajo/{id}/` | `CLAUDE.md` |
| D14 | Criterio del cierre de caja y `CIERRE_YA_REALIZADO` | `CLAUDE.md`; `finanzas/models.py:120-125` |
| D15 | Anular pago pendiente, estado `ANULADO`, `motivo_anulacion` | `CLAUDE.md`; `finanzas/models.py:14-16` |
| D16 | Dispositivo no autorizado rechaza el lote sin registrar | `CLAUDE.md`; `core/services.py:61-70` |
| D17 | Lista cerrada de recursos sincronizables | `CLAUDE.md`; `core/sync.py:375-400` |
| D18 | `fecha_cliente` obligatoria; sin `MOVIMIENTO_EN_PERIODO_CERRADO` | `CLAUDE.md` |
| D19 | Conservar `precio_unitario` del dispositivo en sync | `CLAUDE.md` (precisada el 03/10 con el lado cliente); el frontend lo envía desde `20907da` |
| D20 | `OPERACION_PREVIA_FALLIDA` | `CLAUDE.md` |
| D21 | Lote atribuido al usuario autenticado; sin cambio de usuario con cola | `CLAUDE.md` |
| D22 | Valores «provisional» en el cliente, nunca enviados | `CLAUDE.md` |
| D23 | Access 30 min / refresh 7 días; sesión offline | `CLAUDE.md`; `settings.py:222-228` |
| D24 | Validar stock al agregar detalle en línea | `CLAUDE.md` |
| D25 | Un solo servicio Render (Docker) + Neon; API y PWA en el mismo dominio; desde B1, `SECRET_KEY` obligatoria | `CLAUDE.md` (agregada el 03/10 en `3072214`); `Dockerfile`, `render.yaml`, `settings.py`, `DESPLIEGUE.md` |
| D26 | La sesión se abre al agregar el primer producto | `CLAUDE.md` |
| **D27** | Cierre de sesión por inactividad: 30 min sin interacción, aviso 1 min antes; solo con conexión y cola vacía; nunca borra la cola ni la copia local; ajuste E-15 (cualquier interacción reinicia, también tras expirar). Constante `INACTIVIDAD_SESION`. Ajuste F-19: «conexión» = `navigator.onLine` + `GET /api/health/` con 200 en máximo 5 s (`api/salud.ts::servidorDisponible`); comprobación asíncrona sin duplicados y cancelada por actividad. Ajuste F-20: `meta.ultima_actividad` (ms) en Dexie, la cuenta sigue al reabrir la app (`calcularInicioInactividad`) | `CLAUDE.md` (ajustes F-19 y F-20 agregados el 04/10); commits `e90e527` (E-11), `6caa42a` (E-15), `24e7c46` (F-19) y `7688cb7` (F-20); `frontend/src/contexto/inactividad.ts`, `componentes/Layout.tsx`, `api/salud.ts`. Interacción con D21/D23 y riesgos en `03 §9` |
| **D28** | `GET /api/cierres-caja/vista-previa/` (solo ADMIN, `finanzas_activo`), mismo criterio D14 sin guardar ni bloquear; cálculo compartido `calcular_totales_cierre`; «Diferencia estimada» = efectivo contado − `efectivo_esperado` de la vista previa, nunca se envía. Extiende el Contrato v2 §11. Desde F-21, la PWA también muestra `por_medio_pago` y `cantidad_movimientos`; desde F-22, la fecha contable del cierre («Fecha del cierre») está separada del filtro del resumen (solo interfaz, sin cambiar D28) | `CLAUDE.md`; commits `3072214`, `f1c58f2` (F-21) y `d782bbd` (F-22); `backend/finanzas/services.py:222-274`, `views.py:171-178`; `frontend/src/componentes/PanelCierreCaja.tsx` |
| E-01..E-09 (lotes de corrección 1–3) | Navegación móvil, Inicio, menú, accesos, mesa 500, errores por campo, selector de productos, contador, apertura de sesión | Solo en mensajes de commit (`f783d49`, `9542665`, `8910c90`). **Atención:** el prefijo «E-» choca con las excepciones E-01..E-05 del ERD §9.2 (operaciones que requieren conexión) |
| E-10..E-19 (lotes de corrección 4–6) | Clic suma una unidad (E-10, reemplazado por E-12), cierre por inactividad (E-11/D27, E-15), bandeja de selección (E-12, E-17, E-19), Inventario unificado (E-13), estilo de formularios (E-14), cuenta visible en celular (E-16), Caja con pestañas (E-18) | Mensajes de commit (`e90e527`, `6caa42a`, `02ce97b`) y «Estado del proyecto» de `CLAUDE.md`. Mismo choque de prefijo con E-01..E-05 del ERD (p. ej. «E-05» en la alerta del cierre se refiere al ERD, no a un lote) |
| A1..A7, B1..B5 | Ítems de la rama `correcciones-pre-documentacion` | `docs/insumos_documentacion/10_cambios_post_inventario.md` y mensajes de commit |
| F-1..F-23 | Hallazgos de interfaz y técnicos de este inventario. F-19…F-23 corregidos en la rama `correcciones-sesion-y-cierre` (F-23 precisa E-19: salir de la mesa conserva la bandeja) | `03 §15`, `05 §6.3`, informe `11` (versionados desde el commit «docs: inventario verificado para la documentación final») |
| IMP-01..IMP-12, INC-xx, VAC-xx | Hallazgos de auditoría | `docs/INCONSISTENCIAS.md` |

Ninguna de D7..D28 se ha trasladado todavía a ERD, CU ni ADR (HU-047 en curso). D27 afecta a CU-17 (sesión) y D28 al Contrato §11 y a CU-15.

---

## 5. Objetivos específicos del anteproyecto

| # | Objetivo (`00_Anteproyecto_SADIM_v2.md:149-157`) | Qué se hizo | Evidencia | Qué quedó parcial |
|---|---|---|---|---|
| 1 | Identificar requerimientos funcionales y no funcionales | 23 casos de uso, 33 reglas R-01..R-33, matriz offline E-01..E-05, backlog con criterios de aceptación | `03_Casos_de_Uso…`, `02_ERD…` §7, §9; `Backlog_Definitivo.md` | **No existe un documento de requerimientos RF/RNF** (decisión «Documento de requerimientos» abierta, `Backlog_Definitivo.md:91`; VAC-05) |
| 2 | Diseñar la interfaz con wireframes y mockups | Documento de 7 wireframes de baja fidelidad + implementación responsive (barra lateral / barra inferior) | `04_Wireframes_SADIM_v2.md`; `componentes/Layout.tsx` | Las imágenes de los wireframes y los mockups de Figma no están en el repo; 7 CU sin wireframe (documento §9); no hay prototipo de alta fidelidad; identidad visual propia desde `1bf76fc` (F-16 corregido), pero sin prototipo ni guía de estilo |
| 3 | Módulo de inventario: productos, stock, contingencias (mermas, compras menores, regalados) | Catálogo, stock con alerta, ENTRADA, MERMA, AJUSTE_MANUAL, salidas automáticas por venta y servicio, gastos (compras menores) | `inventario/`, `finanzas/services.py:45-63` | No hay tipo específico «producto regalado» (se registra como MERMA con motivo); sin recetas (decisión ERD R-18) |
| 4 | Ventas y flujo de servicios: cuentas abiertas, consumos en tiempo real, servicios, seguimiento, tiempos estimados, costos | Venta rápida, sesiones dinámicas por mesa, órdenes con estados, `fecha_entrega_estimada`, abonos, consumos, costos y utilidad (ADMIN), confirmación de pagos electrónicos | `ventas/`, `servicios/`, `finanzas/` | «Tiempos estimados» = solo fecha de entrega (sin horas ni alertas de vencimiento); el mapa de mesas no muestra tiempo transcurrido; Inicio sin KPI |
| 5 | Pruebas de integración y funcionamiento interfaz–lógica–BD | 194 pruebas de API sobre PostgreSQL (integración vista–servicio–BD), concurrencia real, 38 pruebas Vitest de la lógica del cliente (cola, mapa local, precio en la cola, inactividad, formato, etiquetas) | `05 §1-3` | Sin pruebas de interfaz ni E2E (navegador ↔ API ↔ BD); sin validación con usuarios (HU-037/038) |

---

## Cambios respecto a la versión del 03/10 (`7326a5a`)

- §4 Decisiones: D27 con los ajustes F-19 (servidor que responde) y F-20 (inactividad guardada); D28 con F-21 y F-22 (solo interfaz); F-1..F-23 y A/B ya versionados en `docs/insumos_documentacion/`. No hay decisiones nuevas (D29 no se usa).

## Cambios respecto a la versión del 02/10

- §1 Matriz CU: CU-01/02/03 (bandeja y mapa sin conexión), CU-12 (ingreso dentro de Inventario), CU-14, CU-15 (vista previa D28, cierres anteriores, F-21), CU-17 (A4 y D27, que no está en CU-17), CU-20 (pestaña de Caja con Transferencia y QR), CU-23 (estado real y etiquetas).
- §2 Backlog: HU-027, HU-028, HU-030 (solo falta F-2), HU-033, HU-034 (194 + 38), HU-036 (lotes 4–6 y rama de correcciones), HU-039, HU-046.
- §3 Cronograma: 16 commits del 03/10 en el Sprint 4; tabla de commits por bloque con los lotes 4, 5 y 6 y los 13 commits de la rama de correcciones; 61 commits en total.
- §4 Decisiones: D27 y D28 nuevas; D19 y D25 actualizadas (D25 ya está en `CLAUDE.md`); filas para E-10…E-19, A/B y F-x.
- §5 Objetivos: cifras de pruebas e identidad visual.
- Referencias de `core/settings.py` corridas.
