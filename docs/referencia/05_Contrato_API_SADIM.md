**SADIM**

**Contrato de API por Recurso — Versión 2**

Actualizado al cierre del Sprint 2 (16/09/2026) · Universidad Antonio Nariño — Ingeniería de Sistemas y Computación · Bogotá, Colombia · 2026

# Control de versiones

| **Versión** | **Fecha** | **Momento** | **Resumen** |
| --- | --- | --- | --- |
| 1 | 12/09/2026 | Sprint 1, con los ajustes de la revisión cruzada | Contrato inicial por recurso, alineado con ADR-001 a ADR-008, ERD v3 y CU-01 a CU-23. |
| 2 | 16/09/2026 | Cierre del Sprint 2 | Incorpora las decisiones de implementación del Sprint 2, corrige inconsistencias con el ERD y los Casos de Uso y define lo que necesitan las historias del Sprint 3. |

## Cambios de la versión 2

Cada cambio tiene uno de tres tipos:

- **Aplicada:** decisión aprobada por el equipo e implementada y probada en el Sprint 2.

- **Corrección:** alinea el contrato con el ERD v3 o con los Casos de Uso, sin introducir una decisión nueva.

- **Propuesta:** decisión de diseño nueva que necesita el Sprint 3. Forma parte del texto de esta versión, pero no debe implementarse hasta que el equipo la apruebe. Al aprobarse, su estado cambia a «Aprobada» sin modificar el texto.

| **ID** | **Tipo** | **Sección** | **Cambio** | **Historias** |
| --- | --- | --- | --- | --- |
| D1 | Aplicada | §14.3 | Códigos de error de la API en línea: NO_AUTENTICADO, CREDENCIALES_INVALIDAS, RECURSO_NO_ENCONTRADO, METODO_NO_PERMITIDO, INSTALACION_YA_INICIALIZADA y ERROR_INTERNO. | HU-008, HU-009 |
| D2 | Aplicada | §3 | La renovación de token es pública: recibe refresh_token y devuelve access_token. | HU-008 |
| D3 | Aplicada | §2, §5, §6 | Categorías y productos solo aceptan GET, POST y PATCH; DELETE y PUT responden 405. | HU-011 |
| D4 | Aplicada | §6 | El ADMIN ve productos activos e inactivos; el OPERADOR solo los activos. | HU-011, HU-012 |
| D5 | Aplicada | §2, §6 | El OPERADOR no recibe costo_produccion. | HU-012 |
| D6 | Aplicada | §2, §5, §6 | En línea, operation_id es opcional al crear categorías y productos: si no llega, lo genera el servidor. No es editable. | HU-011 |
| C-01 | Corrección | §3 | La tabla marcaba la renovación de token como «Autenticado», en contradicción con §2. | HU-008 |
| C-02 | Corrección | §2 | Se precisa que montos y cantidades viajan como números JSON, nunca como texto. | HU-011 |
| C-03 | Corrección | §2 | Se precisa que las relaciones usan el nombre del ERD con sufijo _id en solicitudes y respuestas. | HU-011 |
| C-04 | Corrección | §9 | /api/inventario/stock/ admite filtros por categoría y tipo, como exige CU-11. | HU-024 |
| C-05 | Corrección | §7 | Cerrar una sesión sin detalles se rechaza, conforme a la precondición de CU-04. | HU-018 |
| C-06 | Corrección | §10, §11 | El ejemplo de cierre incluye operation_id (NOT NULL en ERD §5.16) y sus cifras cuadran con el resumen diario; se precisa qué incluyen los totales del resumen. | HU-027, HU-028 |
| C-07 | Corrección | §12.1 | El ejemplo de configuración de pagos incluye acepta_efectivo (ERD §5.4). | HU-049 |
| C-08 | Corrección | §2, §13 | En sincronización, las creaciones incluyen el id generado en el dispositivo (ERD §5.8). | HU-032 |
| C-09 | Corrección | §8 | Se agregan los ejemplos de creación y cambio de estado de una orden, y estado_pago en la respuesta del abono. | HU-020, HU-021, HU-022 |
| P-01 | Propuesta | §7, §12.1 | Venta rápida en una sola operación atómica; reglas de creación de ventas y validación del medio de pago. | HU-013, HU-014, HU-016 |
| P-02 | Propuesta | §10 | Consulta y confirmación de pagos con estado PENDIENTE_VERIFICACION. | HU-050 |
| P-03 | Propuesta | §2, §13.1 | Idempotencia uniforme para toda escritura con operation_id, en línea y por sincronización, incluidas las acciones que no crean filas. | HU-045, HU-032 |
| P-04 | Propuesta | §12 | Mapa de rutas por módulo: el catálogo no depende de ninguna bandera y las banderas bloquean rutas, no efectos internos. | HU-042 |
| P-05 | Propuesta | §8 | Órdenes: avance de un estado a la vez, consumos permitidos hasta LISTO y entrega atómica. | HU-021, HU-041, HU-023 |
| P-06 | Propuesta | §4 | Usuarios: campos editables y protección del último ADMIN activo. | HU-044 |
| P-07 | Propuesta | §6 | controla_stock solo puede cambiar cuando stock_actual = 0. | HU-015 |

Las decisiones D7 (claves foráneas con PROTECT) y D8 (columna password_hash de 255 caracteres) no afectan este contrato: se formalizan en el ERD (sección 17).

# 1. Propósito y alcance

Este documento define el contrato de la API REST de SADIM para orientar el desarrollo del backend Django REST Framework y del cliente PWA. Fija las rutas, responsabilidades, permisos, estructuras principales y reglas de integración. No constituye todavía una especificación exhaustiva de implementación.

El contrato se mantiene alineado con ADR-001 a ADR-008, el ERD v3 y los Casos de Uso CU-01 a CU-23. La API opera para una única instalación asociada a un único negocio. La sincronización offline utiliza UUID y operation_id para que las operaciones creadas localmente se procesen de forma idempotente en el backend.

Cuando este contrato requiere un ajuste en otro documento, el ajuste se registra en la sección 17 en lugar de asumirse.

# 2. Convenciones generales

- La API se expone mediante Django REST Framework (ADR-002) sobre PostgreSQL (ADR-001).

- Las rutas protegidas requieren el encabezado Authorization: Bearer <access_token>. Son públicas el registro inicial, el inicio de sesión y la renovación de token; esta última exige un refresh_token válido en el cuerpo (D2).

- La autorización se aplica en el backend mediante permission classes y RBAC (ADR-005). Los roles son ADMIN y OPERADOR.

- Un campo restringido a un rol no se incluye en las respuestas para los demás roles, en lugar de enviarse vacío; por ejemplo, costo_produccion y utilidad_neta no se envían al OPERADOR (D5).

- Las fechas y horas se intercambian en formato ISO 8601.

- Los montos y cantidades se representan como números JSON (por ejemplo 3500.00), en COP, sin símbolos ni separadores de miles, y nunca como texto (C-02). El backend calcula con decimales exactos.

- Los campos que referencian otra entidad usan el nombre del ERD con sufijo _id (categoria_id, producto_id, mesa_id, venta_id), tanto en solicitudes como en respuestas (C-03).

- Los identificadores de las entidades se representan mediante UUID. En línea los genera el servidor. En /api/sync/, las operaciones de creación incluyen el id generado en el dispositivo, porque operaciones posteriores de la misma cola lo referencian, por ejemplo un detalle que apunta a su venta (C-08).

- Las operaciones que pueden originarse sin conexión incluyen un operation_id (UUID) generado por el cliente. En línea, operation_id es opcional al crear categorías y productos: si no llega, lo genera el servidor (D6). Una vez asignado, operation_id no es editable.

- Si el servidor recibe un operation_id ya procesado, no vuelve a aplicar efectos y devuelve el resultado original, conforme a la sección 13.1 (P-03).

- El cliente no modifica directamente stock_actual, totales, saldos ni estados derivados. Si envía esos campos, el servidor los ignora.

- Los efectos de una venta, abono o consumo de servicio sobre inventario y caja se generan en el servidor, dentro de la misma transacción que la operación de origen.

- Un método HTTP no definido para una ruta responde 405 METODO_NO_PERMITIDO (D3).

- Un módulo desactivado impide sus operaciones en la interfaz y en el backend, aunque se invoque directamente la ruta (sección 12).

# 3. Autenticación

Ruta base: /api/auth/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| POST | /api/auth/register/ | Público, solo con la instalación sin usuarios | Registra el usuario Administrador inicial. |
| POST | /api/auth/login/ | Público | Valida usuario y contraseña y devuelve los tokens con la identidad y el rol del usuario (CU-17). |
| POST | /api/auth/refresh/ | Público, con refresh_token válido | Renueva el token de acceso (D2, C-01). |

### Ejemplo — registro inicial

// POST /api/auth/register/
{
  "nombre_completo": "Ana Torres",
  "username": "admin.aroma",
  "password": "********"
}

// Response 201
{
  "usuario_id": "8b66...",
  "rol": "ADMIN"
}

El registro público solo crea el primer Administrador de una instalación sin usuarios. Si ya existen usuarios responde 409 INSTALACION_YA_INICIALIZADA. Una contraseña que no cumple los validadores del servidor responde 400 DATOS_INVALIDOS. Los usuarios posteriores se crean mediante /api/usuarios/.

### Ejemplo — inicio de sesión (CU-17)

// POST /api/auth/login/
{
  "username": "admin.aroma",
  "password": "********"
}

// Response 200
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "usuario_id": "8b66...",
  "rol": "ADMIN"
}

// Response 401 — contraseña incorrecta, usuario inexistente o inactivo
{
  "code": "CREDENCIALES_INVALIDAS",
  "message": "El usuario o la contraseña no son correctos.",
  "details": {}
}

El mensaje es el mismo para los tres casos, para no revelar qué dato falló.

### Ejemplo — renovación de token (D2)

// POST /api/auth/refresh/
{
  "refresh_token": "eyJhbGciOi..."
}

// Response 200
{
  "access_token": "eyJhbGciOi..."
}

Un refresh_token inválido o expirado responde 401 NO_AUTENTICADO; el cliente cierra la sesión y solicita autenticación de nuevo.

# 4. Usuarios

Ruta base: /api/usuarios/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| GET | /api/usuarios/ | ADMIN | Lista los usuarios de la instalación (CU-18). |
| POST | /api/usuarios/ | ADMIN | Crea un nuevo usuario Operador (CU-18). |
| PATCH | /api/usuarios/{id}/ | ADMIN | Edita los campos permitidos o cambia activo para realizar una baja lógica (CU-18). |

### Ejemplo — crear usuario Operador (CU-18)

// POST /api/usuarios/
{
  "nombre_completo": "Carlos Ruiz",
  "username": "oper.aroma",
  "password": "********"
}

// Response 201
{
  "id": "c41a...",
  "nombre_completo": "Carlos Ruiz",
  "username": "oper.aroma",
  "rol": "OPERADOR",
  "activo": true,
  "fecha_creacion": "2026-09-21T09:30:00-05:00"
}

Reglas (P-06):

- POST siempre crea un usuario con rol OPERADOR. Un username repetido o una contraseña que no cumple los validadores responde 400 DATOS_INVALIDOS.

- PATCH admite nombre_completo, password (restablecimiento por el ADMIN) y activo. Los campos id, username, rol y fecha_creacion son de solo lectura y se ignoran si se envían.

- Ninguna respuesta incluye la contraseña ni su hash.

- No existe DELETE: la baja es lógica mediante activo. Un usuario con activo = false conserva su historial y no puede iniciar sesión.

- El backend rechaza con 409 ULTIMO_ADMIN_ACTIVO cualquier cambio que deje la instalación sin un ADMIN activo (R-04). Como POST solo crea Operadores y rol no es editable, la instalación tiene un único ADMIN, de modo que la regla impide que ese ADMIN se desactive.

- La creación de usuarios y el cambio de contraseña requieren conexión (E-02).

## 4.1 Dispositivos

Ruta base: /api/dispositivos/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| GET | /api/dispositivos/ | ADMIN | Lista los dispositivos registrados y cuál está autorizado offline (CU-21). |
| POST | /api/dispositivos/ | ADMIN | Registra un dispositivo con su identificador, el UUID generado por la PWA (CU-21). |
| PATCH | /api/dispositivos/{id}/ | ADMIN | Marca es_caja, autoriza el dispositivo o lo desactiva. Requiere conexión (E-04). |

### Ejemplo — autorizar dispositivo (CU-21)

// PATCH /api/dispositivos/{id}/
{
  "autorizado_offline": true
}

Al autorizar un dispositivo, el servidor revoca automáticamente cualquier otro con autorizado_offline = true: solo uno puede operar sin conexión (D-04). Un dispositivo se desactiva, nunca se elimina, para conservar su historial de sincronización.

# 5. Categorías

Ruta base: /api/categorias/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| GET | /api/categorias/ | ADMIN, OPERADOR | Lista las categorías del catálogo. |
| POST | /api/categorias/ | ADMIN | Crea una categoría (CU-05). |
| PATCH | /api/categorias/{id}/ | ADMIN | Edita el nombre de una categoría. |

### Ejemplo — crear categoría (CU-05)

// POST /api/categorias/
{
  "operation_id": "1c77...",
  "nombre": "Bebidas calientes"
}

// Response 201
{
  "id": "58d7...",
  "operation_id": "1c77...",
  "nombre": "Bebidas calientes"
}

La creación puede originarse sin conexión (R-30). En línea, operation_id es opcional (D6). Un nombre repetido responde 400 DATOS_INVALIDOS.

No existe DELETE ni PUT en el catálogo: responden 405 METODO_NO_PERMITIDO (D3).

# 6. Productos

Ruta base: /api/productos/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| GET | /api/productos/?categoria=&tipo= | ADMIN, OPERADOR | Lista o filtra el catálogo (CU-05 y operaciones de venta). |
| POST | /api/productos/ | ADMIN | Crea un producto con precio, tipo, unidad y configuración de inventario (CU-05). |
| PATCH | /api/productos/{id}/ | ADMIN | Edita los atributos permitidos o cambia activo para la baja lógica. |

### Ejemplo — crear producto (CU-05)

// POST /api/productos/
{
  "operation_id": "300a...",
  "categoria_id": "58d7...",
  "nombre": "Cafe americano",
  "tipo": "REVENTA_DIRECTA",
  "precio_venta": 3500.00,
  "costo_produccion": 1200.00,
  "unidad_medida": "unidad",
  "stock_minimo": 5,
  "controla_stock": true
}

// Response 201 (vista del ADMIN)
{
  "id": "0aba...",
  "operation_id": "300a...",
  "categoria_id": "58d7...",
  "nombre": "Cafe americano",
  "tipo": "REVENTA_DIRECTA",
  "precio_venta": 3500.00,
  "costo_produccion": 1200.00,
  "stock_actual": 0.00,
  "stock_minimo": 5.00,
  "controla_stock": true,
  "unidad_medida": "unidad",
  "activo": true
}

Consulta y visibilidad:

- Los filtros ?categoria= (UUID de la categoría) y ?tipo= (INSUMO_PRODUCCION o REVENTA_DIRECTA) son opcionales. Un valor inválido responde 400 DATOS_INVALIDOS con el detalle del parámetro.

- El ADMIN recibe productos activos e inactivos, para poder reactivarlos; el OPERADOR solo recibe productos activos (D4).

- Las respuestas al OPERADOR no incluyen costo_produccion (D5).

Edición y baja (P-07):

- PATCH admite nombre, categoria_id, tipo, precio_venta, costo_produccion, stock_minimo, unidad_medida, controla_stock y activo. id, operation_id y stock_actual no son editables.

- stock_actual lo mantiene el backend a partir de MovimientoInventario; si el cliente lo envía, se ignora.

- controla_stock solo puede cambiar cuando stock_actual = 0; en otro caso responde 409 PRODUCTO_CON_EXISTENCIAS. Así no quedan existencias huérfanas al pasar a false.

- Cambiar precio_venta no altera los detalles de venta ya registrados, que conservan su precio_unitario (ERD §5.9).

- Un nombre repetido dentro de la misma categoría responde 400 DATOS_INVALIDOS.

- La baja es lógica: PATCH con activo = false, y activo = true la revierte. DELETE y PUT responden 405 METODO_NO_PERMITIDO (D3).

controla_stock indica si el producto lleva existencias propias. En false —un preparado al momento— su venta no valida ni descuenta stock y el producto queda fuera de las alertas de stock mínimo; sus insumos se controlan como productos independientes. SADIM no modela recetas.

# 7. Ventas — venta rápida y sesiones dinámicas

Ruta base: /api/ventas/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| GET | /api/ventas/?estado=ABIERTA&mesa= | ADMIN, OPERADOR | Lista ventas y sesiones; alimenta el mapa de mesas. |
| POST | /api/ventas/ | ADMIN, OPERADOR | Registra una venta RAPIDA ya cerrada o abre una SESION_DINAMICA (CU-01, CU-02). |
| POST | /api/ventas/{id}/detalles/ | ADMIN, OPERADOR | Agrega un producto a una sesión ABIERTA (CU-03). |
| DELETE | /api/ventas/{id}/detalles/{detalle_id}/ | ADMIN, OPERADOR | Quita una línea mientras la sesión permanezca ABIERTA. |
| PATCH | /api/ventas/{id}/cerrar/ | ADMIN, OPERADOR | Cierra la sesión, registra el medio de pago y genera sus efectos (CU-04). |
| PATCH | /api/ventas/{id}/cancelar/ | ADMIN, OPERADOR | Cancela una sesión ABIERTA sin generar efectos y libera la mesa (CU-04 alterno). |

### Ejemplo — venta rápida en una sola operación (CU-01, P-01)

// POST /api/ventas/
{
  "operation_id": "b610...",
  "tipo": "RAPIDA",
  "medio_pago": "EFECTIVO",
  "detalles": [
    { "operation_id": "b611...", "producto_id": "0aba...", "cantidad": 2 },
    { "operation_id": "b612...", "producto_id": "a3d4...", "cantidad": 1 }
  ]
}

// Response 201
{
  "id": "7a90...",
  "tipo": "RAPIDA",
  "estado": "CERRADA",
  "mesa_id": null,
  "fecha_apertura": "2026-09-21T10:15:02-05:00",
  "fecha_cierre": "2026-09-21T10:15:02-05:00",
  "medio_pago": "EFECTIVO",
  "estado_pago": "CONFIRMADO",
  "total": 11000.00,
  "detalles": [
    {
      "id": "9e10...",
      "producto_id": "0aba...",
      "cantidad": 2,
      "precio_unitario": 3500.00,
      "subtotal": 7000.00
    },
    {
      "id": "9e11...",
      "producto_id": "a3d4...",
      "cantidad": 1,
      "precio_unitario": 4000.00,
      "subtotal": 4000.00
    }
  ]
}

Reglas de la venta rápida (P-01):

- Se registra en una sola operación que se aplica completa o no se aplica: la Venta en estado CERRADA, sus DetalleVenta, un MovimientoInventario SALIDA_VENTA por cada línea cuyo producto tiene controla_stock = true y exactamente un MovimientoCaja INGRESO_VENTA (R-10).

- Exige al menos un detalle. Los operation_id de cada detalle son opcionales en línea; si no llegan, los genera el servidor.

- precio_unitario se toma del precio_venta vigente del producto al procesar la operación. El cliente no envía precio_unitario, subtotal, total, estado ni estado_pago.

- Si un producto está inactivo responde 409 PRODUCTO_INACTIVO. Si un producto con controla_stock = true no tiene existencias suficientes, responde 409 STOCK_INSUFICIENTE indicando el producto. En ambos casos no se registra nada.

- Una venta rápida nace CERRADA: agregar detalles, cerrarla o cancelarla responde 409 VENTA_YA_CERRADA.

- En sincronización viaja como una sola operación de creación del recurso ventas, con el mismo contenido.

### Ejemplo — abrir sesión dinámica (CU-02)

// POST /api/ventas/
{
  "operation_id": "ab12...",
  "tipo": "SESION_DINAMICA",
  "mesa_id": "4c22..."
}

// Response 201
{
  "id": "7f31...",
  "tipo": "SESION_DINAMICA",
  "estado": "ABIERTA",
  "mesa_id": "4c22...",
  "total": 0.00
}

Una sesión se abre sin detalles ni medio de pago; si se envían, responde 400 DATOS_INVALIDOS. Si la mesa ya tiene una sesión ABIERTA responde 409 MESA_OCUPADA (R-08). Si la mesa está inactiva responde 400 DATOS_INVALIDOS (P-01).

### Ejemplo — registrar consumo en sesión dinámica (CU-03)

// POST /api/ventas/{id}/detalles/
{
  "operation_id": "d921...",
  "producto_id": "0aba...",
  "cantidad": 2
}

// Response 201
{
  "id": "9e02...",
  "venta_id": "7f31...",
  "producto_id": "0aba...",
  "cantidad": 2,
  "precio_unitario": 3500.00,
  "subtotal": 7000.00
}

### Ejemplo — cerrar sesión (CU-04)

// PATCH /api/ventas/{id}/cerrar/
{
  "operation_id": "e711...",
  "medio_pago": "EFECTIVO"
}

// Response 200
{
  "id": "7f31...",
  "estado": "CERRADA",
  "total": 17500.00,
  "medio_pago": "EFECTIVO",
  "estado_pago": "CONFIRMADO",
  "mesa_id": "4c22..."
}

Una sesión ABIERTA acumula detalles sin afectar existencias (R-09). Al cerrarla, el backend genera en una sola transacción los MovimientoInventario de los productos con controla_stock = true y exactamente un MovimientoCaja INGRESO_VENTA, y la mesa queda DISPONIBLE (R-10). Una sesión sin detalles no puede cerrarse: responde 400 DATOS_INVALIDOS y debe cancelarse (C-05, CU-04).

Medio y estado del pago, para la venta rápida y el cierre de sesión:

- El medio de pago debe estar habilitado en /api/configuracion/pagos/; si no lo está, responde 400 DATOS_INVALIDOS (P-01, CU-22).

- Con EFECTIVO, estado_pago = CONFIRMADO.

- Con TRANSFERENCIA o QR, estado_pago = PENDIENTE_VERIFICACION: el cobro queda registrado, la interfaz muestra la referencia Nequi y la confirmación se realiza en línea mediante la sección 10 (D-06, E-01, R-27, R-28).

- Un movimiento pendiente de verificación no entra en ningún cierre de caja (R-22).

La cancelación solo aplica a sesiones ABIERTA; sobre una venta CERRADA o CANCELADA responde 409 VENTA_YA_CERRADA. La venta cancelada no genera movimientos y la mesa vuelve a DISPONIBLE (R-11).

## 7.1 Mesas

Ruta base: /api/mesas/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| GET | /api/mesas/?activa= | ADMIN, OPERADOR | Lista las mesas con su número y estado; alimenta el mapa de mesas (CU-02, CU-19). |
| POST | /api/mesas/ | ADMIN | Registra una mesa (CU-19). |
| PATCH | /api/mesas/{id}/ | ADMIN | Activa o desactiva una mesa (CU-19). |

### Ejemplo — registrar mesa (CU-19)

// POST /api/mesas/
{
  "operation_id": "7b40...",
  "numero": 7
}

// Response 201
{
  "id": "4c22...",
  "numero": 7,
  "estado": "DISPONIBLE",
  "activa": true
}

La gestión de mesas puede originarse sin conexión, por lo que POST acepta operation_id (R-30). El backend revalida el límite de quince mesas activas al crear o reactivar: en línea responde 409 y, al sincronizar, registra el conflicto LIMITE_MESAS_EXCEDIDO (R-06). Una mesa OCUPADA no puede desactivarse: responde 409 MESA_OCUPADA. No existe DELETE: las mesas se desactivan para conservar el historial de sesiones. El estado DISPONIBLE u OCUPADA es derivado y el cliente no lo escribe.

# 8. Órdenes de trabajo

Ruta base: /api/ordenes-trabajo/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| GET | /api/ordenes-trabajo/?estado= | ADMIN, OPERADOR | Lista o filtra órdenes por estado. |
| POST | /api/ordenes-trabajo/ | ADMIN, OPERADOR | Registra una nueva orden por encargo (CU-06). |
| PATCH | /api/ordenes-trabajo/{id}/estado/ | ADMIN, OPERADOR | Avanza la orden al estado siguiente (CU-07). |
| POST | /api/ordenes-trabajo/{id}/abonos/ | ADMIN, OPERADOR | Registra un abono y recalcula el saldo pendiente (CU-08). |
| POST | /api/ordenes-trabajo/{id}/consumos/ | ADMIN, OPERADOR | Registra un ConsumoOrden pendiente (CU-09). |
| GET | /api/ordenes-trabajo/{id}/consumos/ | ADMIN, OPERADOR | Consulta los consumos registrados en la orden. |
| POST | /api/ordenes-trabajo/{id}/costos/ | ADMIN | Registra un concepto de CostoOperativoOrden (CU-10). |
| GET | /api/ordenes-trabajo/{id}/costos/ | ADMIN | Consulta el desglose de costos y la utilidad neta del servicio (CU-10). |

### Ejemplo — registrar orden (CU-06)

// POST /api/ordenes-trabajo/
{
  "operation_id": "0d51...",
  "cliente_nombre": "Laura Méndez",
  "cliente_telefono": "3104567890",
  "descripcion": "Torta de chocolate para 20 personas",
  "fecha_entrega_estimada": "2026-09-25",
  "costo_total": 75000.00
}

// Response 201
{
  "id": "e5b2...",
  "estado": "RECIBIDO",
  "fecha_solicitud": "2026-09-21T11:02:00-05:00",
  "fecha_entrega_estimada": "2026-09-25",
  "costo_total": 75000.00,
  "saldo_pendiente": 75000.00
}

utilidad_neta solo se incluye en las respuestas al ADMIN (ERD §5.10).

### Ejemplo — cambiar estado de la orden (CU-07)

// PATCH /api/ordenes-trabajo/{id}/estado/
{
  "operation_id": "0d60...",
  "estado": "EN_PROCESO"
}

// Response 200
{
  "id": "e5b2...",
  "estado": "EN_PROCESO"
}

### Ejemplo — registrar abono (CU-08)

// POST /api/ordenes-trabajo/{id}/abonos/
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
  "medio_pago": "EFECTIVO",
  "estado_pago": "CONFIRMADO",
  "saldo_pendiente": 55000.00
}

### Ejemplo — registrar consumo de orden (CU-09)

// POST /api/ordenes-trabajo/{id}/consumos/
{
  "operation_id": "c901...",
  "producto_id": "0aba...",
  "cantidad": 2
}

// Response 201
{
  "id": "cc22...",
  "producto_id": "0aba...",
  "cantidad": 2,
  "estado": "PENDIENTE"
}

Estados de la orden (P-05):

- La orden solo avanza al estado siguiente: RECIBIDO → EN_PROCESO → LISTO → ENTREGADO (R-16, CU-07). Saltar o retroceder un estado responde 400 DATOS_INVALIDOS.

- ENTREGADO es final: cualquier cambio de estado, nuevo consumo o nuevo costo operativo sobre una orden ENTREGADO responde 409 ORDEN_YA_ENTREGADA (R-16).

- El paso a ENTREGADO es atómico. Por cada ConsumoOrden PENDIENTE, genera un MovimientoInventario SALIDA_SERVICIO si el producto tiene controla_stock = true y lo marca APLICADO. Los consumos de productos con controla_stock = false pasan a APLICADO sin generar movimiento (R-15, R-18).

- Si algún producto con controla_stock = true no tiene existencias suficientes, la transición responde 409 STOCK_INSUFICIENTE indicando los productos afectados, la orden permanece en LISTO y no se aplica ningún consumo. La corrección es una operación nueva, por ejemplo un ingreso de mercancía.

Consumos (P-05):

- Se registran en RECIBIDO, EN_PROCESO o LISTO, y quedan PENDIENTE sin mover inventario (R-15).

- Registrar un consumo no valida existencias; la validación ocurre al entregar la orden.

- Un producto inactivo responde 409 PRODUCTO_INACTIVO.

Abonos y utilidad:

- Una orden puede tener múltiples abonos.

- Cada abono genera exactamente un MovimientoCaja INGRESO_ABONO: con EFECTIVO queda CONFIRMADO y con TRANSFERENCIA o QR queda PENDIENTE_VERIFICACION (R-14).

- Un abono que supera el saldo pendiente responde 409 ABONO_EXCEDE_SALDO (R-13).

- La utilidad neta que devuelve GET /api/ordenes-trabajo/{id}/costos/ se calcula en el backend como costo_total menos la suma de los CostoOperativoOrden de la orden (CU-10). No incluye el valor de los insumos consumidos, que se controla en Inventario.

# 9. Inventario

Rutas base: /api/inventario/movimientos/ y /api/inventario/stock/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| GET | /api/inventario/movimientos/?producto= | ADMIN, OPERADOR | Consulta el historial de movimientos de un producto. |
| POST | /api/inventario/movimientos/ | ADMIN, OPERADOR para ENTRADA; ADMIN para MERMA y AJUSTE_MANUAL | Registra un movimiento de inventario (CU-12, CU-13). Para AJUSTE_MANUAL exige sentido. |
| GET | /api/inventario/stock/?categoria=&tipo= | ADMIN, OPERADOR | Consulta el stock actual, filtrable por categoría y tipo, y marca los productos en o por debajo del stock mínimo (CU-11, C-04). |

### Ejemplo — ingreso de mercancía (CU-12)

// POST /api/inventario/movimientos/
{
  "operation_id": "51a0...",
  "producto_id": "0aba...",
  "tipo": "ENTRADA",
  "cantidad": 10,
  "motivo": "Compra de mercancía"
}

### Ejemplo — ajuste manual (CU-13)

// POST /api/inventario/movimientos/
{
  "operation_id": "51a1...",
  "producto_id": "0aba...",
  "tipo": "AJUSTE_MANUAL",
  "sentido": "RESTA",
  "cantidad": 2,
  "motivo": "Conteo físico: faltaban dos unidades"
}

cantidad es siempre positiva. El signo lo determina el tipo y, en AJUSTE_MANUAL, el campo sentido (SUMA o RESTA), obligatorio en ese tipo y ausente en los demás. motivo es obligatorio para MERMA y AJUSTE_MANUAL.

Las salidas originadas por ventas y servicios no se registran manualmente mediante este endpoint: se generan como efecto de las operaciones correspondientes. Los movimientos históricos no se editan; las correcciones son nuevos movimientos de ajuste (R-17).

Los productos con controla_stock = false no llevan existencias propias: no aparecen en las alertas de stock mínimo y no generan salidas al venderse ni al entregarse una orden (R-18).

# 10. Movimientos de caja, gastos y confirmación de pagos

Ruta base: /api/movimientos-caja/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| GET | /api/movimientos-caja/?fecha_desde=&fecha_hasta=&tipo= | ADMIN | Consulta el detalle histórico de movimientos de caja. |
| POST | /api/movimientos-caja/ | ADMIN, OPERADOR | Registra un gasto de caja (CU-14). |
| GET | /api/movimientos-caja/resumen/?fecha= | ADMIN | Resumen del día calculado por el backend (CU-20). |
| GET | /api/movimientos-caja/pendientes/ | ADMIN, OPERADOR | Lista los movimientos con estado_pago = PENDIENTE_VERIFICACION (E-01, P-02). |
| PATCH | /api/movimientos-caja/{id}/confirmar/ | ADMIN, OPERADOR | Confirma la recepción o el pago de un movimiento electrónico. Requiere conexión (E-01, R-28, P-02). |

### Ejemplo — registrar gasto hormiga (CU-14)

// POST /api/movimientos-caja/
{
  "operation_id": "a311...",
  "tipo": "GASTO",
  "medio_pago": "EFECTIVO",
  "valor": 3500.00,
  "concepto": "Compra de bolsas"
}

// Response 201
{
  "id": "m821...",
  "tipo": "GASTO",
  "medio_pago": "EFECTIVO",
  "estado_pago": "CONFIRMADO",
  "valor": 3500.00
}

### Ejemplo — confirmar un pago electrónico (P-02)

// PATCH /api/movimientos-caja/{id}/confirmar/
{
  "operation_id": "c7a2..."
}

// Response 200
{
  "id": "m905...",
  "tipo": "INGRESO_ABONO",
  "abono_id": "bb40...",
  "medio_pago": "TRANSFERENCIA",
  "valor": 26000.00,
  "estado_pago": "CONFIRMADO",
  "fecha": "2026-08-22T15:40:00-05:00",
  "fecha_confirmacion": "2026-08-22T16:05:12-05:00"
}

Reglas de confirmación (P-02):

- Solo un movimiento con estado_pago = PENDIENTE_VERIFICACION puede confirmarse. Confirmar uno ya CONFIRMADO responde 409 PAGO_YA_CONFIRMADO.

- La confirmación registra fecha_confirmacion y actualiza estado_pago en el MovimientoCaja y en su Venta o Abono de origen, dentro de una sola transacción. Los gastos no tienen origen que actualizar.

- Ambos roles pueden confirmar, porque los Casos de Uso asignan la comprobación a «un usuario con conexión» (CU-01, CU-04, CU-08).

- /api/movimientos-caja/pendientes/ solo expone los movimientos pendientes necesarios para esa tarea, no el histórico consolidado, que sigue restringido al ADMIN (ADR-005).

- La confirmación no puede enviarse por /api/sync/: si llega por esa vía se registra como RECHAZADA con PAGO_NO_VERIFICABLE (E-01).

### Ejemplo — resumen diario (CU-20)

// GET /api/movimientos-caja/resumen/?fecha=2026-08-22 — Response 200
{
  "fecha": "2026-08-22",
  "ingresos_ventas": 200000.00,
  "ingresos_abonos": 26000.00,
  "gastos": 3500.00,
  "neto": 222500.00,
  "por_medio_pago": {
    "EFECTIVO": 150000.00,
    "TRANSFERENCIA": 76000.00,
    "QR": 0.00
  },
  "pendiente_verificacion": 26000.00
}

En el ejemplo, las ventas suman 150.000 en efectivo y 50.000 por transferencia ya confirmada. El abono de 26.000 por transferencia sigue pendiente de verificación y el gasto de 3.500 fue en efectivo.

Los totales del resumen incluyen todos los movimientos del día, confirmados o no. pendiente_verificacion indica qué parte de los ingresos todavía no está confirmada y, por lo tanto, no puede incorporarse a un cierre (R-22). por_medio_pago discrimina los ingresos sin descontar gastos (C-06).

Los movimientos INGRESO_VENTA e INGRESO_ABONO los genera el sistema como efecto de las ventas y los abonos; el cliente no los crea directamente. El gasto sí se registra mediante este recurso. Cada venta cerrada tiene un único movimiento de caja asociado. Los totales los calcula el backend y no se derivan en el cliente.

# 11. Cierre de caja

Ruta base: /api/cierres-caja/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| GET | /api/cierres-caja/?fecha= | ADMIN | Consulta el histórico de cierres. |
| POST | /api/cierres-caja/ | ADMIN | Calcula los totales del período a partir de MovimientoCaja y registra el cierre (CU-15). |

### Ejemplo — cierre de caja (CU-15)

// POST /api/cierres-caja/
{
  "operation_id": "f0c1...",
  "fecha": "2026-08-22",
  "efectivo_contado": 146500.00,
  "observaciones": "Sin novedades"
}

// Response 201
{
  "id": "c921...",
  "fecha": "2026-08-22",
  "total_ingresos_ventas": 200000.00,
  "total_ingresos_abonos": 0.00,
  "total_gastos": 3500.00,
  "total_neto": 196500.00,
  "efectivo_esperado": 146500.00,
  "efectivo_contado": 146500.00,
  "diferencia": 0.00
}

El ejemplo corresponde al mismo día del resumen de la sección 10. El abono de 26.000 no entra porque sigue pendiente de verificación. El efectivo esperado es 150.000 de ventas en efectivo menos 3.500 del gasto en efectivo (C-06).

Condiciones y cálculo:

- El cierre requiere conexión y solo incluye movimientos con estado_pago = CONFIRMADO (R-22).

- El servidor rechaza el cierre si quedan operaciones pendientes de sincronizar (E-05).

- operation_id protege contra un doble envío del mismo cierre (ERD §5.16).

- Los totales no se envían desde el cliente: el servidor los calcula y asocia los movimientos al cierre mediante cierre_caja_id.

- efectivo_contado lo aporta el Administrador durante el arqueo, y diferencia es efectivo_contado menos efectivo_esperado. observaciones es obligatorio cuando la diferencia no es cero.

- CierreCaja funciona como resumen o corte; MovimientoCaja conserva el detalle histórico.

La forma de calcular periodo_inicio y periodo_fin, y la inclusión de movimientos confirmados después de su fecha, quedan pendientes de definir porque dependen de corregir R-22 y R-25 en el ERD (sección 17).

# 12. Configuración de módulos

Ruta base: /api/configuracion/modulos/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| GET | /api/configuracion/modulos/ | ADMIN, OPERADOR | Consulta el estado de los módulos. La lectura es necesaria para que la interfaz del Operador sepa qué ocultar. |
| PATCH | /api/configuracion/modulos/ | ADMIN | Activa o desactiva Ventas, Inventario, Servicios o Finanzas (CU-16). |

### Ejemplo — configuración de módulos

// PATCH /api/configuracion/modulos/
{
  "ventas_activo": true,
  "inventario_activo": true,
  "servicios_activo": true,
  "finanzas_activo": false
}

### Rutas controladas por cada bandera (P-04)

| **Bandera** | **Rutas que se bloquean al desactivarla** |
| --- | --- |
| ventas_activo | /api/mesas/ y /api/ventas/ con todas sus acciones. |
| inventario_activo | /api/inventario/movimientos/ y /api/inventario/stock/. |
| servicios_activo | /api/ordenes-trabajo/ con todos sus subrecursos. |
| finanzas_activo | /api/movimientos-caja/ (incluidos resumen, pendientes y confirmar) y /api/cierres-caja/. |
| Ninguna (núcleo) | /api/auth/, /api/usuarios/, /api/dispositivos/, /api/categorias/, /api/productos/, /api/configuracion/ y /api/sync/. |

Reglas (P-04):

- Una ruta bloqueada responde 403 MODULO_DESACTIVADO en todos sus métodos. Una operación de ese módulo recibida por /api/sync/ se registra como RECHAZADA con el mismo código (R-05).

- El catálogo (categorías y productos) forma parte del núcleo y no depende de ninguna bandera, porque tanto Ventas como Servicios lo necesitan: si dependiera de Inventario, desactivar ese módulo impediría vender.

- Las banderas controlan el acceso a las rutas, no los efectos internos. Cerrar una venta con Inventario o Finanzas desactivados sigue generando sus MovimientoInventario y su MovimientoCaja, para que existencias y caja permanezcan consistentes si el módulo se reactiva.

- Desactivar un módulo no elimina datos ni código. El frontend oculta sus funcionalidades.

## 12.1 Configuración de pagos

Ruta base: /api/configuracion/pagos/

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| GET | /api/configuracion/pagos/ | ADMIN, OPERADOR | Consulta los medios aceptados y la referencia Nequi a mostrar al cliente (CU-22). |
| PATCH | /api/configuracion/pagos/ | ADMIN | Modifica los medios aceptados y la llave Nequi. Requiere conexión (E-03, D-06). |

### Ejemplo — configuración de pagos (CU-22)

// PATCH /api/configuracion/pagos/
{
  "acepta_efectivo": true,
  "acepta_transferencia": true,
  "acepta_qr": true,
  "nequi_titular": "Aroma & Co.",
  "nequi_llave": "3001234567"
}

SADIM no integra pasarela de pagos: la llave Nequi es un dato de referencia que se muestra al cliente y que el sistema nunca consulta ni valida. Es obligatoria si acepta_transferencia o acepta_qr están en true; si falta, responde 400 DATOS_INVALIDOS. El servidor registra actualizado_por_id y actualizado_en en cada modificación (ERD §5.4). El Operador necesita la lectura para mostrar la referencia al cobrar; solo el ADMIN la modifica (R-29). Las ventas, abonos y gastos solo aceptan medios habilitados (sección 7).

# 13. Sincronización offline

La API recibe las operaciones creadas localmente por la PWA. El cliente mantiene las operaciones pendientes en IndexedDB y las envía al recuperar conectividad, en el mismo orden en que fueron creadas.

Cada solicitud a /api/sync/ incluye el encabezado X-Device-Id con el identificador del dispositivo (D-04). Si no corresponde a un dispositivo activo y autorizado para offline, se rechaza el lote completo con DISPOSITIVO_NO_AUTORIZADO.

| **Método** | **Endpoint** | **Rol requerido** | **Descripción** |
| --- | --- | --- | --- |
| POST | /api/sync/ | Autenticado | Recibe una o varias operaciones pendientes y las procesa de forma idempotente mediante operation_id. |
| GET | /api/sync/novedades/?atendida=false | ADMIN, OPERADOR | Lista las operaciones sincronizadas con estado RECHAZADA o CONFLICTO pendientes de revisión (CU-23). |
| PATCH | /api/sync/novedades/{id}/ | ADMIN, OPERADOR | Marca una novedad como atendida. Requiere conexión (CU-23). |

### Ejemplo — operación pendiente

// POST /api/sync/ — encabezado X-Device-Id: 2d9e...
{
  "operations": [
    {
      "operation_id": "d921...",
      "resource": "ventas.detalles",
      "action": "CREATE",
      "payload": {
        "id": "9e02...",
        "venta_id": "7f31...",
        "producto_id": "0aba...",
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
      "estado": "APLICADA",
      "objeto_id": "9e02..."
    }
  ]
}

Los valores posibles de estado son APLICADA, DUPLICADA, RECHAZADA y CONFLICTO (ERD §8.2). Cuando el estado es RECHAZADA o CONFLICTO, la respuesta incluye además codigo_conflicto y mensaje.

Toda operación recibida queda registrada en OperacionSincronizacion, incluidas las rechazadas o en conflicto, para que el usuario las revise (R-33). Los conflictos de operaciones transaccionales no se resuelven mediante Last Write Wins: se validan según las reglas de negocio y el estado actual de la información, y su corrección es siempre una operación nueva y trazable (R-31).

## 13.1 Idempotencia (P-03)

Toda solicitud de escritura que incluya operation_id —en línea o por /api/sync/— queda registrada en OperacionSincronizacion con su resultado. Esto incluye las acciones que no crean filas, como cerrar o cancelar una venta, cambiar el estado de una orden o confirmar un pago. Antes de aplicar cualquier efecto, el servidor busca el operation_id:

- Si no existe, procesa la operación y registra el resultado.

- Si existe y la operación se procesó en línea, no aplica efectos y responde con el mismo código HTTP de la respuesta original: el estado actual del objeto afectado si fue exitosa, o el mismo error si fue rechazada. Así, un reintento por falla de red de un cierre de venta devuelve 200 con la venta cerrada, y no 409 VENTA_YA_CERRADA.

- Si existe y la operación llega por /api/sync/, responde estado DUPLICADA e incluye estado_original (APLICADA, RECHAZADA o CONFLICTO) y, cuando corresponda, codigo_conflicto y mensaje. Así el cliente no pierde un rechazo cuya primera respuesta no alcanzó a recibir.

- El cliente genera un operation_id nuevo por cada operación. Reutilizar uno ya procesado devuelve siempre el resultado original, aunque cambie el contenido.

Las novedades de /api/sync/novedades/ solo incluyen operaciones recibidas por sincronización: una operación rechazada en línea ya se informó al usuario en la respuesta HTTP.

Mientras HU-045 no esté implementada, un operation_id repetido al crear categorías o productos responde 400 DATOS_INVALIDOS (comportamiento provisional del Sprint 2, D6).

# 14. Códigos HTTP y errores

## 14.1 Códigos HTTP

| **Código** | **Nombre** | **Uso en SADIM** |
| --- | --- | --- |
| 200 | OK | Consulta o modificación procesada correctamente. |
| 201 | Created | Recurso creado correctamente. |
| 400 | Bad Request | Datos inválidos: estructura, validaciones de campo, parámetros de consulta o transición no permitida. |
| 401 | Unauthorized | Autenticación ausente, inválida o expirada, o credenciales incorrectas en el inicio de sesión. |
| 403 | Forbidden | Usuario autenticado sin permisos suficientes, módulo desactivado o dispositivo no autorizado. |
| 404 | Not Found | Recurso solicitado inexistente. |
| 405 | Method Not Allowed | Método HTTP no definido para la ruta (D3). |
| 409 | Conflict | Conflicto de estado, duplicidad u operación incompatible con el estado actual. |
| 500 | Internal Server Error | Error inesperado del servidor, sin exponer detalles internos. |

Todas las respuestas de error mantienen la estructura {code, message, details}:

{
  "code": "STOCK_INSUFICIENTE",
  "message": "No hay existencias suficientes para completar la operación.",
  "details": {
    "producto_id": "0aba...",
    "stock_disponible": 1,
    "cantidad_solicitada": 3
  }
}

message está en español y es apto para mostrarse al usuario. En DATOS_INVALIDOS, details contiene una clave por cada campo o parámetro inválido con su mensaje, por ejemplo {“tipo”: “Debe ser uno de: INSUMO_PRODUCCION, REVENTA_DIRECTA.”}. En los demás códigos, details puede estar vacío.

## 14.2 Códigos compartidos con la sincronización

El campo code proviene de un catálogo cerrado. Los códigos de esta tabla son compartidos con la sección 8.4 del ERD: una operación en línea y la misma operación sincronizada producen el código idéntico, que /api/sync/ devuelve en codigo_conflicto.

| **Código** | **Estado en sincronización** | **HTTP** | **Situación que lo produce** |
| --- | --- | --- | --- |
| DISPOSITIVO_NO_AUTORIZADO | RECHAZADA | 403 | El X-Device-Id no corresponde a un dispositivo activo y autorizado. Se rechaza el lote completo. |
| PERMISO_INSUFICIENTE | RECHAZADA | 403 | El rol del usuario no permite la operación. |
| MODULO_DESACTIVADO | RECHAZADA | 403 | El módulo al que pertenece la ruta está desactivado (sección 12). |
| DATOS_INVALIDOS | RECHAZADA | 400 | El contenido no cumple la estructura, las validaciones de campo o una transición permitida. |
| PAGO_NO_VERIFICABLE | RECHAZADA | 400 | Se intenta sincronizar un pago electrónico marcado como confirmado o una confirmación de pago. |
| STOCK_INSUFICIENTE | CONFLICTO | 409 | Las existencias del servidor ya no alcanzan para aplicar la salida. |
| PRODUCTO_INACTIVO | CONFLICTO | 409 | El producto está desactivado. |
| PRODUCTO_CON_EXISTENCIAS | CONFLICTO | 409 | Se intenta cambiar controla_stock en un producto con stock_actual distinto de cero (P-07). |
| VENTA_YA_CERRADA | CONFLICTO | 409 | Se intenta modificar, cerrar o cancelar una venta que ya está CERRADA o CANCELADA. |
| MESA_OCUPADA | CONFLICTO | 409 | Se intenta abrir una sesión en una mesa con sesión ABIERTA, o desactivar una mesa OCUPADA. |
| LIMITE_MESAS_EXCEDIDO | CONFLICTO | 409 | La operación superaría las quince mesas activas permitidas. |
| ORDEN_YA_ENTREGADA | CONFLICTO | 409 | Se intenta registrar un consumo, un costo o un cambio de estado sobre una orden ya ENTREGADO. |
| ABONO_EXCEDE_SALDO | CONFLICTO | 409 | El abono supera el saldo pendiente de la orden. |
| MOVIMIENTO_EN_PERIODO_CERRADO | CONFLICTO | 409 | El movimiento corresponde a un período con CierreCaja ya realizado. |

## 14.3 Códigos exclusivos de la API en línea

Estos códigos corresponden a fallas de la propia petición HTTP o a operaciones que requieren conexión, por lo que nunca aparecen en /api/sync/.

| **Código** | **HTTP** | **Situación que lo produce** |
| --- | --- | --- |
| NO_AUTENTICADO | 401 | Falta el token de acceso, es inválido o expiró; también un refresh_token inválido (D1). |
| CREDENCIALES_INVALIDAS | 401 | Contraseña incorrecta, usuario inexistente o inactivo en el inicio de sesión, con el mismo mensaje en los tres casos (D1). |
| RECURSO_NO_ENCONTRADO | 404 | El identificador de la ruta no corresponde a ningún recurso (D1). |
| METODO_NO_PERMITIDO | 405 | El método HTTP no está definido para la ruta (D1, D3). |
| INSTALACION_YA_INICIALIZADA | 409 | Se intenta el registro inicial en una instalación que ya tiene usuarios (D1). |
| ULTIMO_ADMIN_ACTIVO | 409 | El cambio dejaría la instalación sin un ADMIN activo (R-04, P-06). |
| PAGO_YA_CONFIRMADO | 409 | Se intenta confirmar un movimiento que ya está CONFIRMADO (P-02). |
| ERROR_INTERNO | 500 | Error inesperado; el mensaje no expone detalles internos (D1). |

# 15. Trazabilidad con los artefactos anteriores

| **Artefacto** | **Decisión / caso** | **Reflejo en API** |
| --- | --- | --- |
| ADR-001 | PostgreSQL | Persistencia relacional del backend. |
| ADR-002 | Monolito modular + DRF | API REST única organizada por recursos y módulos. |
| ADR-004 | Offline-first | UUID, operation_id, /api/sync/ e idempotencia (sección 13.1). |
| ADR-004 | Un solo dispositivo offline | /api/dispositivos/ y encabezado X-Device-Id. |
| D-06, E-01, R-28 | Pagos sin pasarela | /api/configuracion/pagos/, estado_pago y confirmación en /api/movimientos-caja/. |
| ADR-005 | RBAC | ADMIN y OPERADOR aplicados en permission classes. |
| ADR-006, D-03 | Módulos configurables | /api/configuracion/modulos/ y mapa de rutas por bandera. |
| ADR-007 | Un negocio por instalación | No se expone business_id ni tenant_id en los recursos del alcance actual. |
| ADR-008 | MovimientoCaja | Ventas y abonos generan ingresos; gastos se registran explícitamente. |
| CU-01 a CU-04, CU-19 | Ventas | /api/ventas/ y /api/mesas/. |
| CU-05 | Catálogo (núcleo) | /api/categorias/ y /api/productos/. |
| CU-06 a CU-10 | Servicios | /api/ordenes-trabajo/, abonos, consumos y costos. |
| CU-11 a CU-13 | Inventario | /api/inventario/movimientos/ y /api/inventario/stock/. |
| CU-14, CU-15, CU-20 | Finanzas | /api/movimientos-caja/, su resumen y /api/cierres-caja/. |
| CU-16 | Configuración de módulos | /api/configuracion/modulos/. |
| CU-17 | Autenticación | /api/auth/register/, login y refresh. |
| CU-18 | Gestión de usuarios | /api/usuarios/. |
| CU-21 | Dispositivos autorizados | /api/dispositivos/. |
| CU-22 | Medios de pago | /api/configuracion/pagos/. |
| CU-23 | Novedades de sincronización | /api/sync/novedades/. |

# 16. Límites del contrato

Este documento no fija la implementación exacta de serializers, ViewSets, services, permissions, transacciones internas, estructura detallada de IndexedDB ni el formato final de documentación OpenAPI/Swagger. Esas decisiones se toman durante la implementación, manteniendo este contrato como referencia. Todavía no definidos: el catálogo cerrado de valores de resource en /api/sync/ y el tratamiento de un pago electrónico que nunca llega (sección 17).

# 17. Ajustes pendientes en otros documentos

Este contrato no modifica el ERD, los Casos de Uso ni el ADR. Los ajustes siguientes deben aplicarse en esos documentos antes de implementar las historias indicadas; mientras tanto, prevalece lo que diga el documento de origen.

| **Documento** | **Ajuste requerido** | **Origen** | **Antes de** |
| --- | --- | --- | --- |
| ERD §5.17 | Permitir registrar operaciones en línea: dispositivo_id NULL cuando la operación no llega por sincronización, nuevo atributo origen (EN_LINEA o SINCRONIZACION) y fecha_cliente igual a la fecha de recepción en línea. | P-03 | HU-045 |
| ERD D-03 y §3.1 | Categoria y Producto pasan al núcleo, sin bandera; aclarar que las banderas bloquean rutas y no efectos internos. | P-04 | HU-042 |
| ERD §8.4 | Agregar PRODUCTO_CON_EXISTENCIAS. En PRODUCTO_INACTIVO, quitar «o eliminado» (no existe DELETE). En VENTA_YA_CERRADA, incluir la cancelación. En ORDEN_YA_ENTREGADA, incluir los costos. En PAGO_NO_VERIFICABLE, incluir las confirmaciones de pago recibidas por sincronización. | P-02, P-05, P-07 | HU-015, HU-041 |
| ERD §5.1 | Documentar que password_hash se implementa sobre el campo de contraseña de Django (VARCHAR(255)) y los campos técnicos que agrega el framework. | D8 | Sprint 3 |
| ERD §4 y §5 | Convención: todas las claves foráneas del dominio usan PROTECT; nada se borra físicamente. | D7 | Sprint 3 |
| ERD §9.2 | Ubicar CU-23: marcar una novedad como atendida requiere conexión. | Revisión | HU-052 |
| ERD R-22, R-25 y §5.16 | Un movimiento confirmado después de su fecha nunca cae dentro del período de un cierre posterior; MOVIMIENTO_EN_PERIODO_CERRADO figura como CONFLICTO, que significa «no se aplica»; y no se define cómo se calculan periodo_inicio y periodo_fin. | Revisión | HU-028 |
| ERD D-04 y §5.17 | Un X-Device-Id que no existe en Dispositivo no puede registrarse con dispositivo_id NOT NULL; y si el lote rechazado queda registrado, reenviarlo tras autorizar el dispositivo produciría DUPLICADA. | Revisión | HU-032, HU-051 |
| ERD §5.17 | Catálogo cerrado de valores de recurso, alineado con las rutas de este contrato. | Revisión | HU-032 |
| ERD §5.9 y §8.5 | Definir qué precio aplica a un detalle registrado offline si el precio del producto cambió antes de sincronizar. | Revisión | HU-030 |
| ERD §8.3, CU-01, CU-04, CU-08 | Definir cómo se anula un cobro PENDIENTE_VERIFICACION que nunca se recibe. | P-02 | HU-050 |
| CU-09 | Precondición: permitir consumos en RECIBIDO, EN_PROCESO o LISTO; reemplazar «al finalizar o entregar» por «al entregar». | P-05 | HU-041 |
| CU-18 | Precisar los campos editables y que la instalación tiene un único ADMIN. | P-06 | HU-044 |
| ADR-005 | Agregar a la tabla de permisos la consulta y confirmación de pagos pendientes para ambos roles. | P-02 | HU-050 |
