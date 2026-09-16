**SADIM**

**Casos de Uso Priorizados por Módulo**

Sprint 1 — Diseño del sistema y arquitectura
Universidad Antonio Nariño — Ingeniería de Sistemas y Computación
Bogotá, Colombia · 2026

# Criterio de priorización

Las prioridades se asignan según la relación de cada caso de uso con las funciones núcleo del alcance del anteproyecto y con la continuidad operativa offline-first. Los casos de prioridad Alta representan funciones necesarias para la operación diaria o para el control básico del negocio. Los casos de prioridad Media complementan la trazabilidad, administración y control, pero pueden desarrollarse después de los flujos operativos principales. Se documentan 23 casos de uso: diecisiete agrupados en los tres módulos funcionales y seis transversales de autenticación, configuración y administración de la instalación.

Para la columna de conexión se distingue entre operaciones que pueden ejecutarse localmente y operaciones cuyo resultado depende del servidor. Un cobro por TRANSFERENCIA o QR sí puede registrarse sin conexión, pero queda con estado_pago = PENDIENTE_VERIFICACION hasta que un usuario compruebe la recepción en línea; solo el efectivo se confirma de inmediato (D-06). Las operaciones que siempre requieren conexión son las excepciones E-01 a E-05 del ERD: confirmar un pago electrónico, autenticarse por primera vez y gestionar credenciales, modificar los medios de pago, autorizar dispositivos y confirmar un cierre de caja.

# Módulo 1 — Gestión de Ventas Diarias y Consumo Inmediato

Cubre la venta rápida de mostrador, las sesiones dinámicas de mesa y la configuración del catálogo. La gestión operativa corresponde a Administrador y Operador, mientras que la configuración del catálogo corresponde al Administrador, conforme al alcance del anteproyecto.

| ID | Caso de uso | Actor(es) | Prioridad | Conexión |
| --- | --- | --- | --- | --- |
| CU-01 | Registrar venta rápida de mostrador | Operador, Administrador | Alta | No (offline-first) |
| CU-02 | Abrir sesión dinámica de mesa | Operador, Administrador | Alta | No (offline-first) |
| CU-03 | Registrar consumo en sesión dinámica | Operador, Administrador | Alta | No (offline-first) |
| CU-04 | Cerrar sesión dinámica y cobrar | Operador, Administrador | Alta | Parcial: el cobro se registra offline; confirmar un pago electrónico requiere conexión (E-01) |
| CU-05 | Configurar catálogo de productos y precios | Administrador | Alta | No (offline-first; sincronización posterior) |
| CU-19 | Gestionar mesas del local | Administrador | Alta | No (offline-first; sincronización posterior) |

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

- El sistema registra la Venta con tipo=RAPIDA y estado=CERRADA, genera los detalles, registra los movimientos de inventario de los productos que controlan existencias y genera un único MovimientoCaja de ingreso con el estado_pago que corresponda al medio utilizado.

- El sistema muestra un comprobante o resumen de la venta.

### Flujos alternativos / excepciones

- Si el producto no tiene stock suficiente, el sistema informa al usuario y no permite confirmar una cantidad superior a la existencia disponible. Esta validación no aplica a los productos con controla_stock = false, que no llevan existencias propias.

- Si la venta se registra sin conexión y el medio de pago es efectivo, se guarda localmente y queda pendiente de sincronización.

- Si el medio de pago es TRANSFERENCIA o QR, el cobro queda registrado con estado_pago = PENDIENTE_VERIFICACION y el sistema muestra la referencia Nequi configurada (ConfiguracionPago); solo un usuario con conexión, tras comprobar la recepción, lo marca como CONFIRMADO. El sistema nunca lo presenta como pago recibido antes de esa confirmación (D-06, E-01).

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

- Si el producto no tiene stock suficiente, el sistema informa al usuario y no permite agregar una cantidad superior a la disponibilidad. Los productos con controla_stock = false se agregan sin esa validación.

- Si no existe conexión, la modificación de la sesión se guarda localmente y queda pendiente de sincronización.

### Postcondiciones

El total de la sesión queda actualizado. La existencia disponible local puede reflejar el consumo pendiente, pero el MovimientoInventario definitivo se genera al cerrar la venta.

## CU-04 — Cerrar sesión dinámica y cobrar

Actor(es): Operador, Administrador

Prioridad: Alta

Precondiciones: Existe una sesión dinámica ABIERTA. El cierre con cobro exige al menos un consumo registrado; una sesión sin consumos se resuelve mediante el flujo alternativo de cancelación.

### Flujo principal

- El usuario selecciona «Cerrar cuenta».

- El sistema muestra el resumen de consumos y el total a pagar.

- El usuario selecciona el medio de pago.

- El sistema valida las condiciones del pago según el medio seleccionado.

- El usuario confirma el cierre.

- El sistema cambia la Venta a estado=CERRADA, registra la fecha de cierre, el medio de pago y el estado del pago, genera los movimientos de salida de inventario de los productos que controlan existencias y genera exactamente un MovimientoCaja de ingreso.

- El sistema libera la mesa.

### Flujos alternativos / excepciones

- El usuario puede cancelar el cierre y continuar agregando consumos.

- Si la sesión se abrió por error, el usuario puede cancelarla mientras siga ABIERTA: la venta pasa a CANCELADA sin generar movimientos de inventario ni de caja y la mesa vuelve a DISPONIBLE. Una venta ya CERRADA no puede cancelarse; su corrección se registra mediante los movimientos de ajuste correspondientes (R-11).

- Con TRANSFERENCIA o QR el cobro se registra con estado_pago = PENDIENTE_VERIFICACION, mostrando la referencia Nequi configurada (ConfiguracionPago); solo un usuario con conexión, tras comprobar la recepción, lo marca como CONFIRMADO (D-06, E-01).

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

- El sistema solicita y valida nombre, tipo, precio de venta, costo de producción cuando aplique, unidad de medida, stock mínimo y si el producto controla existencias propias.

- El sistema guarda los cambios y actualiza la disponibilidad del catálogo.

### Flujos alternativos / excepciones

- Si un Operador intenta acceder, el backend deniega la operación mediante RBAC.

- Si no hay conexión, los cambios pueden almacenarse localmente y sincronizarse posteriormente, siempre que correspondan a una operación permitida offline.

### Postcondiciones

El catálogo queda actualizado para las operaciones de venta y sesiones dinámicas. Un producto marcado con controla_stock = false queda disponible para la venta sin llevar existencias propias; sus insumos se controlan como productos independientes.

## CU-19 — Gestionar mesas del local

Actor(es): Administrador

Prioridad: Alta

Precondiciones: Usuario autenticado con rol Administrador.

### Flujo principal

- El Administrador accede a la gestión de mesas.

- El sistema muestra las mesas registradas con su número, estado y si están activas.

- El Administrador registra una mesa nueva indicando su número, o activa o desactiva una existente.

- El sistema valida el número y el límite de mesas activas y guarda el cambio.

### Flujos alternativos / excepciones

- Si la operación superaría las quince mesas activas, el sistema la rechaza. Al sincronizar una operación creada sin conexión, se registra el conflicto LIMITE_MESAS_EXCEDIDO (R-06).

- Si la mesa está OCUPADA, el sistema no permite desactivarla.

- Las mesas no se eliminan: se desactivan para conservar el historial de sesiones.

- Si un Operador intenta modificar una mesa, el backend deniega la operación. El Operador sí consulta las mesas, porque las necesita para abrir una sesión (CU-02).

### Postcondiciones

El local dispone del mapa de mesas necesario para las sesiones dinámicas, con un máximo de quince mesas activas.

# Módulo 2 — Flujo de Entrega y Gestión de Servicios

Cubre los pedidos por encargo y servicios con fecha de entrega, el seguimiento de estados, los múltiples abonos, el consumo de inventario asociado a la orden y el análisis de costos operativos. La información financiera sensible del análisis de costos permanece restringida al Administrador.

| ID | Caso de uso | Actor(es) | Prioridad | Conexión |
| --- | --- | --- | --- | --- |
| CU-06 | Registrar pedido por encargo | Operador, Administrador | Alta | No (offline-first) |
| CU-07 | Actualizar estado de la orden de trabajo | Operador, Administrador | Media | No (offline-first) |
| CU-08 | Registrar abono a una orden de trabajo | Operador, Administrador | Alta | Parcial: el cobro se registra offline; confirmar un pago electrónico requiere conexión (E-01) |
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

- El sistema genera un MovimientoCaja de tipo INGRESO_ABONO con el estado_pago que corresponda al medio utilizado.

- El sistema recalcula el saldo pendiente como costo_total menos la suma de todos los abonos.

### Flujos alternativos / excepciones

- Si el abono excede el saldo pendiente, el sistema rechaza el valor.

- Con TRANSFERENCIA o QR el abono queda registrado con estado_pago = PENDIENTE_VERIFICACION, mostrando la referencia Nequi configurada (ConfiguracionPago); solo un usuario con conexión, tras comprobar la recepción, lo marca como CONFIRMADO (D-06, E-01). El saldo pendiente sí se reduce desde el registro, pero el ingreso no entra en un cierre de caja hasta confirmarse (R-22).

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

- El sistema calcula la utilidad neta de la orden como costo_total menos la suma de los CostoOperativoOrden registrados. El cálculo se realiza en el backend y no incluye el valor de los insumos consumidos, que se controla en el módulo de Inventario.

### Flujos alternativos / excepciones

- Si el usuario no tiene rol Administrador, el backend deniega el acceso.

- Si no existen costos operativos registrados, el sistema informa que no hay conceptos disponibles para el desglose y la utilidad neta equivale al costo total acordado.

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
| CU-15 | Realizar cierre de caja (arqueo) | Administrador | Alta | Sí: requiere conexión y la cola de sincronización aplicada (E-05) |
| CU-20 | Consultar resumen diario de caja | Administrador | Alta | Sí: los totales los calcula el backend |

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

- El Administrador indica el tipo de ajuste (MERMA o AJUSTE_MANUAL), la cantidad, el motivo y, si es AJUSTE_MANUAL, si el ajuste suma o resta existencias.

- El sistema crea un MovimientoInventario de tipo MERMA o AJUSTE_MANUAL, registrando el sentido cuando corresponde. La cantidad siempre es positiva: el signo lo determina el tipo o, en el ajuste manual, el sentido.

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

- Con TRANSFERENCIA o QR el gasto queda registrado con estado_pago = PENDIENTE_VERIFICACION y no se incorpora a un cierre de caja hasta que un usuario con conexión confirme la operación (D-06, R-22).

### Postcondiciones

El gasto queda trazable dentro de los movimientos de caja y puede incluirse en el cierre correspondiente.

## CU-15 — Realizar cierre de caja (arqueo)

Actor(es): Administrador

Prioridad: Alta

Precondiciones: Usuario autenticado con rol Administrador y con conexión; existen movimientos de caja registrados en el período que se desea cerrar.

### Flujo principal

- El Administrador selecciona «Cierre de caja».

- El sistema verifica que no existan operaciones pendientes de sincronización; si las hay, deben aplicarse antes de continuar.

- El sistema consolida los movimientos de caja del período con estado_pago = CONFIRMADO y sin cierre asignado, diferenciando ingresos por ventas, ingresos por abonos y gastos.

- El sistema presenta los totales por medio de pago y el efectivo esperado.

- El Administrador registra el efectivo físico contado y el sistema calcula la diferencia.

- El Administrador registra observaciones cuando existe un descuadre; son obligatorias si la diferencia no es cero.

- El sistema guarda el CierreCaja como resumen del período y asocia a él los movimientos consolidados.

### Flujos alternativos / excepciones

- Si existen operaciones pendientes de sincronización, el sistema las identifica y no permite confirmar el cierre hasta haberlas aplicado. El arqueo puede prepararse y el efectivo contarse sin conexión, pero la confirmación del cierre siempre requiere conexión (E-05).

- Los movimientos con estado_pago = PENDIENTE_VERIFICACION no se incluyen en este cierre y quedan disponibles para el siguiente (R-22).

- Un movimiento sincronizado con fecha anterior a un cierre ya realizado no se incorpora retroactivamente: se registra el conflicto MOVIMIENTO_EN_PERIODO_CERRADO y se consolida en el cierre siguiente (R-25).

- Si un Operador intenta acceder, el backend deniega la operación mediante RBAC.

### Postcondiciones

El período queda formalmente cerrado y el CierreCaja conserva el resumen, el arqueo (efectivo esperado, contado y diferencia) y las observaciones, mientras que MovimientoCaja mantiene el detalle histórico. Los movimientos consolidados quedan asociados al cierre y no pueden reasignarse ni modificarse (R-23).

## CU-20 — Consultar resumen diario de caja

Actor(es): Administrador

Prioridad: Alta

Precondiciones: Usuario autenticado con rol Administrador y con conexión.

### Flujo principal

- El Administrador abre el resumen financiero e indica la fecha a consultar.

- El sistema calcula en el backend los ingresos por ventas, los ingresos por abonos, los gastos y el neto del día, discriminados por medio de pago.

- El sistema señala por separado los importes con estado_pago = PENDIENTE_VERIFICACION, que aún no forman parte de ningún cierre.

### Flujos alternativos / excepciones

- Si un Operador intenta acceder, el backend deniega la operación mediante RBAC.

- Si no existen movimientos en la fecha consultada, el sistema informa que no hay actividad registrada.

### Postcondiciones

El Administrador dispone de la situación de caja del día sin necesidad de realizar un cierre. Los totales los calcula el backend; el cliente nunca los deriva localmente.

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

- El backend rechaza operaciones pertenecientes a un módulo desactivado, aunque un usuario intente acceder directamente a su API; al sincronizar registra el código MODULO_DESACTIVADO.

- Ambos roles consultan la configuración en modo lectura: sin ella, la interfaz del Operador no puede saber qué funcionalidades ocultar. La modificación queda restringida al Administrador.

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

# Casos de uso transversales — Administración de la instalación y sincronización

| ID | Caso de uso | Actor(es) | Prioridad | Conexión |
| --- | --- | --- | --- | --- |
| CU-18 | Gestionar usuarios | Administrador | Alta | Sí: las credenciales se validan y almacenan en el servidor (E-02) |
| CU-21 | Gestionar dispositivos autorizados | Administrador | Media | Sí: requiere conexión (E-04) |
| CU-22 | Configurar medios de pago | Administrador | Media | Sí: requiere conexión (E-03) |
| CU-23 | Atender novedades de sincronización | Operador, Administrador | Alta | Sí: requiere conexión |

## CU-18 — Gestionar usuarios

Actor(es): Administrador

Prioridad: Alta

Precondiciones: Usuario autenticado con rol Administrador y con conexión.

### Flujo principal

- El Administrador accede a la gestión de usuarios y consulta los existentes.

- El Administrador crea un usuario Operador indicando nombre, usuario y contraseña inicial, o edita los datos permitidos de uno existente.

- El sistema valida que el nombre de usuario sea único, almacena la contraseña como hash y guarda el registro.

### Flujos alternativos / excepciones

- La baja es lógica: el Administrador cambia activo a false. Un usuario inactivo conserva su historial y no puede iniciar sesión.

- El sistema rechaza la operación que dejaría la instalación sin ningún Administrador activo (R-04).

- Si un Operador intenta acceder, el backend deniega la operación.

- La creación de usuarios y el cambio de contraseña requieren conexión: las credenciales se validan y almacenan en el servidor (E-02).

### Postcondiciones

La instalación conserva al menos un Administrador activo y cada usuario accede únicamente a las funciones de su rol.

## CU-21 — Gestionar dispositivos autorizados

Actor(es): Administrador

Prioridad: Media

Precondiciones: Usuario autenticado con rol Administrador y con conexión.

### Flujo principal

- El Administrador consulta los dispositivos registrados y cuál está autorizado para operar sin conexión.

- El Administrador registra un dispositivo nuevo con el identificador que genera la PWA, le asigna un nombre reconocible e indica si corresponde al punto de caja.

- El Administrador autoriza un dispositivo para operar offline; el sistema revoca automáticamente cualquier autorización anterior.

### Flujos alternativos / excepciones

- Si un Operador intenta acceder, el backend deniega la operación.

- Si un dispositivo no autorizado envía operaciones creadas sin conexión, el lote completo se rechaza con el código DISPOSITIVO_NO_AUTORIZADO y las operaciones quedan registradas para informar al usuario.

- Un dispositivo se revoca sin borrarlo, para conservar su historial de sincronización.

### Postcondiciones

A lo sumo un dispositivo tiene autorizado_offline = true, conforme a la política de un único dispositivo offline (D-04).

## CU-22 — Configurar medios de pago

Actor(es): Administrador

Prioridad: Media

Precondiciones: Usuario autenticado con rol Administrador y con conexión.

### Flujo principal

- El Administrador accede a la configuración de medios de pago.

- El Administrador habilita o deshabilita EFECTIVO, TRANSFERENCIA y QR.

- El Administrador registra el titular y la llave Nequi que se mostrará al cliente como referencia de cobro.

### Flujos alternativos / excepciones

- El sistema exige una llave Nequi si TRANSFERENCIA o QR están habilitados.

- La modificación requiere conexión: un cambio registrado offline y rechazado después dejaría cobros dirigidos a una cuenta que el negocio no controla (E-03).

- Ambos roles consultan la configuración en modo lectura, porque el Operador necesita mostrar la referencia al cliente. Solo el Administrador la modifica (R-29).

### Postcondiciones

La referencia configurada se muestra a partir de ese momento en los cobros por transferencia o QR. SADIM no verifica el pago: solo registra el medio y presenta la referencia.

## CU-23 — Atender novedades de sincronización

Actor(es): Operador, Administrador

Prioridad: Alta

Precondiciones: Existen operaciones sincronizadas con estado RECHAZADA o CONFLICTO pendientes de atención.

### Flujo principal

- El usuario consulta las novedades: operaciones con estado RECHAZADA o CONFLICTO y atendida = false.

- El sistema muestra, por cada una, el recurso afectado, el código, el mensaje y la fecha en que se registró en el dispositivo.

- El usuario realiza la corrección manual que corresponda: repetir el registro con la cantidad disponible, registrar un ajuste de inventario con motivo, cobrar la diferencia o dejar constancia en las observaciones del cierre.

- El usuario marca la novedad como atendida.

### Flujos alternativos / excepciones

- Una novedad no se resuelve sobrescribiendo el estado del servidor: la corrección es siempre una operación nueva y trazable (R-31).

- Las novedades cuya corrección corresponde a un Administrador, como un ajuste manual de inventario, quedan visibles para el Operador pero no son ejecutables por él.

### Postcondiciones

Ninguna operación queda rechazada o en conflicto sin que un usuario la haya revisado (R-33).

# Notas de consistencia con ADR y ERD

- Una Venta cerrada genera exactamente un MovimientoCaja de ingreso; el cambio entregado al cliente no se modela como un movimiento independiente de caja.

- Una OrdenTrabajo puede tener múltiples Abonos. Cada Abono confirmado genera su propio MovimientoCaja de ingreso.

- El saldo pendiente de una OrdenTrabajo se calcula a partir del costo total y la suma de sus Abonos; no se utiliza un campo de abono acumulado como fuente independiente.

- Los consumos de una OrdenTrabajo se registran mediante ConsumoOrden y permanecen PENDIENTES hasta que la orden se finaliza/entrega y se aplican al inventario.

- Una sesión dinámica utiliza Venta con tipo=SESION_DINAMICA y una Mesa independiente. El alcance funcional del prototipo permite hasta 15 mesas activas.

- Los gastos hormiga se registran como MovimientoCaja de tipo GASTO.

- La cola de sincronización y los identificadores operation_id forman parte de la estrategia offline-first; el modelo relacional debe mantener la unicidad necesaria para garantizar idempotencia.

- Un producto con controla_stock = false no valida ni descuenta existencias al venderse. SADIM no modela recetas: los insumos de un preparado se controlan como productos independientes mediante ingresos, consumos de órdenes, mermas y ajustes.

- La utilidad neta de una orden es costo_total menos la suma de sus CostoOperativoOrden, calculada en el backend y visible solo para el Administrador.

- Un cobro por TRANSFERENCIA o QR se registra con estado_pago = PENDIENTE_VERIFICACION y no entra en un cierre de caja hasta confirmarse en línea.

- Las operaciones creadas sin conexión provienen de un único dispositivo autorizado. Las rechazadas o en conflicto no se descartan: se atienden mediante CU-23.

- El frontend puede ocultar funciones de módulos desactivados o roles sin permiso, pero la autorización efectiva se valida en el backend.