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

Origen: informe `/auditar-sprint2` corrido contra el código real (repo con `usuarios/` e `inventario/` implementados). Estos IDs son sobre **código**, no sobre documentos: no se resuelven editando `docs/referencia/`, sino con cambios en el repo del proyecto. Ninguno bloquea la corrección de documentos (sección Guía); sí bloqueaban dar Sprint 2 por terminado — **todos resueltos en la rama `cierre-sprint-2`** (16/09/2026).

| ID | Sev. | Dónde | Problema | Estado | Evidencia |
|---|---|---|---|---|---|
| IMP-01 | Alta | `usuarios/serializers.py` | Login devuelve `access`/`refresh` (nombres por defecto de simplejwt) en vez de `access_token`/`refresh_token` que exige Contrato §3. | Resuelta | Commit `7b9e875`. `CustomTokenObtainPairSerializer.validate` devuelve exactamente `access_token`, `refresh_token`, `usuario_id`, `rol`. Prueba: `usuarios/tests.py::LoginRefreshTests::test_login_devuelve_las_cuatro_claves`. |
| IMP-02 | Crítica | `usuarios/urls.py` | No existe `/api/auth/register/`. Sin este endpoint no se puede crear ni siquiera el primer Administrador. | Resuelta | Commit `7b9e875`. `RegistroInicialView` + `usuarios/services.py::registrar_administrador_inicial` (solo si `Usuario.objects.exists()` es falso; si no, 409 `INSTALACION_YA_INICIALIZADA`). Pruebas: `usuarios/tests.py::RegistroInicialTests` (3 casos). |
| IMP-03 | Crítica | `inventario/views.py` | Categorías y Productos solo exigían `IsAuthenticated`: cualquier OPERADOR podía crear o editar catálogo, precios y márgenes. | Resuelta | Commit `a4333f0`. `inventario/permissions.py::EsAdmin`/`EsAdminUOperador`, aplicadas por método HTTP (`PermisosPorRolMixin`). Pruebas: `inventario/tests.py::RBACTests`. |
| IMP-04 | Alta | `inventario/views.py` (ViewSets) | `CategoriaViewSet` y `ProductoViewSet` exponían DELETE físico; Categoria no tenía baja lógica. | Resuelta | Commit `a4333f0`. Se quitó `DestroyModelMixin`/`destroy()`: DELETE ya no está enrutado y responde 405. Baja lógica solo por PATCH `{"activo": false}` (INC-11). Pruebas: `test_put_y_delete_no_permitidos_en_categorias`, `..._en_productos`. |
| IMP-05 | Media | `inventario/urls.py` / `views.py` | Sin filtros `?categoria=` ni `?tipo=` en productos (Contrato §6). | Resuelta | Commit `a4333f0`. `ProductoViewSet.get_queryset` filtra por `categoria`/`tipo` y responde 400 `DATOS_INVALIDOS` ante valores inválidos. Prueba: `test_filtros_categoria_y_tipo`. |
| IMP-06 | Media | `inventario/views.py` | `ProductoViewSet.get_queryset()` forzaba `activo=True` incluso para ADMIN, que necesita ver y reactivar productos inactivos. | Resuelta | Commit `a4333f0`. ADMIN ve activos e inactivos (D4); OPERADOR solo activos. Prueba: `test_admin_ve_inactivos_operador_no`, `test_baja_logica_y_reactivacion_de_producto`. |
| IMP-07 | Alta | `core/settings.py` (no existía) | Sin `EXCEPTION_HANDLER`: los errores usaban el formato por defecto de DRF (`{"detail": "..."}`), no `{"code","message","details"}` del Contrato §14. | Resuelta | Commit `ead4709`. `core/exceptions.py::manejador_de_excepciones` + `ErrorNegocio`, registrado en `REST_FRAMEWORK['EXCEPTION_HANDLER']`. Verificado en todas las pruebas vía `assert_error_shape`. |
| IMP-08 | Alta | `usuarios/tests.py`, `inventario/tests.py` | Pruebas vacías (`Ran 0 tests`). Contradice la regla de CLAUDE.md de probar camino feliz, excepción y permisos por HU. | Resuelta | Commit `4ce5729`. 29 pruebas (`Ran 29 tests ... OK`) sobre PostgreSQL: restricciones de BD, auth, RBAC y catálogo. Ver `docs/evidencias/sprint-2.md`. |
| IMP-09 | Media | `core/settings.py` | Motor de base de datos era SQLite; ADR-001 exige PostgreSQL (SQLite solo opcional para pruebas). `psycopg2-binary` ya estaba instalado. | Resuelta | Commit `e1551f6`. `DATABASES` apunta a PostgreSQL vía variables de entorno (`.env`); migraciones aplicadas sobre `sadim_db`. |
| IMP-10 | Media | Raíz del repo | Sin frontend (`package.json` no existía), sin `.gitignore`, sin `requirements.txt`, sin ningún commit todavía. | Resuelta | El scaffold de Vite+TS y el primer commit ya existían antes de esta rama (`ee3b5ed`, `fbc79d8`, previos a esta sesión); `.gitignore` ya estaba versionado. `requirements.txt` agregado en el commit `e1551f6` de esta rama. |

### Decisiones de implementación Sprint 2 — pendientes de formalizar en el Contrato

Aprobadas por el equipo para cerrar Sprint 2 (16/09/2026) y aplicadas en `cierre-sprint-2`. No están todavía escritas en `docs/referencia/05_Contrato_API_SADIM.md`; quien actualice el Contrato debe incorporarlas o decidir explícitamente no hacerlo.

| ID | Decisión |
|---|---|
| D1 | Además de los códigos del Contrato §14: `NO_AUTENTICADO` (401), `CREDENCIALES_INVALIDAS` (401, solo login, mensaje genérico), `RECURSO_NO_ENCONTRADO` (404), `METODO_NO_PERMITIDO` (405), `INSTALACION_YA_INICIALIZADA` (409), `ERROR_INTERNO` (500, sin exponer detalles internos). Validación: `DATOS_INVALIDOS` (400) con errores por campo en `details`. Rol insuficiente: `PERMISO_INSUFICIENTE` (403). |
| D2 | `POST /api/auth/refresh/` es público (no "Autenticado" como dice el Contrato §3 hoy) pero exige refresh token: recibe `{"refresh_token"}` y devuelve `{"access_token"}`. |
| D3 | Categorías y productos solo aceptan GET, POST y PATCH. DELETE y PUT responden 405. La baja de producto es solo PATCH `{"activo": false}`. |
| D4 | `GET /api/productos/`: ADMIN ve activos e inactivos; OPERADOR solo activos. |
| D5 | OPERADOR no recibe `costo_produccion` en las respuestas de productos (ADR-005). |
| D6 | `operation_id` en Categoria y Producto: se acepta en POST; si no llega, lo genera el servidor; no se puede modificar. Un `operation_id` repetido responde 400 `DATOS_INVALIDOS` (devolver el resultado original en vez de rechazar llega con HU-045, sincronización). |
| D7 | Toda FK del dominio usa `on_delete=PROTECT` (nunca `CASCADE`): nada se borra físicamente (R-17, baja lógica del Contrato). Hoy aplica a `Producto.categoria`; es la convención para cualquier FK nueva de Sprint 3. |
| D8 | El campo heredado `Usuario.password` (de `AbstractBaseUser`, `VARCHAR(128)`, columna `password`) se sobrescribe como `CharField(max_length=255, db_column="password_hash")` para que la columna física coincida con ERD §5.1. El atributo Python sigue siendo `user.password`; `set_password()`/`check_password()`/`authenticate()` no cambian. |

**Campos y tablas técnicos de Django en Usuario (no están en el ERD; no se quitan — sostienen `AbstractBaseUser`/`PermissionsMixin`, `/admin/` y el propio login):**

| Columna en `usuarios_usuario` | Origen | Para qué sirve |
|---|---|---|
| `last_login` | `AbstractBaseUser` | Fecha del último login exitoso; simplejwt la actualiza sola (`UPDATE_LAST_LOGIN`). Solo auditoría, SADIM no la usa en reglas de negocio. |
| `is_superuser` | `PermissionsMixin` | Bandera de Django que salta todas las verificaciones de permisos (`has_perm` siempre True); la usa `/admin/`, no el RBAC de SADIM (`rol`). `createsuperuser` la deja en `true`. |
| `is_staff` | Declarado explícito en el modelo | Permite o no entrar a `/admin/`. No forma parte del RBAC de SADIM. |
| `is_active` | Declarado explícito en el modelo | La revisan `authenticate()` y las permission classes de DRF para permitir login/acceso; se mantiene sincronizada con `activo` en `Usuario.save()` (ERD solo declara `activo`). |

| Tabla | Origen | Para qué sirve |
|---|---|---|
| `auth_group`, `auth_permission`, `auth_group_permissions` | `django.contrib.auth` (requerido por `AbstractBaseUser`/`PermissionsMixin`) | Catálogo de grupos y permisos de Django; los usa `/admin/`, no el RBAC de SADIM. Quedan vacías en operación normal. |
| `usuarios_usuario_groups`, `usuarios_usuario_user_permissions` | `PermissionsMixin` (declara `groups` y `user_permissions` como M2M) | Tablas puente de esas mismas relaciones M2M. |
| `django_admin_log` | `django.contrib.admin` | Historial de acciones hechas desde `/admin/`. |
| `django_content_type` | `django.contrib.contenttypes` | Registro interno modelo↔tipo que usan el sistema de permisos y `django_admin_log`. |
| `django_session` | `django.contrib.sessions` | Sesiones basadas en cookie; la API de SADIM es JWT (sin estado) y no la usa, pero el login de `/admin/` sí. |
| `django_migrations` | Núcleo de Django | Bitácora de qué migraciones ya se aplicaron. |

**Nota sobre el momento de esta auditoría:** se corrió con el paquete v1 (antes de existir HU-041 a HU-048). Las preguntas 2 a 5 del informe original ya tienen respuesta en el backlog v2:

| Pregunta del informe | Ya resuelto en backlog v2 |
|---|---|
| ¿Cómo se modela Mesa y su endpoint? (INC-06) | HU-043 + Contrato §7.1 (guía 2.5) |
| ¿HU para `/api/usuarios/`? (INC-07) | HU-044 + CU-18 (guía 3.11) |
| ¿A qué HU se le agrega ConsumoOrden/SALIDA_SERVICIO? (VAC-01) | HU-041, historia propia (no se agrega a otra) |
| ¿Se prioriza CU-16 antes de Sprint 3? (VAC-02) | Sí: HU-042, primera del Sprint 3 según el orden sugerido |
