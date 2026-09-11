**SADIM**

**Modelo Entidad-Relación (ERD) — Conceptual y Lógico**

Sprint 1 — Diseño del sistema y arquitectura
Universidad Antonio Nariño — Ingeniería de Sistemas y Computación
Bogotá, Colombia

# E1. Alcance del modelo de datos

Este modelo traduce a estructuras de datos las dinámicas operativas descritas en el alcance del anteproyecto: ventas de consumo inmediato y sesiones dinámicas, flujo de entrega de servicios, inventario y control financiero. El modelo se encuentra alineado con el ADR arquitectónico aprobado y con el alcance de una instalación de SADIM asociada a un único negocio.

El modelo incorpora las entidades necesarias para representar ventas, mesas, productos, órdenes de trabajo, abonos, consumos de órdenes, movimientos de inventario, movimientos de caja, cierres de caja y configuración de módulos.

Nota de diseño: la venta rápida de mostrador y la sesión dinámica se mantienen como una única entidad Venta diferenciada mediante el atributo tipo. Una sesión dinámica permanece ABIERTA mientras acumula consumos; al cerrarse se confirma la operación y se generan los efectos correspondientes sobre inventario y caja. La Mesa se modela como entidad independiente para permitir gestionar hasta 15 mesas activas.

# 2. ERD conceptual

El diagrama conceptual debe representar las siguientes entidades y relaciones. La figura correspondiente puede mantenerse o reemplazarse por un diagrama visual actualizado conforme a esta especificación.

## Entidades del modelo

**Usuario. **Personas que acceden al sistema con un rol definido (Administrador u Operador).

**ConfiguracionModulo. **Configuración de los módulos habilitados en la instalación de SADIM.

**Categoria. **Agrupa productos del catálogo.

**Producto. **Ítems del catálogo, diferenciando insumos de producción y productos para reventa directa.

**Mesa. **Mesa física disponible para sesiones dinámicas; máximo funcional de 15 mesas activas.

**Venta. **Venta rápida o sesión dinámica. Una sesión puede permanecer ABIERTA hasta su cierre.

**DetalleVenta. **Líneas de productos asociadas a una Venta.

**OrdenTrabajo. **Pedidos por encargo o servicios con fecha de entrega.

**Abono. **Pago parcial realizado sobre una OrdenTrabajo; una orden puede tener múltiples abonos.

**ConsumoOrden. **Productos o insumos utilizados en una OrdenTrabajo y pendientes de aplicación al inventario hasta la finalización/entrega.

**CostoOperativoOrden. **Desglose de costos operativos asociados a una OrdenTrabajo.

**MovimientoInventario. **Historial de entradas, salidas, mermas y ajustes de inventario.

**MovimientoCaja. **Registro trazable de ingresos y egresos originados por ventas, abonos y gastos.

**CierreCaja. **Corte o resumen de los movimientos de caja de un período, realizado por el Administrador.

# 3. Relaciones y cardinalidad

| Entidad origen | Cardinalidad | Entidad destino | Descripción |
| --- | --- | --- | --- |
| Usuario | 1:N | Venta | Un usuario puede registrar muchas ventas o sesiones dinámicas. |
| Usuario | 1:N | OrdenTrabajo | Un usuario puede registrar y gestionar muchas órdenes. |
| Usuario | 1:N | Abono | Un usuario puede registrar muchos abonos. |
| Usuario | 1:N | MovimientoInventario | Un usuario puede ejecutar movimientos de inventario. |
| Usuario | 1:N | MovimientoCaja | Un usuario puede registrar movimientos de caja. |
| Usuario | 1:N | CierreCaja | Un Administrador puede realizar múltiples cierres. |
| ConfiguracionModulo | 1:1 | Instalación | Cada instalación tiene una configuración funcional única de módulos. |
| Categoria | 1:N | Producto | Una categoría puede agrupar muchos productos. |
| Mesa | 1:N | Venta | Una mesa puede participar en múltiples ventas/sesiones a lo largo del tiempo; una sesión dinámica activa ocupa una mesa. |
| Venta | 1:N | DetalleVenta | Una venta contiene una o más líneas de detalle. |
| Producto | 1:N | DetalleVenta | Un producto puede aparecer en muchas líneas de venta. |
| Producto | 1:N | MovimientoInventario | Un producto puede tener muchos movimientos de inventario. |
| OrdenTrabajo | 1:N | Abono | Una orden puede recibir múltiples abonos en diferentes momentos. |
| OrdenTrabajo | 1:N | ConsumoOrden | Una orden puede registrar múltiples consumos de productos o insumos. |
| Producto | 1:N | ConsumoOrden | Un producto puede utilizarse en múltiples órdenes. |
| OrdenTrabajo | 1:N | CostoOperativoOrden | Una orden puede acumular múltiples conceptos de costo. |
| Venta | 1:1 | MovimientoCaja | Una venta cerrada genera un único movimiento de ingreso en caja. |
| Abono | 1:1 | MovimientoCaja | Un abono confirmado genera un movimiento de ingreso en caja. |
| Venta | 1:N | MovimientoInventario | Una venta cerrada puede generar movimientos de salida de inventario. |
| ConsumoOrden | 1:1 | MovimientoInventario | Un consumo aplicado al finalizar/entregar una orden genera el movimiento de salida correspondiente. |
| CierreCaja | 1:N | MovimientoCaja | Un cierre consolida los movimientos incluidos en el período que se está cerrando. |

Nota: la relación ConfiguracionModulo–Instalación se expresa conceptualmente; dado que el alcance actual contempla una única instalación por negocio, no se introduce una entidad Negocio ni un modelo multi-tenant. En el modelo físico, la configuración puede representarse como una única fila de configuración por instalación.

# 4. ERD lógico — diccionario de datos

Los siguientes atributos constituyen la base para las migraciones de Django y los serializers de la API. Los identificadores UUID permiten generar identificadores localmente para las operaciones que puedan originarse offline. Los campos calculados no deben ser tratados como valores editables por el usuario.

## 4.1 Usuario

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| nombre_completo | VARCHAR(150) | NOT NULL | Nombre del propietario o empleado. |
| username | VARCHAR(50) | UNIQUE, NOT NULL | Usuario de acceso al sistema. |
| password_hash | VARCHAR(255) | NOT NULL | Hash de la contraseña; nunca se almacena la contraseña en texto plano. |
| rol | ENUM | NOT NULL | ADMIN u OPERADOR (RBAC). |
| activo | BOOLEAN | DEFAULT true | Permite deshabilitar un usuario sin eliminarlo. |
| fecha_creacion | TIMESTAMP | NOT NULL | Auditoría de alta del usuario. |

## 4.2 ConfiguracionModulo

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador de la configuración. |
| ventas_activo | BOOLEAN | NOT NULL, DEFAULT true | Indica si el módulo de ventas está habilitado. |
| inventario_activo | BOOLEAN | NOT NULL, DEFAULT true | Indica si el módulo de inventario está habilitado. |
| servicios_activo | BOOLEAN | NOT NULL, DEFAULT true | Indica si el módulo de servicios está habilitado. |
| finanzas_activo | BOOLEAN | NOT NULL, DEFAULT true | Indica si el módulo de finanzas está habilitado. |

## 4.3 Categoria

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| nombre | VARCHAR(100) | NOT NULL, UNIQUE | Nombre de la categoría. |

## 4.4 Producto

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| categoria_id | UUID | FK → Categoria, NOT NULL | Categoría a la que pertenece. |
| nombre | VARCHAR(150) | NOT NULL | Nombre del producto. |
| tipo | ENUM | NOT NULL | INSUMO_PRODUCCION o REVENTA_DIRECTA. |
| precio_venta | DECIMAL(10,2) | NOT NULL | Precio al público definido por el Administrador. |
| costo_produccion | DECIMAL(10,2) | NULL | Costo interno; puede ser nulo cuando corresponda a reventa directa. |
| stock_actual | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Existencia actual; se mantiene consistente con los movimientos aplicados. |
| stock_minimo | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Nivel de referencia para alertas de reabastecimiento. |
| unidad_medida | VARCHAR(20) | NOT NULL | Unidad, kg, litro, unidad, etc. |
| activo | BOOLEAN | DEFAULT true | Indica si el producto está disponible en el catálogo. |

## 4.5 Mesa

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| numero | SMALLINT | UNIQUE, NOT NULL | Número de mesa; limitado funcionalmente a 1–15. |
| activa | BOOLEAN | DEFAULT true | Permite habilitar o deshabilitar una mesa. |
| estado | ENUM | NOT NULL | DISPONIBLE u OCUPADA. |

## 4.6 Venta

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de operación para sincronización idempotente. |
| tipo | ENUM | NOT NULL | RAPIDA o SESION_DINAMICA. |
| usuario_id | UUID | FK → Usuario, NOT NULL | Usuario que registra o atiende la venta. |
| mesa_id | UUID | FK → Mesa, NULL | Mesa asociada cuando tipo = SESION_DINAMICA. |
| estado | ENUM | NOT NULL | ABIERTA, CERRADA o CANCELADA. |
| fecha_apertura | TIMESTAMP | NOT NULL | Inicio de la venta o sesión. |
| fecha_cierre | TIMESTAMP | NULL | Momento del cierre. |
| medio_pago | ENUM | NULL hasta cierre | EFECTIVO, TRANSFERENCIA o QR. |
| total | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Total calculado a partir de los detalles. |

## 4.7 DetalleVenta

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| venta_id | UUID | FK → Venta, UNIQUE, NULL | Venta que originó el ingreso; una venta solo puede generar un movimiento de caja. |
| producto_id | UUID | FK → Producto, NOT NULL | Producto consumido. |
| cantidad | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Cantidad vendida. |
| precio_unitario | DECIMAL(10,2) | NOT NULL | Precio vigente al momento de agregar el producto. |
| subtotal | DECIMAL(10,2) | CALCULADO | cantidad × precio_unitario. |

## 4.8 OrdenTrabajo

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de operación para sincronización idempotente cuando la orden se crea offline. |
| usuario_id | UUID | FK → Usuario, NOT NULL | Usuario que registra la orden. |
| cliente_nombre | VARCHAR(150) | NOT NULL | Nombre del cliente. |
| cliente_telefono | VARCHAR(20) | NULL | Dato de contacto del cliente. |
| descripcion | TEXT | NOT NULL | Detalle del encargo o servicio. |
| fecha_solicitud | TIMESTAMP | NOT NULL | Fecha de recepción. |
| fecha_entrega_estimada | DATE | NOT NULL | Compromiso de entrega. |
| estado | ENUM | NOT NULL | RECIBIDO, EN_PROCESO, LISTO o ENTREGADO. |
| costo_total | DECIMAL(10,2) | NOT NULL | Valor total acordado. |
| saldo_pendiente | DECIMAL(10,2) | CALCULADO | costo_total − suma de abonos. |

## 4.9 Abono

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de operación para evitar duplicación durante la sincronización. |
| orden_id | UUID | FK → OrdenTrabajo, NOT NULL | Orden a la que se aplica el abono. |
| usuario_id | UUID | FK → Usuario, NOT NULL | Usuario que registra el abono. |
| valor | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Valor del abono. |
| medio_pago | ENUM | NOT NULL | EFECTIVO, TRANSFERENCIA o QR. |
| fecha | TIMESTAMP | NOT NULL | Fecha y hora del abono. |
| observacion | VARCHAR(255) | NULL | Nota opcional. |

## 4.10 ConsumoOrden

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de operación para sincronización. |
| orden_id | UUID | FK → OrdenTrabajo, NOT NULL | Orden donde se utiliza el producto. |
| producto_id | UUID | FK → Producto, NOT NULL | Producto o insumo utilizado. |
| cantidad | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Cantidad utilizada. |
| estado | ENUM | NOT NULL | PENDIENTE o APLICADO. |
| fecha_registro | TIMESTAMP | NOT NULL | Momento en que se registra el consumo. |

## 4.11 CostoOperativoOrden

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| orden_id | UUID | FK → OrdenTrabajo, NOT NULL | Orden asociada. |
| concepto | VARCHAR(150) | NOT NULL | Repuesto, herramienta, corrección u otro costo operativo. |
| valor | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Costo del concepto. |

## 4.12 MovimientoInventario

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de operación para evitar duplicación al sincronizar. |
| producto_id | UUID | FK → Producto, NOT NULL | Producto afectado. |
| usuario_id | UUID | FK → Usuario, NOT NULL | Usuario responsable del movimiento. |
| venta_id | UUID | FK → Venta, UNIQUE, NULL | Venta que originó el ingreso; una venta solo puede generar un movimiento de caja. |
| consumo_orden_id | UUID | FK → ConsumoOrden, NULL | Consumo de orden que originó una salida, cuando corresponda. |
| tipo | ENUM | NOT NULL | ENTRADA, SALIDA_VENTA, SALIDA_SERVICIO, MERMA o AJUSTE_MANUAL. |
| cantidad | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Cantidad del movimiento. |
| fecha | TIMESTAMP | NOT NULL | Momento en que se aplica el movimiento. |
| motivo | VARCHAR(255) | NULL | Obligatorio para MERMA y AJUSTE_MANUAL. |

## 4.13 MovimientoCaja

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de operación para sincronización idempotente. |
| usuario_id | UUID | FK → Usuario, NOT NULL | Usuario que registra el movimiento. |
| venta_id | UUID | FK → Venta, UNIQUE, NULL | Venta que originó el ingreso; una venta solo puede generar un movimiento de caja. |
| abono_id | UUID | FK → Abono, NULL | Abono que originó el ingreso, cuando corresponda. |
| tipo | ENUM | NOT NULL | INGRESO_VENTA, INGRESO_ABONO o GASTO. |
| medio_pago | ENUM | NOT NULL | EFECTIVO, TRANSFERENCIA o QR. |
| valor | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Valor del movimiento. |
| concepto | VARCHAR(255) | NULL | Descripción del gasto u observación del movimiento. |
| fecha | TIMESTAMP | NOT NULL | Momento del movimiento. |

## 4.14 CierreCaja

| Atributo | Tipo | Restricción | Descripción |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| usuario_id | UUID | FK → Usuario, NOT NULL | Administrador que realiza el cierre. |
| fecha | DATE | NOT NULL, UNIQUE | Fecha del cierre. |
| total_ingresos | DECIMAL(10,2) | CALCULADO | Suma de ingresos incluidos en el período. |
| total_gastos | DECIMAL(10,2) | CALCULADO | Suma de gastos incluidos en el período. |
| total_neto | DECIMAL(10,2) | CALCULADO | total_ingresos − total_gastos. |
| observaciones | TEXT | NULL | Notas del cierre, descuadres o novedades. |

# 5. Reglas de integridad y negocio

- La configuración de módulos pertenece a una única instalación de SADIM. No se modela multi-tenancy.

- Una instalación puede tener como máximo 15 mesas activas.

- Una Venta de tipo SESION_DINAMICA debe tener mesa_id; una Venta de tipo RAPIDA no requiere mesa.

- Una mesa no puede tener más de una Venta SESION_DINAMICA en estado ABIERTA al mismo tiempo.

- Una Venta ABIERTA puede acumular DetalleVenta. El inventario no se descuenta al agregar el detalle; el descuento se aplica cuando la venta se cierra.

- Una Venta CERRADA genera exactamente un movimiento de caja de ingreso y los movimientos de salida de inventario aplicables.

- Una OrdenTrabajo puede tener cero, uno o muchos Abonos. El saldo pendiente se calcula como costo_total menos la suma de los abonos.

- Un Abono confirmado genera un MovimientoCaja de tipo INGRESO_ABONO.

- Un ConsumoOrden permanece PENDIENTE mientras la orden está en proceso. Al finalizar/entregar la orden, se transforma en un efecto de inventario de tipo SALIDA_SERVICIO y pasa a APLICADO.

- Los gastos hormiga se registran como MovimientoCaja de tipo GASTO y deben incluir un concepto que permita su trazabilidad.

- Los movimientos de inventario son históricos y no deben editarse para corregir un error; la corrección se registra mediante un nuevo movimiento de AJUSTE_MANUAL o el tipo de movimiento correspondiente.

- El stock_actual es un valor derivado/operativo mantenido por el sistema y debe permanecer consistente con los movimientos de inventario aplicados.

- Los campos operation_id son únicos para impedir que una misma operación offline sea aplicada más de una vez en el backend.

- Los pagos electrónicos no se consideran confirmados únicamente por existir un registro offline; su confirmación requiere conectividad según el flujo definido para el sistema.

- El acceso a CostoOperativoOrden y a las funciones financieras sensibles se controla mediante RBAC; la restricción de acceso no se resuelve únicamente ocultando elementos de la interfaz.

# 6. Reglas de sincronización relacionadas con el modelo

Las operaciones que puedan generarse offline utilizarán UUID y operation_id. La cola local se mantendrá en IndexedDB y no forma parte del modelo relacional principal. Al recuperar la conectividad, el cliente enviará las operaciones pendientes a la API. El backend comprobará operation_id antes de aplicar una operación, garantizando idempotencia. Las operaciones transaccionales se validarán de acuerdo con las reglas de negocio antes de confirmar sus efectos sobre inventario y caja.

# 7. Decisiones que quedan fuera de este ERD

Este documento no define todavía los contratos HTTP de la API, la estructura física de IndexedDB, la estrategia de autenticación de sesión offline ni la implementación interna de los casos de uso. Estos aspectos se documentarán en los artefactos correspondientes y deberán mantenerse alineados con el ADR y este modelo de datos.

# 8. Trazabilidad con la arquitectura

| Decisión arquitectónica | Reflejo en el ERD |
| --- | --- |
| ADR-001 — PostgreSQL | Modelo relacional con PK, FK, restricciones e integridad referencial. |
| ADR-002 — Monolito modular | Entidades agrupables por módulos funcionales dentro de una misma aplicación. |
| ADR-003 — PWA | Identificadores y datos necesarios para soportar operaciones locales. |
| ADR-004 — Offline-first | UUID y operation_id para operaciones idempotentes; cola local fuera de la base principal. |
| ADR-005 — RBAC | Usuario con rol y restricciones funcionales asociadas. |
| ADR-006 — Módulos configurables | ConfiguracionModulo controla la disponibilidad funcional. |
| ADR-007 — Un negocio por instalación | No existe entidad Negocio ni tenant en el modelo actual. |
| ADR-008 — Movimiento de caja | MovimientoCaja centraliza ingresos y gastos y CierreCaja actúa como corte/resumen. |