Actualizado al commit 7326a5a (03/10/2026)

# 02b — Backend: autenticación, RBAC, reglas, sincronización, errores y configuración

> Parte 2 de 2. Rutas relativas a `backend/` salvo indicación.

---

## 4. Autenticación

| Aspecto | Implementación real | Evidencia |
|---|---|---|
| Librería y token | `djangorestframework-simplejwt` 5.5.1, `JWTAuthentication` como única clase de autenticación; tokens JWT firmados con el algoritmo por defecto de simplejwt (HS256 con `SECRET_KEY`; `SIMPLE_JWT` no lo cambia) | `core/settings.py:211-214`, `:225-228` |
| Vida del access | 30 minutos | `core/settings.py:226` (D23) |
| Vida del refresh | 7 días | `core/settings.py:227` (D23) |
| Rotación / lista negra | NO configuradas (sin `ROTATE_REFRESH_TOKENS`, sin app `token_blacklist`) | `core/settings.py:65-80`, `:225-228` |
| Login | `POST /api/auth/login/` → `{access_token, refresh_token, usuario_id, rol}`; usuario inexistente, contraseña incorrecta o inactivo → 401 `CREDENCIALES_INVALIDAS` con el mismo mensaje | `usuarios/serializers.py:19-40` |
| Refresh | `POST /api/auth/refresh/` con `{refresh_token}` → `{access_token}`; inválido/expirado → 401 `NO_AUTENTICADO` «El refresh token no es válido o expiró.» | `usuarios/serializers.py:123-137`, `usuarios/views.py:39-47` |
| Registro del Administrador inicial | `POST /api/auth/register/` (público) crea el ADMIN **solo si no existe ningún usuario**; si ya hay usuarios → 409 `INSTALACION_YA_INICIALIZADA`. En la misma transacción crea `ConfiguracionModulo` y `ConfiguracionPago` (D9). Valida la contraseña con los validadores de Django | `usuarios/services.py:12-45`, `usuarios/serializers.py:43-59` |
| Pantalla de registro en la PWA | **NO ENCONTRADA**: el frontend no tiene formulario de registro; el primer ADMIN se crea por HTTP (curl/Postman), como indican `README.md` §4 y `DESPLIEGUE.md` §3 | `frontend/src/App.tsx` (rutas) |
| Hash de contraseñas | Hasher por defecto de Django 6.1 (PBKDF2-SHA256; no se define `PASSWORD_HASHERS` fuera de pruebas). En `manage.py test` se usa MD5 solo para acelerar la suite | `core/settings.py:231-237` |
| Validadores de contraseña | `UserAttributeSimilarity`, `MinimumLength` (8 por defecto), `CommonPassword`, `NumericPassword` | `core/settings.py:142-155` |
| Logout | **No hay endpoint en el backend.** El frontend borra la sesión de IndexedDB y, desde E-19, las bandejas de selección guardadas (`frontend/src/api/auth.ts:16-18`, `frontend/src/db/baseLocal.ts:195-198`). Los tokens emitidos siguen siendo válidos hasta expirar. Con operaciones en cola, el cierre de sesión se bloquea (D21) | `frontend/src/contexto/SesionContext.tsx:79-92` |
| Cierre por inactividad (D27) | **Solo frontend**; el backend no lo conoce. Tras 30 min sin interacción, con `navigator.onLine` y la cola vacía, el cliente llama al mismo cierre de sesión local. Los JWT ya emitidos siguen válidos hasta vencer (no hay lista negra). Detalle y riesgos en `03 §9` | `frontend/src/componentes/Layout.tsx:41-76`; `frontend/src/contexto/inactividad.ts` |
| Login sin conexión | El primer login exige conexión (llama a `/api/auth/login/`). Sin conexión, la app reutiliza la sesión guardada en Dexie al abrir (`obtenerSesion`) y deja trabajar; si el access vence y no hay red, la petición falla por red y la escritura se encola. Al volver la conexión, si el refresh también venció, el cliente borra la sesión y pide login; si hay cola pendiente, solo se acepta el mismo usuario (D21/D23) | `frontend/src/contexto/SesionContext.tsx:49-77`, `frontend/src/api/cliente.ts:49-88` |
| Usuario inactivo | `save()` copia `activo` a `is_active`; `authenticate` rechaza inactivos | `usuarios/models.py:58-62` |

---

## 5. RBAC

### 5.1 Clases y funciones de permiso

| Nombre | Qué hace | Evidencia |
|---|---|---|
| `EsAdminUOperador` | Autenticado con rol ADMIN u OPERADOR | `core/permissions.py:9-18` |
| `EsAdmin` | Autenticado con rol ADMIN | `core/permissions.py:21-30` |
| `ModuloActivoPermission` | Lanza 403 `MODULO_DESACTIVADO` si la bandera del `view.modulo` está en false | `core/permissions.py:75-85` |
| `verificar_modulo_activo(modulo)` | Mismo chequeo como función, usado por `/api/sync/` por operación | `core/permissions.py:44-61` |
| `verificar_rol_admin(usuario)` | 403 `PERMISO_INSUFICIENTE` «Solo un ADMIN puede realizar esta operación.» (para sync) | `core/permissions.py:64-72` |
| Mixins por método | `PermisosPorRolMixin` (lectura ambos, escritura ADMIN) en catálogo; `get_permissions` por acción en mesas, órdenes, caja, configuración | `inventario/views.py:17-23`, `ventas/views.py:50-52`, `servicios/views.py:43-46`, `finanzas/views.py:37-40`, `core/views.py:48-54` |
| Regla dentro del servicio | MERMA / AJUSTE_MANUAL exigen ADMIN aunque el endpoint admita ambos roles | `inventario/services.py:128-159` |
| `IsAuthenticated` (DRF) | Solo en `POST /api/sync/` | `core/sync.py:468-471` |

### 5.2 Matriz real rol × acción

| Acción | ADMIN | OPERADOR |
|---|---|---|
| Registrar primer ADMIN | Público (una sola vez) | Público (una sola vez) |
| Login / refresh | Sí | Sí |
| Listar / crear / editar / desactivar usuarios | Sí (solo crea OPERADOR) | No (403) |
| Ver categorías y productos | Sí (activos + inactivos, con `costo_produccion`) | Sí (solo activos, **sin** `costo_produccion`) |
| Crear / editar categorías y productos, baja lógica | Sí | No |
| Ver mesas | Sí | Sí |
| Crear / activar / desactivar mesas | Sí | No |
| Venta rápida, abrir sesión, agregar/quitar detalle, cerrar, cancelar | Sí | Sí |
| Listar ventas | Sí | Sí |
| Crear orden, cambiar estado, abonos, consumos, ver detalle de orden | Sí (ve `utilidad_neta`) | Sí (**sin** `utilidad_neta`) |
| Registrar / ver costos operativos de una orden | Sí | No (403) |
| Ver stock y movimientos de inventario | Sí | Sí |
| Ingreso de mercancía (ENTRADA) | Sí | Sí |
| MERMA y AJUSTE_MANUAL | Sí | No (403 `PERMISO_INSUFICIENTE`) |
| Registrar gasto | Sí | Sí |
| Ver pagos pendientes de verificación | Sí | Sí |
| Confirmar pago electrónico | Sí | Sí |
| Anular pago pendiente (D15) | Sí | No |
| Histórico de movimientos de caja | Sí | No |
| Resumen diario | Sí | No |
| Cierre de caja (listar / crear) | Sí | No |
| Leer configuración de módulos y pagos | Sí | Sí |
| Modificar módulos o medios de pago | Sí | No |
| Dispositivos (listar, registrar, autorizar, desactivar) | Sí | No |
| Enviar lote `/api/sync/` | Sí | Sí (cada operación valida su propio rol) |
| Ver / marcar novedades de sincronización | Sí | Sí |

### 5.3 Cómo se oculta información sensible al OPERADOR

- `costo_produccion`: `ProductoSerializer.to_representation` elimina la clave si el rol no es ADMIN (`inventario/serializers.py:32-39`, D5). El campo **no** se envía (no va vacío).
- `utilidad_neta`: `OrdenTrabajoSerializer.to_representation` la elimina para no-ADMIN (`servicios/serializers.py:51-57`); `/costos/` es solo ADMIN (`servicios/views.py:43-46`).
- Histórico de caja, resumen diario y cierres: 403 para OPERADOR (`finanzas/views.py:45-48`, `:161-162`).
- Lo que el OPERADOR **sí** puede ver: totales de todas las ventas (`GET /api/ventas/`), `costo_total` y `saldo_pendiente` de las órdenes, y los valores de todos los pagos pendientes (`/pendientes/`).

### 5.4 Dónde se emite `PERMISO_INSUFICIENTE`

1. Cualquier `PermissionDenied` de DRF (permission classes) → 403 «No tiene permisos suficientes para realizar esta operación.» (`core/exceptions.py:72-77`).
2. `verificar_rol_admin` en `/api/sync/` (`core/permissions.py:64-72`).
3. `registrar_movimiento` para MERMA/AJUSTE_MANUAL de un OPERADOR: «Solo un ADMIN puede registrar movimientos de tipo {tipo}.» (`inventario/services.py:143-148`).

---

## 6. Reglas de negocio críticas

### 6.1 Stock

- **Dónde se crea `MovimientoInventario`**: solo en `inventario/services.py`: `registrar_entrada` (`:36-58`), `registrar_merma` (`:61-90`), `registrar_ajuste_manual` (`:93-125`), `crear_salida_venta` (`:162-181`) y `crear_salida_servicio` (`:184-201`).
- **Dónde se actualiza `stock_actual`**: en esas mismas funciones (`:47`, `:79`, `:113`, `:172`, `:192`), siempre en la misma transacción que crea el movimiento. `stock_actual` es de solo lectura en la API (`inventario/serializers.py:30`).
- Cuándo se descuenta: al **cerrar** una venta (R-09), no al agregar el detalle (`ventas/services.py:338-399`); al pasar una orden a ENTREGADO (`servicios/services.py:116-140`). Productos con `controla_stock=false` nunca generan movimiento.
- Stock negativo: prohibido. Validación previa de toda la operación (D12) en `ventas/services.py:122-147` y `servicios/services.py:88-113`; merma/ajuste en `inventario/services.py:67-78`, `:99-112`. D24: al agregar un detalle en línea se valida (sin descontar) la cantidad acumulada (`ventas/services.py:263-283`); por sync no (`core/sync.py:223`).

### 6.2 Caja (`MovimientoCaja`)

| Origen | Función | Estado de pago | Evidencia |
|---|---|---|---|
| Venta rápida | `crear_venta_rapida` crea 1 `INGRESO_VENTA` por el total | EFECTIVO → CONFIRMADO con `fecha_confirmacion`; TRANSFERENCIA/QR → PENDIENTE_VERIFICACION | `ventas/services.py:207-216` |
| Cierre de sesión | `cerrar_venta` crea 1 `INGRESO_VENTA` | idem | `ventas/services.py:383-392` |
| Abono | `registrar_abono` crea 1 `INGRESO_ABONO` | idem | `servicios/services.py:219-228` |
| Gasto | `registrar_gasto` crea 1 `GASTO` con concepto | EFECTIVO → CONFIRMADO; electrónico → PENDIENTE_VERIFICACION | `finanzas/services.py:45-63` |

El medio de pago debe estar habilitado en `ConfiguracionPago` (si no, 400 `DATOS_INVALIDOS`): `ventas/services.py:79-91`, `servicios/services.py:25-37`, `finanzas/services.py:19-31`. Las banderas de módulo no suprimen estos efectos (P-04): cerrar una venta con Finanzas desactivado igual crea el `MovimientoCaja`.

Confirmar (`finanzas/services.py:69-98`) y anular (`:101-135`) actualizan el movimiento y su Venta/Abono de origen; al anular un abono, `saldo_pendiente += valor` (`:130-132`). No se revierte inventario.

### 6.3 Saldo pendiente de cada orden

- Al crear: `saldo_pendiente = costo_total` (`servicios/services.py:51-71`).
- Al abonar: valida `valor ≤ saldo_pendiente` (409 `ABONO_EXCEDE_SALDO`) y resta (`:195-231`). El abono queda válido aunque la orden esté ENTREGADO (no se restringe por estado, `:187-192`).
- Al anular un abono pendiente: suma el valor (`finanzas/services.py:130-132`).
- Se mantiene de forma incremental; no se recalcula como `costo_total − Σ abonos`.

### 6.4 Utilidad neta

`utilidad_neta = costo_total − Σ CostoOperativoOrden.valor`, recalculada en cada costo nuevo (`servicios/services.py:284-287`). No incluye el valor de insumos consumidos ni los abonos.

### 6.5 Resumen diario (`calcular_resumen`, `finanzas/services.py:148-189`)

- Rango: día local `America/Bogota` [00:00, 24:00) (`:141-145`).
- Incluye todos los movimientos del día **excepto ANULADO**, confirmados o pendientes.
- `ingresos_ventas`, `ingresos_abonos`, `gastos` = suma de `valor` por tipo; `neto = ventas + abonos − gastos`.
- `por_medio_pago` = ingresos (sin gastos) por EFECTIVO/TRANSFERENCIA/QR.
- `pendiente_verificacion` = ingresos en PENDIENTE_VERIFICACION.

### 6.6 Cierre de caja y vista previa (`finanzas/services.py:192-339`, D14 y D28)

Desde A5 (`3072214`) el cierre está dividido en funciones reutilizables. Su comportamiento no cambió: las 29 pruebas previas de `finanzas`, incluida la de concurrencia, siguen en verde.

| Función | Qué hace | Evidencia |
|---|---|---|
| `_calcular_periodo_inicio(periodo_fin)` | Devuelve el `periodo_fin` del último cierre, o la fecha del primer movimiento si no hay cierres. Tiene una guarda para que quede estrictamente antes de `periodo_fin` | `:192-210` (guarda `:208-209`) |
| `_movimientos_a_consolidar(periodo_fin)` | Queryset, sin bloqueo, de los movimientos `CONFIRMADO` con `cierre_caja IS NULL` y `fecha ≤ periodo_fin`. El criterio es «todavía en ningún cierre», no un rango de fechas | `:213-219` |
| `calcular_totales_cierre(movimientos)` | Totales por tipo; `total_neto = ventas + abonos − gastos`; `efectivo_esperado = ingresos en EFECTIVO − gastos en EFECTIVO`; `por_medio_pago` = ingresos (sin gastos) por medio; `cantidad_movimientos`. No guarda ni bloquea nada | `:222-259` |
| `calcular_vista_previa_cierre()` | `periodo_fin = now()` más las tres funciones anteriores, **sin** `select_for_update` ni escritura (D28) | `:262-274` |
| `crear_cierre(...)` | Usa las mismas funciones y agrega lo que la vista previa no hace (pasos de abajo) | `:277-339` |

Pasos de `crear_cierre`:
1. `periodo_fin = now()`; `periodo_inicio` con `_calcular_periodo_inicio` (`:284-285`).
2. Bloquea con `select_for_update()` los movimientos de `_movimientos_a_consolidar` (`:287`).
3. Calcula los totales con `calcular_totales_cierre` (`:289-294`) y `diferencia = efectivo_contado − efectivo_esperado`.
4. Si `diferencia ≠ 0` y no hay observaciones → 400 `DATOS_INVALIDOS` (`:297-303`).
5. Crea el `CierreCaja` dentro de `transaction.atomic()` (`:305-321`). Si la `fecha` ya tiene cierre → 409 `CIERRE_YA_REALIZADO` (`:322-334`).
6. Asigna `cierre_caja` a los movimientos consolidados (`:336-337`).

`CierreCaja` sigue guardando solo los totales por tipo y los datos del efectivo. `por_medio_pago` y `cantidad_movimientos` solo aparecen en la respuesta de la vista previa.

---

## 7. Máquinas de estado

| Entidad | Estados | Transiciones permitidas | Evidencia |
|---|---|---|---|
| Venta RAPIDA | — → CERRADA | Nace CERRADA (no pasa por ABIERTA) | `ventas/services.py:150-217` |
| Venta SESION_DINAMICA | ABIERTA → CERRADA; ABIERTA → CANCELADA | Sobre CERRADA/CANCELADA: 409 `VENTA_YA_CERRADA` (agregar/quitar detalle, cerrar, cancelar) | `ventas/services.py:220-421` |
| Mesa.estado | DISPONIBLE ↔ OCUPADA | Abrir sesión → OCUPADA; cerrar o cancelar → DISPONIBLE. Mesa.activa: true ↔ false (no se desactiva OCUPADA; reactivar revalida límite 15) | `ventas/services.py:41-73`, `:250-253`, `:394-397`, `:415-418` |
| OrdenTrabajo | RECIBIDO → EN_PROCESO → LISTO → ENTREGADO | Solo al siguiente; saltar/retroceder 400; desde ENTREGADO 409 `ORDEN_YA_ENTREGADA` | `servicios/services.py:17-22`, `:143-180` |
| ConsumoOrden | PENDIENTE → APLICADO | Solo al entregar la orden (todos a la vez) | `servicios/services.py:116-140` |
| estado_pago (MovimientoCaja, Venta, Abono) | CONFIRMADO; PENDIENTE_VERIFICACION → CONFIRMADO; PENDIENTE_VERIFICACION → ANULADO | Efectivo nace CONFIRMADO; electrónico nace PENDIENTE. Confirmar o anular algo que no está pendiente → 409 `PAGO_YA_CONFIRMADO` | `finanzas/services.py:69-135` |
| OperacionSincronizacion.estado | APLICADA / RECHAZADA / CONFLICTO (al registrar). DUPLICADA solo se devuelve en la respuesta, nunca se guarda | `core/idempotencia.py:98-102`, `:159-169` |

---

## 8. Transacciones y bloqueos

- **Toda escritura en línea de dominio** (crear venta, detalle, cerrar, cancelar, órdenes y subrecursos, movimientos de inventario, gastos, confirmar/anular, cierres, creación de categorías/productos/mesas) pasa por `ejecutar_con_idempotencia`, que abre `transaction.atomic()` exterior + savepoint interior (`core/idempotencia.py:53-62`). Si la operación falla, sus efectos se revierten y se registra el rechazo.
- Cada operación de `/api/sync/` corre en su propia transacción (mismo núcleo `_registrar_y_ejecutar`); un fallo no aborta el lote.
- `transaction.atomic()` explícito adicional: registro del ADMIN (`usuarios/services.py:34`), editar dispositivo (`core/services.py:50`), editar mesa (`ventas/services.py:54`, E-05), abrir sesión (`:230`), crear cierre (`finanzas/services.py:306`).
- `select_for_update()`: productos en entrada/merma/ajuste (`inventario/services.py:46`, `:67`, `:99`); productos de la venta en orden estable para evitar interbloqueos (`ventas/services.py:101-107`); mesas activas al crear/reactivar (`:25-28`); mesa al abrir/cerrar/cancelar; venta al cerrar/cancelar (`:345`, `:404`); producto al agregar detalle (`:267`); orden al cambiar estado/abonar/costear (`servicios/services.py:149`, `:193`, `:272`); productos de consumos al entregar (`:78-85`); movimiento/venta/abono/orden al confirmar o anular (`finanzas/services.py:76-131`); movimientos a consolidar en el cierre (`finanzas/services.py:287`; la vista previa no bloquea); dispositivo autorizado previo (`core/services.py:52`).
- Concurrencia probada: dos aperturas simultáneas de la misma mesa (`ventas/tests.py:505-553`), dos cierres simultáneos (`finanzas/tests.py:398-465`), dos peticiones con el mismo `operation_id` (`core/tests.py:277-305`).

**Confirmación explícita:** ningún cálculo de stock, caja, saldo, total, subtotal, utilidad ni totales de cierre lo hace el cliente con efecto en la base de datos. Los serializers marcan esos campos como solo lectura (`inventario/serializers.py:30`, `ventas/serializers.py:41`, `:57`, `servicios/serializers.py:49`, `finanzas/serializers.py:21`, `:63`) y los payloads que arma el frontend no los incluyen (`frontend/src/api/ventas.ts:39-70`, `ordenesTrabajo.ts:76-149`, `caja.ts:56-92`). El frontend sí calcula valores **solo para mostrar**: el «Total estimado» de la bandeja, la «Diferencia estimada» del arqueo (desde A5, efectivo contado − `efectivo_esperado` de la vista previa del servidor, `frontend/src/componentes/PanelCierreCaja.tsx:81-82`) y las vistas «provisional» sin conexión (D22). El único dato no calculado que el dispositivo agrega al payload encolado es el `precio_unitario` que mostró (D19, `frontend/src/api/ventas.ts:47-49`).

---

## 9. Sincronización

### 9.1 Flujo completo de `POST /api/sync/` (`core/sync.py:468-491`)

1. Autenticación JWT (`IsAuthenticated`).
2. **Antes de leer el lote**, valida `X-Device-Id` contra un `Dispositivo` activo y `autorizado_offline=True` (`core/services.py:61-87`). Si falta o no coincide → 403 `DISPOSITIVO_NO_AUTORIZADO` para el lote completo, **sin registrar** ningún `operation_id` (D16).
3. Valida el sobre: `operations[]` con `operation_id`, `resource`, `action` (CREATE/UPDATE/DELETE), `fecha_cliente`, `payload`; máximo 200 operaciones (`:36-55`).
4. Procesa las operaciones **en el orden recibido**, cada una en su transacción (`_procesar_operacion`, `:426-465`):
   - Busca el `operation_id` en `OperacionSincronizacion`; si existe → resultado `DUPLICADA` con `estado_original` (y `codigo_conflicto`/`mensaje` si fue rechazo) sin efectos.
   - Si `fecha_cliente` está más de 5 min en el futuro → RECHAZADA `DATOS_INVALIDOS` (`:445-450`).
   - Busca el manejador `(resource, action)` en la lista cerrada D17 (`:375-400`); si no existe → RECHAZADA `DATOS_INVALIDOS` «La operación {resource}.{action} requiere conexión.».
   - El manejador verifica módulo y rol y llama a la misma función de `services.py` que el endpoint en línea, usando `fecha_cliente` como fecha de negocio (D18) y el `precio_unitario` del dispositivo si llega (D19).
   - Referencias a objetos que debía crear una operación fallida → CONFLICTO `OPERACION_PREVIA_FALLIDA` (D20, `:62-94`).
   - Registra el resultado en `OperacionSincronizacion` (`origen=SINCRONIZACION`, `dispositivo`, `payload`, `objeto_id` incluso si falla).
5. Actualiza `Dispositivo.ultima_sincronizacion` (`:488-489`) y responde `200 {"results": [...]}`.

### 9.2 Idempotencia por `operation_id`

- Núcleo único `_registrar_y_ejecutar` (`core/idempotencia.py:30-119`), compartido por línea y sync.
- En línea (`ejecutar_con_idempotencia`, `:122-140`): un `operation_id` repetido devuelve **el mismo código HTTP** de la primera vez; si fue éxito, el **estado actual** del objeto; si fue error, el mismo error. Si el cliente no envía `operation_id`, la vista genera uno.
- Carrera de dos peticiones con el mismo id: la perdedora atrapa `IntegrityError` y repite el resultado de la ganadora (`:112-117`).
- Valores de `recurso` registrados en línea: `categorias`, `productos`, `mesas`, `ventas`, `detalles_venta`, `ordenes_trabajo`, `abonos`, `consumos_orden`, `costos_operativos_orden`, `movimientos_inventario`, `movimientos_caja`, `cierres_caja`. Por sync se registra el `resource` del Contrato (`ventas.detalles`, `ordenes-trabajo.abonos`, etc.). Ambos espacios de nombres conviven en la misma tabla.

### 9.3 `X-Device-Id` y dispositivo autorizado

- La PWA genera el identificador con `crypto.randomUUID()` la primera vez y lo guarda en el almacén `meta` de Dexie (`frontend/src/db/baseLocal.ts:104-110`); lo envía en cada `POST /api/sync/` (`frontend/src/api/sync.ts:9-25`).
- Solo un dispositivo puede tener `autorizado_offline=True` (índice único parcial); autorizar uno revoca al anterior en la misma transacción (`core/services.py:40-58`).

### 9.4 Estados

| Estado | Cuándo | Qué hace el cliente | Evidencia |
|---|---|---|---|
| APLICADA | La operación se validó y aplicó | La quita de la cola | `core/idempotencia.py:183-187`; `frontend/src/sync/motor.ts:117-121` |
| DUPLICADA | `operation_id` ya registrado | La quita de la cola | `core/idempotencia.py:159-169` |
| RECHAZADA | Error con HTTP ≠ 409 (400 datos, 403 permiso/módulo) | La quita de la cola y la guarda en `novedades` local | `core/idempotencia.py:98-102`; `motor.ts:122-131` |
| CONFLICTO | Error de negocio 409 | idem | idem |

### 9.5 Novedades

- `GET /api/sync/novedades/?atendida=` lista solo operaciones `origen=SINCRONIZACION` en RECHAZADA o CONFLICTO, ordenadas por `fecha_procesamiento` descendente (`core/sync.py:527-535`). Sin filtro por usuario/dispositivo.
- `PATCH /api/sync/novedades/{id}/ {"atendida": true|false}` (`:537-543`).
- Campos: `id, operation_id, dispositivo_id, usuario_id, recurso, accion, estado, codigo_conflicto, mensaje, objeto_id, fecha_cliente, fecha_procesamiento, atendida` (`:494-505`).

### 9.6 Códigos de rechazo y conflicto en `/api/sync/`

| Código | Estado | Cuándo ocurre | Mensaje (exacto) |
|---|---|---|---|
| DISPOSITIVO_NO_AUTORIZADO | (lote, HTTP 403) | Sin `X-Device-Id` o dispositivo no activo/autorizado | «Falta el encabezado X-Device-Id.» / «El dispositivo no está autorizado para sincronizar sin conexión.» |
| PERMISO_INSUFICIENTE | RECHAZADA | OPERADOR envía categorías, productos, mesas, costos, configuración de módulos, MERMA o AJUSTE_MANUAL | «Solo un ADMIN puede realizar esta operación.» / «Solo un ADMIN puede registrar movimientos de tipo {tipo}.» |
| MODULO_DESACTIVADO | RECHAZADA | Operación de un módulo apagado | «El módulo {modulo} está desactivado.» |
| DATOS_INVALIDOS | RECHAZADA | Payload mal formado, referencia ausente, recurso fuera de D17, fecha futura, medio de pago no habilitado, mesa inactiva, sesión sin detalles, gasto no-GASTO, etc. | p. ej. «La operación {resource}.{action} requiere conexión.», «fecha_cliente no puede ser una fecha futura.», «El recurso referenciado no existe.», «El payload de la operación no es válido: …» |
| PAGO_NO_VERIFICABLE | RECHAZADA | `movimientos-caja.confirmar` UPDATE | «La confirmación de un pago electrónico requiere conexión.» |
| STOCK_INSUFICIENTE | CONFLICTO | Al cerrar venta/sesión, al entregar orden, merma o ajuste | «Las existencias no alcanzan para completar la operación.» / «… para entregar la orden.» / «La merma dejaría el stock por debajo de cero.» / «El ajuste dejaría el stock por debajo de cero.» |
| PRODUCTO_INACTIVO | CONFLICTO | Producto desactivado | «El producto "{nombre}" está inactivo.» |
| PRODUCTO_CON_EXISTENCIAS | CONFLICTO | Cambiar `controla_stock` con stock ≠ 0 | «No se puede cambiar controla_stock mientras el producto tiene existencias distintas de cero.» |
| VENTA_YA_CERRADA | CONFLICTO | Modificar/cerrar/cancelar venta cerrada o cancelada | «La venta ya está cerrada o cancelada.» |
| MESA_OCUPADA | CONFLICTO | Abrir sesión en mesa ocupada o desactivar mesa ocupada | «La mesa ya tiene una sesión abierta.» / «No se puede desactivar una mesa con una sesión abierta.» |
| LIMITE_MESAS_EXCEDIDO | CONFLICTO | Crear/reactivar con 15 activas | «La instalación ya tiene 15 mesas activas.» |
| ORDEN_YA_ENTREGADA | CONFLICTO | Estado, consumo o costo sobre orden entregada | «La orden ya fue entregada.» |
| ABONO_EXCEDE_SALDO | CONFLICTO | Abono > saldo | «El abono supera el saldo pendiente de la orden.» |
| OPERACION_PREVIA_FALLIDA | CONFLICTO | La operación referencia un objeto cuya creación falló antes (D20) | «La operación {operation_id} que debía crear este recurso no se aplicó ({código}: {mensaje}).» |
| MOVIMIENTO_EN_PERIODO_CERRADO | — | **No se emite nunca** (D18: el movimiento entra al siguiente cierre) | — |

---

## 10. Catálogo completo de errores

Formato único `{"code", "message", "details"}` (`core/exceptions.py:34-40`). `message` es fijo para los errores genéricos (el texto de `NotFound('La venta no existe.')` en las vistas se reemplaza por el genérico).

| Código | HTTP | Mensaje (exacto) | Origen |
|---|---|---|---|
| NO_AUTENTICADO | 401 | «Se requiere autenticación para realizar esta operación.» (sin token) / «Las credenciales de autenticación no son válidas o expiraron.» (token inválido) / «El refresh token no es válido o expiró.» (refresh) | `core/exceptions.py:58-70`; `usuarios/serializers.py:132-136` |
| CREDENCIALES_INVALIDAS | 401 | «El usuario o la contraseña no son correctos.» | `usuarios/serializers.py:16`, `:29-33` |
| PERMISO_INSUFICIENTE | 403 | «No tiene permisos suficientes para realizar esta operación.» (y los dos de §5.4) | `core/exceptions.py:72-77` |
| MODULO_DESACTIVADO | 403 | «El módulo {modulo} está desactivado.» | `core/permissions.py:57-61` |
| DISPOSITIVO_NO_AUTORIZADO | 403 | ver §9.6 | `core/services.py:71-86` |
| RECURSO_NO_ENCONTRADO | 404 | «El recurso solicitado no existe.» | `core/exceptions.py:79-84` |
| METODO_NO_PERMITIDO | 405 | «El método HTTP utilizado no está permitido para este recurso.» | `core/exceptions.py:86-91` |
| DATOS_INVALIDOS | 400 | Validación: «Los datos enviados no son válidos.» + `details` por campo. JSON mal formado: «El cuerpo de la solicitud no tiene un formato válido.» Negocio: «El medio de pago {X} no está habilitado en esta instalación.», «La mesa está inactiva.», «Una sesión sin detalles no puede cerrarse; puede cancelarse.», «La orden solo puede avanzar al estado siguiente.», «Estado inválido: {x}.», «observaciones es obligatorio cuando hay una diferencia en el arqueo.» | `core/exceptions.py:93-108`; servicios citados |
| INSTALACION_YA_INICIALIZADA | 409 | «La instalación ya tiene usuarios registrados; el registro público solo crea el primer administrador.» | `usuarios/services.py:25-32` |
| ULTIMO_ADMIN_ACTIVO | 409 | «No se puede desactivar al único administrador activo de la instalación.» | `usuarios/services.py:60-64` |
| PRODUCTO_CON_EXISTENCIAS | 409 | ver §9.6 | `inventario/services.py:20-28` |
| STOCK_INSUFICIENTE | 409 | ver §9.6 | varios |
| PRODUCTO_INACTIVO | 409 | ver §9.6 | `ventas/services.py:114-119`, `:302-307`; `servicios/services.py:248-253` |
| VENTA_YA_CERRADA | 409 | «La venta ya está cerrada o cancelada.» | `ventas/services.py` |
| MESA_OCUPADA | 409 | ver §9.6 | `ventas/services.py:57-61`, `:244-248` |
| LIMITE_MESAS_EXCEDIDO | 409 | «La instalación ya tiene 15 mesas activas.» | `ventas/services.py:33-37`, `:64-68` |
| ORDEN_YA_ENTREGADA | 409 | «La orden ya fue entregada.» | `servicios/services.py` |
| ABONO_EXCEDE_SALDO | 409 | «El abono supera el saldo pendiente de la orden.» (+ `details.saldo_pendiente`) | `servicios/services.py:196-201` |
| PAGO_YA_CONFIRMADO | 409 | Confirmar: «El movimiento ya fue confirmado, anulado o no está pendiente de verificación.» Anular: «Solo se puede anular un movimiento pendiente de verificación.» | `finanzas/services.py:78-82`, `:111-115` |
| CIERRE_YA_REALIZADO | 409 | «Ya existe un cierre de caja registrado para esta fecha.» | `finanzas/services.py:329-334` |
| OPERACION_PREVIA_FALLIDA | 409 (solo sync) | ver §9.6 | `core/sync.py:86-93` |
| PAGO_NO_VERIFICABLE | 400 (solo sync) | ver §9.6 | `core/sync.py:395-399` |
| ERROR_INTERNO | 500 | «Ocurrió un error inesperado en el servidor.» | `core/exceptions.py:118-123` |
| SESION_EXPIRADA | (solo frontend) | «La sesión terminó. Vuelve a iniciar sesión.» | `frontend/src/api/cliente.ts:82-84` |

Mensajes de validación de campo propios del código: «operation_id no se puede modificar.», «Ya existe un usuario con ese nombre de usuario.», «Es obligatoria mientras acepta_transferencia o acepta_qr estén activos.», «numero no se puede modificar.», «No aplica para una venta RAPIDA.», «Es obligatorio para una venta RAPIDA.», «Debe incluir al menos un producto.», «Es obligatorio para una sesión dinámica.», «Una sesión dinámica se abre sin detalles ni medio de pago.», «Es obligatorio para MERMA y AJUSTE_MANUAL.», «Es obligatorio para AJUSTE_MANUAL.», «Solo aplica a AJUSTE_MANUAL.», «Debe ser uno de: …», «Debe ser un identificador UUID válido.», «Un lote admite como máximo 200 operaciones.». Los mensajes estándar de DRF y de los validadores de contraseña salen en español porque `LANGUAGE_CODE='es-co'` y `USE_I18N=True` (inferido de la configuración; no hay `LocaleMiddleware`).

---

## 11. Configuración

### 11.1 Settings por entorno

Un solo `core/settings.py`; el entorno se decide por variables:
- `DEBUG` (default `'True'`, `:35`). Se lee **antes** que `SECRET_KEY` (B1, `e57e7a6`). Con `DEBUG=False`: `SECURE_PROXY_SSL_HEADER`, `SECURE_SSL_REDIRECT`, cookies de sesión y CSRF seguras (`:242-246`).
- `SECRET_KEY` (`:37-49`): si falta o está vacía y `DEBUG=False` → `ImproperlyConfigured` «SECRET_KEY no está definida. En producción (DEBUG=False) es obligatorio configurarla como variable de entorno.», y Django no arranca. Con `DEBUG=True` (desarrollo, pruebas y el `collectstatic` del `Dockerfile`) usa la clave de desarrollo embebida.
- Base de datos: si existe `DATABASE_URL` → `dj_database_url.parse(..., conn_max_age=600, ssl_require=True)` (Neon); si no → PostgreSQL por variables sueltas (`:118-136`).
- `ALLOWED_HOSTS` desde env (lista separada por comas); si `DEBUG` y está vacío → `localhost`, `127.0.0.1` (`:53-55`).

### 11.2 Variables de entorno

| Variable | Obligatoria | Propósito | Default (si no es secreto) |
|---|---|---|---|
| SECRET_KEY | **Sí en producción: obligatoria desde B1** (`render.yaml` `sync: false`) | Firma de JWT y de Django | Con `DEBUG=True` y sin la variable se usa un valor de desarrollo embebido en `settings.py:49` (no se copia aquí). Con `DEBUG=False` y sin la variable → `ImproperlyConfigured` y el servicio no arranca (F-13, corregido) |
| DEBUG | No | Modo depuración | `True` (Render fija `False`) |
| ALLOWED_HOSTS | Sí en producción | Dominios permitidos | vacío (localhost en DEBUG) |
| CSRF_TRUSTED_ORIGINS | Sí en producción (admin/formularios por HTTPS) | Orígenes de confianza CSRF | vacío |
| DATABASE_URL | Sí en producción | Cadena de conexión a Neon (SSL obligatorio) | — |
| DB_NAME | Local | Nombre de la BD | `sadim_db` |
| DB_USER | Local | Usuario | `sadim` |
| DB_PASSWORD | Local | Contraseña | — (secreto) |
| DB_HOST | Local | Host | `localhost` |
| DB_PORT | Local | Puerto | `5432` |
| PORT | Render | Puerto de gunicorn | `8000` (`Dockerfile:36`) |

### 11.3 Otros

| Aspecto | Valor | Evidencia |
|---|---|---|
| CORS | No configurado (sin `django-cors-headers`): API y PWA comparten dominio en producción; en desarrollo el proxy de Vite reenvía `/api` | `core/settings.py:82-93`; `frontend/vite.config.ts:47-58` |
| Zona horaria | `TIME_ZONE='America/Bogota'`, `USE_TZ=True` (D10) | `core/settings.py:167-171` |
| Idioma | `LANGUAGE_CODE='es-co'`, `USE_I18N=True` | `:161-169` |
| Decimales | Números JSON (`COERCE_DECIMAL_TO_STRING=False`) | `:220` |
| Estáticos | WhiteNoise; `STATIC_ROOT=backend/staticfiles`; `CompressedManifestStaticFilesStorage` | `:177-184` |
| Cómo Django sirve la PWA | `WHITENOISE_ROOT = frontend/dist` (si existe) sirve `/`, `/assets/…`, `/manifest.webmanifest`, `/sw.js`; `/assets/` con caché inmutable de un año; resto `max-age=0`. Rutas de cliente → `spa_view` devuelve `index.html` (501 si no hay build) | `:190-200`; `core/views.py:33-45`; `core/urls.py` |
| Correo | `MAILERS` con backend de consola; `check --deploy` lo marca como error `mail.E001` (no se envía correo en ninguna función) | `:206-210` |
| `check --deploy` local (02/10/2026) | 1 error (mail.E001) y 5 avisos (HSTS no configurado, y 4 propios de correrlo con `DEBUG=True` local) | salida del comando |

---

## 12. Comandos de gestión, datos semilla y admin

| Elemento | Estado | Evidencia |
|---|---|---|
| Comandos de gestión propios (`management/commands`) | NO ENCONTRADO | `find backend -name management` |
| Fixtures | NO ENCONTRADO | sin carpetas `fixtures/` ni `.json` de datos |
| Datos demo de Aroma & Co. | NO ENCONTRADO. «Aroma & Co.» solo aparece como `nequi_titular` en pruebas | `core/tests.py:145`, `finanzas/tests.py:40`, `servicios/tests.py:36`, `ventas/tests.py:41` |
| Migración de datos | `core/migrations/0002_backfill_configuracion.py`: crea las filas singleton si ya existe un ADMIN | archivo citado |
| Django admin | Habilitado en `/admin/`; solo registra `MovimientoCaja` y `CierreCaja` (`finanzas/admin.py`). `Usuario` no está registrado. Requiere `is_staff`, que solo tiene un usuario creado con `createsuperuser` (los de la API nacen `is_staff=False`) | `core/urls.py`; `*/admin.py`; `usuarios/models.py:16-22` |
| Acceso al admin con la PWA instalada | Desde B2 (`fc6c598`) el service worker excluye `/api/` y `/admin/` de su ruta de navegación (`navigateFallbackDenylist`), así que `/admin/` llega a Django aunque la PWA esté instalada. Verificado en el `dist/sw.js` generado; no probado en navegador (informe 10 §5, punto 5) | `frontend/vite.config.ts:39-42`; ver 03 §5 |

---

## Cambios respecto a la versión del 02/10

- §4: el logout también borra las bandejas guardadas (E-19). Nueva fila sobre el cierre por inactividad (D27), que existe solo en el frontend. Referencias de `SesionContext.tsx` actualizadas.
- §5.3: líneas de `finanzas/views.py` actualizadas.
- §6.6 rehecha: el cierre se dividió en `_calcular_periodo_inicio`, `_movimientos_a_consolidar`, `calcular_totales_cierre` y `calcular_vista_previa_cierre` (D28, `3072214`). `crear_cierre` reutiliza esas funciones y conserva su comportamiento.
- §8: líneas nuevas de transacción y bloqueo; la «Diferencia estimada» usa el `efectivo_esperado` del servidor; el precio del dispositivo viaja en la cola (D19).
- §10: línea de `CIERRE_YA_REALIZADO` actualizada.
- §11: `SECRET_KEY` obligatoria con `DEBUG=False` (B1, `e57e7a6`, F-13 corregido) y referencias de `settings.py` corridas.
- §12: el admin ya es accesible con la PWA instalada (B2, F-10 corregido).
- Los lotes de corrección 4–6 no cambiaron reglas de negocio, permisos, sincronización ni errores del backend.
