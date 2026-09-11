**SADIM**

**Contrato Inicial de API por Recurso**

Sprint 1 — Diseño del sistema y arquitectura
Universidad Antonio Nariño — Ingeniería de Sistemas y Computación
Bogotá, Colombia · 2026

# 1. Propósito y alcance

Este documento define el contrato inicial de la API REST de SADIM para orientar el desarrollo del backend Django REST Framework y del cliente PWA. No constituye todavía una especificación exhaustiva de implementación: fija las rutas, responsabilidades, permisos, estructuras principales y reglas de integración necesarias para comenzar el desarrollo.

El contrato se mantiene alineado con ADR-001 a ADR-008, el ERD lógico y los casos de uso aprobados. La API opera para una única instalación asociada a un único negocio. La sincronización offline utiliza UUID y operation_id para permitir que las operaciones creadas localmente sean procesadas de forma idempotente por el backend.

# 2. Convenciones generales

- La API se expone mediante Django REST Framework (ADR-002) sobre PostgreSQL (ADR-001).

- Las rutas protegidas requieren autenticación mediante un token válido en el encabezado Authorization: Bearer <token>. Las rutas de registro inicial y login son públicas; refresh requiere un refresh token válido.

- El control de autorización se aplica en el backend mediante permission classes y RBAC (ADR-005). Los roles son ADMIN y OPERADOR.

- Las fechas y horas se intercambian en formato ISO 8601. Los valores monetarios se representan como números decimales en COP, sin símbolos ni separadores de miles en JSON.

- Los identificadores de las entidades que pueden crearse offline se representan mediante UUID. Las operaciones sincronizables incluyen operation_id único para garantizar idempotencia.

- Los endpoints que crean o modifican información deben aceptar operation_id cuando la operación pueda originarse offline. El servidor debe rechazar o reconocer una operación ya procesada sin volver a aplicar sus efectos.

- El cliente no debe modificar directamente stock_actual, totales de caja ni saldos calculados. Estos valores son responsabilidad de las reglas de negocio del backend.

- Los efectos derivados de una venta, abono o consumo de servicio sobre inventario y caja se generan en el servidor al confirmar la operación correspondiente.

- Un módulo desactivado debe impedir sus operaciones tanto en la interfaz como en el backend, aunque el usuario intente invocar directamente la ruta.

# 3. Autenticación

Ruta base: /api/auth/

| Método | Endpoint | Rol requerido | Descripción |
| --- | --- | --- | --- |
| POST | /api/auth/register/ | Público, solo primer usuario | Registra el usuario Administrador inicial cuando la instalación todavía no tiene usuarios. |
| POST | /api/auth/login/ | Público | Valida usuario y contraseña y devuelve tokens de acceso junto con la identidad y rol del usuario (CU-17). |
| POST | /api/auth/refresh/ | Autenticado | Renueva el token de acceso mediante el refresh token. |

### Ejemplo — registro inicial

{
  "nombre_completo": "Usuario Demo",
  "username": "admin",
  "password": "********"
}

// Response 201
{
  "usuario_id": "b3f1...",
  "rol": "ADMIN"
}

### Ejemplo — inicio de sesión (CU-17)

{
  "username": "operador.sadim",
  "password": "********"
}

// Response 200
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "usuario_id": "b3f1...",
  "rol": "OPERADOR"
}

El registro público no funciona como alta abierta de operadores: solo puede crear el primer Administrador de una instalación sin usuarios. Los usuarios posteriores se crean mediante el recurso de Usuarios y requieren permisos de Administrador.

# 4. Usuarios

Ruta base: /api/usuarios/

| Método | Endpoint | Rol requerido | Descripción |
| --- | --- | --- | --- |
| GET | /api/usuarios/ | ADMIN | Lista los usuarios de la instalación. |
| POST | /api/usuarios/ | ADMIN | Crea un nuevo usuario Operador. |
| PATCH | /api/usuarios/{id}/ | ADMIN | Edita datos permitidos o cambia activo para realizar una baja lógica. |

# 5. Categorías

Ruta base: /api/categorias/

| Método | Endpoint | Rol requerido | Descripción |
| --- | --- | --- | --- |
| GET | /api/categorias/ | ADMIN, OPERADOR | Lista las categorías del catálogo. |
| POST | /api/categorias/ | ADMIN | Crea una categoría (CU-05). |
| PATCH | /api/categorias/{id}/ | ADMIN | Edita el nombre de una categoría. |

# 6. Productos

Ruta base: /api/productos/

| Método | Endpoint | Rol requerido | Descripción |
| --- | --- | --- | --- |
| GET | /api/productos/?categoria=&tipo= | ADMIN, OPERADOR | Lista o filtra el catálogo (CU-05 y operaciones de venta). |
| POST | /api/productos/ | ADMIN | Crea un producto con precio, tipo, unidad y configuración de inventario (CU-05). |
| PATCH | /api/productos/{id}/ | ADMIN | Edita atributos permitidos, como precio de venta, costo de producción, stock mínimo o activo. |

### Ejemplo — creación de producto (CU-05)

{
  "operation_id": "2f10...",
  "categoria_id": "8a90...",
  "nombre": "Almojabana",
  "tipo": "REVENTA_DIRECTA",
  "precio_venta": 3500.00,
  "unidad_medida": "unidad",
  "stock_minimo": 10
}

// Response 201
{
  "id": "f21c...",
  "stock_actual": 0,
  "activo": true
}

El cliente no envía stock_actual como valor editable. Los ingresos y ajustes de inventario se realizan mediante MovimientoInventario.

# 7. Ventas — venta rápida y sesiones dinámicas

Ruta base: /api/ventas/

| Método | Endpoint | Rol requerido | Descripción |
| --- | --- | --- | --- |
| GET | /api/ventas/?estado=ABIERTA&mesa= | ADMIN, OPERADOR | Lista ventas/sesiones y alimenta el mapa de mesas. |
| POST | /api/ventas/ | ADMIN, OPERADOR | Crea una venta rápida o abre una sesión dinámica (CU-01, CU-02). |
| POST | /api/ventas/{id}/detalles/ | ADMIN, OPERADOR | Agrega un producto a una venta/sesión (CU-03). |
| DELETE | /api/ventas/{id}/detalles/{detalle_id}/ | ADMIN, OPERADOR | Quita una línea mientras la venta permanezca ABIERTA. |
| PATCH | /api/ventas/{id}/cerrar/ | ADMIN, OPERADOR | Cierra la venta/sesión, confirma el medio de pago y genera los efectos correspondientes (CU-04). |

### Ejemplo — abrir sesión dinámica

{
  "operation_id": "ab12...",
  "tipo": "SESION_DINAMICA",
  "mesa_id": "4c22..."
}

// Response 201
{
  "id": "7f31...",
  "estado": "ABIERTA",
  "mesa_id": "4c22...",
  "total": 0
}

### Ejemplo — registrar consumo en sesión dinámica (CU-03)

{
  "operation_id": "d921...",
  "producto_id": "f21c...",
  "cantidad": 2
}

// Response 201
{
  "id": "9e02...",
  "precio_unitario": 3500.00,
  "subtotal": 7000.00,
  "venta_id": "7f31..."
}

### Ejemplo — cerrar venta/sesión (CU-04)

{
  "operation_id": "e711...",
  "medio_pago": "EFECTIVO"
}

// Response 200
{
  "id": "7f31...",
  "estado": "CERRADA",
  "total": 17500.00,
  "mesa_id": "4c22..."
}

Una sesión ABIERTA puede acumular detalles sin generar todavía el movimiento definitivo de salida de inventario. Al cerrar una venta, el backend genera los movimientos de inventario correspondientes y exactamente un MovimientoCaja de tipo INGRESO_VENTA. La mesa queda disponible.

Para medios electrónicos como TRANSFERENCIA o QR, la confirmación del pago requiere conectividad. Una operación en efectivo puede registrarse offline y sincronizarse posteriormente.

# 8. Órdenes de trabajo

Ruta base: /api/ordenes-trabajo/

| Método | Endpoint | Rol requerido | Descripción |
| --- | --- | --- | --- |
| GET | /api/ordenes-trabajo/?estado= | ADMIN, OPERADOR | Lista o filtra órdenes por estado. |
| POST | /api/ordenes-trabajo/ | ADMIN, OPERADOR | Registra una nueva orden por encargo (CU-06). |
| PATCH | /api/ordenes-trabajo/{id}/estado/ | ADMIN, OPERADOR | Actualiza el estado de la orden (CU-07). |
| POST | /api/ordenes-trabajo/{id}/abonos/ | ADMIN, OPERADOR | Registra un abono independiente y recalcula el saldo pendiente (CU-08). |
| POST | /api/ordenes-trabajo/{id}/consumos/ | ADMIN, OPERADOR | Registra un ConsumoOrden pendiente (CU-09). |
| GET | /api/ordenes-trabajo/{id}/consumos/ | ADMIN, OPERADOR | Consulta los consumos registrados en la orden. |
| POST | /api/ordenes-trabajo/{id}/costos/ | ADMIN | Registra un concepto de CostoOperativoOrden (CU-10). |
| GET | /api/ordenes-trabajo/{id}/costos/ | ADMIN | Consulta el desglose de costos y la utilidad neta del servicio (CU-10). |

### Ejemplo — registrar abono (CU-08)

{
  "operation_id": "a812...",
  "valor": 20000.00,
  "medio_pago": "EFECTIVO",
  "observacion": "Abono inicial"
}

// Response 201
{
  "id": "bb31...",
  "valor": 20000.00,
  "saldo_pendiente": 55000.00
}

### Ejemplo — registrar consumo de orden (CU-09)

{
  "operation_id": "c901...",
  "producto_id": "f21c...",
  "cantidad": 2
}

// Response 201
{
  "id": "cc22...",
  "estado": "PENDIENTE"
}

Una orden puede tener múltiples Abonos. Cada Abono confirmado genera exactamente un MovimientoCaja de tipo INGRESO_ABONO. Los ConsumoOrden permanecen PENDIENTES hasta la finalización/entrega de la orden; al aplicar el consumo se generan los movimientos de salida de inventario correspondientes.

# 9. Inventario

Ruta base: /api/inventario/movimientos/

| Método | Endpoint | Rol requerido | Descripción |
| --- | --- | --- | --- |
| GET | /api/inventario/movimientos/?producto= | ADMIN, OPERADOR | Consulta el historial de movimientos de un producto. |
| POST | /api/inventario/movimientos/ | ADMIN, OPERADOR para ENTRADA; ADMIN para MERMA/AJUSTE_MANUAL | Registra un movimiento de inventario (CU-12, CU-13). |
| GET | /api/inventario/stock/ | ADMIN, OPERADOR | Consulta el stock actual y los productos en o por debajo del stock mínimo (CU-11). |

### Ejemplo — ingreso de mercancía (CU-12)

{
  "operation_id": "51a0...",
  "producto_id": "f21c...",
  "tipo": "ENTRADA",
  "cantidad": 10,
  "motivo": "Compra de mercancía"
}

Las salidas originadas por ventas y servicios no deben registrarse manualmente mediante este endpoint: se generan como efecto de las operaciones correspondientes. Los movimientos históricos no se editan; las correcciones se representan mediante nuevos movimientos de ajuste.

# 10. Movimientos de caja y gastos

Ruta base: /api/movimientos-caja/

| Método | Endpoint | Rol requerido | Descripción |
| --- | --- | --- | --- |
| GET | /api/movimientos-caja/?fecha_desde=&fecha_hasta=&tipo= | ADMIN | Consulta el detalle histórico de movimientos de caja. |
| POST | /api/movimientos-caja/ | ADMIN, OPERADOR | Registra un gasto de caja (CU-14). |

### Ejemplo — registrar gasto hormiga (CU-14)

{
  "operation_id": "g311...",
  "tipo": "GASTO",
  "medio_pago": "EFECTIVO",
  "valor": 3500.00,
  "concepto": "Compra de bolsas"
}

// Response 201
{
  "id": "m821...",
  "tipo": "GASTO",
  "valor": 3500.00
}

Los movimientos INGRESO_VENTA e INGRESO_ABONO son generados por el sistema como consecuencia de las operaciones de venta y abono; el cliente no debe crearlos manualmente. El gasto sí se registra mediante este recurso. Cada venta cerrada tiene un único movimiento de caja asociado.

# 11. Cierre de caja

Ruta base: /api/cierres-caja/

| Método | Endpoint | Rol requerido | Descripción |
| --- | --- | --- | --- |
| GET | /api/cierres-caja/?fecha= | ADMIN | Consulta el histórico de cierres. |
| POST | /api/cierres-caja/ | ADMIN | Calcula los totales del período a partir de MovimientoCaja y registra el cierre (CU-15). |

### Ejemplo — cierre de caja (CU-15)

{
  "fecha": "2026-08-22",
  "observaciones": "Sin novedades"
}

// Response 201
{
  "id": "c921...",
  "fecha": "2026-08-22",
  "total_ingresos": 226000.00,
  "total_gastos": 0.00,
  "total_neto": 226000.00
}

Los totales no se envían desde el cliente. El servidor los calcula a partir de los movimientos de caja incluidos en el período. CierreCaja funciona como resumen/corte; MovimientoCaja conserva el detalle histórico.

# 12. Configuración de módulos

Ruta base: /api/configuracion/modulos/

| Método | Endpoint | Rol requerido | Descripción |
| --- | --- | --- | --- |
| GET | /api/configuracion/modulos/ | ADMIN | Consulta el estado de los módulos de la instalación. |
| PATCH | /api/configuracion/modulos/ | ADMIN | Activa o desactiva Ventas, Inventario, Servicios o Finanzas (CU-16). |

### Ejemplo — configuración de módulos

{
  "ventas_activo": true,
  "inventario_activo": true,
  "servicios_activo": true,
  "finanzas_activo": false
}

Desactivar un módulo no elimina datos ni código. El frontend oculta sus funcionalidades y el backend rechaza las operaciones correspondientes mientras permanezca desactivado.

# 13. Sincronización offline

La API debe soportar la recepción de operaciones creadas localmente por la PWA. El cliente mantiene las operaciones pendientes en IndexedDB y las envía al recuperar conectividad.

| Método | Endpoint | Rol requerido | Descripción |
| --- | --- | --- | --- |
| POST | /api/sync/ | Autenticado | Recibe una o varias operaciones pendientes y las procesa de forma idempotente mediante operation_id. |

### Ejemplo — operación pendiente

{
  "operations": [
    {
      "operation_id": "d921...",
      "resource": "ventas.detalles",
      "action": "CREATE",
      "payload": {
        "venta_id": "7f31...",
        "producto_id": "f21c...",
        "cantidad": 2
      }
    }
  ]
}

// Respuesta
{
  "results": [
    {
      "operation_id": "d921...",
      "status": "APPLIED"
    }
  ]
}

Si el operation_id ya fue procesado, el servidor debe devolver el resultado previamente registrado o un estado equivalente a ALREADY_PROCESSED, sin volver a aplicar la operación. Los conflictos de operaciones transaccionales no se resuelven mediante Last Write Wins; se validan según las reglas de negocio y el estado actual de la información.

# 14. Códigos HTTP y errores

| Código | Nombre | Uso en SADIM |
| --- | --- | --- |
| 200 | OK | Consulta o modificación procesada correctamente. |
| 201 | Created | Recurso creado correctamente. |
| 400 | Bad Request | Datos inválidos o regla de negocio no cumplida. |
| 401 | Unauthorized | Autenticación ausente, inválida o expirada. |
| 403 | Forbidden | Usuario autenticado sin permisos suficientes. |
| 404 | Not Found | Recurso solicitado inexistente. |
| 409 | Conflict | Conflicto de estado, duplicidad u operación incompatible. |
| 500 | Internal Server Error | Error inesperado del servidor. |

# Las respuestas de error deben mantener una estructura JSON consistente, por ejemplo:

### Ejemplo de error

{
  "code": "INSUFFICIENT_STOCK",
  "message": "No hay existencias suficientes para completar la operación.",
  "details": {
    "producto_id": "f21c...",
    "stock_disponible": 1,
    "cantidad_solicitada": 3
  }
}

# 15. Trazabilidad con los artefactos anteriores

| Artefacto | Decisión / caso | Reflejo en API |
| --- | --- | --- |
| ADR-001 | PostgreSQL | Persistencia relacional del backend. |
| ADR-002 | Monolito modular + DRF | API REST única organizada por recursos/módulos. |
| ADR-004 | Offline-first | UUID, operation_id, /api/sync/ e idempotencia. |
| ADR-005 | RBAC | ADMIN/OPERADOR aplicado en permission classes. |
| ADR-006 | Módulos configurables | /api/configuracion/modulos/. |
| ADR-007 | Un negocio por instalación | No se expone business_id/tenant_id en los recursos del alcance actual. |
| ADR-008 | MovimientoCaja | Ventas y abonos generan ingresos; gastos se registran explícitamente. |
| CU-01 a CU-05 | Ventas | /api/ventas/ y recursos de catálogo. |
| CU-06 a CU-10 | Servicios | /api/ordenes-trabajo/, abonos, consumos y costos. |
| CU-11 a CU-13 | Inventario | /api/inventario/ y movimientos. |
| CU-14 a CU-15 | Finanzas | /api/movimientos-caja/ y /api/cierres-caja/. |
| CU-16 | Configuración | /api/configuracion/modulos/. |
| CU-17 | Autenticación | /api/auth/register/, login y refresh. |

# 16. Límites del contrato inicial

Este documento no fija todavía la implementación exacta de serializers, ViewSets, services, permissions, transacciones internas, estructura detallada de IndexedDB ni el formato final de documentación OpenAPI/Swagger. Esas decisiones se definirán durante la arquitectura detallada y la implementación, manteniendo este contrato como referencia.