# Registro de inconsistencias y vacíos — SADIM

Documento vivo. Origen: revisión de consistencia del 11/09/2026. Actualizado tras el **backlog v2** (misma fecha).

**Regla para Claude Code:** si una tarea toca una entrada que no está "Resuelta", detente, cita el ID y pregunta antes de implementar. En particular, las entradas "Pendiente HU-047" tienen una corrección ya definida en `docs/GUIA_CAMBIOS_DOCUMENTOS.md`, pero **los documentos de `docs/referencia/` todavía no la tienen aplicada**: pregunta si implementar según la guía o esperar.

Estados: **Resuelta** · **Pendiente HU-047** (corrección definida, falta aplicarla al documento) · **Decisión abierta** (ver hoja "Decisiones pendientes" del backlog).

## A. Errores de los documentos base

| ID | Sev. | Dónde | Problema | Estado | Corrección |
|---|---|---|---|---|---|
| INC-01 | Crítica | ERD §4.7 | `DetalleVenta.venta_id` marcado UNIQUE, NULL: una venta solo podría tener una línea. | Pendiente HU-047 | Guía 1.3: `FK → Venta, NOT NULL` sin UNIQUE. |
| INC-02 | Crítica | ERD §4.12 | `MovimientoInventario.venta_id` marcado UNIQUE (contradice 1:N). | Pendiente HU-047 | Guía 1.6: `FK → Venta, NULL`. |
| INC-03 | Alta | ERD §4 vs Contrato | Falta `operation_id` en Categoria, Producto, DetalleVenta, CostoOperativoOrden. | Pendiente HU-047 | Guía 1.4 y 1.5. |
| INC-04 | Alta | ERD §4.13/4.14 | Sin FK MovimientoCaja → CierreCaja; CierreCaja sin efectivo contado. | Pendiente HU-047 | Guía 1.8, 1.9, 2.11. |
| INC-05 | Alta | ERD §4.12 | AJUSTE_MANUAL sin sentido (suma/resta). | Pendiente HU-047 | Guía 1.7: campo `sentido` (SUMA/RESTA). |
| INC-06 | Alta | Contrato | No hay endpoint de Mesas. | Pendiente HU-047 | Guía 2.5 (`/api/mesas/`), CU-19, HU-043. |
| INC-07 | Alta | Contrato §4 | /api/usuarios/ sin CU ni HU. | Pendiente HU-047 | CU-18 (guía 3.11), HU-044. |
| INC-08 | Media | ERD §4.13 | `MovimientoCaja.abono_id` debería ser UNIQUE. | Pendiente HU-047 | Guía 1.8. |
| INC-09 | Alta | Anteproyecto vs ERD | Descuento de insumos por venta sin recetas; un producto preparado al momento no tiene stock y no podría venderse. | Decisión abierta | "Recetas". Propuesta A: `Producto.controla_stock` (guía 1.13, 5.5). |
| INC-22 | Media | ADR-005 vs CU | ADR-005 solo da al Operador ventas, sesiones y abonos; los CU también le dan órdenes, inventario y gastos. | Pendiente HU-047 | Guía 4.2. |
| INC-23 | Media | CU-15 vs Contrato §11 | CU-15 dice "offline-first", pero el servidor calcula los totales del cierre. | Pendiente HU-047 | Guía 3.4: CU-15 requiere conexión. |
| INC-24 | Media | Contrato §12 | GET de configuración de módulos solo para ADMIN: la interfaz del Operador no puede saber qué ocultar. | Pendiente HU-047 | Guía 2.12 y 4.3: lectura para ambos roles. |
| INC-25 | Alta | CU-04 | Precondición exige un consumo para cerrar; una sesión abierta por error deja la mesa ocupada indefinidamente. | Pendiente HU-047 | RN-16, guía 2.6 y 3.5, HU-048. |
| INC-26 | Media | CU-10 | La fórmula de utilidad neta no está definida. | Decisión abierta | "Utilidad neta". Propuesta: costo_total − Σ costos operativos (guía 3.7). |
| INC-27 | Baja | Anteproyecto §1.5.1 | "Venta rápida de un solo producto" vs CU-01 "uno o varios". | Pendiente HU-047 | Guía 5.4. |
| INC-28 | Media | ERD §5, CU-01/04/08 | No está definido qué significa "confirmar" un pago electrónico sin pasarela. | Decisión abierta | "Pagos electrónicos". Propuesta: offline solo efectivo (guía 1.12, 2.7, 3.6). |

## B. Backlog

| ID | Problema | Estado |
|---|---|---|
| INC-10 | HU-010 mencionaba la entidad inexistente "Inventario". | Resuelta (backlog v2: Usuario, Categoria, Producto). Confirmar en la auditoría. |
| INC-11 | HU-011 hablaba de CRUD/eliminación. | Resuelta (sin DELETE, baja lógica). |
| INC-12 | HU-025 y HU-029 limitadas a administrador. | Resuelta (ambos roles). |
| INC-13 | IndexedDB tratado como decisión abierta. | Resuelta (solo queda abierta la librería auxiliar). |
| INC-14 | HU-006 marcada hecha sin cumplir su criterio. | Pendiente HU-047 (guía 5.1 a 5.3). |
| INC-15 | Referencias RN inexistentes. | Resuelta en backlog; falta numerar el ERD (guía 1.11). |
| INC-16 | Calendario 12 vs 9 semanas. | Decisión abierta ("Calendario", guía 5.7). |
| INC-17 | Totales del resumen escritos a mano. | Resuelta (fórmulas). |
| INC-18 | Prioridades HU ≠ CU. | HU-029 resuelta; HU-021 pendiente de subir CU-07 a Alta (guía 3.3). |
| INC-19 | Hoja de decisiones desactualizada. | Resuelta (columnas Estado y Resolución). |
| INC-20 | HU-019 vs CU-02 alterno. | Resuelta (409 + mostrar sesión existente). |
| INC-21 | HU-012 pedía buscador no contemplado. | Resuelta (filtros del contrato). |

## C. Vacíos

| ID | Qué faltaba | Estado |
|---|---|---|
| VAC-01 | CU-09 (Alta) sin HU. | Resuelta: HU-041. |
| VAC-02 | CU-16 sin HU. | Resuelta: HU-042. |
| VAC-03 | CU-17 parcial. | Resuelta: HU-008 ampliada + HU-046. |
| VAC-04 | HU-027 sin CU ni endpoint. | Pendiente HU-047: CU-20 y `/api/movimientos-caja/resumen/` (guía 2.10, 3.10). |
| VAC-05 | Documento de requerimientos RF/RNF y documento 04 (mockups). | Decisión abierta ("Documento de requerimientos"). |
| VAC-06 | Idempotencia dejada para Sprint 4. | Resuelta: HU-045 en Sprint 3. |
| VAC-07 | Estado CANCELADA sin flujo. | Resuelta en backlog (HU-048); falta documentarlo (guía 2.6, 3.5). |

## D. Hallazgos de implementación — auditoría Sprint 2 (11/09/2026)

Origen: informe `/auditar-sprint2` corrido contra el código real (repo con `usuarios/` e `inventario/` implementados). Estos IDs son sobre **código**, no sobre documentos: no se resuelven editando `docs/referencia/`, sino con cambios en el repo del proyecto. Ninguno bloquea la corrección de documentos (sección Guía); sí bloquean dar Sprint 2 por terminado.

| ID | Sev. | Dónde | Problema | Estado | Acción |
|---|---|---|---|---|---|
| IMP-01 | Alta | `usuarios/serializers.py:4-11` | Login devuelve `access`/`refresh` (nombres por defecto de simplejwt) en vez de `access_token`/`refresh_token` que exige Contrato §3. | Abierta | Renombrar las claves en el serializer. El Contrato es la fuente de verdad (no se cambia el Contrato). |
| IMP-02 | Crítica | `usuarios/urls.py:5-9` | No existe `/api/auth/register/`. Sin este endpoint no se puede crear ni siquiera el primer Administrador. | Abierta | Implementarlo: solo permite POST si `Usuario.objects.count() == 0`. |
| IMP-03 | Crítica | `inventario/views.py:10,15` | Categorías y Productos solo exigen `IsAuthenticated`: cualquier OPERADOR puede crear o editar catálogo, precios y márgenes. | Abierta | Crear permission class por rol y aplicarla antes de replicar el patrón en `ventas`/`servicios`/`finanzas` (ver `.claude/rules/backend-api.md`). |
| IMP-04 | Alta | `inventario/views.py` (ViewSets) | `CategoriaViewSet` y `ProductoViewSet` exponen DELETE físico; Categoria no tiene baja lógica. | Abierta | Quitar el método DELETE; baja lógica solo por PATCH `{"activo": false}` (INC-11 ya cerraba esta decisión). |
| IMP-05 | Media | `inventario/urls.py` / `views.py` | Sin filtros `?categoria=` ni `?tipo=` en productos (Contrato §6). | Abierta | Agregar `filterset_fields` o `get_queryset` con los parámetros. |
| IMP-06 | Media | `inventario/views.py:17-19` | `ProductoViewSet.get_queryset()` fuerza `activo=True` incluso para ADMIN, que necesita ver y reactivar productos inactivos. | Abierta | Filtrar por `activo=True` solo por defecto; permitir `?activo=false` o quitar el filtro para ADMIN. |
| IMP-07 | Alta | `core/settings.py:130-134` (no existe) | Sin `EXCEPTION_HANDLER`: los errores usan el formato por defecto de DRF (`{"detail": "..."}`), no `{"code","message","details"}` del Contrato §14. | Abierta | Implementar un exception handler global antes de que cada módulo de Sprint 3 invente su propio formato. |
| IMP-08 | Alta | `usuarios/tests.py`, `inventario/tests.py` | Pruebas vacías (`Ran 0 tests`). Contradice la regla de CLAUDE.md de probar camino feliz, excepción y permisos por HU. | Abierta | Escribir pruebas para los endpoints ya existentes antes de cerrar Sprint 2. |
| IMP-09 | Media | `core/settings.py:77-82` | Motor de base de datos es SQLite; ADR-001 exige PostgreSQL (SQLite solo opcional para pruebas). `psycopg2-binary` ya está instalado. | Abierta | Migrar antes de acumular migraciones sobre SQLite. |
| IMP-10 | Media | Raíz del repo | Sin frontend (`package.json` no existe), sin `.gitignore`, sin `requirements.txt`, sin ningún commit todavía. | Abierta | Iniciar Vite+TS; generar `.gitignore` y `requirements.txt`; hacer el primer commit — prioridad antes que cualquier otra cosa, para no perder el trabajo. |

**Nota sobre el momento de esta auditoría:** se corrió con el paquete v1 (antes de existir HU-041 a HU-048). Las preguntas 2 a 5 del informe original ya tienen respuesta en el backlog v2:

| Pregunta del informe | Ya resuelto en backlog v2 |
|---|---|
| ¿Cómo se modela Mesa y su endpoint? (INC-06) | HU-043 + Contrato §7.1 (guía 2.5) |
| ¿HU para `/api/usuarios/`? (INC-07) | HU-044 + CU-18 (guía 3.11) |
| ¿A qué HU se le agrega ConsumoOrden/SALIDA_SERVICIO? (VAC-01) | HU-041, historia propia (no se agrega a otra) |
| ¿Se prioriza CU-16 antes de Sprint 3? (VAC-02) | Sí: HU-042, primera del Sprint 3 según el orden sugerido |
