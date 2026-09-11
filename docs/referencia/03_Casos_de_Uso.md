**SADIM**

**Casos de Uso Priorizados por Módulo**

Sprint 1 — Diseño del sistema y arquitectura
Universidad Antonio Nariño — Ingeniería de Sistemas y Computación
Bogotá, Colombia · 2026

# Criterio de priorización

Las prioridades se asignan según la relación de cada caso de uso con las funciones núcleo del alcance del anteproyecto y con la continuidad operativa offline-first. Los casos de prioridad Alta representan funciones necesarias para la operación diaria o para el control básico del negocio. Los casos de prioridad Media complementan la trazabilidad, administración y control, pero pueden desarrollarse después de los flujos operativos principales. Se documentan 17 casos de uso agrupados en los tres módulos funcionales y un caso transversal de autenticación.

Para la columna de conexión se distingue entre operaciones que pueden ejecutarse localmente y operaciones cuya confirmación externa depende de conectividad. En particular, las operaciones en efectivo pueden registrarse offline; los pagos electrónicos requieren conectividad para confirmar su estado.

# Módulo 1 — Gestión de Ventas Diarias y Consumo Inmediato

Cubre la venta rápida de mostrador, las sesiones dinámicas de mesa y la configuración del catálogo. La gestión operativa corresponde a Administrador y Operador, mientras que la configuración del catálogo corresponde al Administrador, conforme al alcance del anteproyecto.

| ID | Caso de uso | Actor(es) | Prioridad | Conexión |
| --- | --- | --- | --- | --- |
| CU-01 | Registrar venta rápida de mostrador | Operador, Administrador | Alta | No (offline-first) |
| CU-02 | Abrir sesión dinámica de mesa | Operador, Administrador | Alta | No (offline-first) |
| CU-03 | Registrar consumo en sesión dinámica | Operador, Administrador | Alta | No (offline-first) |
| CU-04 | Cerrar sesión dinámica y cobrar | Operador, Administrador | Alta | Parcial: efectivo offline; electrónico requiere conexión |
| CU-05 | Configurar catálogo de productos y precios | Administrador | Alta | No (offline-first; sincronización posterior) |

## CU-01 — Registrar venta rápida de mostrador

Actor(es): Operador, Administrador

Prioridad: Alta

Precondiciones: Usuario autenticado; catálogo disponible localmente.

### Flujo principal

- El usuario selecciona «Venta rápida» en el módulo de ventas.

- El sistema muestra el catálogo de productos disponibles.

- El usuario selecciona uno o varios productos y ajusta las cantidades.

- El sistema calcula el total en tiempo real.

- El usuario selecciona el medio de pago.

- El usuario confirma la venta.

- El sistema registra la Venta con tipo=RAPIDA y estado=CERRADA, genera los detalles, registra el movimiento de inventario correspondiente y, cuando el pago está confirmado, genera un único MovimientoCaja de ingreso.

- El sistema muestra un comprobante o resumen de la venta.

### Flujos alternativos / excepciones

- Si el producto no tiene stock suficiente, el sistema informa al usuario y no permite confirmar una cantidad superior a la existencia disponible.

- Si la venta se registra sin conexión y el medio de pago es efectivo, se guarda localmente y queda pendiente de sincronización.

- Si el medio de pago es electrónico y no existe conectividad para confirmar el pago, el sistema no debe marcar el pago electrónico como confirmado.

### Postcondiciones

La venta queda registrada; sus efectos de inventario y caja quedan aplicados localmente o pendientes de sincronización según el estado de conectividad.

## CU-02 — Abrir sesión dinámica de mesa

Actor(es): Operador, Administrador

Prioridad: Alta

Precondiciones: Usuario autenticado; existe una mesa activa disponible y sin una sesión dinámica abierta.

### Flujo principal

- El usuario selecciona «Nueva sesión» e indica la mesa.

- El sistema verifica que la mesa no tenga otra sesión dinámica ABIERTA.

- El sistema crea una Venta con tipo=SESION_DINAMICA y estado=ABIERTA.

- El sistema marca la mesa como OCUPADA.

### Flujos alternativos / excepciones

- Si la mesa ya tiene una sesión abierta, el sistema muestra la sesión existente en lugar de crear una segunda sesión.

- Si se intenta seleccionar una mesa desactivada, el sistema no permite abrir una nueva sesión.

### Postcondiciones

La mesa queda ocupada y la sesión queda disponible para registrar consumos progresivos.

## CU-03 — Registrar consumo en sesión dinámica

Actor(es): Operador, Administrador

Prioridad: Alta

Precondiciones: Existe una sesión dinámica ABIERTA asociada a una mesa.

### Flujo principal

- El usuario abre la sesión correspondiente.

- El sistema muestra el catálogo disponible.

- El usuario agrega uno o varios productos a la cuenta.

- El sistema crea o actualiza las líneas de DetalleVenta y recalcula el total acumulado.

- El usuario puede repetir el flujo mientras la sesión permanezca abierta.

### Flujos alternativos / excepciones

- Si el producto no tiene stock suficiente, el sistema informa al usuario y no permite agregar una cantidad superior a la disponibilidad.

- Si no existe conexión, la modificación de la sesión se guarda localmente y queda pendiente de sincronización.

### Postcondiciones

El total de la sesión queda actualizado. La existencia disponible local puede reflejar el consumo pendiente, pero el MovimientoInventario definitivo se genera al cerrar la venta.

## CU-04 — Cerrar sesión dinámica y cobrar

Actor(es): Operador, Administrador

Prioridad: Alta

Precondiciones: Existe una sesión dinámica ABIERTA con al menos un consumo registrado.

### Flujo principal

- El usuario selecciona «Cerrar cuenta».

- El sistema muestra el resumen de consumos y el total a pagar.

- El usuario selecciona el medio de pago.

- El sistema valida las condiciones del pago según el medio seleccionado.

- El usuario confirma el cierre.

- El sistema cambia la Venta a estado=CERRADA, registra la fecha de cierre y el medio de pago, genera los movimientos de salida de inventario correspondientes y, si el pago está confirmado, genera exactamente un MovimientoCaja de ingreso.

- El sistema libera la mesa.

### Flujos alternativos / excepciones

- El usuario puede cancelar el cierre y continuar agregando consumos.

- Para pagos electrónicos sin conectividad, el sistema no debe confirmar el pago; el flujo queda pendiente hasta contar con la conectividad requerida.

- En efectivo, el cierre puede registrarse offline y sincronizarse posteriormente.

### Postcondiciones

La mesa queda DISPONIBLE y la venta cerrada queda disponible para el cierre de caja. Los efectos pendientes quedan identificados para sincronización.

## CU-05 — Configurar catálogo de productos y precios

Actor(es): Administrador

Prioridad: Alta

Precondiciones: Usuario autenticado con rol Administrador.

### Flujo principal

- El Administrador accede al catálogo.

- El Administrador crea o edita una categoría y/o un producto.

- El sistema solicita y valida nombre, tipo, precio de venta, costo de producción cuando aplique, unidad de medida y stock mínimo.

- El sistema guarda los cambios y actualiza la disponibilidad del catálogo.

### Flujos alternativos / excepciones

- Si un Operador intenta acceder, el backend deniega la operación mediante RBAC.

- Si no hay conexión, los cambios pueden almacenarse localmente y sincronizarse posteriormente, siempre que correspondan a una operación permitida offline.

### Postcondiciones

El catálogo queda actualizado para las operaciones de venta y sesiones dinámicas.

# Módulo 2 — Flujo de Entrega y Gestión de Servicios

Cubre los pedidos por encargo y servicios con fecha de entrega, el seguimiento de estados, los múltiples abonos, el consumo de inventario asociado a la orden y el análisis de costos operativos. La información financiera sensible del análisis de costos permanece restringida al Administrador.

| ID | Caso de uso | Actor(es) | Prioridad | Conexión |
| --- | --- | --- | --- | --- |
| CU-06 | Registrar pedido por encargo | Operador, Administrador | Alta | No (offline-first) |
| CU-07 | Actualizar estado de la orden de trabajo | Operador, Administrador | Media | No (offline-first) |
| CU-08 | Registrar abono a una orden de trabajo | Operador, Administrador | Alta | Parcial: efectivo offline; electrónico requiere conexión |
| CU-09 | Registrar consumo de inventario en una orden | Operador, Administrador | Alta | No (offline-first) |
| CU-10 | Consultar análisis de costos operativos por orden | Administrador | Media | No (offline-first) |

## CU-06 — Registrar pedido por encargo

Actor(es): Operador, Administrador

Prioridad: Alta

Precondiciones: Usuario autenticado.

### Flujo principal

- El usuario selecciona «Nuevo pedido» en el módulo de Órdenes de Trabajo.

- El usuario registra nombre y teléfono del cliente, descripción del encargo, fecha de entrega estimada y costo total acordado.

- Si corresponde, el usuario registra un abono inicial mediante el flujo de CU-08.

- El sistema crea la OrdenTrabajo en estado RECIBIDO.

- El sistema calcula el saldo pendiente como costo_total menos la suma de los abonos registrados.

### Flujos alternativos / excepciones

- Si no se registra abono inicial, el saldo pendiente equivale al costo total acordado.

- Si los datos obligatorios son inválidos, el sistema solicita corrección.

### Postcondiciones

La orden queda visible en el tablero de seguimiento con estado, fecha de entrega y saldo pendiente.

## CU-07 — Actualizar estado de la orden de trabajo

Actor(es): Operador, Administrador

Prioridad: Media

Precondiciones: Existe una OrdenTrabajo registrada y el usuario tiene permisos para actualizarla.

### Flujo principal

- El usuario abre la orden.

- El sistema muestra el estado actual.

- El usuario selecciona el siguiente estado permitido.

- El sistema valida la transición y actualiza el estado.

### Flujos alternativos / excepciones

- Si la transición no es válida, el sistema rechaza el cambio.

- Al pasar a ENTREGADO, el sistema permite ejecutar el cierre operativo de la orden y aplicar los ConsumoOrden pendientes.

### Postcondiciones

La orden queda con el nuevo estado y se conserva la trazabilidad de su evolución.

## CU-08 — Registrar abono a una orden de trabajo

Actor(es): Operador, Administrador

Prioridad: Alta

Precondiciones: Existe una OrdenTrabajo con saldo pendiente mayor que cero.

### Flujo principal

- El usuario abre el detalle de la orden.

- El usuario registra un nuevo abono, indicando valor y medio de pago.

- El sistema valida que el abono sea mayor que cero y no exceda el saldo pendiente.

- El sistema crea una entidad Abono independiente asociada a la orden.

- Si el pago está confirmado, el sistema genera un MovimientoCaja de tipo INGRESO_ABONO.

- El sistema recalcula el saldo pendiente como costo_total menos la suma de todos los abonos.

### Flujos alternativos / excepciones

- Si el abono excede el saldo pendiente, el sistema rechaza el valor.

- Si el pago electrónico no puede confirmarse por falta de conectividad, el sistema no lo registra como pago electrónico confirmado.

- Un abono en efectivo puede registrarse offline y quedar pendiente de sincronización.

### Postcondiciones

La orden conserva el historial de abonos y el saldo pendiente actualizado.

## CU-09 — Registrar consumo de inventario en una orden

Actor(es): Operador, Administrador

Prioridad: Alta

Precondiciones: Existe una OrdenTrabajo en estado RECIBIDO o EN_PROCESO y productos disponibles para registrar como consumo.

### Flujo principal

- El usuario abre la orden.

- El usuario selecciona un producto o insumo y registra la cantidad utilizada.

- El sistema crea un registro ConsumoOrden con estado=PENDIENTE.

- El usuario puede agregar varios consumos durante el proceso del servicio.

- Al finalizar o entregar la orden, el sistema valida los consumos pendientes y genera los movimientos de salida de inventario correspondientes.

- Los consumos aplicados pasan a estado=APLICADO.

### Flujos alternativos / excepciones

- Si la cantidad disponible no es suficiente, el sistema informa al usuario y no permite aplicar una cantidad superior a la disponibilidad.

- Si la orden todavía no está finalizada, el consumo permanece PENDIENTE y no se genera todavía el movimiento definitivo de salida.

### Postcondiciones

La orden conserva la trazabilidad de los productos utilizados y el inventario se actualiza al aplicar los consumos.

## CU-10 — Consultar análisis de costos operativos por orden

Actor(es): Administrador

Prioridad: Media

Precondiciones: Existe una OrdenTrabajo con información de costos operativos registrada.

### Flujo principal

- El Administrador abre el análisis de la orden.

- El sistema muestra el costo total acordado y el desglose de costos operativos registrados.

- El sistema calcula o presenta la utilidad neta según las reglas definidas para el proyecto.

### Flujos alternativos / excepciones

- Si el usuario no tiene rol Administrador, el backend deniega el acceso.

- Si no existen costos operativos registrados, el sistema informa que no hay conceptos disponibles para el desglose.

### Postcondiciones

El Administrador obtiene una vista consolidada de los costos de la orden sin exponer esta información al Operador.

# Módulo 3 — Inventario Centralizado y Análisis Financiero

Vincula las operaciones de ventas y servicios con las existencias físicas y concentra el control de caja, gastos y cierres. Las funciones sensibles de ajuste y cierre están restringidas al Administrador.

| ID | Caso de uso | Actor(es) | Prioridad | Conexión |
| --- | --- | --- | --- | --- |
| CU-11 | Consultar inventario y stock | Operador, Administrador | Alta | No (offline-first) |
| CU-12 | Registrar ingreso de mercancía | Operador, Administrador | Media | No (offline-first) |
| CU-13 | Realizar ajuste manual de inventario | Administrador | Media | No (offline-first) |
| CU-14 | Registrar gasto o gasto hormiga | Operador, Administrador | Alta | No (offline-first) |
| CU-15 | Realizar cierre de caja (arqueo) | Administrador | Alta | No (offline-first) |

## CU-11 — Consultar inventario y stock

Actor(es): Operador, Administrador

Prioridad: Alta

Precondiciones: Usuario autenticado y datos de inventario disponibles localmente.

### Flujo principal

- El usuario accede al módulo de Inventario.

- El sistema muestra los productos con su stock actual.

- El usuario puede filtrar por categoría o tipo de producto.

- El sistema identifica productos cuyo stock actual se encuentra en o por debajo del stock mínimo configurado.

### Postcondiciones

El usuario consulta el estado del inventario disponible localmente. No se modifica ningún registro.

## CU-12 — Registrar ingreso de mercancía

Actor(es): Operador, Administrador

Prioridad: Media

Precondiciones: Usuario autenticado y producto existente en el catálogo.

### Flujo principal

- El usuario selecciona el producto recibido.

- El usuario registra la cantidad ingresada.

- El sistema crea un MovimientoInventario de tipo ENTRADA.

- El sistema actualiza el stock actual del producto.

### Flujos alternativos / excepciones

- Si la cantidad es inválida o menor o igual a cero, el sistema rechaza el movimiento.

### Postcondiciones

El ingreso queda registrado y el stock actualizado, localmente o en el servidor según la conectividad.

## CU-13 — Realizar ajuste manual de inventario

Actor(es): Administrador

Prioridad: Media

Precondiciones: Usuario autenticado con rol Administrador y producto existente.

### Flujo principal

- El Administrador selecciona el producto a ajustar.

- El Administrador indica el tipo de ajuste, cantidad y motivo.

- El sistema crea un MovimientoInventario de tipo MERMA o AJUSTE_MANUAL.

- El sistema actualiza el stock actual.

### Flujos alternativos / excepciones

- Si un Operador intenta realizar el ajuste, el backend deniega la operación.

- Los movimientos históricos no se editan para corregir errores; se registra un nuevo movimiento de ajuste.

### Postcondiciones

El ajuste queda trazable y el stock actual refleja el movimiento aplicado.

## CU-14 — Registrar gasto o gasto hormiga

Actor(es): Operador, Administrador

Prioridad: Alta

Precondiciones: Usuario autenticado.

### Flujo principal

- El usuario selecciona «Registrar gasto» o «Caso extra» en el módulo financiero.

- El usuario registra el concepto, valor, medio de pago y fecha.

- El sistema valida que el valor sea mayor que cero.

- El sistema crea un MovimientoCaja de tipo GASTO.

### Flujos alternativos / excepciones

- Si el gasto se registra en efectivo sin conexión, se almacena localmente y queda pendiente de sincronización.

- Si el medio corresponde a un pago electrónico que requiere confirmación externa, el sistema no debe marcarlo como confirmado sin conectividad.

### Postcondiciones

El gasto queda trazable dentro de los movimientos de caja y puede incluirse en el cierre correspondiente.

## CU-15 — Realizar cierre de caja (arqueo)

Actor(es): Administrador

Prioridad: Alta

Precondiciones: Usuario autenticado con rol Administrador; existen movimientos de caja registrados en el período que se desea cerrar.

### Flujo principal

- El Administrador selecciona «Cierre de caja».

- El sistema consolida los movimientos de caja del período, diferenciando ingresos por ventas, ingresos por abonos y gastos.

- El sistema presenta los totales por medio de pago.

- El Administrador compara el efectivo esperado con el efectivo físico contado.

- El Administrador registra observaciones cuando existe un descuadre.

- El sistema guarda el CierreCaja como resumen del período.

### Flujos alternativos / excepciones

- Si existen operaciones pendientes de sincronización, el sistema las identifica y evita presentarlas como confirmadas por el servidor hasta completar la sincronización.

- Si un Operador intenta acceder, el backend deniega la operación mediante RBAC.

### Postcondiciones

El período queda formalmente cerrado y el CierreCaja conserva el resumen y las observaciones, mientras que MovimientoCaja mantiene el detalle histórico.

# Caso de uso transversal — Configuración de módulos

| ID | Caso de uso | Actor(es) | Prioridad | Conexión |
| --- | --- | --- | --- | --- |
| CU-16 | Configurar módulos funcionales | Administrador | Media | No (offline-first; sincronización posterior) |

## CU-16 — Configurar módulos funcionales

Actor(es): Administrador

Prioridad: Media

Precondiciones: Usuario autenticado con rol Administrador.

### Flujo principal

- El Administrador accede a la configuración de módulos.

- El sistema muestra el estado de Ventas, Inventario, Servicios y Finanzas.

- El Administrador activa o desactiva los módulos requeridos.

- El sistema guarda la configuración de la instalación.

- El sistema actualiza la disponibilidad de las funcionalidades en la interfaz.

### Flujos alternativos / excepciones

- El backend rechaza operaciones pertenecientes a un módulo desactivado, aunque un usuario intente acceder directamente a su API.

- Si un cambio se realiza offline, queda pendiente de sincronización.

### Postcondiciones

La instalación queda configurada con los módulos habilitados. Los módulos no se eliminan ni se cargan dinámicamente.

# Caso de uso transversal — Autenticación

| ID | Caso de uso | Actor(es) | Prioridad | Conexión |
| --- | --- | --- | --- | --- |
| CU-17 | Iniciar sesión en el sistema | Operador, Administrador | Alta | Primera autenticación: requiere conexión; sesión validada: puede continuar offline |

## CU-17 — Iniciar sesión en el sistema

Actor(es): Operador, Administrador

Prioridad: Alta

Precondiciones: El usuario tiene una cuenta activa creada previamente.

### Flujo principal

- El usuario ingresa nombre de usuario y contraseña.

- Cuando existe conexión, el sistema valida las credenciales contra el backend.

- El sistema identifica el rol del usuario y habilita las funciones correspondientes.

- Tras una autenticación válida, el dispositivo puede conservar la información de sesión necesaria para continuar con las funciones offline permitidas.

### Flujos alternativos / excepciones

- Si las credenciales son incorrectas, el sistema muestra un mensaje genérico sin revelar cuál dato falló.

- Si no existe conexión y el dispositivo posee una sesión previamente validada y vigente, el sistema permite continuar en modo offline según las restricciones definidas en ADR-004.

- Si nunca se ha autenticado previamente en el dispositivo, la primera autenticación requiere conexión.

### Postcondiciones

El usuario queda autenticado y puede acceder a las funciones permitidas por su rol.

# Notas de consistencia con ADR y ERD

- Una Venta cerrada genera exactamente un MovimientoCaja de ingreso; el cambio entregado al cliente no se modela como un movimiento independiente de caja.

- Una OrdenTrabajo puede tener múltiples Abonos. Cada Abono confirmado genera su propio MovimientoCaja de ingreso.

- El saldo pendiente de una OrdenTrabajo se calcula a partir del costo total y la suma de sus Abonos; no se utiliza un campo de abono acumulado como fuente independiente.

- Los consumos de una OrdenTrabajo se registran mediante ConsumoOrden y permanecen PENDIENTES hasta que la orden se finaliza/entrega y se aplican al inventario.

- Una sesión dinámica utiliza Venta con tipo=SESION_DINAMICA y una Mesa independiente. El alcance funcional del prototipo permite hasta 15 mesas activas.

- Los gastos hormiga se registran como MovimientoCaja de tipo GASTO.

- La cola de sincronización y los identificadores operation_id forman parte de la estrategia offline-first; el modelo relacional debe mantener la unicidad necesaria para garantizar idempotencia.

- El frontend puede ocultar funciones de módulos desactivados o roles sin permiso, pero la autorización efectiva se valida en el backend.