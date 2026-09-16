**SADIM**

**Modelo Entidad-Relación (ERD) — Conceptual y Lógico**

**Versión 3 — Ajustes solicitados en revisión**

Sprint 1 — Diseño del sistema y arquitectura

Universidad Antonio Nariño — Ingeniería de Sistemas y Computación

Bogotá, Colombia

# **1. Alcance del modelo de datos**

Este modelo traduce a estructuras de datos las dinámicas operativas descritas en el alcance del anteproyecto: ventas de consumo inmediato y sesiones dinámicas, flujo de entrega de servicios, inventario y control financiero. Se mantiene alineado con el ADR arquitectónico aprobado (ADR-001 a ADR-008) y con el alcance de una instalación de SADIM asociada a un único negocio.

La versión 3 no reemplaza el modelo aprobado: lo conserva y lo precisa. Los ajustes responden exclusivamente a los diez puntos observados en la revisión, cada uno documentado como decisión explícita con su justificación en la sección 2. No se incorporan módulos, entidades ni funcionalidades adicionales a las requeridas por esas observaciones.

El proyecto se mantiene como monolito modular con Django + Django REST Framework sobre PostgreSQL, entregado como PWA con funcionamiento offline mediante IndexedDB. No se introducen Firebase, autenticación federada de terceros, microservicios ni multi-tenancy.

Nota de diseño (vigente desde v2): la venta rápida de mostrador y la sesión dinámica se mantienen como una única entidad Venta diferenciada mediante el atributo tipo. Una sesión dinámica permanece ABIERTA mientras acumula consumos; al cerrarse se confirma la operación y se generan los efectos correspondientes sobre inventario y caja. La Mesa se modela como entidad independiente para permitir gestionar hasta 15 mesas activas.

## **1.1 Resumen de cambios respecto a la versión 2**

| **Ítem** | **Cambio** | **Efecto en el modelo** |
| --- | --- | --- |
| D-01 | Se ratifica la ausencia de entidad Negocio y de campos de multi-tenancy. | Sin cambios estructurales; se documenta la decisión y se prohíbe explícitamente negocio_id. |
| D-02 | Rol permanece como enum/choice dentro de Usuario. | Sin tabla Rol ni tabla intermedia de permisos. |
| D-03 | Se fijan los cuatro módulos oficiales y su función. | ConfiguracionModulo conserva exactamente cuatro banderas y se declara singleton. |
| D-04 | Un único dispositivo operativo autorizado para trabajar offline. | Nueva entidad Dispositivo (identificación en la sincronización). |
| D-05 | Se define el proceso de sincronización y el tratamiento de conflictos. | Nueva entidad OperacionSincronizacion (bitácora idempotente y de conflictos). |
| D-06 | Pagos electrónicos sin pasarela: referencia Nequi configurable por ADMIN. | Nueva entidad ConfiguracionPago y atributo estado_pago en Venta, Abono y MovimientoCaja. |
| D-07 | Relación explícita CierreCaja — MovimientoCaja. | Nueva FK cierre_caja_id en MovimientoCaja y ampliación de CierreCaja para el arqueo. |
| D-08 | Regla general de operación offline y excepciones justificadas. | Sección 9 con la matriz de operaciones y sus justificaciones. |
| D-09 | IndexedDB con Dexie.js como tecnología definitiva de persistencia local. | Sección 10 con los almacenes locales; fuera del modelo relacional. |
| D-10 | Criterio de Done y evidencia mínima por Historia de Usuario. | Sección 11. |
| REV | Revisión de coherencia de PK, FK, cardinalidades, UNIQUE y estados. | Sección 12: correcciones a errores detectados en la v2. |
| REV-2 | Revisión de consistencia cruzada con el Contrato de API, los Casos de Uso y el ADR (12/09/2026). | Sección 12.1: operation_id en Categoria, Producto y Mesa; sentido en AJUSTE_MANUAL; controla_stock en Producto; fórmula de utilidad neta. |

# **2. Decisiones documentadas en esta versión**

Cada decisión responde a un punto observado en la revisión. Se enuncia la decisión adoptada y su justificación, y se indica dónde queda reflejada en el modelo.

## **D-01. No se utiliza una entidad Negocio**

**Decisión. **El modelo de datos no incluye la entidad Negocio ni ningún atributo de tenencia (negocio_id, sede_id, tenant_id). La instalación de SADIM representa directamente al negocio donde se implementa el sistema: todos los usuarios, productos, ventas, órdenes, movimientos y configuraciones pertenecen implícitamente a ese único negocio.

**Justificación. **El alcance actual no contempla varias sedes de un mismo negocio, franquicias ni varios negocios dentro de una misma instalación. Introducir una entidad Negocio obligaría a propagar una clave foránea a prácticamente todas las tablas, a filtrar cada consulta por tenencia y a resolver el aislamiento de datos en la sincronización offline, sin que exista un requisito que lo justifique. Es coherente con ADR-007.

**Reflejo en el modelo. **Ninguna entidad de la sección 5 declara una FK hacia un negocio. ConfiguracionModulo y ConfiguracionPago se modelan como filas únicas (singleton) de la instalación. Una eventual evolución hacia múltiples negocios exigiría una nueva versión del ERD y una revisión del ADR-007, y no debe anticiparse con campos sin uso.

## **D-02. El rol es una característica del Usuario, no una entidad**

**Decisión. **Usuario.rol se representa como un enum/choice con exactamente dos valores: ADMIN y OPERADOR. No existe la entidad Rol, ni tabla Permiso, ni tabla intermedia UsuarioRol. Cada usuario tiene un único rol que determina las áreas y acciones a las que puede acceder.

**Justificación. **Con dos roles fijos y sin permisos configurables en tiempo de ejecución, una tabla de roles solo añadiría una unión adicional en cada verificación de autorización y un riesgo de estados inválidos (roles huérfanos, usuarios sin rol). El enum permite validar el valor en la base de datos, en el modelo de Django (choices) y en las permission classes de DRF con una sola fuente de verdad, y viaja sin costo en el token de sesión y en la caché local de la PWA. Es coherente con ADR-005.

**Reflejo en el modelo. **Sección 5.1, atributo rol. La autorización efectiva se aplica en el backend; la interfaz solo oculta acciones no autorizadas. Si en el futuro se requirieran roles configurables por el administrador, ese cambio constituiría una decisión arquitectónica nueva y no una simple modificación del ERD.

## **D-03. Módulos oficiales de SADIM**

**Decisión. **Los módulos oficiales son exactamente cuatro: Ventas, Inventario, Servicios y Finanzas. ConfiguracionModulo mantiene una bandera por módulo, con esos mismos nombres, y no se añaden módulos adicionales.

| **Módulo** | **Bandera en ConfiguracionModulo** | **Función que cubre** |
| --- | --- | --- |
| Ventas | ventas_activo | Venta rápida de mostrador y sesiones dinámicas de mesa: apertura, acumulación de consumos, cierre y cobro. Entidades Mesa, Venta y DetalleVenta. |
| Inventario | inventario_activo | Catálogo de productos e insumos, existencias, entradas de mercancía, mermas y ajustes manuales. Entidades Categoria, Producto y MovimientoInventario. |
| Servicios | servicios_activo | Pedidos por encargo y órdenes de trabajo con fecha de entrega: estados, abonos, consumo de insumos y costos operativos. Entidades OrdenTrabajo, Abono, ConsumoOrden y CostoOperativoOrden. |
| Finanzas | finanzas_activo | Trazabilidad de ingresos y egresos, gastos hormiga y cierre de caja o arqueo. Entidades MovimientoCaja y CierreCaja. |

**Justificación. **Los cuatro módulos corresponden a los definidos en ADR-002 y ADR-006 y cubren la totalidad de los casos de uso aprobados (CU-01 a CU-23). Fijar la lista evita que la configuración se convierta en un catálogo abierto y permite validar en el backend, con un conjunto cerrado de valores, qué operaciones se rechazan cuando un módulo está desactivado.

**Reflejo en el modelo. **Sección 5.3. Desactivar un módulo no elimina datos ni código: oculta sus funcionalidades en la PWA y hace que el backend rechace sus operaciones mientras permanezca desactivado, incluidas las que lleguen por sincronización (código de conflicto MODULO_DESACTIVADO).

## **D-04. Trabajo offline desde un único dispositivo operativo**

**Decisión. **Cuando SADIM opera sin conexión, las operaciones se realizan desde un único dispositivo autorizado, preferiblemente el dispositivo de caja. No se contempla que varios dispositivos trabajen simultáneamente offline sobre la misma instalación. El dispositivo autorizado se registra en la entidad Dispositivo y se identifica en cada sincronización mediante un identificador propio.

**Justificación. **Dos dispositivos operando offline sobre el mismo inventario producen descuadres que el servidor no puede resolver de forma automática: ambos descuentan existencias que solo alcanzan para uno, ambos abren una sesión sobre la misma mesa o ambos registran un cierre de caja del mismo período. Al concentrar la operación offline en un único dispositivo, el estado local es la única fuente de operaciones pendientes y el conflicto solo puede surgir frente al servidor, no entre pares. Esto evita recurrir a CRDT, descartado en ADR-004 por exceder el alcance del proyecto.

### **Identificación del dispositivo en la sincronización**

- En su primer uso con conexión, la PWA genera un UUID local (identificador de dispositivo) y lo almacena de forma persistente en IndexedDB. Ese valor no cambia mientras no se borren los datos del navegador.

- Un usuario ADMIN registra el dispositivo con conexión: crea la fila en Dispositivo con ese identificador, le asigna un nombre reconocible («Tablet caja»), lo marca como dispositivo de caja cuando corresponde y activa la bandera autorizado_offline.

- Solo puede existir un dispositivo con autorizado_offline = true, garantizado por un índice único parcial. Autorizar otro dispositivo exige revocar el anterior, operación que requiere conexión.

- Cada solicitud a /api/sync/ incluye el encabezado X-Device-Id con ese identificador. El backend resuelve el Dispositivo, verifica que esté activo y autorizado, y registra el origen de cada operación en OperacionSincronizacion.dispositivo_id.

- Si el identificador no corresponde a un dispositivo autorizado, el lote completo se rechaza con el código DISPOSITIVO_NO_AUTORIZADO y las operaciones quedan registradas como RECHAZADA para que el usuario sea informado.

- La trazabilidad del origen no se replica en cada tabla transaccional: se obtiene relacionando el operation_id de la fila con OperacionSincronizacion, que conserva el dispositivo, el usuario y la fecha de origen.

## **D-05. Sincronización posterior al modo offline**

**Decisión. **Al recuperar la conexión, el dispositivo envía sus operaciones pendientes en el mismo orden en que fueron creadas. El servidor las procesa de forma idempotente mediante operation_id, valida cada una contra las reglas de negocio y el estado actual, y devuelve un resultado por operación. No se aplica Last Write Wins a las operaciones transaccionales. Toda operación que no pueda aplicarse queda registrada como RECHAZADA o CONFLICTO en OperacionSincronizacion, con su código y mensaje, para ser informada al usuario.

**Justificación. **Last Write Wins es adecuado para campos independientes, no para operaciones que modifican saldos y existencias: sobrescribir el estado del servidor con el del cliente descuadraría inventario y caja y haría desaparecer operaciones legítimas registradas en línea. La validación por reglas de negocio, ya adoptada en ADR-004, preserva la consistencia; el registro explícito del rechazo evita el peor escenario, que es perder una operación en silencio. Es coherente con el endpoint /api/sync/ del contrato de API.

El detalle del procedimiento, los estados y los códigos de conflicto se desarrolla en la sección 8.

## **D-06. Alcance de los pagos electrónicos**

**Decisión. **SADIM no integra pasarela de pagos ni servicios bancarios. Registra el medio de pago utilizado (EFECTIVO, TRANSFERENCIA o QR) y, para transferencia y QR, muestra como referencia la cuenta o llave Nequi configurada en ConfiguracionPago. Esa configuración solo puede ser modificada por un usuario ADMIN. El sistema nunca afirma que una transferencia o un pago QR fue recibido mientras el dispositivo está offline: la operación se registra con estado_pago = PENDIENTE_VERIFICACION y solo un usuario, ya con conexión y tras comprobar la recepción en su aplicación Nequi, puede marcarla como CONFIRMADO.

**Justificación. **Sin integración bancaria, SADIM no tiene ninguna forma técnica de comprobar que el dinero llegó; ni siquiera en línea. Presentar el pago como confirmado sería afirmar un hecho que el sistema no conoce, y ese dato terminaría en el cierre de caja produciendo un descuadre a favor de un ingreso inexistente. Diferenciar el registro del pago de su confirmación permite operar sin conexión sin comprometer la veracidad de la información financiera, y mantiene el proyecto dentro del alcance definido en ADR-004.

**Reflejo en el modelo. **Entidad ConfiguracionPago (sección 5.4) y atributo estado_pago en Venta, Abono y MovimientoCaja. Los movimientos con estado_pago = PENDIENTE_VERIFICACION no se incorporan a un CierreCaja hasta ser confirmados (regla R-22).

## **D-07. Relación explícita entre CierreCaja y MovimientoCaja**

**Decisión. **MovimientoCaja incorpora la clave foránea cierre_caja_id, nula mientras el movimiento no ha sido incluido en ningún cierre. Un CierreCaja agrupa de cero a muchos MovimientoCaja; un MovimientoCaja pertenece a lo sumo a un CierreCaja. La relación es 1:N desde CierreCaja hacia MovimientoCaja con FK del lado N.

**Justificación. **Deducir la pertenencia por rango de fechas es frágil: una operación creada offline el lunes y sincronizada el miércoles caería fuera del corte del lunes o alteraría un cierre ya firmado, y un movimiento pendiente de verificación entraría en el corte antes de confirmarse. La FK explícita fija qué movimientos quedaron efectivamente dentro de cada cierre, permite reconstruir de dónde provino el dinero registrado y hace verificable el arqueo: los totales del cierre deben ser exactamente la suma de sus movimientos asociados. Es coherente con ADR-008, donde el cierre es un corte y no la fuente histórica.

**Reflejo en el modelo. **Secciones 5.15 y 5.16, y reglas R-20 a R-24. Un movimiento asignado a un cierre no puede reasignarse ni modificarse; una corrección posterior se registra como un nuevo movimiento.

## **D-08. Operaciones permitidas offline**

**Decisión. **La regla general es que SADIM permite trabajar offline con todas las operaciones posibles. Solo se exceptúan las que dependen de una verificación externa en tiempo real o cuyo procesamiento offline comprometería la seguridad o la consistencia global de la instalación. Las excepciones son cinco y están justificadas una a una en la sección 9.

**Justificación. **La continuidad operativa ante conectividad inestable es un requisito central del proyecto (ADR-003 y ADR-004); restringir funciones sin causa lo contradiría. Las excepciones se limitan a los casos en que el resultado no depende de datos locales: confirmación de pagos electrónicos, autenticación inicial y gestión de credenciales, cambio de la referencia de pago, autorización de dispositivos y confirmación definitiva del cierre de caja.

## **D-09. Tecnología de persistencia local**

**Decisión. **La tecnología base de persistencia local es IndexedDB, utilizada mediante el wrapper Dexie.js. La tecnología definitiva es, por tanto, IndexedDB con Dexie.js; no se introduce ninguna base local alternativa ni servicios externos de sincronización.

**Justificación. **La API nativa de IndexedDB es asíncrona basada en eventos y verbosa: cada consulta exige abrir transacciones, gestionar cursores y encadenar callbacks, lo que multiplica el código de la cola de sincronización y las probabilidades de error. Dexie.js expone la misma base de datos con una API de promesas y consultas por índice compatible con async/await y TypeScript, resuelve el versionado de esquema con migraciones declarativas y no añade un motor distinto: los datos siguen almacenados en IndexedDB, por lo que la decisión es reversible sin cambiar el modelo. Es una biblioteca ligera, sin servidor asociado y sin implicaciones para ADR-001 ni ADR-004.

**Reflejo en el modelo. **Sección 10. Los almacenes locales no forman parte del modelo relacional de PostgreSQL y no se migran con Django.

## **D-10. Criterio de Done y evidencia mínima por Historia de Usuario**

**Decisión. **Una Historia de Usuario se considera terminada únicamente cuando cuenta con implementación funcional, las validaciones correspondientes, prueba de su flujo principal y evidencia verificable de su funcionamiento. La definición completa está en la sección 11.

**Justificación. **Sin un criterio común, «terminado» se interpreta como «el código está escrito», y las HU regresan en sprints posteriores por validaciones faltantes o comportamientos no comprobados. Exigir evidencia hace verificable el avance del equipo frente al mismo estándar.

# **3. ERD conceptual**

El modelo conceptual está compuesto por diecisiete entidades. Catorce provienen de la versión 2 y se conservan sin cambios estructurales; tres se incorporan como consecuencia directa de las decisiones D-04, D-05 y D-06.

## **3.1 Entidades del modelo**

| **Entidad** | **Origen** | **Descripción** |
| --- | --- | --- |
| Usuario | v2 | Personas que acceden al sistema. Su rol (ADMIN u OPERADOR) es un atributo propio y determina las áreas y acciones permitidas. |
| Dispositivo | v3 (D-04) | Dispositivo cliente registrado en la instalación. Identifica el origen de las operaciones sincronizadas y determina cuál es el único dispositivo autorizado para operar sin conexión. |
| ConfiguracionModulo | v2 | Fila única que indica cuáles de los cuatro módulos oficiales están habilitados en la instalación. |
| ConfiguracionPago | v3 (D-06) | Fila única con los medios de pago aceptados y la cuenta o llave Nequi de referencia. Solo modificable por un usuario ADMIN. |
| Categoria | v2 | Agrupa productos del catálogo. |
| Producto | v2 | Ítems del catálogo, diferenciando insumos de producción y productos para reventa directa, y si el ítem controla existencias propias. |
| Mesa | v2 | Mesa física disponible para sesiones dinámicas; máximo funcional de 15 mesas activas. |
| Venta | v2 | Venta rápida o sesión dinámica. Una sesión puede permanecer ABIERTA hasta su cierre. |
| DetalleVenta | v2 | Líneas de productos asociadas a una Venta. |
| OrdenTrabajo | v2 | Pedidos por encargo o servicios con fecha de entrega. |
| Abono | v2 | Pago parcial realizado sobre una OrdenTrabajo; una orden puede tener múltiples abonos. |
| ConsumoOrden | v2 | Productos o insumos utilizados en una OrdenTrabajo, pendientes de aplicación al inventario hasta la finalización o entrega. |
| CostoOperativoOrden | v2 | Desglose de costos operativos asociados a una OrdenTrabajo. |
| MovimientoInventario | v2 | Historial de entradas, salidas, mermas y ajustes de inventario. |
| MovimientoCaja | v2 | Registro trazable de ingresos y egresos originados por ventas, abonos y gastos. Ahora referencia el cierre que lo consolidó. |
| CierreCaja | v2 | Corte o arqueo de los movimientos de caja de un período, realizado por un ADMIN, con relación explícita a los movimientos incluidos. |
| OperacionSincronizacion | v3 (D-05) | Bitácora del servidor con el resultado de cada operación recibida por sincronización: aplicada, duplicada, rechazada o en conflicto. |

## **3.2 Diagrama conceptual en notación textual**

Notación: 1 — N indica uno a muchos; 1 — 1 indica uno a uno; (0..1) indica participación opcional del lado indicado.

Usuario 1 ─── N Venta                 Usuario 1 ─── N MovimientoInventario

Usuario 1 ─── N OrdenTrabajo          Usuario 1 ─── N MovimientoCaja

Usuario 1 ─── N Abono                 Usuario 1 ─── N CierreCaja        (solo ADMIN)

Usuario 1 ─── N Dispositivo           Usuario 1 ─── N OperacionSincronizacion

Categoria 1 ─── N Producto

Producto  1 ─── N DetalleVenta        Producto 1 ─── N MovimientoInventario

Producto  1 ─── N ConsumoOrden

Mesa  1 ─── N Venta                   (0..1 sesión ABIERTA por mesa)

Venta 1 ─── N DetalleVenta

Venta 1 ─── N MovimientoInventario    (salidas generadas al cerrar)

Venta 1 ─── 1 MovimientoCaja          (0..1 mientras la venta esté ABIERTA)

OrdenTrabajo 1 ─── N Abono            OrdenTrabajo 1 ─── N ConsumoOrden

OrdenTrabajo 1 ─── N CostoOperativoOrden

Abono        1 ─── 1 MovimientoCaja

ConsumoOrden 1 ─── 1 MovimientoInventario   (0..1 mientras esté PENDIENTE)

CierreCaja  1 ─── N MovimientoCaja    (D-07: FK cierre_caja_id, NULL si no cerrado)

Dispositivo 1 ─── N OperacionSincronizacion

ConfiguracionModulo  ── fila única de la instalación (singleton)

ConfiguracionPago    ── fila única de la instalación (singleton)

OperacionSincronizacion ── se vincula a la fila afectada por operation_id

La correspondencia entre OperacionSincronizacion y la entidad afectada no se modela como clave foránea, porque el destino varía según el recurso. Se resuelve mediante operation_id, que es único en cada tabla transaccional, y se conserva además objeto_id como referencia de auditoría.

# **4. Relaciones y cardinalidad**

| **Entidad origen** | **Cardinalidad** | **Entidad destino** | **Descripción** |
| --- | --- | --- | --- |
| Usuario | 1:N | Venta | Un usuario puede registrar muchas ventas o sesiones dinámicas. |
| Usuario | 1:N | OrdenTrabajo | Un usuario puede registrar y gestionar muchas órdenes. |
| Usuario | 1:N | Abono | Un usuario puede registrar muchos abonos. |
| Usuario | 1:N | MovimientoInventario | Un usuario puede ejecutar movimientos de inventario. |
| Usuario | 1:N | MovimientoCaja | Un usuario puede registrar movimientos de caja. |
| Usuario | 1:N | CierreCaja | Un ADMIN puede realizar múltiples cierres. Restringido por rol. |
| Usuario | 1:N | Dispositivo | Un ADMIN registra y autoriza los dispositivos de la instalación. |
| Usuario | 1:N | OperacionSincronizacion | Las operaciones sincronizadas conservan el usuario que las originó. |
| Categoria | 1:N | Producto | Una categoría puede agrupar muchos productos. |
| Mesa | 1:N | Venta | Una mesa participa en múltiples sesiones a lo largo del tiempo; a lo sumo una de ellas está ABIERTA. |
| Venta | 1:N | DetalleVenta | Una venta contiene una o más líneas de detalle. |
| Producto | 1:N | DetalleVenta | Un producto puede aparecer en muchas líneas de venta. |
| Producto | 1:N | MovimientoInventario | Un producto puede tener muchos movimientos de inventario. |
| Producto | 1:N | ConsumoOrden | Un producto puede utilizarse en múltiples órdenes. |
| OrdenTrabajo | 1:N | Abono | Una orden puede recibir múltiples abonos en distintos momentos. |
| OrdenTrabajo | 1:N | ConsumoOrden | Una orden puede registrar múltiples consumos de productos o insumos. |
| OrdenTrabajo | 1:N | CostoOperativoOrden | Una orden puede acumular múltiples conceptos de costo. |
| Venta | 1:1 | MovimientoCaja | Una venta cerrada genera exactamente un movimiento de ingreso. Garantizado por UNIQUE(venta_id) en MovimientoCaja. |
| Abono | 1:1 | MovimientoCaja | Un abono registrado genera exactamente un movimiento de ingreso. Garantizado por UNIQUE(abono_id). |
| Venta | 1:N | MovimientoInventario | Una venta cerrada genera una salida de inventario por cada línea de detalle con efecto sobre existencias. |
| ConsumoOrden | 1:1 | MovimientoInventario | Un consumo aplicado al finalizar la orden genera un único movimiento de salida. Garantizado por UNIQUE(consumo_orden_id). |
| CierreCaja | 1:N | MovimientoCaja | D-07. Un cierre consolida los movimientos que efectivamente incluyó; un movimiento pertenece a lo sumo a un cierre. FK cierre_caja_id, NULL hasta ser consolidado. |
| Dispositivo | 1:N | OperacionSincronizacion | D-04. Cada operación recibida queda asociada al dispositivo que la envió. |

ConfiguracionModulo y ConfiguracionPago no participan en relaciones de cardinalidad con otras entidades operativas: son configuraciones únicas de la instalación (D-01). Cada una conserva una FK opcional hacia el usuario que la modificó por última vez, con fines de auditoría.

# **5. ERD lógico — diccionario de datos**

Los siguientes atributos constituyen la base para las migraciones de Django y los serializers de la API. Los identificadores UUID permiten generar identificadores localmente para las operaciones que puedan originarse offline. Los campos marcados como CALCULADO son mantenidos por el backend y nunca son editables por el cliente.

## **5.1 Usuario**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| nombre_completo | VARCHAR(150) | NOT NULL | Nombre del propietario o empleado. |
| username | VARCHAR(50) | UNIQUE, NOT NULL | Usuario de acceso al sistema. |
| password_hash | VARCHAR(255) | NOT NULL | Hash de la contraseña; nunca se almacena en texto plano. |
| rol | ENUM | NOT NULL, DEFAULT OPERADOR | D-02. ADMIN u OPERADOR. Se implementa como choices del modelo y CHECK en base de datos; no existe entidad Rol. |
| activo | BOOLEAN | NOT NULL, DEFAULT true | Permite deshabilitar un usuario sin eliminarlo. |
| fecha_creacion | TIMESTAMP | NOT NULL | Auditoría de alta del usuario. |

Restricción adicional: debe existir al menos un usuario con rol = ADMIN y activo = true. La operación que dejaría la instalación sin administradores activos se rechaza en el backend. La gestión de usuarios corresponde a CU-18 y la baja es lógica mediante activo: un usuario inactivo conserva su historial y no puede iniciar sesión.

## **5.2 Dispositivo**

Entidad nueva (D-04). Registra los dispositivos de la instalación y determina cuál puede operar sin conexión. Su gestión corresponde a CU-21.

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador del registro en el servidor. |
| identificador | UUID | UNIQUE, NOT NULL | UUID generado por la PWA en su primer uso y conservado en IndexedDB. Viaja en el encabezado X-Device-Id de cada sincronización. |
| nombre | VARCHAR(100) | NOT NULL, UNIQUE | Nombre reconocible por el negocio, por ejemplo «Tablet caja». |
| es_caja | BOOLEAN | NOT NULL, DEFAULT false | Indica que el dispositivo corresponde al punto de caja. Es el candidato preferente a operar offline. |
| autorizado_offline | BOOLEAN | NOT NULL, DEFAULT false | Único dispositivo habilitado para registrar operaciones sin conexión. Índice único parcial: solo una fila puede tener true. |
| activo | BOOLEAN | NOT NULL, DEFAULT true | Permite revocar un dispositivo sin borrar su historial de sincronización. |
| registrado_por_id | UUID | FK → Usuario, NOT NULL | ADMIN que registró y autorizó el dispositivo. |
| fecha_registro | TIMESTAMP | NOT NULL | Momento del registro. |
| ultima_sincronizacion | TIMESTAMP | NULL | Fecha del último lote procesado con éxito; permite detectar dispositivos con operaciones antiguas sin enviar. |

## **5.3 ConfiguracionModulo**

D-03. Fila única de la instalación. Los cuatro módulos oficiales son Ventas, Inventario, Servicios y Finanzas; no se admiten otros.

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador de la configuración. |
| ventas_activo | BOOLEAN | NOT NULL, DEFAULT true | Habilita el módulo Ventas: venta rápida, sesiones dinámicas y mesas. |
| inventario_activo | BOOLEAN | NOT NULL, DEFAULT true | Habilita el módulo Inventario: catálogo, existencias, entradas, mermas y ajustes. |
| servicios_activo | BOOLEAN | NOT NULL, DEFAULT true | Habilita el módulo Servicios: órdenes de trabajo, abonos, consumos y costos operativos. |
| finanzas_activo | BOOLEAN | NOT NULL, DEFAULT true | Habilita el módulo Finanzas: movimientos de caja, gastos y cierre de caja. |
| actualizado_por_id | UUID | FK → Usuario, NULL | ADMIN que realizó la última modificación. |
| actualizado_en | TIMESTAMP | NOT NULL | Fecha de la última modificación. |

Restricción de singleton: la tabla admite exactamente una fila. Se garantiza con un índice único sobre una columna constante o con una validación equivalente en el backend. La modificación está restringida al rol ADMIN (CU-16).

## **5.4 ConfiguracionPago**

Entidad nueva (D-06). Fila única de la instalación. No representa una pasarela de pagos: solo almacena los medios aceptados y la referencia Nequi que se muestra al cliente.

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador de la configuración. |
| acepta_efectivo | BOOLEAN | NOT NULL, DEFAULT true | Habilita EFECTIVO como medio de pago seleccionable. |
| acepta_transferencia | BOOLEAN | NOT NULL, DEFAULT true | Habilita TRANSFERENCIA como medio de pago seleccionable. |
| acepta_qr | BOOLEAN | NOT NULL, DEFAULT true | Habilita QR como medio de pago seleccionable. |
| nequi_titular | VARCHAR(150) | NULL | Nombre del titular de la cuenta Nequi, mostrado como referencia al cliente. |
| nequi_llave | VARCHAR(50) | NULL | Número o llave Nequi configurada por el ADMIN. Es un dato de referencia; SADIM no consulta ni valida la cuenta. |
| actualizado_por_id | UUID | FK → Usuario, NOT NULL | ADMIN que realizó la última modificación. Auditoría obligatoria. |
| actualizado_en | TIMESTAMP | NOT NULL | Fecha de la última modificación. |

Restricciones: fila única (singleton); CHECK que exige nequi_llave NOT NULL cuando acepta_transferencia o acepta_qr es true; modificación permitida únicamente al rol ADMIN y con conexión (CU-22, D-08, excepción E-03). La lectura está disponible para ambos roles, porque el Operador debe mostrar la referencia al cobrar.

## **5.5 Categoria**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de la operación de creación, para sincronización idempotente. |
| nombre | VARCHAR(100) | NOT NULL, UNIQUE | Nombre de la categoría. |

## **5.6 Producto**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de la operación de creación, para sincronización idempotente. |
| categoria_id | UUID | FK → Categoria, NOT NULL | Categoría a la que pertenece. |
| nombre | VARCHAR(150) | NOT NULL | Nombre del producto. |
| tipo | ENUM | NOT NULL | INSUMO_PRODUCCION o REVENTA_DIRECTA. |
| precio_venta | DECIMAL(10,2) | NOT NULL, CHECK ≥ 0 | Precio al público definido por el ADMIN. |
| costo_produccion | DECIMAL(10,2) | NULL, CHECK ≥ 0 | Costo interno; puede ser nulo cuando corresponde a reventa directa. |
| stock_actual | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Valor derivado mantenido por el backend; debe permanecer consistente con los movimientos aplicados. |
| stock_minimo | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Nivel de referencia para alertas de reabastecimiento. |
| controla_stock | BOOLEAN | NOT NULL, DEFAULT true | Indica si el producto descuenta existencias al venderse. Se marca false en los preparados al momento, que no tienen stock propio; sus insumos se controlan como productos independientes. |
| unidad_medida | VARCHAR(20) | NOT NULL | Unidad, kilogramo, litro, u otra unidad aplicable. |
| activo | BOOLEAN | NOT NULL, DEFAULT true | Indica si el producto está disponible en el catálogo. |

Restricción adicional: UNIQUE(categoria_id, nombre) para impedir productos duplicados dentro de una misma categoría.

Sobre controla_stock. SADIM no modela recetas ni composición de productos. Un producto preparado al momento se registra con controla_stock = false: su venta no valida existencias ni genera MovimientoInventario, y sus insumos se controlan por separado mediante ingresos, consumos de órdenes, mermas y ajustes manuales. stock_actual y stock_minimo se ignoran en ese caso. Incorporar recetas y descuento automático de insumos exigiría una entidad nueva y una revisión de este modelo.

## **5.7 Mesa**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de la operación de creación, para sincronización idempotente. |
| numero | SMALLINT | UNIQUE, NOT NULL, CHECK 1–15 | Número de mesa; limitado funcionalmente a quince mesas. |
| activa | BOOLEAN | NOT NULL, DEFAULT true | Permite habilitar o deshabilitar una mesa. |
| estado | ENUM | NOT NULL, DEFAULT DISPONIBLE | DISPONIBLE u OCUPADA. Es un valor operativo derivado de la existencia de una sesión ABIERTA. |

Restricciones: como máximo quince mesas con activa = true (R-06); la operación que superaría ese límite se rechaza en línea y, al sincronizar, produce el conflicto LIMITE_MESAS_EXCEDIDO. Una mesa con estado = OCUPADA no puede desactivarse. Las mesas no se eliminan: se desactivan para conservar el historial de sesiones.

## **5.8 Venta**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único, generable en el cliente. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de la operación de creación, para sincronización idempotente. |
| tipo | ENUM | NOT NULL | RAPIDA o SESION_DINAMICA. |
| usuario_id | UUID | FK → Usuario, NOT NULL | Usuario que registra o atiende la venta. |
| mesa_id | UUID | FK → Mesa, NULL | Mesa asociada cuando tipo = SESION_DINAMICA. |
| estado | ENUM | NOT NULL, DEFAULT ABIERTA | ABIERTA, CERRADA o CANCELADA. |
| fecha_apertura | TIMESTAMP | NOT NULL | Inicio de la venta o sesión. |
| fecha_cierre | TIMESTAMP | NULL | Momento del cierre; obligatorio cuando estado = CERRADA. |
| medio_pago | ENUM | NULL hasta el cierre | EFECTIVO, TRANSFERENCIA o QR. Obligatorio cuando estado = CERRADA. |
| estado_pago | ENUM | NULL hasta el cierre | D-06. CONFIRMADO o PENDIENTE_VERIFICACION. Obligatorio cuando estado = CERRADA. |
| total | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | CALCULADO: suma de los subtotales de DetalleVenta. |

Restricciones: CHECK que exige mesa_id NOT NULL si tipo = SESION_DINAMICA y mesa_id NULL si tipo = RAPIDA; índice único parcial sobre mesa_id para las ventas con estado = ABIERTA, que impide dos sesiones simultáneas en la misma mesa; CHECK que exige fecha_cierre, medio_pago y estado_pago cuando estado = CERRADA.

## **5.9 DetalleVenta**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de la operación; una línea puede agregarse offline (CU-03). |
| venta_id | UUID | FK → Venta, NOT NULL | Venta a la que pertenece la línea. Corrección respecto a la v2 (ver sección 12). |
| producto_id | UUID | FK → Producto, NOT NULL | Producto consumido. |
| cantidad | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Cantidad vendida. |
| precio_unitario | DECIMAL(10,2) | NOT NULL, CHECK ≥ 0 | Precio vigente al momento de agregar el producto; no se recalcula si el catálogo cambia después. |
| subtotal | DECIMAL(10,2) | CALCULADO | cantidad × precio_unitario. |

Restricción de estado: solo puede agregarse, modificarse o eliminarse una línea mientras la venta está ABIERTA. Sobre una venta CERRADA o CANCELADA la operación se rechaza con el código VENTA_YA_CERRADA.

## **5.10 OrdenTrabajo**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de la operación de creación de la orden. |
| usuario_id | UUID | FK → Usuario, NOT NULL | Usuario que registra la orden. |
| cliente_nombre | VARCHAR(150) | NOT NULL | Nombre del cliente. |
| cliente_telefono | VARCHAR(20) | NULL | Dato de contacto del cliente. |
| descripcion | TEXT | NOT NULL | Detalle del encargo o servicio. |
| fecha_solicitud | TIMESTAMP | NOT NULL | Fecha de recepción. |
| fecha_entrega_estimada | DATE | NOT NULL | Compromiso de entrega. |
| estado | ENUM | NOT NULL, DEFAULT RECIBIDO | RECIBIDO, EN_PROCESO, LISTO o ENTREGADO. |
| costo_total | DECIMAL(10,2) | NOT NULL, CHECK ≥ 0 | Valor total acordado con el cliente. |
| saldo_pendiente | DECIMAL(10,2) | CALCULADO | costo_total menos la suma de los abonos registrados. |
| utilidad_neta | DECIMAL(10,2) | CALCULADO | costo_total menos la suma de los CostoOperativoOrden de la orden. Expuesto únicamente al rol ADMIN (CU-10). |

## **5.11 Abono**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de operación para evitar duplicación durante la sincronización. |
| orden_id | UUID | FK → OrdenTrabajo, NOT NULL | Orden a la que se aplica el abono. |
| usuario_id | UUID | FK → Usuario, NOT NULL | Usuario que registra el abono. |
| valor | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Valor del abono. |
| medio_pago | ENUM | NOT NULL | EFECTIVO, TRANSFERENCIA o QR. |
| estado_pago | ENUM | NOT NULL, DEFAULT CONFIRMADO | D-06. CONFIRMADO o PENDIENTE_VERIFICACION. |
| fecha | TIMESTAMP | NOT NULL | Fecha y hora del abono. |
| observacion | VARCHAR(255) | NULL | Nota opcional. |

Restricción de negocio: la suma de los abonos de una orden no puede superar su costo_total. La validación se aplica en el servidor y, en sincronización, puede producir el conflicto ABONO_EXCEDE_SALDO.

## **5.12 ConsumoOrden**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de operación para sincronización. |
| orden_id | UUID | FK → OrdenTrabajo, NOT NULL | Orden donde se utiliza el producto. |
| producto_id | UUID | FK → Producto, NOT NULL | Producto o insumo utilizado. |
| cantidad | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Cantidad utilizada. |
| estado | ENUM | NOT NULL, DEFAULT PENDIENTE | PENDIENTE o APLICADO. |
| fecha_registro | TIMESTAMP | NOT NULL | Momento en que se registra el consumo. |

## **5.13 CostoOperativoOrden**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de operación; el costo puede registrarse offline junto con la orden. Añadido en v3 por coherencia (sección 12). |
| orden_id | UUID | FK → OrdenTrabajo, NOT NULL | Orden asociada. |
| concepto | VARCHAR(150) | NOT NULL | Repuesto, herramienta, corrección u otro costo operativo. |
| valor | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Costo del concepto. |

El acceso a esta entidad y al análisis de márgenes está restringido al rol ADMIN (CU-10), verificado en el backend.

## **5.14 MovimientoInventario**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de operación para evitar duplicación al sincronizar. |
| producto_id | UUID | FK → Producto, NOT NULL | Producto afectado. |
| usuario_id | UUID | FK → Usuario, NOT NULL | Usuario responsable del movimiento. |
| venta_id | UUID | FK → Venta, NULL | Venta que originó la salida. Sin restricción UNIQUE: una venta genera un movimiento por cada línea. Corrección respecto a la v2 (sección 12). |
| consumo_orden_id | UUID | FK → ConsumoOrden, UNIQUE, NULL | Consumo de orden que originó la salida. UNIQUE porque la relación es 1:1. |
| tipo | ENUM | NOT NULL | ENTRADA, SALIDA_VENTA, SALIDA_SERVICIO, MERMA o AJUSTE_MANUAL. |
| cantidad | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Cantidad del movimiento; el signo lo determina el tipo o, en el ajuste manual, el sentido. |
| sentido | ENUM | NULL | SUMA o RESTA. Obligatorio cuando tipo = AJUSTE_MANUAL; en los demás tipos el signo lo determina el tipo. |
| fecha | TIMESTAMP | NOT NULL | Momento en que se aplica el movimiento. |
| motivo | VARCHAR(255) | NULL | Obligatorio para MERMA y AJUSTE_MANUAL. |

Restricciones: CHECK que exige motivo NOT NULL cuando tipo ∈ {MERMA, AJUSTE_MANUAL}; CHECK que exige sentido NOT NULL cuando tipo = AJUSTE_MANUAL y sentido NULL en los demás tipos; CHECK que exige venta_id NOT NULL solo cuando tipo = SALIDA_VENTA y consumo_orden_id NOT NULL solo cuando tipo = SALIDA_SERVICIO. Los movimientos son históricos: no se editan ni se eliminan; una corrección se registra como un nuevo movimiento de AJUSTE_MANUAL.

## **5.15 MovimientoCaja**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador de operación para sincronización idempotente. |
| usuario_id | UUID | FK → Usuario, NOT NULL | Usuario que registra el movimiento. |
| venta_id | UUID | FK → Venta, UNIQUE, NULL | Venta que originó el ingreso. UNIQUE: una venta genera un único movimiento de caja. |
| abono_id | UUID | FK → Abono, UNIQUE, NULL | Abono que originó el ingreso. UNIQUE: un abono genera un único movimiento de caja. |
| cierre_caja_id | UUID | FK → CierreCaja, NULL | D-07. Cierre que consolidó este movimiento. NULL mientras el movimiento no ha sido incluido en ningún cierre. |
| tipo | ENUM | NOT NULL | INGRESO_VENTA, INGRESO_ABONO o GASTO. |
| medio_pago | ENUM | NOT NULL | EFECTIVO, TRANSFERENCIA o QR. |
| estado_pago | ENUM | NOT NULL, DEFAULT CONFIRMADO | D-06. CONFIRMADO o PENDIENTE_VERIFICACION. |
| valor | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Valor del movimiento. |
| concepto | VARCHAR(255) | NULL | Descripción del gasto u observación; obligatorio cuando tipo = GASTO. |
| fecha | TIMESTAMP | NOT NULL | Momento del movimiento, según su origen. |
| fecha_confirmacion | TIMESTAMP | NULL | Momento en que un usuario confirmó la recepción de un pago electrónico. NULL mientras estado_pago = PENDIENTE_VERIFICACION. |

Restricciones: CHECK de coherencia de origen — tipo = INGRESO_VENTA exige venta_id NOT NULL y abono_id NULL; tipo = INGRESO_ABONO exige abono_id NOT NULL y venta_id NULL; tipo = GASTO exige ambos NULL y concepto NOT NULL. CHECK que impide cierre_caja_id NOT NULL cuando estado_pago = PENDIENTE_VERIFICACION. CHECK que exige medio_pago = EFECTIVO cuando estado_pago = CONFIRMADO y fecha_confirmacion es NULL, es decir, solo el efectivo se confirma sin verificación adicional.

## **5.16 CierreCaja**

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador único. |
| operation_id | UUID | UNIQUE, NOT NULL | Protege contra un doble envío del mismo cierre ante reintentos de red, aunque la operación requiera conexión. |
| usuario_id | UUID | FK → Usuario, NOT NULL | ADMIN que realiza el cierre. |
| fecha | DATE | NOT NULL, UNIQUE | Fecha contable del corte. Un solo cierre por día. |
| periodo_inicio | TIMESTAMP | NOT NULL | Inicio del período consolidado. |
| periodo_fin | TIMESTAMP | NOT NULL, CHECK > periodo_inicio | Fin del período consolidado. |
| total_ingresos_ventas | DECIMAL(10,2) | CALCULADO | Suma de los movimientos INGRESO_VENTA asociados al cierre. |
| total_ingresos_abonos | DECIMAL(10,2) | CALCULADO | Suma de los movimientos INGRESO_ABONO asociados al cierre. |
| total_gastos | DECIMAL(10,2) | CALCULADO | Suma de los movimientos GASTO asociados al cierre. |
| total_neto | DECIMAL(10,2) | CALCULADO | Ingresos totales menos gastos. |
| efectivo_esperado | DECIMAL(10,2) | CALCULADO | Neto de los movimientos asociados con medio_pago = EFECTIVO. |
| efectivo_contado | DECIMAL(10,2) | NOT NULL, CHECK ≥ 0 | Efectivo físico contado por el ADMIN durante el arqueo (CU-15). |
| diferencia | DECIMAL(10,2) | CALCULADO | efectivo_contado − efectivo_esperado. Negativa indica faltante. |
| observaciones | TEXT | NULL | Notas del cierre, descuadres o novedades. Obligatorio cuando diferencia ≠ 0. |
| fecha_creacion | TIMESTAMP | NOT NULL | Momento en que se registró el cierre. |

Los totales son CALCULADO en el sentido de que el backend los deriva de los MovimientoCaja asociados al cierre y los persiste al crearlo, de modo que el corte quede congelado. Deben coincidir en todo momento con la suma de los movimientos que tienen cierre_caja_id igual a este cierre; esa igualdad es verificable y constituye la prueba del arqueo.

## **5.17 OperacionSincronizacion**

Entidad nueva (D-05). Bitácora del servidor. No sustituye a las entidades transaccionales: registra qué ocurrió con cada operación recibida y permite informar al usuario los rechazos y conflictos, que se atienden mediante CU-23.

| **Atributo** | **Tipo** | **Restricción** | **Descripción** |
| --- | --- | --- | --- |
| id | UUID | PK | Identificador del registro. |
| operation_id | UUID | UNIQUE, NOT NULL | Identificador generado por el cliente. Es la clave de idempotencia: si ya existe, la operación no se vuelve a aplicar. |
| dispositivo_id | UUID | FK → Dispositivo, NOT NULL | D-04. Dispositivo que envió la operación. |
| usuario_id | UUID | FK → Usuario, NOT NULL | Usuario autenticado que originó la operación en el cliente. |
| recurso | VARCHAR(60) | NOT NULL | Recurso destino, por ejemplo ventas, ventas.detalles, ordenes.abonos, inventario.movimientos, caja.movimientos. |
| accion | ENUM | NOT NULL | CREATE, UPDATE o DELETE. |
| estado | ENUM | NOT NULL | APLICADA, DUPLICADA, RECHAZADA o CONFLICTO. |
| codigo_conflicto | VARCHAR(50) | NULL | Código de la tabla 8.4 cuando estado ∈ {RECHAZADA, CONFLICTO}. |
| mensaje | VARCHAR(255) | NULL | Explicación legible para mostrar al usuario. |
| objeto_id | UUID | NULL | Identificador de la fila creada o afectada cuando la operación se aplicó. |
| payload | JSONB | NULL | Contenido enviado por el cliente. Permite auditar y reintentar manualmente una operación rechazada. |
| fecha_cliente | TIMESTAMP | NOT NULL | Momento en que la operación se registró en el dispositivo. |
| fecha_procesamiento | TIMESTAMP | NOT NULL | Momento en que el servidor la procesó. |
| atendida | BOOLEAN | NOT NULL, DEFAULT false | Indica si el usuario ya revisó el rechazo o conflicto. Permite listar las novedades pendientes de atención. |

Restricciones: CHECK que exige codigo_conflicto NOT NULL cuando estado ∈ {RECHAZADA, CONFLICTO}; CHECK que exige objeto_id NOT NULL cuando estado = APLICADA. Índice sobre (estado, atendida) para consultar eficientemente las novedades pendientes.

# **6. Enumeraciones consolidadas**

Todos los valores son cerrados y se implementan como choices del modelo de Django con su CHECK equivalente en PostgreSQL. Ningún enum se modela como tabla.

| **Enumeración** | **Entidad** | **Valores** |
| --- | --- | --- |
| Rol | Usuario.rol | ADMIN, OPERADOR (D-02) |
| TipoProducto | Producto.tipo | INSUMO_PRODUCCION, REVENTA_DIRECTA |
| EstadoMesa | Mesa.estado | DISPONIBLE, OCUPADA |
| TipoVenta | Venta.tipo | RAPIDA, SESION_DINAMICA |
| EstadoVenta | Venta.estado | ABIERTA, CERRADA, CANCELADA |
| MedioPago | Venta, Abono, MovimientoCaja | EFECTIVO, TRANSFERENCIA, QR (D-06) |
| EstadoPago | Venta, Abono, MovimientoCaja | CONFIRMADO, PENDIENTE_VERIFICACION (D-06) |
| EstadoOrden | OrdenTrabajo.estado | RECIBIDO, EN_PROCESO, LISTO, ENTREGADO |
| EstadoConsumo | ConsumoOrden.estado | PENDIENTE, APLICADO |
| TipoMovInventario | MovimientoInventario.tipo | ENTRADA, SALIDA_VENTA, SALIDA_SERVICIO, MERMA, AJUSTE_MANUAL |
| SentidoAjuste | MovimientoInventario.sentido | SUMA, RESTA (solo para AJUSTE_MANUAL) |
| TipoMovCaja | MovimientoCaja.tipo | INGRESO_VENTA, INGRESO_ABONO, GASTO |
| AccionSync | OperacionSincronizacion.accion | CREATE, UPDATE, DELETE (D-05) |
| EstadoSync | OperacionSincronizacion.estado | APLICADA, DUPLICADA, RECHAZADA, CONFLICTO (D-05) |

# **7. Reglas de integridad y negocio**

## **7.1 Alcance e identidad**

- R-01. Toda la información pertenece a una única instalación asociada a un único negocio. Ninguna entidad incluye identificadores de negocio, sede o tenant (D-01).

- R-02. ConfiguracionModulo y ConfiguracionPago admiten exactamente una fila cada una.

- R-03. El rol es un atributo de Usuario con dos valores posibles. La autorización efectiva se resuelve en el backend; ocultar controles en la interfaz no constituye control de acceso (D-02, ADR-005).

- R-04. Debe existir siempre al menos un usuario ADMIN activo.

- R-05. Los módulos habilitados son exactamente Ventas, Inventario, Servicios y Finanzas. Una operación de un módulo desactivado se rechaza en el backend aunque se invoque directamente la ruta (D-03).

## **7.2 Ventas y mesas**

- R-06. La instalación admite como máximo quince mesas activas. La operación que superaría ese límite se rechaza; al sincronizar produce el conflicto LIMITE_MESAS_EXCEDIDO. Una mesa OCUPADA no puede desactivarse.

- R-07. Una Venta de tipo SESION_DINAMICA debe tener mesa_id; una de tipo RAPIDA no lo tiene.

- R-08. Una mesa no puede tener más de una Venta SESION_DINAMICA en estado ABIERTA al mismo tiempo.

- R-09. Una Venta ABIERTA acumula líneas de DetalleVenta sin afectar existencias. El descuento de inventario se aplica al cerrar la venta.

- R-10. Una Venta CERRADA genera exactamente un MovimientoCaja de tipo INGRESO_VENTA y los MovimientoInventario de salida correspondientes, dentro de una única transacción de base de datos.

- R-11. Una Venta CANCELADA no genera movimientos de caja ni de inventario y libera la mesa asociada. Solo puede cancelarse una venta en estado ABIERTA, lo que permite resolver una sesión abierta por error sin dejar la mesa ocupada. Cancelar una venta ya cerrada no está permitido; la corrección se registra mediante los movimientos de ajuste correspondientes.

## **7.3 Servicios**

- R-12. Una OrdenTrabajo puede tener cero, uno o muchos Abonos. El saldo pendiente es costo_total menos la suma de los abonos.

- R-13. La suma de los abonos de una orden no puede superar su costo_total.

- R-14. Un Abono registrado genera exactamente un MovimientoCaja de tipo INGRESO_ABONO.

- R-15. Un ConsumoOrden permanece PENDIENTE mientras la orden está en proceso. Al pasar la orden a ENTREGADO, cada consumo genera un MovimientoInventario de tipo SALIDA_SERVICIO y pasa a APLICADO.

- R-16. Una orden en estado ENTREGADO no admite nuevos consumos ni cambios de costo. Los estados avanzan en el orden RECIBIDO → EN_PROCESO → LISTO → ENTREGADO.

## **7.4 Inventario**

- R-17. Los movimientos de inventario son históricos: no se editan ni se eliminan. Una corrección se registra mediante un nuevo movimiento de AJUSTE_MANUAL con motivo obligatorio.

- R-18. stock_actual es un valor derivado mantenido por el backend y debe permanecer consistente con los movimientos aplicados. El cliente nunca lo escribe directamente. Los productos con controla_stock = false no llevan existencias propias: no validan stock, no generan movimientos de salida al venderse y quedan fuera de las alertas de stock mínimo.

- R-19. Una salida de inventario no puede dejar stock_actual por debajo de cero, salvo en los productos con controla_stock = false, que no generan salidas. Si al sincronizar una operación offline las existencias ya no alcanzan, la operación se registra con el conflicto STOCK_INSUFICIENTE.

## **7.5 Caja y cierre**

- R-20. MovimientoCaja es el registro central de trazabilidad financiera. Cada movimiento tiene un único origen: una venta, un abono o un gasto (ADR-008).

- R-21. Los gastos hormiga se registran como MovimientoCaja de tipo GASTO con concepto obligatorio.

- R-22. Un CierreCaja incluye únicamente movimientos con estado_pago = CONFIRMADO y cierre_caja_id nulo, cuya fecha esté dentro del período consolidado. Los movimientos pendientes de verificación permanecen sin asignar hasta su confirmación y se incorporan al cierre posterior (D-06, D-07).

- R-23. Un MovimientoCaja pertenece a lo sumo a un CierreCaja. Una vez asignado, ni el movimiento ni su asignación pueden modificarse.

- R-24. Los totales de un CierreCaja deben ser exactamente la suma de los MovimientoCaja asociados a él. Esa igualdad es la comprobación del arqueo.

- R-25. Existe a lo sumo un CierreCaja por fecha. Un movimiento sincronizado con fecha anterior a un cierre ya realizado no se incorpora retroactivamente: se registra el conflicto MOVIMIENTO_EN_PERIODO_CERRADO y queda disponible para el siguiente cierre, con la observación correspondiente.

## **7.6 Pagos**

- R-26. SADIM no verifica pagos: registra el medio utilizado. Para TRANSFERENCIA y QR muestra la llave Nequi de ConfiguracionPago como referencia (D-06).

- R-27. Una operación con medio_pago ∈ {TRANSFERENCIA, QR} registrada sin conexión se guarda con estado_pago = PENDIENTE_VERIFICACION. La interfaz debe presentarla como pendiente y nunca como pago recibido.

- R-28. El paso a CONFIRMADO requiere conexión y la acción explícita de un usuario que haya comprobado la recepción; registra fecha_confirmacion.

- R-29. Solo un usuario ADMIN puede modificar ConfiguracionPago, y únicamente con conexión.

## **7.7 Sincronización**

- R-30. Toda entidad creable sin conexión posee operation_id UNIQUE. El backend comprueba ese identificador antes de aplicar cualquier efecto, garantizando idempotencia (D-05, ADR-004).

- R-31. Los conflictos transaccionales no se resuelven mediante Last Write Wins. Cada operación se valida contra las reglas de negocio y el estado actual del servidor.

- R-32. Solo el dispositivo con autorizado_offline = true puede enviar operaciones creadas sin conexión (D-04).

- R-33. Ninguna operación se descarta en silencio: toda operación recibida deja una fila en OperacionSincronizacion con su resultado.

# **8. Sincronización posterior al modo offline**

Esta sección desarrolla la decisión D-05 y complementa el endpoint /api/sync/ definido en el contrato de API.

## **8.1 Procedimiento**

- Detección de conexión. El cliente recupera la conectividad y verifica que su sesión siga vigente. Si el token expiró, se solicita autenticación antes de enviar nada.

- Envío ordenado. Las operaciones pendientes se envían en el mismo orden en que fueron creadas, en lotes, con el encabezado X-Device-Id. El orden importa: cerrar una venta no puede procesarse antes de las líneas que la componen.

- Comprobación de idempotencia. Por cada operación, el servidor busca su operation_id en OperacionSincronizacion. Si ya existe, responde con el estado DUPLICADA y devuelve el resultado previamente registrado, sin volver a aplicar efectos.

- Validación. Si la operación es nueva, el servidor valida el rol del usuario, la vigencia del módulo, la estructura del contenido y las reglas de negocio contra el estado actual: existencias disponibles, estado de la venta, estado de la orden, saldo de la orden y período de caja.

- Aplicación transaccional. Si la validación es satisfactoria, la operación y todos sus efectos derivados sobre inventario y caja se aplican dentro de una única transacción de PostgreSQL. La transacción se confirma completa o se revierte completa.

- Registro del resultado. Se crea la fila en OperacionSincronizacion con estado APLICADA, DUPLICADA, RECHAZADA o CONFLICTO, junto con el código y el mensaje cuando corresponde.

- Respuesta y limpieza local. El cliente recibe un resultado por operación. Elimina de su cola las operaciones APLICADA y DUPLICADA, y conserva las RECHAZADA y CONFLICTO en un listado de novedades para mostrarlas al usuario.

- Reconciliación. Tras procesar el lote, el cliente descarga el estado actualizado de catálogo, existencias y operaciones abiertas, de modo que su copia local vuelva a reflejar el servidor.

## **8.2 Estados del resultado**

| **Estado** | **Significado** | **Comportamiento** |
| --- | --- | --- |
| APLICADA | La operación se validó y sus efectos se registraron. | Se elimina de la cola local. objeto_id identifica la fila creada o modificada. |
| DUPLICADA | El operation_id ya había sido procesado. | No se aplican efectos nuevos. Se devuelve el resultado anterior y se elimina de la cola local. |
| RECHAZADA | La operación es inválida en sí misma: datos incorrectos, permiso insuficiente, módulo desactivado o dispositivo no autorizado. | No se aplica. Se informa al usuario; no tiene sentido reintentarla sin corregirla. |
| CONFLICTO | La operación era válida al crearse, pero el estado del servidor cambió y ya no puede aplicarse. | No se aplica. Se informa al usuario con el código y el mensaje para que decida la corrección manual. |

## **8.3 Tratamiento de conflictos**

No se utiliza Last Write Wins. Una operación en conflicto no sobrescribe el estado del servidor ni se descarta: queda registrada y visible. El criterio general es que el estado del servidor prevalece, porque puede contener operaciones registradas en línea por otros usuarios, y la operación offline conflictiva se convierte en una novedad que un usuario debe resolver.

La resolución es siempre explícita y consiste en una operación nueva y trazable: repetir el registro con la cantidad disponible, registrar un ajuste manual de inventario con motivo, cobrar la diferencia, anular un cobro mediante el movimiento correspondiente o dejar constancia en las observaciones del cierre. La PWA presenta las novedades pendientes (OperacionSincronizacion con estado RECHAZADA o CONFLICTO y atendida = false) hasta que el usuario las marque como atendidas, conforme a CU-23.

## **8.4 Códigos de rechazo y conflicto**

| **Código** | **Estado** | **Situación que lo produce** |
| --- | --- | --- |
| DISPOSITIVO_NO_AUTORIZADO | RECHAZADA | El X-Device-Id no corresponde a un dispositivo activo con autorizado_offline = true. Se rechaza el lote completo (D-04). |
| PERMISO_INSUFICIENTE | RECHAZADA | El rol del usuario no permite la operación, por ejemplo un OPERADOR intentando un cierre de caja. |
| MODULO_DESACTIVADO | RECHAZADA | El módulo al que pertenece el recurso fue desactivado por un ADMIN (D-03). |
| DATOS_INVALIDOS | RECHAZADA | El contenido no cumple la estructura o las validaciones de campo. |
| PAGO_NO_VERIFICABLE | RECHAZADA | Se intenta sincronizar un pago electrónico marcado como confirmado sin que exista una confirmación en línea (D-06). |
| STOCK_INSUFICIENTE | CONFLICTO | Las existencias registradas en el servidor ya no alcanzan para aplicar la salida. |
| PRODUCTO_INACTIVO | CONFLICTO | El producto fue desactivado o eliminado del catálogo mientras el dispositivo estaba offline. |
| VENTA_YA_CERRADA | CONFLICTO | Se intenta modificar el detalle o cerrar una venta que ya está CERRADA o CANCELADA en el servidor. |
| MESA_OCUPADA | CONFLICTO | Se intenta abrir una sesión en una mesa que ya tiene una sesión ABIERTA, o desactivar una mesa OCUPADA. |
| LIMITE_MESAS_EXCEDIDO | CONFLICTO | La creación o reactivación de una mesa superaría las quince mesas activas permitidas (R-06). |
| ORDEN_YA_ENTREGADA | CONFLICTO | Se intenta registrar un consumo o un cambio de estado sobre una orden ya ENTREGADO. |
| ABONO_EXCEDE_SALDO | CONFLICTO | El abono supera el saldo pendiente porque la orden recibió otros pagos o cambió su costo. |
| MOVIMIENTO_EN_PERIODO_CERRADO | CONFLICTO | El movimiento corresponde a un período con CierreCaja ya realizado (R-25). |

## **8.5 Consistencia por dominio**

- Inventario. Las existencias nunca se sincronizan como un valor absoluto calculado en el cliente: se envían los movimientos y el servidor recalcula stock_actual. Así, un descuento registrado en línea y otro registrado offline se acumulan en lugar de sobrescribirse.

- Ventas. Las líneas de detalle se aplican antes del cierre. El total se recalcula en el servidor a partir de los detalles efectivamente aplicados, de modo que un detalle en conflicto no produce un total incorrecto.

- Servicios. Los abonos se validan contra el saldo vigente y los consumos contra el estado de la orden en el servidor.

- Caja. El movimiento de caja de una venta o de un abono se genera en el servidor al aplicar la operación de origen, nunca se envía por separado desde el cliente. Esto impide ingresos duplicados o huérfanos.

# **9. Operaciones permitidas offline**

Regla general (D-08): SADIM permite trabajar sin conexión con todas las operaciones posibles. Las excepciones son las que dependen de una verificación externa en tiempo real o cuyo procesamiento local comprometería la seguridad o la consistencia de toda la instalación.

## **9.1 Operaciones disponibles sin conexión**

| **Operación** | **Comportamiento offline** |
| --- | --- |
| Registrar venta rápida (CU-01) | Se registra localmente con UUID y operation_id; se sincroniza al recuperar conexión. |
| Abrir y atender sesión dinámica (CU-02, CU-03) | Se gestionan localmente la mesa y las líneas de consumo. |
| Cerrar sesión y cobrar (CU-04) | Permitido. En efectivo el pago queda CONFIRMADO; en transferencia o QR queda PENDIENTE_VERIFICACION. |
| Configurar catálogo y precios (CU-05) | Permitido para ADMIN; se sincroniza posteriormente. |
| Registrar, activar o desactivar una mesa (CU-19) | Permitido para ADMIN; se sincroniza posteriormente. El límite de quince mesas activas se revalida en el servidor y puede producir el conflicto LIMITE_MESAS_EXCEDIDO. |
| Registrar pedido por encargo y cambiar su estado (CU-06, CU-07) | Permitido. |
| Registrar abono a una orden (CU-08) | Permitido, con la misma distinción de estado_pago según el medio. |
| Registrar consumo de inventario en una orden (CU-09) | Permitido; la aplicación al inventario ocurre al entregar la orden. |
| Consultar inventario y stock (CU-11) | Permitido sobre la copia local, señalando que los valores pueden no reflejar operaciones en línea recientes. |
| Registrar ingreso de mercancía (CU-12) | Permitido. |
| Ajuste manual de inventario (CU-13) | Permitido para ADMIN, con motivo obligatorio. No requiere verificación externa y su validación en el servidor es suficiente. |
| Registrar gasto o gasto hormiga (CU-14) | Permitido en efectivo. En medio electrónico queda pendiente de verificación. |
| Configurar módulos funcionales (CU-16) | Permitido para ADMIN conforme a CU-16; se sincroniza posteriormente. |
| Consultar análisis de costos por orden (CU-10) | Permitido en modo consulta sobre los datos disponibles localmente. |
| Reanudar sesión ya iniciada (CU-17) | Permitido mientras la sesión local siga vigente. |
| Cancelar una sesión abierta por error (CU-04 alterno) | Permitido; la venta pasa a CANCELADA sin efectos y la mesa queda DISPONIBLE (R-11). |

## **9.2 Operaciones que requieren conexión**

| **ID** | **Operación** | **Justificación** |
| --- | --- | --- |
| E-01 | Confirmar un pago por TRANSFERENCIA o QR. | Depende de una verificación externa que SADIM no puede realizar sin conexión ni sin integración bancaria. Afirmar que el dinero llegó sería registrar un hecho desconocido y contaminaría el cierre de caja. El registro del cobro sí se permite offline, marcado como PENDIENTE_VERIFICACION (D-06). |
| E-02 | Autenticación inicial, creación de usuarios y cambio de contraseña. | Las credenciales se validan y se almacenan como hash en el servidor. Hacerlo en el cliente exigiría distribuir material sensible al dispositivo y permitiría crear accesos que el servidor no autorizó. Coherente con CU-17, donde la primera autenticación requiere conexión, y con CU-18; las sesiones ya iniciadas siguen operando offline. |
| E-03 | Modificar ConfiguracionPago (llave Nequi y medios aceptados). | Determina la cuenta a la que los clientes envían dinero. Un cambio registrado offline y rechazado después dejaría cobros dirigidos a una cuenta que el negocio no controla, sin posibilidad de reconstruir a dónde fue el dinero. Es una operación puntual del ADMIN (CU-22) y no interrumpe la operación diaria. |
| E-04 | Registrar, autorizar o revocar un dispositivo offline (CU-21). | Es la operación que define quién puede operar sin conexión. Autorizarla offline permitiría que dos dispositivos se autorizaran a sí mismos y trabajaran en paralelo, que es exactamente lo que D-04 evita. |
| E-05 | Confirmar definitivamente un cierre de caja (CU-15). | El cierre consolida movimientos que deben reflejar el estado del servidor. Con operaciones pendientes de sincronizar, los totales serían provisionales y el corte quedaría firmado sobre información incompleta. El arqueo puede prepararse y contarse offline, pero el CierreCaja se confirma en línea y solo después de aplicar la cola pendiente. Esto precisa el flujo alternativo de CU-15. |

No se identifican otras operaciones que deban requerir conexión. En particular, el ajuste manual de inventario, la configuración de módulos y la gestión de mesas permanecen disponibles offline porque su corrección depende únicamente de datos que el servidor puede validar al sincronizar, y restringirlas reduciría la continuidad operativa sin aportar seguridad. La consulta del resumen diario de caja (CU-20) no es una excepción de escritura: requiere conexión simplemente porque sus totales los calcula el servidor.

# **10. Persistencia local**

D-09. La tecnología definitiva de persistencia local es IndexedDB, utilizada mediante el wrapper Dexie.js. Los almacenes locales no forman parte del modelo relacional de PostgreSQL, no se generan con migraciones de Django y se describen aquí únicamente para dejar constancia de su relación con el modelo.

| **Almacén local** | **Contenido** | **Relación con el modelo** |
| --- | --- | --- |
| catalogo | Categorías, productos, precios, existencias y mesas. | Copia de lectura de Categoria, Producto y Mesa. Se refresca en cada reconciliación. |
| operaciones_locales | Ventas, detalles, órdenes, abonos, consumos y movimientos creados en el dispositivo. | Filas con la misma forma que las entidades transaccionales, con su UUID y su operation_id ya asignados. |
| cola_sincronizacion | Operaciones pendientes de envío, en orden de creación, con su recurso, acción, contenido y número de intentos. | Alimenta /api/sync/. Se depura con los resultados APLICADA y DUPLICADA. |
| novedades | Resultados RECHAZADA y CONFLICTO devueltos por el servidor. | Reflejo local de OperacionSincronizacion para informar al usuario (D-05). |
| meta | Identificador del dispositivo, sesión vigente, marca de la última sincronización y configuración de módulos y pagos. | Fuente del encabezado X-Device-Id (D-04) y de la operación en modo offline. |

Consideraciones: el identificador del dispositivo se conserva en el almacén meta y se pierde si el usuario borra los datos del navegador, en cuyo caso el dispositivo debe registrarse de nuevo con conexión. La capacidad de almacenamiento depende del navegador, por lo que la cola de sincronización debe depurarse tras cada envío satisfactorio y la aplicación debe advertir al usuario cuando el número de operaciones pendientes sea elevado.

# **11. Criterio de Done y evidencia mínima por Historia de Usuario**

D-10. Una Historia de Usuario se considera terminada cuando cumple simultáneamente los cuatro criterios siguientes. Si alguno falta, la HU permanece en curso.

| **#** | **Criterio** | **Qué se exige** |
| --- | --- | --- |
| 1 | Implementación funcional | El flujo principal de la HU funciona de extremo a extremo sobre la arquitectura definida: interfaz de la PWA, endpoint de DRF y persistencia en PostgreSQL, con los efectos derivados sobre inventario y caja cuando correspondan. |
| 2 | Validaciones correspondientes | Las reglas de negocio y las restricciones aplicables de la sección 7 están implementadas y verificadas en el backend, no solo en la interfaz. Incluye el control de rol cuando la operación está restringida. |
| 3 | Prueba del flujo principal | Existe al menos una prueba que ejecuta el camino feliz de la HU y, cuando la historia define un rechazo relevante, una prueba de ese caso. Las pruebas quedan versionadas en el repositorio. |
| 4 | Evidencia verificable | Existe una evidencia que permite a un tercero comprobar el funcionamiento sin ejecutar el código. |

## **11.1 Evidencia mínima según el tipo de HU**

| **Tipo de HU** | **Evidencia adecuada** |
| --- | --- |
| Interfaz o flujo de usuario | Captura de pantalla o grabación corta del flujo completo, incluyendo el estado resultante. |
| Endpoint de la API | Solicitud y respuesta registradas, con código HTTP, o la prueba automatizada correspondiente en el repositorio. |
| Regla de negocio o validación | Salida de la prueba que demuestra tanto la aceptación válida como el rechazo esperado. |
| Comportamiento offline y sincronización | Evidencia de la operación registrada sin conexión y del resultado devuelto por /api/sync/ al recuperarla, incluyendo el estado en OperacionSincronizacion. |
| Modelo de datos o migración | Migración aplicada y consulta que demuestra la restricción, por ejemplo el rechazo de un valor que viola un CHECK o un UNIQUE. |

La evidencia se adjunta al cierre de la HU y se referencia desde el tablero del sprint, de modo que la revisión pueda comprobarla sin reproducir el entorno de desarrollo.

# **12. Revisión de consistencia del modelo**

Se revisaron entidades, atributos, claves primarias y foráneas, cardinalidades, restricciones UNIQUE, estados y reglas de negocio frente a las decisiones de esta versión y a la arquitectura vigente. Se detectaron y corrigieron las siguientes inconsistencias de la versión 2.

| **Ubicación** | **Inconsistencia detectada en la v2** | **Corrección aplicada en la v3** |
| --- | --- | --- |
| DetalleVenta.venta_id | Se declaraba como «FK → Venta, UNIQUE, NULL» con la descripción del movimiento de caja, resultado de una copia. Con UNIQUE, una venta solo habría podido tener una línea de detalle. | FK → Venta, NOT NULL, sin UNIQUE. Contradecía la cardinalidad Venta 1:N DetalleVenta declarada en la misma versión. |
| MovimientoInventario.venta_id | Se declaraba UNIQUE con la descripción del movimiento de caja. Habría impedido que una venta con varias líneas generara varias salidas. | FK → Venta, NULL, sin UNIQUE, coherente con la cardinalidad Venta 1:N MovimientoInventario. |
| MovimientoInventario.consumo_orden_id | Sin restricción UNIQUE, pese a declararse la relación ConsumoOrden 1:1 MovimientoInventario. | Se añade UNIQUE. |
| MovimientoCaja.abono_id | Sin restricción UNIQUE, pese a declararse Abono 1:1 MovimientoCaja. | Se añade UNIQUE. |
| CierreCaja — MovimientoCaja | La relación se declaraba en la tabla de cardinalidades, pero ninguna de las dos entidades tenía la clave foránea que la implementara. | Se añade cierre_caja_id en MovimientoCaja (D-07). |
| CierreCaja | No contemplaba el efectivo contado ni la diferencia, aunque CU-15 describe el arqueo. | Se añaden periodo_inicio, periodo_fin, efectivo_esperado, efectivo_contado y diferencia, y se desagregan los ingresos por origen. |
| CostoOperativoOrden | Carecía de operation_id pese a poder registrarse sin conexión junto con la orden. | Se añade operation_id UNIQUE. |
| Medios de pago | medio_pago registraba el medio, pero no existía forma de distinguir un cobro registrado de un cobro verificado. | Se añade estado_pago en Venta, Abono y MovimientoCaja (D-06). |
| Sincronización | Se describía la idempotencia por operation_id, pero no existía dónde registrar un rechazo o conflicto para informarlo. | Se añade OperacionSincronizacion (D-05). |
| Origen de las operaciones | No existía forma de identificar el dispositivo que originó una operación sincronizada. | Se añade Dispositivo y la relación con OperacionSincronizacion (D-04). |
| Producto | Sin restricción que impidiera nombres duplicados dentro de una categoría. | Se añade UNIQUE(categoria_id, nombre). |
| Mesa.numero | El límite de quince mesas figuraba solo como texto. | Se expresa como CHECK 1–15 sobre numero. |
| Venta | Los campos de cierre no tenían restricción condicional; la exclusividad de sesión por mesa era solo una regla textual. | CHECK condicional para fecha_cierre, medio_pago y estado_pago, e índice único parcial sobre mesa_id para ventas ABIERTA. |

El resto del modelo se mantiene sin cambios. Las entidades de la versión 2 conservan sus claves primarias UUID, sus claves foráneas y sus estados; la incorporación de Dispositivo, ConfiguracionPago y OperacionSincronizacion no altera ninguna relación existente y no introduce dependencias circulares.

## **12.1 Correcciones incorporadas tras la revisión cruzada (12/09/2026)**

Una segunda revisión contrastó este modelo con el Contrato de API, los Casos de Uso y el ADR, y cerró dos decisiones que permanecían abiertas. Los ajustes son los siguientes.

| **Ubicación** | **Problema detectado** | **Corrección aplicada** |
| --- | --- | --- |
| Categoria, Producto | Sin operation_id, pese a que la sección 9.1 permite configurar el catálogo sin conexión y R-30 lo exige en toda entidad creable offline. El Contrato ya enviaba el campo al crear un producto. | Se añade operation_id UNIQUE a ambas entidades. |
| Mesa | No figuraba en la sección 9 como operación offline u online, carecía de operation_id y el límite de quince mesas no tenía código de conflicto. | Se resuelve como operación offline: se añade operation_id, se incorpora a la sección 9.1 y se define el conflicto LIMITE_MESAS_EXCEDIDO. |
| MovimientoInventario.sentido | AJUSTE_MANUAL no indicaba si el ajuste suma o resta existencias, a diferencia del resto de tipos, cuyo signo es fijo. | Se añade sentido (SUMA o RESTA), obligatorio para AJUSTE_MANUAL, con su CHECK. |
| Producto.controla_stock | Un producto preparado al momento no tiene existencias propias y, sin recetas, no podía venderse sin descuadrar el inventario. | Se añade controla_stock. En false, el producto no valida ni descuenta existencias; sus insumos se controlan como productos independientes. No se introducen recetas. |
| OrdenTrabajo.utilidad_neta | CU-10 exigía la utilidad neta sin definir su fórmula. | Se define como valor CALCULADO: costo_total menos la suma de los CostoOperativoOrden de la orden. |
| Sección 8.1 | El procedimiento respondía ALREADY_PROCESSED, valor ajeno a los cuatro estados definidos en 8.2. | Se unifica con el estado DUPLICADA. |

# **13. Trazabilidad con la arquitectura**

| **Decisión arquitectónica** | **Reflejo en el ERD v3** |
| --- | --- |
| ADR-001 — PostgreSQL | Modelo relacional con PK, FK, CHECK, índices únicos parciales e integridad referencial. Los efectos derivados de una operación se aplican en una única transacción. |
| ADR-002 — Monolito modular | Las entidades se agrupan en los cuatro módulos oficiales dentro de una misma aplicación y una misma base de datos (D-03). |
| ADR-003 — PWA | Identificadores generables en el cliente y copia local de catálogo y operaciones (secciones 8 y 10). |
| ADR-004 — Offline-first | UUID y operation_id para idempotencia, un único dispositivo autorizado, bitácora de sincronización y ausencia de Last Write Wins (D-04, D-05, D-08). |
| ADR-005 — RBAC | Usuario.rol como enum con dos valores y restricciones de operación por rol verificadas en el backend (D-02). |
| ADR-006 — Módulos configurables | ConfiguracionModulo singleton con exactamente cuatro banderas; las operaciones de un módulo desactivado se rechazan también al sincronizar (D-03). |
| ADR-007 — Un negocio por instalación | Sin entidad Negocio ni identificadores de tenencia en ninguna tabla (D-01). |
| ADR-008 — Trazabilidad financiera | MovimientoCaja centraliza ingresos y egresos; CierreCaja actúa como corte con relación explícita a los movimientos que consolidó (D-07). |

## **13.1 Decisiones que quedan fuera de este ERD**

Este documento no define los contratos HTTP completos de la API, la estructura física detallada de los almacenes de IndexedDB, la implementación interna de los casos de uso ni la estrategia de emisión y renovación de tokens. Esos aspectos se documentan en el ADR, el contrato de API y los artefactos de diseño correspondientes, y deben mantenerse alineados con este modelo. Los cambios introducidos en esta versión que afectan al contrato de API son el encabezado X-Device-Id en /api/sync/, los estados de resultado por operación, el catálogo cerrado de códigos de rechazo y conflicto, y los recursos de mesas, dispositivos, configuración de pagos, cancelación de ventas, resumen de caja y novedades de sincronización.

# **Anexo A. Fuente del diagrama**

El siguiente código, en notación Mermaid (erDiagram), reproduce el modelo de la sección 3 y puede utilizarse para generar la figura del ERD. Se incluyen únicamente las claves y los atributos discriminantes.

erDiagram

  USUARIO ||--o{ VENTA : registra

  USUARIO ||--o{ ORDENTRABAJO : gestiona

  USUARIO ||--o{ ABONO : registra

  USUARIO ||--o{ MOVIMIENTOINVENTARIO : ejecuta

  USUARIO ||--o{ MOVIMIENTOCAJA : registra

  USUARIO ||--o{ CIERRECAJA : realiza

  USUARIO ||--o{ DISPOSITIVO : autoriza

  USUARIO ||--o{ OPERACIONSINCRONIZACION : origina

  CATEGORIA ||--o{ PRODUCTO : agrupa

  PRODUCTO ||--o{ DETALLEVENTA : figura_en

  PRODUCTO ||--o{ CONSUMOORDEN : se_consume_en

  PRODUCTO ||--o{ MOVIMIENTOINVENTARIO : afecta

  MESA ||--o{ VENTA : aloja

  VENTA ||--o{ DETALLEVENTA : contiene

  VENTA ||--o{ MOVIMIENTOINVENTARIO : genera

  VENTA ||--o| MOVIMIENTOCAJA : genera

  ORDENTRABAJO ||--o{ ABONO : recibe

  ORDENTRABAJO ||--o{ CONSUMOORDEN : consume

  ORDENTRABAJO ||--o{ COSTOOPERATIVOORDEN : acumula

  ABONO ||--o| MOVIMIENTOCAJA : genera

  CONSUMOORDEN ||--o| MOVIMIENTOINVENTARIO : aplica

  CIERRECAJA ||--o{ MOVIMIENTOCAJA : consolida

  DISPOSITIVO ||--o{ OPERACIONSINCRONIZACION : envia

  USUARIO { uuid id PK  varchar username UK  enum rol  bool activo }

  DISPOSITIVO { uuid id PK  uuid identificador UK  bool es_caja

                bool autorizado_offline  uuid registrado_por_id FK }

  CONFIGURACIONMODULO { uuid id PK  bool ventas_activo  bool inventario_activo

                        bool servicios_activo  bool finanzas_activo }

  CONFIGURACIONPAGO { uuid id PK  varchar nequi_llave  varchar nequi_titular

                      uuid actualizado_por_id FK }

  CATEGORIA { uuid id PK  uuid operation_id UK  varchar nombre UK }

  PRODUCTO { uuid id PK  uuid operation_id UK  uuid categoria_id FK  enum tipo

             dec precio_venta  dec stock_actual  dec stock_minimo

             bool controla_stock  bool activo }

  MESA { uuid id PK  uuid operation_id UK  smallint numero UK  enum estado

         bool activa }

  VENTA { uuid id PK  uuid operation_id UK  enum tipo  uuid usuario_id FK

          uuid mesa_id FK  enum estado  enum medio_pago  enum estado_pago  dec total }

  DETALLEVENTA { uuid id PK  uuid operation_id UK  uuid venta_id FK

                 uuid producto_id FK  dec cantidad  dec precio_unitario }

  ORDENTRABAJO { uuid id PK  uuid operation_id UK  uuid usuario_id FK

                 enum estado  dec costo_total  dec utilidad_neta

                 date fecha_entrega_estimada }

  ABONO { uuid id PK  uuid operation_id UK  uuid orden_id FK  dec valor

          enum medio_pago  enum estado_pago }

  CONSUMOORDEN { uuid id PK  uuid operation_id UK  uuid orden_id FK

                 uuid producto_id FK  dec cantidad  enum estado }

  COSTOOPERATIVOORDEN { uuid id PK  uuid operation_id UK  uuid orden_id FK

                        varchar concepto  dec valor }

  MOVIMIENTOINVENTARIO { uuid id PK  uuid operation_id UK  uuid producto_id FK

                         uuid venta_id FK  uuid consumo_orden_id FK UK

                         enum tipo  dec cantidad  enum sentido }

  MOVIMIENTOCAJA { uuid id PK  uuid operation_id UK  uuid venta_id FK UK

                   uuid abono_id FK UK  uuid cierre_caja_id FK  enum tipo

                   enum medio_pago  enum estado_pago  dec valor }

  CIERRECAJA { uuid id PK  uuid usuario_id FK  date fecha UK  dec total_neto

               dec efectivo_esperado  dec efectivo_contado  dec diferencia }

  OPERACIONSINCRONIZACION { uuid id PK  uuid operation_id UK  uuid dispositivo_id FK

                            varchar recurso  enum accion  enum estado

                            varchar codigo_conflicto  bool atendida }