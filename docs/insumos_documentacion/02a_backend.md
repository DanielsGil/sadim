Actualizado al commit 7326a5a (03/10/2026)

# 02a — Backend: apps, modelos y endpoints

> Parte 1 de 2 del inventario del backend. La parte 2 (`02b_backend.md`) cubre autenticación, RBAC, reglas de negocio, máquinas de estado, transacciones, sincronización, errores y configuración.
> Rutas relativas a `backend/` salvo que se indique otra cosa.

---

## 1. Apps / módulos de Django

`INSTALLED_APPS` (`core/settings.py:65-80`): `django.contrib.admin`, `auth`, `contenttypes`, `sessions`, `messages`, `staticfiles`, `rest_framework`, `rest_framework_simplejwt`, `core`, `usuarios`, `inventario`, `ventas`, `servicios`, `finanzas`.

| App | Responsabilidad | Bandera que la controla | Modelos |
|---|---|---|---|
| `core` | Proyecto Django (settings, urls, wsgi/asgi); núcleo transversal: manejador de errores (`exceptions.py`), permisos por rol y módulo (`permissions.py`), idempotencia (`idempotencia.py`), despachador `/api/sync/` y novedades (`sync.py`), configuración de módulos y pagos, dispositivos, health check, vista SPA | Ninguna (núcleo) | `Dispositivo`, `ConfiguracionModulo`, `ConfiguracionPago`, `OperacionSincronizacion` |
| `usuarios` | Usuario personalizado (`AUTH_USER_MODEL`), registro del ADMIN inicial, login/refresh JWT, CRUD de usuarios | Ninguna (núcleo) | `Usuario` |
| `inventario` | Catálogo (`Categoria`, `Producto`) y movimientos/stock | Catálogo: ninguna (núcleo, P-04). `inventario/movimientos` y `inventario/stock`: `inventario_activo` | `Categoria`, `Producto`, `MovimientoInventario` |
| `ventas` | Mesas, venta rápida y sesiones dinámicas | `ventas_activo` | `Mesa`, `Venta`, `DetalleVenta` |
| `servicios` | Órdenes de trabajo, abonos, consumos y costos operativos | `servicios_activo` | `OrdenTrabajo`, `Abono`, `ConsumoOrden`, `CostoOperativoOrden` |
| `finanzas` | Movimientos de caja, gastos, confirmación/anulación de pagos, resumen diario y cierre | `finanzas_activo` | `MovimientoCaja`, `CierreCaja` |

Mapa de banderas: `core/permissions.py:36-41` (`CAMPO_BANDERA_POR_MODULO`). Cada ViewSet declara `modulo = "…"` y añade `ModuloActivoPermission` (`core/permissions.py:75-85`).

### 1.1 Estructura interna por capas (la que existe realmente)

Cada app de dominio tiene los mismos archivos: `models.py` → `serializers.py` (forma/validación de campos) → `services.py` (reglas de negocio, transacciones) → `views.py` (ViewSets DRF delgados: permisos, parseo, idempotencia) → `urls.py` (`DefaultRouter`) → `tests.py`. `admin.py` está vacío salvo en `finanzas`.

```
Petición HTTP → views.py (permisos + serializer de entrada)
             → core/idempotencia.ejecutar_con_idempotencia(...)   (transacción + bitácora)
             → services.py (reglas, select_for_update, efectos)
             → serializer de salida → Response
/api/sync/   → core/sync.py (manejador por recurso) → MISMA función de services.py
```

Evidencia del patrón: `ventas/views.py:94-125` (crear venta llama a `crear_venta_rapida` / `abrir_sesion_dinamica` dentro de `ejecutar_con_idempotencia`); `core/sync.py:172-209` llama a esas mismas funciones.

### 1.2 Migraciones por app

| App | Nº | Archivos |
|---|---|---|
| core | 2 | `0001_initial`, `0002_backfill_configuracion` (datos: crea filas singleton si ya hay ADMIN) |
| usuarios | 3 | `0001_initial`, `0002_usuario_rol_constraint`, `0003_alter_usuario_password` |
| inventario | 9 | `0001_initial` … `0009_movimientoinventario_consumo_orden_and_more` (incluye `0003_backfill_operation_id`) |
| ventas | 2 | `0001_initial`, `0002_alter_venta_estado_pago` |
| servicios | 2 | `0001_initial`, `0002_alter_abono_estado_pago` |
| finanzas | 4 | `0001_initial` … `0004_movimientocaja_motivo_anulacion_and_more` |
| **Total** | **22** | `makemigrations --check --dry-run` → «No changes detected» (verificado 02/10/2026) |

---

## 2. Modelos

Convenciones verificadas en todos los modelos: PK `UUIDField(default=uuid4)`; dinero y cantidades `DecimalField(max_digits=10, decimal_places=2)`; todas las FK con `on_delete=PROTECT` (D7). Los enums son `TextChoices` de Django (**sin CHECK en PostgreSQL**, salvo `Usuario.rol`).

### 2.1 `Usuario` — `usuarios/models.py:24-65`

Hereda `AbstractBaseUser` + `PermissionsMixin`.

| Campo | Tipo | Null | Default | Restricciones / notas |
|---|---|---|---|---|
| id | UUID | no | uuid4 | PK |
| nombre_completo | CharField(150) | no | — | |
| username | CharField(50) | no | — | UNIQUE; `USERNAME_FIELD` |
| password | CharField(255), **columna `password_hash`** (D8) | no | — | `:37` |
| rol | CharField(10) choices ADMIN/OPERADOR | no | OPERADOR | CHECK `usuario_rol_valido` (`:52-55`) |
| activo | Boolean | no | True | `save()` copia `activo` → `is_active` (`:58-62`) |
| fecha_creacion | DateTime | no | now | |
| is_staff | Boolean | no | False | campo técnico de Django |
| is_active | Boolean | no | True | campo técnico (lo revisa `authenticate`) |
| last_login | DateTime | sí | — | heredado de `AbstractBaseUser` |
| is_superuser, groups, user_permissions | — | — | — | heredados de `PermissionsMixin` |

### 2.2 `Dispositivo` — `core/models.py:9-35`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| id | UUID | no | uuid4 | PK |
| identificador | UUID | no | — | UNIQUE (UUID que genera la PWA) |
| nombre | CharField(100) | no | — | UNIQUE |
| es_caja | Boolean | no | False | |
| autorizado_offline | Boolean | no | False | Índice único parcial `dispositivo_unico_autorizado_offline` (solo una fila con `True`, `:27-31`) |
| activo | Boolean | no | True | |
| registrado_por | FK → Usuario | no | — | PROTECT |
| fecha_registro | DateTime | no | now | |
| ultima_sincronizacion | DateTime | sí | — | se actualiza al final de cada `POST /api/sync/` (`core/sync.py:488-489`) |

### 2.3 `ConfiguracionModulo` — `core/models.py:50-73`

Singleton: `save()` fuerza `pk = 00000000-0000-0000-0000-000000000001` (`:68-70`); `objects.obtener()` hace `get_or_create` (`:45-47`).

| Campo | Tipo | Null | Default |
|---|---|---|---|
| id | UUID | no | (fijo) |
| ventas_activo / inventario_activo / servicios_activo / finanzas_activo | Boolean | no | True |
| actualizado_por | FK → Usuario (PROTECT) | **sí** | — |
| actualizado_en | DateTime | no | now |

### 2.4 `ConfiguracionPago` — `core/models.py:76-116`

Singleton con PK fijo `…0002`.

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| acepta_efectivo | Boolean | no | True | |
| acepta_transferencia | Boolean | no | **False** (D9) | |
| acepta_qr | Boolean | no | **False** (D9) | |
| nequi_titular | CharField(150) | sí | — | |
| nequi_llave | CharField(50) | sí | — | CHECK `configuracionpago_nequi_llave_si_electronico`: si transferencia o QR → llave NOT NULL (`:102-108`) |
| actualizado_por | FK → Usuario (PROTECT) | no | — | |
| actualizado_en | DateTime | no | now | |

### 2.5 `OperacionSincronizacion` — `core/models.py:119-188`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | — | UNIQUE (clave de idempotencia) |
| dispositivo | FK → Dispositivo | **sí** | — | NULL para operaciones en línea (P-03) |
| usuario | FK → Usuario | no | — | |
| recurso | CharField(60) | no | — | p. ej. `ventas`, `ventas.detalles`, `movimientos_caja` |
| accion | CREATE/UPDATE/DELETE | no | — | |
| estado | APLICADA/DUPLICADA/RECHAZADA/CONFLICTO | no | — | |
| origen | EN_LINEA/SINCRONIZACION | no | — | (no está en ERD; Contrato §17) |
| codigo_conflicto | CharField(50) | sí | — | CHECK: obligatorio si RECHAZADA/CONFLICTO |
| mensaje | CharField(255) | sí | — | |
| objeto_id | UUID | sí | — | CHECK: obligatorio si APLICADA |
| payload | JSON | sí | — | |
| status_code_original | PositiveSmallInteger | no | — | (no está en ERD) |
| fecha_cliente | DateTime | no | — | |
| fecha_procesamiento | DateTime | no | now | |
| atendida | Boolean | no | False | Índice `(estado, atendida)` (`:184`) |

### 2.6 `Categoria` — `inventario/models.py:7-14`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | uuid4 | UNIQUE |
| nombre | CharField(100) | no | — | UNIQUE |

### 2.7 `Producto` — `inventario/models.py:99-138`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | uuid4 | UNIQUE |
| categoria | FK → Categoria | no | — | PROTECT (`:109`) |
| nombre | CharField(150) | no | — | UNIQUE(categoria, nombre) `producto_categoria_nombre_unico` |
| tipo | INSUMO_PRODUCCION / REVENTA_DIRECTA | no | — | |
| precio_venta | Decimal(10,2) | no | — | CHECK ≥ 0 |
| costo_produccion | Decimal(10,2) | sí | — | CHECK NULL o ≥ 0 |
| stock_actual | Decimal(10,2) | no | 0 | solo lectura en API |
| stock_minimo | Decimal(10,2) | no | 0 | |
| controla_stock | Boolean | no | True | |
| unidad_medida | CharField(20) | no | — | |
| activo | Boolean | no | True | |

### 2.8 `MovimientoInventario` — `inventario/models.py:17-96`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | uuid4 | UNIQUE |
| producto | FK → Producto | no | — | PROTECT |
| usuario | FK → Usuario | no | — | PROTECT |
| venta | FK → Venta | sí | — | sin UNIQUE (1:N) |
| consumo_orden | OneToOne → ConsumoOrden | sí | — | UNIQUE |
| tipo | ENTRADA/SALIDA_VENTA/SALIDA_SERVICIO/MERMA/AJUSTE_MANUAL | no | — | |
| cantidad | Decimal(10,2) | no | — | CHECK > 0 |
| sentido | SUMA/RESTA | sí | — | |
| fecha | DateTime | no | now | |
| motivo | CharField(255) | sí | — | |

CHECK (`:60-90`): motivo obligatorio en MERMA/AJUSTE_MANUAL; sentido obligatorio en AJUSTE_MANUAL y nulo en los demás; venta solo y obligatoria en SALIDA_VENTA; consumo_orden solo y obligatorio en SALIDA_SERVICIO. Índice `(producto, fecha)`.

### 2.9 `Mesa` — `ventas/models.py:9-33`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | uuid4 | UNIQUE |
| numero | SmallInteger | no | — | UNIQUE; CHECK 1..15 `mesa_numero_entre_1_y_15` |
| activa | Boolean | no | True | límite de 15 activas en servicio (`ventas/services.py:18`, `:31-38`) |
| estado | DISPONIBLE/OCUPADA | no | DISPONIBLE | derivado; solo lo escribe el backend |

### 2.10 `Venta` — `ventas/models.py:36-109`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | uuid4 | UNIQUE |
| tipo | RAPIDA/SESION_DINAMICA | no | — | |
| usuario | FK → Usuario | no | — | PROTECT |
| mesa | FK → Mesa | sí | — | CHECK `venta_mesa_segun_tipo` (sesión exige mesa; rápida sin mesa) |
| estado | ABIERTA/CERRADA/CANCELADA | no | ABIERTA | Índice único parcial `venta_una_sesion_abierta_por_mesa` (mesa, estado=ABIERTA) |
| fecha_apertura | DateTime | no | now | |
| fecha_cierre | DateTime | sí | — | |
| medio_pago | EFECTIVO/TRANSFERENCIA/QR | sí | — | |
| estado_pago | CONFIRMADO/PENDIENTE_VERIFICACION/**ANULADO** | sí | — | ANULADO agregado por D15 |
| total | Decimal(10,2) | no | 0 | calculado |

CHECK `venta_cerrada_exige_cierre_medio_y_estado_pago` (`:94-105`).

### 2.11 `DetalleVenta` — `ventas/models.py:112-133`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | uuid4 | UNIQUE |
| venta | FK → Venta | no | — | PROTECT |
| producto | FK → Producto | no | — | PROTECT |
| cantidad | Decimal(10,2) | no | — | CHECK > 0 |
| precio_unitario | Decimal(10,2) | no | — | CHECK ≥ 0 |
| subtotal | Decimal(10,2) | no | — | calculado (sin CHECK) |

### 2.12 `OrdenTrabajo` — `servicios/models.py:9-44`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | uuid4 | UNIQUE |
| usuario | FK → Usuario | no | — | PROTECT |
| cliente_nombre | CharField(150) | no | — | |
| cliente_telefono | CharField(20) | sí | — | |
| descripcion | Text | no | — | |
| fecha_solicitud | DateTime | no | now | |
| fecha_entrega_estimada | Date | no | — | |
| estado | RECIBIDO/EN_PROCESO/LISTO/ENTREGADO | no | RECIBIDO | |
| costo_total | Decimal(10,2) | no | — | CHECK ≥ 0 |
| saldo_pendiente | Decimal(10,2) | no | — | calculado |
| utilidad_neta | Decimal(10,2) | no | 0 | calculado; se inicializa = costo_total al crear (`servicios/services.py:51-71`) |

### 2.13 `Abono` — `servicios/models.py:47-82`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | uuid4 | UNIQUE |
| orden | FK → OrdenTrabajo | no | — | PROTECT |
| usuario | FK → Usuario | no | — | PROTECT |
| valor | Decimal(10,2) | no | — | CHECK > 0 |
| medio_pago | EFECTIVO/TRANSFERENCIA/QR | no | — | |
| estado_pago | CONFIRMADO/PENDIENTE_VERIFICACION/**ANULADO** | no | CONFIRMADO | |
| fecha | DateTime | no | now | |
| observacion | CharField(255) | sí | — | |

### 2.14 `ConsumoOrden` — `servicios/models.py:85-106`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | uuid4 | UNIQUE |
| orden | FK → OrdenTrabajo | no | — | PROTECT |
| producto | FK → Producto | no | — | PROTECT |
| cantidad | Decimal(10,2) | no | — | CHECK > 0 |
| estado | PENDIENTE/APLICADO | no | PENDIENTE | |
| fecha_registro | DateTime | no | now | |

### 2.15 `CostoOperativoOrden` — `servicios/models.py:109-124`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | uuid4 | UNIQUE |
| orden | FK → OrdenTrabajo | no | — | PROTECT |
| concepto | CharField(150) | no | — | |
| valor | Decimal(10,2) | no | — | CHECK > 0 |

### 2.16 `MovimientoCaja` — `finanzas/models.py:9-112`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | uuid4 | UNIQUE |
| usuario | FK → Usuario | no | — | PROTECT |
| venta | OneToOne → Venta | sí | — | UNIQUE |
| abono | OneToOne → Abono | sí | — | UNIQUE |
| cierre_caja | FK → CierreCaja | sí | — | PROTECT |
| tipo | INGRESO_VENTA/INGRESO_ABONO/GASTO | no | — | |
| medio_pago | EFECTIVO/TRANSFERENCIA/QR | no | — | |
| estado_pago | CONFIRMADO/PENDIENTE_VERIFICACION/**ANULADO** | no | CONFIRMADO | |
| valor | Decimal(10,2) | no | — | CHECK > 0 |
| concepto | CharField(255) | sí | — | CHECK: obligatorio en GASTO |
| fecha | DateTime | no | now | |
| fecha_confirmacion | DateTime | sí | — | |
| motivo_anulacion | CharField(255) | sí | — | **no está en el ERD** (D15); CHECK: obligatorio si ANULADO |

CHECK (`:65-108`): coherencia de origen (venta solo en INGRESO_VENTA, abono solo en INGRESO_ABONO), `movcaja_confirmado_sin_fecha_solo_efectivo`, `movcaja_sin_cierre_si_pendiente`, `movcaja_motivo_anulacion_si_anulado`.

### 2.17 `CierreCaja` — `finanzas/models.py:115-159`

| Campo | Tipo | Null | Default | Restricciones |
|---|---|---|---|---|
| operation_id | UUID | no | uuid4 | UNIQUE |
| usuario | FK → Usuario | no | — | PROTECT |
| fecha | Date | no | — | UNIQUE (un cierre por día) |
| periodo_inicio / periodo_fin | DateTime | no | — | CHECK `periodo_fin > periodo_inicio` |
| total_ingresos_ventas, total_ingresos_abonos, total_gastos, total_neto, efectivo_esperado, diferencia | Decimal(10,2) | no | 0 | calculados en `finanzas/services.py:222-259` (`calcular_totales_cierre`, el mismo cálculo que usa la vista previa, D28) |
| efectivo_contado | Decimal(10,2) | no | — | CHECK ≥ 0 |
| observaciones | Text | sí | — | CHECK: obligatorio si diferencia ≠ 0 |
| fecha_creacion | DateTime | no | now | |

### 2.18 Diferencias contra el ERD v3 §5 (y §6)

| Entidad | Campo / aspecto | ERD dice | Código dice |
|---|---|---|---|
| Todas | Enumeraciones | §6: «choices del modelo de Django con su CHECK equivalente en PostgreSQL» | Solo `Usuario.rol` tiene CHECK (`usuarios/models.py:52-55`). Los demás enums (estado, tipo, medio_pago, estado_pago, sentido…) son solo `choices` (Django no genera CHECK); un INSERT directo en BD con otro valor no se rechazaría |
| Todas | FK on_delete | §4/§5 no lo fija | PROTECT en todas (D7; pendiente de formalizar en el ERD, Contrato v2 §17) |
| Usuario | password_hash | VARCHAR(255) | Campo Django `password` con `db_column='password_hash'`, 255 (D8) |
| Usuario | campos extra | No existen | `is_staff`, `is_active`, `is_superuser`, `last_login`, `groups`, `user_permissions` (framework) |
| ConfiguracionModulo | singleton | «índice único sobre columna constante o validación equivalente» | PK fijo en `save()`; no hay restricción en BD |
| ConfiguracionModulo | actualizado_en | NOT NULL | default `timezone.now` |
| ConfiguracionPago | acepta_transferencia, acepta_qr | DEFAULT true | DEFAULT **false** (D9) |
| OperacionSincronizacion | dispositivo_id | FK NOT NULL | **NULL** permitido (P-03) |
| OperacionSincronizacion | origen | No existe | EN_LINEA / SINCRONIZACION (Contrato v2 §17) |
| OperacionSincronizacion | status_code_original | No existe | PositiveSmallInteger (para repetir el mismo código HTTP) |
| OperacionSincronizacion | recurso | ejemplos `ordenes.abonos`, `caja.movimientos` | sync: `ordenes-trabajo.abonos`, `movimientos-caja`…; en línea usa otros nombres: `movimientos_caja`, `detalles_venta`, `ordenes_trabajo`, `abonos`, `consumos_orden`, `costos_operativos_orden`, `movimientos_inventario`, `cierres_caja` (ver 02b §6.2) |
| Venta | estado_pago | CONFIRMADO, PENDIENTE_VERIFICACION | + **ANULADO** (D15) |
| Abono | estado_pago | idem | + **ANULADO** (D15) |
| Abono | R-13 (suma ≤ costo_total) | «validación en el servidor» | Solo en servicio (`servicios/services.py:195-201`), sin CHECK de BD (coincide con ERD) |
| MovimientoCaja | estado_pago | idem | + **ANULADO** (D15) |
| MovimientoCaja | motivo_anulacion | No existe | CharField(255) NULL + CHECK (D15) |
| OrdenTrabajo | utilidad_neta | CALCULADO (sin default) | default 0; se inicializa en `costo_total` |
| OrdenTrabajo | saldo_pendiente | «costo_total − suma de abonos» | Se mantiene incrementalmente: resta al abonar (`servicios/services.py:230`), suma al anular (`finanzas/services.py:131`); no se recalcula desde la suma |
| DetalleVenta | subtotal | CALCULADO | NOT NULL, sin CHECK |
| Mesa | `estado` | ENUM derivado | Igual; no hay CHECK de coherencia con la venta abierta (lo mantiene el servicio) |
| CierreCaja, Producto, MovimientoInventario, ConsumoOrden, CostoOperativoOrden, Categoria, Dispositivo | — | — | Coinciden con el ERD v3 en nombres, tipos y restricciones |

---

## 3. Endpoints reales

Recorrido de `core/urls.py` (incluye `usuarios.urls`, `inventario.urls`, `ventas.urls`, `servicios.urls`, `finanzas.urls`, el router de `core` y rutas sueltas). Columna «Sync»: combinación `resource`/`action` aceptada por `/api/sync/` (lista D17, `core/sync.py:375-400`).

| Método | Ruta | Vista | Roles | Bandera | CU | Sync |
|---|---|---|---|---|---|---|
| GET | /api/health/ | `HealthView` (`core/views.py:21`) | Público (sin auth ni BD) | — | — | No |
| POST | /api/auth/register/ | `RegistroInicialView` (`usuarios/views.py:27`) | Público (solo sin usuarios) | — | CU-17 | No |
| POST | /api/auth/login/ | `CustomTokenObtainPairView` (`usuarios/views.py:22`) | Público | — | CU-17 | No |
| POST | /api/auth/refresh/ | `CustomTokenRefreshView` (`usuarios/views.py:39`) | Público con refresh_token | — | CU-17 | No |
| GET | /api/usuarios/ | `UsuarioViewSet.list` | ADMIN | — | CU-18 | No |
| POST | /api/usuarios/ | `UsuarioViewSet.create` (`:81`) | ADMIN | — | CU-18 | No |
| PATCH | /api/usuarios/{id}/ | `UsuarioViewSet.update` partial (`:71`) | ADMIN | — | CU-18 | No |
| GET | /api/categorias/ | `CategoriaViewSet` (`inventario/views.py:35`) | ADMIN, OPERADOR | — | CU-05 | No |
| GET | /api/categorias/{id}/ | idem (retrieve) | ADMIN, OPERADOR | — | CU-05 | No |
| POST | /api/categorias/ | idem (`CreacionIdempotenteMixin`) | ADMIN | — | CU-05 | `categorias`/CREATE |
| PATCH | /api/categorias/{id}/ | idem | ADMIN | — | CU-05 | `categorias`/UPDATE |
| GET | /api/productos/?categoria=&tipo= | `ProductoViewSet` (`:49`) | ADMIN (activos+inactivos), OPERADOR (activos) | — | CU-05, CU-01 | No |
| GET | /api/productos/{id}/ | idem | ADMIN, OPERADOR | — | CU-05 | No |
| POST | /api/productos/ | idem | ADMIN | — | CU-05 | `productos`/CREATE |
| PATCH | /api/productos/{id}/ | idem (`perform_update` → `editar_producto`) | ADMIN | — | CU-05 | `productos`/UPDATE |
| GET | /api/inventario/movimientos/?producto= | `MovimientoInventarioViewSet` (`:99`) | ADMIN, OPERADOR | inventario | CU-12, CU-13 | No |
| POST | /api/inventario/movimientos/ | idem `create` (`:122`) | ENTRADA: ambos; MERMA/AJUSTE_MANUAL: ADMIN | inventario | CU-12, CU-13 | `inventario.movimientos`/CREATE |
| GET | /api/inventario/stock/?categoria=&tipo= | `StockViewSet` (`:154`) | ADMIN, OPERADOR | inventario | CU-11 | No |
| GET | /api/mesas/?activa= | `MesaViewSet` (`ventas/views.py:35`) | ADMIN, OPERADOR | ventas | CU-19, CU-02 | No |
| GET | /api/mesas/{id}/ | idem | ADMIN, OPERADOR | ventas | CU-19 | No |
| POST | /api/mesas/ | idem | ADMIN | ventas | CU-19 | `mesas`/CREATE |
| PATCH | /api/mesas/{id}/ | idem (`perform_update` → `editar_mesa`) | ADMIN | ventas | CU-19 | `mesas`/UPDATE |
| GET | /api/ventas/?estado=&mesa= | `VentaViewSet.list` (`:65`) | ADMIN, OPERADOR | ventas | CU-02 | No |
| POST | /api/ventas/ | `VentaViewSet.create` (`:94`) | ADMIN, OPERADOR | ventas | CU-01, CU-02 | `ventas`/CREATE |
| POST | /api/ventas/{id}/detalles/ | `detalles` (`:128`) | ADMIN, OPERADOR | ventas | CU-03 | `ventas.detalles`/CREATE |
| DELETE | /api/ventas/{id}/detalles/{detalle_id}/ | `eliminar_detalle` (`:156`) | ADMIN, OPERADOR | ventas | CU-03 | `ventas.detalles`/DELETE |
| PATCH | /api/ventas/{id}/cerrar/ | `cerrar` (`:186`) | ADMIN, OPERADOR | ventas | CU-04 | `ventas.cerrar`/UPDATE |
| PATCH | /api/ventas/{id}/cancelar/ | `cancelar` (`:211`) | ADMIN, OPERADOR | ventas | CU-04 alt. | `ventas.cancelar`/UPDATE |
| GET | /api/ordenes-trabajo/?estado= | `OrdenTrabajoViewSet.list` (`servicios/views.py:28`) | ADMIN, OPERADOR | servicios | CU-06, CU-07 | No |
| GET | /api/ordenes-trabajo/{id}/ | `retrieve` (D13) | ADMIN, OPERADOR | servicios | CU-07, CU-08 | No |
| POST | /api/ordenes-trabajo/ | `create` (`:68`) | ADMIN, OPERADOR | servicios | CU-06 | `ordenes-trabajo`/CREATE |
| PATCH | /api/ordenes-trabajo/{id}/estado/ | `estado` (`:93`) | ADMIN, OPERADOR | servicios | CU-07 | `ordenes-trabajo.estado`/UPDATE |
| POST | /api/ordenes-trabajo/{id}/abonos/ | `abonos` (`:121`) | ADMIN, OPERADOR | servicios | CU-08 | `ordenes-trabajo.abonos`/CREATE |
| GET/POST | /api/ordenes-trabajo/{id}/consumos/ | `consumos` (`:155`) | ADMIN, OPERADOR | servicios | CU-09 | POST: `ordenes-trabajo.consumos`/CREATE |
| GET/POST | /api/ordenes-trabajo/{id}/costos/ | `costos` (`:188`) | ADMIN | servicios | CU-10 | POST: `ordenes-trabajo.costos`/CREATE (exige ADMIN) |
| GET | /api/movimientos-caja/?fecha_desde=&fecha_hasta=&tipo= | `MovimientoCajaViewSet.list` (`finanzas/views.py:33`) | ADMIN | finanzas | CU-14, CU-20 | No |
| POST | /api/movimientos-caja/ | `create` (`:69`) — solo GASTO | ADMIN, OPERADOR | finanzas | CU-14 | `movimientos-caja`/CREATE (solo GASTO) |
| GET | /api/movimientos-caja/pendientes/ | `pendientes` (`:93`) | ADMIN, OPERADOR | finanzas | CU-01/04/08 (confirmación) | No |
| GET | /api/movimientos-caja/resumen/?fecha= | `resumen` (`:100`) | ADMIN | finanzas | CU-20 | No |
| PATCH | /api/movimientos-caja/{id}/confirmar/ | `confirmar` (`:106`) | ADMIN, OPERADOR | finanzas | HU-050 (E-01) | **Rechazado** (`PAGO_NO_VERIFICABLE`) |
| PATCH | /api/movimientos-caja/{id}/anular/ | `anular` (`:130`) | ADMIN | finanzas | D15 (sin CU) | No (→ `DATOS_INVALIDOS`) |
| GET | /api/cierres-caja/?fecha= | `CierreCajaViewSet.list` (`:156`, `get_queryset` `:164`) | ADMIN | finanzas | CU-15 | No |
| GET | /api/cierres-caja/vista-previa/ | `vista_previa` (`:171-178`) — **nuevo, D28** | ADMIN | finanzas | CU-15 | No |
| POST | /api/cierres-caja/ | `create` (`:180`) | ADMIN | finanzas | CU-15 | No |
| GET | /api/configuracion/modulos/ | `ConfiguracionModuloView` (`core/views.py:57`) | ADMIN, OPERADOR | — | CU-16 | No |
| PATCH | /api/configuracion/modulos/ | idem | ADMIN | — | CU-16 | `configuracion.modulos`/UPDATE |
| GET | /api/configuracion/pagos/ | `ConfiguracionPagoView` (`:69`) | ADMIN, OPERADOR | — | CU-22 | No |
| PATCH | /api/configuracion/pagos/ | idem | ADMIN | — | CU-22 | No |
| GET | /api/dispositivos/ | `DispositivoViewSet` (`:84`) | ADMIN | — | CU-21 | No |
| GET | /api/dispositivos/{id}/ | idem | ADMIN | — | CU-21 | No |
| POST | /api/dispositivos/ | idem | ADMIN | — | CU-21 | No |
| PATCH | /api/dispositivos/{id}/ | `partial_update` (`:102`) | ADMIN | — | CU-21 | No |
| POST | /api/sync/ | `SincronizacionView` (`core/sync.py:468`) | Autenticado (`IsAuthenticated`) + `X-Device-Id` autorizado | — (por operación) | Todos los offline | — |
| GET | /api/sync/novedades/?atendida= | `NovedadSincronizacionViewSet` (`core/sync.py:512`) | ADMIN, OPERADOR | — | CU-23 | No |
| GET | /api/sync/novedades/{id}/ | idem | ADMIN, OPERADOR | — | CU-23 | No |
| PATCH | /api/sync/novedades/{id}/ | `partial_update` (`:537`) | ADMIN, OPERADOR | — | CU-23 | No |
| * | /admin/ | Django admin | `is_staff` | — | — | — |
| GET | cualquier ruta que no empiece por `api/` ni `admin/` | `spa_view` (`core/views.py:33`; `core/urls.py` regex `^(?!api/|admin/).*$`) | Público | — | — | — |

Métodos no definidos (PUT, DELETE en catálogo, mesas, usuarios, dispositivos; GET de detalle de usuarios y ventas) responden **405 METODO_NO_PERMITIDO** (`inventario/views.py:26-32`, `ventas/views.py:26-32`, `usuarios/views.py:71-73`). Además, cada `DefaultRouter` expone su vista raíz (p. ej. `GET /api/`) y sufijos de formato (`.json`), públicos por no haber `DEFAULT_PERMISSION_CLASSES` en `REST_FRAMEWORK` (`core/settings.py:211-221`); solo listan URLs, no datos.

### 3.1 Diferencias contra el Contrato API v2

**Endpoints faltantes:** NINGUNO. Todas las rutas de las tablas §3–§13 del Contrato existen con su método y rol.

**Endpoints extra (no están en el Contrato):**

| Ruta | Origen | Evidencia |
|---|---|---|
| GET /api/health/ | D25 (despliegue) | `core/views.py:21-30` |
| GET /api/ordenes-trabajo/{id}/ | D13 (wireframe 5) | `servicios/views.py:28-51`, `serializers.py:60-67` |
| PATCH /api/movimientos-caja/{id}/anular/ | D15 | `finanzas/views.py:130-153` |
| GET /api/cierres-caja/vista-previa/ | **D28** (correcciones pre-documentación, A5, commit `3072214`); extiende el Contrato v2 §11 | `finanzas/views.py:171-178`, `finanzas/serializers.py:66-77`, `finanzas/services.py:262-274` |
| GET /api/{categorias,productos,mesas,dispositivos,sync/novedades}/{id}/ | Efecto de `RetrieveModelMixin`/router | ViewSets citados |
| /admin/ | Django admin habilitado | `core/urls.py` (`path('admin/', …)`) |
| Rutas SPA (catch-all) | D25 | `core/views.py:33-45` |

**Rutas cambiadas:** NINGUNA.

**Payloads o respuestas distintos:**

| Endpoint | Contrato v2 | Código | Evidencia |
|---|---|---|---|
| POST /api/sync/ | Cada operación: `operation_id, resource, action, payload` | Exige además **`fecha_cliente`** (D18); un lote > 200 operaciones → 400 | `core/sync.py:36-55` |
| POST /api/sync/ (payload) | El dispositivo no envía precio | Acepta `precio_unitario` opcional en `ventas` y `ventas.detalles` (D19). Desde `20907da` el frontend sí lo envía en lo que encola | `core/sync.py:191-194`, `:222`; `frontend/src/api/ventas.ts:47-49` |
| Respuesta de abono | `saldo_pendiente: 55000.00` (número) | `saldo_pendiente` se serializa como **texto** (`str(...)`) | `servicios/views.py:130` |
| Errores 409 `STOCK_INSUFICIENTE` | `details: {producto_id, stock_disponible, cantidad_solicitada}` (números) | Ventas/entregas: `details.productos[] = {producto_id, nombre, disponible, requerido}` (texto); merma/ajuste: `{producto_id, disponible, solicitado}` (texto) | `ventas/services.py:122-147`, `inventario/services.py:69-78` |
| 409 `PRODUCTO_CON_EXISTENCIAS` | details sin forma definida | `details.stock_actual` como texto | `inventario/services.py:20-28` |
| Respuestas de venta (crear, abrir sesión, cerrar, cancelar) | Subconjunto de campos | Venta completa: `id, operation_id, tipo, estado, mesa_id, fecha_apertura, fecha_cierre, medio_pago, estado_pago, total, detalles` | `ventas/serializers.py:44-57` |
| Respuesta de mesa, detalle, consumo, cierre, movimiento | Subconjunto | Incluyen además `operation_id` y demás campos del modelo | serializers de cada app |
| GET /api/inventario/stock/ | Sin ejemplo | `{id, categoria_id, nombre, tipo, unidad_medida, controla_stock, stock_actual, stock_minimo, alerta_stock_minimo}`; `stock_*` = null si `controla_stock=false` | `inventario/serializers.py:86-115` |
| POST /api/cierres-caja/ | «El servidor rechaza el cierre si quedan operaciones pendientes de sincronizar (E-05)» | El backend **no** lo verifica (no conoce la cola local); lo impide el frontend con la cola del propio dispositivo | `finanzas/services.py:277-339`; `frontend/src/componentes/PanelCierreCaja.tsx:86`, `:178-183`, `:228` |
| Códigos de error | §14.2–14.3 | Nuevos: `CIERRE_YA_REALIZADO` (409, D14), `OPERACION_PREVIA_FALLIDA` (409, D20). `PAGO_YA_CONFIRMADO` también se usa al anular. `MOVIMIENTO_EN_PERIODO_CERRADO` **nunca se emite** (D18) | `finanzas/services.py:329-334`, `core/sync.py:86-93` |
| Cierre: cálculo de período | «pendiente de definir» (§11) | Definido por D14 | `finanzas/services.py:192-219` (`_calcular_periodo_inicio`, `_movimientos_a_consolidar`) |
| Cierre: totales por medio de pago (CU-15) | «presentar los totales por medio de pago» | `CierreCaja` sigue sin guardarlos; la vista previa (D28) sí los devuelve en `por_medio_pago`, pero la PWA no los muestra (F-21) | `finanzas/models.py:115-159`; `finanzas/services.py:244-250`; `frontend/src/componentes/PanelCierreCaja.tsx:153-175` |
| PATCH /api/mesas/{id}/, /api/categorias/{id}/, /api/productos/{id}/ | §13.1: «toda escritura con operation_id» es idempotente | En edición, enviar `operation_id` responde 400 («operation_id no se puede modificar.») y la vista **no pasa por `ejecutar_con_idempotencia`**: solo la CREACIÓN de estos recursos es idempotente en línea (por `/api/sync/` sí se registran) | `core/serializers.py:6-28`, `ventas/views.py:61-62`, `inventario/views.py:62-66` |
| GET /api/sync/novedades/ | Novedades de la instalación | Lista **todas** las novedades de sincronización, sin filtrar por usuario ni dispositivo | `core/sync.py:527-535` |

### 3.2 Endpoint nuevo: `GET /api/cierres-caja/vista-previa/` (D28)

| Aspecto | Valor | Evidencia |
|---|---|---|
| Vista | `CierreCajaViewSet.vista_previa`, `@action(detail=False, methods=['get'], url_path='vista-previa')` | `finanzas/views.py:171-178` |
| Permisos | Los del ViewSet: `EsAdmin` + `ModuloActivoPermission` con `modulo='finanzas'`. OPERADOR → 403 `PERMISO_INSUFICIENTE`; módulo apagado → 403 `MODULO_DESACTIVADO` | `finanzas/views.py:161-162` |
| Servicio | `calcular_vista_previa_cierre()`: `periodo_fin = now()`, `periodo_inicio` según D14 y los movimientos de `_movimientos_a_consolidar` **sin** `select_for_update` y sin guardar nada | `finanzas/services.py:262-274` |
| Cálculo compartido | `calcular_totales_cierre(movimientos)` devuelve `total_ingresos_ventas`, `total_ingresos_abonos`, `total_gastos`, `total_neto`, `efectivo_esperado`, `por_medio_pago` (ingresos sin gastos, por EFECTIVO/TRANSFERENCIA/QR) y `cantidad_movimientos`. Lo usan la vista previa y `crear_cierre`, así que no pueden calcular distinto | `finanzas/services.py:222-259`, `:289-294` |
| Serializer | `VistaPreviaCierreSerializer`: montos `DecimalField(max_digits=12)` que salen como números JSON (`COERCE_DECIMAL_TO_STRING=False`); fechas con `-05:00` | `finanzas/serializers.py:66-77` |
| Pruebas | `finanzas.tests.VistaPreviaCierreTests` (6) | `finanzas/tests.py:398-475` |
| Relación con el Contrato | No existe en el Contrato v2; lo extiende (§11) | `CLAUDE.md` D28; informe `10 §3` |

Ejemplo de respuesta y tabla de campos: informe `10_cambios_post_inventario.md §3`.

---

## Cambios respecto a la versión del 02/10

- Revisado el diff `8910c90..7326a5a` del backend: solo cambiaron `core/settings.py` (B1, `e57e7a6`) y `finanzas/` (A5, `3072214`). Los lotes de corrección 4–6 (E-10…E-19) **no tocaron el backend** y no hay migraciones nuevas (siguen 22).
- §2.17: los totales del cierre se calculan en `calcular_totales_cierre`, compartido con la vista previa.
- §3: nueva fila `GET /api/cierres-caja/vista-previa/`; líneas de `finanzas/views.py` actualizadas (el archivo creció con la acción nueva).
- §3.1: endpoint extra D28; el frontend ya envía `precio_unitario` (D19); la evidencia de E-05 pasa a `PanelCierreCaja.tsx`; nueva fila sobre los totales por medio de pago.
- §3.2 nueva: detalle del endpoint D28.
- Referencias a `core/settings.py` corridas (+8 líneas desde la sección de `SECRET_KEY`).
