**SADIM**

**Wireframes de las Pantallas Principales**

Sprint 1 — Diseño del sistema y arquitectura
Universidad Antonio Nariño — Ingeniería de Sistemas y Computación
Bogotá, Colombia

# **Criterio de diseño**

Los wireframes son de baja fidelidad y están orientados principalmente a una vista de ordenador, que constituye la referencia visual principal para el prototipo inicial. La interfaz mantiene un diseño responsive para adaptarse posteriormente a diferentes tamaños de pantalla, pero la documentación y los mockups de este Sprint priorizan la distribución horizontal de escritorio. La navegación lateral organiza las áreas principales de la aplicación y busca reducir clics en las operaciones frecuentes, en línea con el diseño centrado en el usuario y el minimalismo cognitivo descrito en la sección 2.1.5 del anteproyecto. Los wireframes representan pantallas de uso frecuente y puntos de entrada a los casos de uso priorizados del Sprint 2. La identidad visual y el refinamiento de alta fidelidad se desarrollarán posteriormente. Las imágenes pueden contener elementos exploratorios de interfaz que no constituyen compromisos adicionales de alcance.

**1. Inicio de sesión**

**Módulo: **Transversal (autenticación)**   ·   Rol(es): **Operador, Administrador

|  | Elementos clave Campos de usuario y contraseña con validación en el servidor. Mensaje de estado offline: permite continuar con una sesión previamente validada y almacenada localmente, conforme a ADR-004. El rol (Administrador/Operador) se determina tras validar las credenciales y define las funciones disponibles, conforme a RBAC (ADR-005). Corresponde a CU-17. |
| --- | --- |

*Figura 1. Inicio de sesión — wireframe de baja fidelidad. Elaboración propia.*

**2. Inicio (dashboard)**

**Módulo: **Transversal**   ·   Rol(es): **Operador, Administrador

|  | Elementos clave Tarjetas KPI del día: ventas totales, mesas abiertas y órdenes activas. Accesos rápidos a las acciones de mayor frecuencia (venta rápida, nueva sesión, nuevo pedido, inventario). Lista de mesas actualmente ocupadas con tiempo transcurrido y total acumulado. Indicador del estado de conexión, del número de operaciones en cola y de las novedades de sincronización pendientes de atender (CU-23). El contenido de la información financiera visible varía según el rol autenticado: el resumen diario de caja (CU-20) es exclusivo del Administrador. |
| --- | --- |

*Figura 2. Inicio (dashboard) — wireframe de baja fidelidad. Elaboración propia.*

**3. Ventas — Mapa de mesas**

**Módulo: **Ventas**   ·   Rol(es): **Operador, Administrador

|  | Elementos clave Botón principal de venta rápida de mostrador (CU-01), siempre visible arriba. Cuadrícula de mesas; la visualización puede ejemplificarse con las 6 mesas del escenario de Aroma & Co., pero SADIM admite hasta 15 mesas activas. El estado visual distingue mesas disponibles de mesas con sesión abierta (CU-02). Cada mesa ocupada muestra el total acumulado. Accesos a «Catálogo» (CU-05) y «Mesas» (CU-19) visibles solo para el rol Administrador; el Operador consulta las mesas pero no las registra ni las desactiva. |
| --- | --- |

*Figura 3. Ventas — Mapa de mesas — wireframe de baja fidelidad. Elaboración propia.*

**4. Detalle de sesión dinámica**

**Módulo: **Ventas**   ·   Rol(es): **Operador, Administrador

|  | Elementos clave Lista de consumos progresivos agregados a la cuenta abierta (CU-03). Botón para agregar más productos del catálogo sin cerrar la cuenta. Total recalculado en tiempo real y selector de medio de pago, limitado a los medios habilitados en la configuración de pagos (CU-22). Al elegir transferencia o QR se muestra la referencia Nequi configurada y el cobro se presenta como pendiente de verificación, nunca como pago recibido, hasta que un usuario lo confirme con conexión. El cierre confirma la venta, genera los efectos de inventario y caja correspondientes y libera la mesa (CU-04). Una sesión abierta por error se resuelve con la acción «Cancelar sesión», disponible mientras la venta siga ABIERTA: no genera movimientos y libera la mesa. |
| --- | --- |

*Figura 4. Detalle de sesión dinámica — wireframe de baja fidelidad. Elaboración propia.*

**5. Órdenes de trabajo**

**Módulo: **Servicios**   ·   Rol(es): **Operador, Administrador

|  | Elementos clave Listado de pedidos por encargo con cliente, fecha de entrega y estado visual (RECIBIDO, EN_PROCESO, LISTO; ENTREGADO cuando corresponda). Botón para registrar un nuevo pedido (CU-06). Cada tarjeta lleva al detalle donde se actualiza el estado (CU-07), se registran múltiples abonos (CU-08) y se gestionan los consumos de inventario de la orden (CU-09). |
| --- | --- |

*Figura 5. Órdenes de trabajo — wireframe de baja fidelidad. Elaboración propia.*

**6. Inventario**

Módulo: Inventario   ·   Rol(es): Operador, Administrador

|  | Elementos clave Filtro por tipo de producto: insumos de producción o reventa directa. Listado con existencia actual por producto (CU-11); los valores en o por debajo del stock mínimo se resaltan como alerta visual. Los productos que no controlan existencias propias se muestran sin stock ni alerta, para no sugerir un descuadre inexistente. La consulta está disponible para ambos roles. Las operaciones de ajuste manual corresponden al Administrador y exigen indicar si el ajuste suma o resta existencias, además del motivo (CU-13). |
| --- | --- |

*Figura 6. Inventario — wireframe de baja fidelidad. Elaboración propia.*

**7. Cierre de caja (arqueo)**

Módulo: Finanzas   ·   Rol(es): Administrador (exclusivo)

|  | Elementos clave Consolidado automático de los movimientos de caja del período, diferenciando ingresos por ventas, ingresos por abonos y gastos (CU-15). Bloque de arqueo con el efectivo esperado calculado por el servidor, el campo de efectivo contado que registra el Administrador y la diferencia resultante. Campo de observaciones para registrar descuadres o novedades, obligatorio cuando la diferencia no es cero. La pantalla advierte si quedan operaciones pendientes de sincronizar e impide confirmar el cierre hasta aplicarlas: el arqueo puede prepararse sin conexión, pero la confirmación siempre la requiere. Los cobros pendientes de verificación se muestran aparte y no entran en este cierre. Pantalla accesible únicamente para el rol Administrador, conforme a RBAC (ADR-005). CierreCaja funciona como resumen del período; MovimientoCaja conserva el detalle histórico. |
| --- | --- |

*Figura 7. Cierre de caja (arqueo) — wireframe de baja fidelidad. Elaboración propia.*

**8. Dirección visual y alcance de los mockups**

Los mockups de este documento utilizan una composición horizontal orientada a ordenador como referencia principal. Esto no limita la naturaleza PWA de SADIM: la implementación deberá conservar comportamiento responsive para otros tamaños de pantalla. Los elementos visuales de bienvenida, ayuda o tutorial que aparezcan en las imágenes se consideran exploratorios y no constituyen una funcionalidad comprometida del alcance arquitectónico.

**9. Trazabilidad y consistencia con la arquitectura**

Los wireframes constituyen una representación de baja fidelidad de los principales puntos de interacción. No representan todavía la interfaz visual definitiva ni pretenden cubrir todos los casos de uso. La siguiente tabla establece la relación entre las pantallas y los flujos definidos en el documento de casos de uso, permitiendo verificar que la interfaz propuesta sea coherente con el ADR y el ERD.

| Pantalla | Casos de uso relacionados | Observación |
| --- | --- | --- |
| Inicio de sesión | CU-17 | La primera autenticación requiere conexión; una sesión previamente validada puede continuar offline. |
| Inicio / dashboard | Entrada a CU-01, CU-02, CU-06 y CU-11; avisos de CU-23 | Funciona como punto de acceso a las operaciones frecuentes y adapta la información al rol. Señala el estado de conexión y las novedades de sincronización pendientes. |
| Ventas — mapa de mesas | CU-01, CU-02, CU-05, CU-19 | La visualización puede mostrar 6 mesas como ejemplo, con capacidad funcional de hasta 15 activas. El registro y la desactivación de mesas son del Administrador. |
| Detalle de sesión dinámica | CU-03, CU-04 | El inventario definitivo y el movimiento de caja se generan al cerrar la venta. Incluye la cancelación de una sesión abierta por error y el estado del pago electrónico. |
| Órdenes de trabajo | CU-06, CU-07, CU-08, CU-09, CU-10 | El detalle debe permitir múltiples abonos, saldo pendiente y consumos pendientes. |
| Inventario | CU-11, CU-12, CU-13 | La consulta es común; los ajustes manuales requieren Administrador e indican el sentido del ajuste. |
| Cierre de caja | CU-15 | Requiere conexión y la cola de sincronización aplicada. Incluye el arqueo (efectivo esperado, contado y diferencia); MovimientoCaja conserva el detalle histórico. |

Cobertura pendiente. Siete casos de uso no tienen todavía wireframe propio: el registro de gastos (CU-14), el resumen diario de caja (CU-20), la configuración de módulos (CU-16), la gestión de usuarios (CU-18), la gestión de dispositivos autorizados (CU-21), la configuración de medios de pago (CU-22) y la bandeja de novedades de sincronización (CU-23). Los cuatro últimos son pantallas de administración de baja frecuencia; CU-23 sí requiere, además de su bandeja, el aviso permanente ya previsto en el dashboard. Todos se incorporan en el prototipo de alta fidelidad.

**10. Consideraciones para el prototipo de alta fidelidad**

- El prototipo de alta fidelidad deberá mantener la navegación y jerarquía funcional definidas aquí, pero podrá modificar colores, tipografía, iconografía y componentes.

- Deberá existir una representación clara del estado offline, de las operaciones pendientes de sincronización y de las novedades rechazadas o en conflicto, que el usuario debe poder revisar y marcar como atendidas (CU-23).

- La interfaz deberá indicar si el dispositivo es el autorizado para operar sin conexión: solo uno lo está en cada instalación (ADR-004).

- Las funciones no disponibles por rol o por módulo desactivado no deberán presentarse como acciones ejecutables.

- El flujo de pago deberá distinguir visualmente un cobro confirmado de uno pendiente de verificación. Con transferencia o QR se muestra la referencia Nequi configurada y nunca se presenta el pago como recibido antes de que un usuario lo confirme con conexión.

- Las pantallas de servicios deberán permitir visualizar el estado de la orden, sus abonos y sus consumos, aunque no todos estos elementos estén representados todavía en los wireframes de baja fidelidad.

- Las pantallas financieras deberán diferenciar el detalle de MovimientoCaja, el resumen diario consultable (CU-20) y el cierre firmado de CierreCaja, que consolida los movimientos e impide modificarlos después.