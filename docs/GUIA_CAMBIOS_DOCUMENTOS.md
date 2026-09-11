# Guía de cambios en los documentos de SADIM (HU-047)

Esta guía aplica, documento por documento, las correcciones de la revisión de consistencia. Está pensada para hacerse en Word, con la guía abierta al lado.

## Cómo usar la guía

1. Abre el documento en Word.
2. Para cada paso, presiona **Ctrl+F** (en Mac, **Cmd+F**) y pega el texto de **"Busca"**. Así llegas al lugar exacto.
3. Haz lo que dice **"Cambia a"** o **"Agrega"**. Los textos entre recuadros están listos para copiar y pegar.
4. Marca la casilla `[ ]` cuando termines el paso.

Guarda cada documento como una versión nueva (por ejemplo `02_ERD_SADIM_v3.docx`) para conservar la anterior.

**Orden recomendado:** 1) ERD → 2) Contrato API → 3) Casos de Uso → 4) ADR → 5) Anteproyecto. El ERD va primero porque los demás documentos dependen de sus nombres y campos.

**Pasos con ⚠️:** dependen de una decisión que sigue abierta en la hoja **Decisiones pendientes** del backlog. El texto sugerido asume la propuesta de esa hoja. Si deciden otra cosa, sáltense ese paso y me avisan para ajustar el texto.

---

## 1. ERD — `02_ERD_SADIM_v2`

**[ ] 1.1 Encabezado de la portada**
- Busca: `Sprint 1 — Diseño del sistema y arquitectura`
- Cambia a: `Sprint 1 — Análisis, arquitectura y diseño · Revisión 2 (septiembre 2026)`

> Por qué: el backlog llama así al Sprint 1. Haz este mismo cambio en los cuatro documentos técnicos.

**[ ] 1.2 Número del primer título**
- Busca: `E1. Alcance del modelo de datos`
- Cambia a: `1. Alcance del modelo de datos`

**[ ] 1.3 DetalleVenta: corregir `venta_id` (el error más importante)**
- Ve a la tabla **4.7 DetalleVenta**, fila `venta_id`.
- Columna Restricción: cambia `FK → Venta, UNIQUE, NULL` por `FK → Venta, NOT NULL`
- Columna Descripción: cambia el texto por `Venta o sesión a la que pertenece la línea.`

> Por qué: "UNIQUE" significa "no se puede repetir". Con esa restricción, una venta solo podría tener **una** línea de detalle: vender un café y un pan de queso juntos sería imposible. Además decía NULL (opcional), pero una línea sin venta no tiene sentido. Fue un error de copiar y pegar la fila de MovimientoCaja.

**[ ] 1.4 DetalleVenta: agregar `operation_id`**
- En la misma tabla 4.7, inserta una fila debajo de `id`:

| operation_id | UUID | UNIQUE, NOT NULL | Identificador de operación para sincronización idempotente. |
|---|---|---|---|

> Por qué: el Contrato API ya envía `operation_id` al agregar productos a una sesión (§7 y §13). Sin este campo, si el celular reenvía la operación al recuperar internet, el producto se agregaría dos veces.

**[ ] 1.5 Agregar `operation_id` en tres tablas más**
- Inserta la misma fila del paso 1.4 debajo de `id` en: **4.3 Categoria**, **4.4 Producto** y **4.11 CostoOperativoOrden**.

> Por qué: son operaciones que los casos de uso permiten hacer sin conexión (CU-05 y CU-10), y el Contrato ya muestra `operation_id` al crear un producto.

**[ ] 1.6 MovimientoInventario: corregir `venta_id`**
- Tabla **4.12**, fila `venta_id`.
- Restricción: cambia `FK → Venta, UNIQUE, NULL` por `FK → Venta, NULL`
- Descripción: `Venta cerrada que originó la salida, cuando corresponda.`

> Por qué: una venta de 3 productos genera 3 salidas de inventario, todas con la misma venta. UNIQUE lo impediría. La tabla de relaciones (§3) ya dice que es 1:N.

**[ ] 1.7 MovimientoInventario: indicar si el ajuste suma o resta**
- En la tabla 4.12, inserta una fila debajo de `cantidad`:

| sentido | ENUM | NULL | SUMA o RESTA. Obligatorio cuando tipo = AJUSTE_MANUAL. En los demás tipos lo define el tipo: ENTRADA suma; SALIDA_VENTA, SALIDA_SERVICIO y MERMA restan. |
|---|---|---|---|

> Por qué: `cantidad` siempre es positiva (CHECK > 0), así que un ajuste manual no tenía forma de decir si corrige hacia arriba o hacia abajo.

**[ ] 1.8 MovimientoCaja: `abono_id` único y vínculo con el cierre**
- Tabla **4.13**, fila `abono_id`. Restricción: `FK → Abono, UNIQUE, NULL`. Descripción: `Abono que originó el ingreso; un abono genera un solo movimiento.`
- Inserta una fila al final de la tabla:

| cierre_caja_id | UUID | FK → CierreCaja, NULL | Cierre que incluyó el movimiento; NULL mientras el período no se haya cerrado. |
|---|---|---|---|

> Por qué: la relación "un cierre agrupa muchos movimientos" (§3) no tenía cómo guardarse. Con este campo se sabe qué movimientos entraron en cada cierre y ninguno se cuenta dos veces.

**[ ] 1.9 CierreCaja: efectivo contado**
- Tabla **4.14**, inserta dos filas antes de `observaciones`:

| efectivo_contado | DECIMAL(10,2) | NOT NULL | Efectivo físico contado por el Administrador. |
|---|---|---|---|
| diferencia_efectivo | DECIMAL(10,2) | CALCULADO | efectivo_contado − efectivo esperado (ingresos en efectivo − gastos en efectivo del período). |

> Por qué: CU-15 dice que el Administrador compara el efectivo esperado con el contado, pero no había dónde guardar ese dato.

**[ ] 1.10 Usuario: aclarar la contraseña**
- Tabla **4.1**, fila `password_hash`, al final de la descripción agrega: ` En Django corresponde al campo password del modelo de usuario, que ya almacena el hash.`

**[ ] 1.11 Numerar las reglas de negocio**
- Ve a **5. Reglas de integridad y negocio**. Escribe al inicio de cada viñeta su código, en este orden:

| Código | La viñeta que empieza con… |
|---|---|
| RN-01 | "La configuración de módulos pertenece…" |
| RN-02 | "Una instalación puede tener como máximo 15 mesas…" |
| RN-03 | "Una Venta de tipo SESION_DINAMICA debe tener mesa_id…" |
| RN-04 | "Una mesa no puede tener más de una Venta…" |
| RN-05 | "Una Venta ABIERTA puede acumular DetalleVenta…" |
| RN-06 | "Una Venta CERRADA genera exactamente…" |
| RN-07 | "Una OrdenTrabajo puede tener cero, uno o muchos Abonos…" |
| RN-08 | "Un Abono confirmado genera…" |
| RN-09 | "Un ConsumoOrden permanece PENDIENTE…" |
| RN-10 | "Los gastos hormiga se registran…" |
| RN-11 | "Los movimientos de inventario son históricos…" |
| RN-12 | "El stock_actual es un valor derivado…" |
| RN-13 | "Los campos operation_id son únicos…" |
| RN-14 | "Los pagos electrónicos no se consideran confirmados…" |
| RN-15 | "El acceso a CostoOperativoOrden…" |

- Agrega esta viñeta al final:

```
RN-16: Una Venta en estado ABIERTA puede cancelarse: queda CANCELADA, sin efectos sobre inventario ni caja, y la mesa asociada queda DISPONIBLE.
```

> Por qué: el backlog citaba RN-01, RN-03 y RN-04 sin que existieran. Ya quedó actualizado con esta numeración.

**[ ] 1.12 ⚠️ Pagos electrónicos (decisión "Pagos electrónicos")**
- Busca: `su confirmación requiere conectividad según el flujo definido para el sistema.`
- Cambia a: `su confirmación requiere conectividad: sin conexión solo puede cerrarse una venta o registrarse un abono en EFECTIVO; con TRANSFERENCIA o QR la operación espera conexión y la confirmación del usuario de que recibió el pago.`

**[ ] 1.13 ⚠️ Productos sin control de stock (decisión "Recetas", opción A)**
- Tabla **4.4 Producto**, inserta una fila debajo de `stock_minimo`:

| controla_stock | BOOLEAN | NOT NULL, DEFAULT true | Si es false (p. ej. un tinto preparado al momento), la venta no valida ni descuenta existencias. |
|---|---|---|---|

- Agrega en §5 la viñeta: `RN-17: Los productos con controla_stock = false no validan ni descuentan inventario al venderse; sus insumos se controlan mediante ingresos, consumos de órdenes, mermas y ajustes.`

> Por qué: hoy, un tinto tendría stock 0 y CU-01 no permitiría venderlo. Esta es la solución más simple; la alternativa (recetas) está en la hoja Decisiones pendientes.

**[ ] 1.14 Relación de cierre**
- Tabla de §3, fila `CierreCaja 1:N MovimientoCaja`. Al final de la descripción agrega: ` Se implementa con MovimientoCaja.cierre_caja_id.`

---

## 2. Contrato API — `05_Contrato_API_SADIM`

**[ ] 2.1 Encabezado:** igual que el paso 1.1.

**[ ] 2.2 Módulos desactivados (§2)**
- Al final de la lista de "Convenciones generales", agrega:

```
Si el módulo al que pertenece una ruta está desactivado, el backend responde 403 con code MODULE_DISABLED.
```

**[ ] 2.3 Usuarios (§4):** en la fila `POST /api/usuarios/`, al final de la descripción agrega ` (CU-18).` Debajo de la tabla agrega: `Un usuario con activo = false no puede iniciar sesión.`

**[ ] 2.4 Productos (§6) ⚠️ (solo si aplicaron el paso 1.13):** en el ejemplo de creación de producto, agrega la línea `"controla_stock": true,` debajo de `"stock_minimo": 10`, con la coma que corresponda.

**[ ] 2.5 Nueva sección de Mesas**
- Justo antes del título **"8. Órdenes de trabajo"**, pega:

```
7.1 Mesas

Ruta base: /api/mesas/

| Método | Endpoint           | Rol requerido     | Descripción |
| GET    | /api/mesas/        | ADMIN, OPERADOR   | Lista las mesas con número, activa, estado y venta_abierta_id (si tiene una sesión ABIERTA). Alimenta el mapa de mesas. |
| POST   | /api/mesas/        | ADMIN             | Registra una mesa (numero entre 1 y 15). Se rechaza si ya hay 15 mesas activas (CU-19). |
| PATCH  | /api/mesas/{id}/   | ADMIN             | Activa o desactiva una mesa. No se puede desactivar una mesa OCUPADA (CU-19). |

Ejemplo — registrar mesa
{
  "numero": 3
}
// Response 201
{
  "id": "5d10...",
  "numero": 3,
  "activa": true,
  "estado": "DISPONIBLE"
}
```

> Por qué: CU-02 exige una "mesa activa disponible", pero no había forma de crear ni listar mesas.

**[ ] 2.6 Cancelar sesión (§7)**
- En la tabla de Ventas, agrega una fila al final:

| PATCH | /api/ventas/{id}/cancelar/ | ADMIN, OPERADOR | Cancela una venta o sesión ABIERTA: queda CANCELADA sin efectos de inventario ni caja y libera la mesa (RN-16). Recibe operation_id. |
|---|---|---|---|

**[ ] 2.7 ⚠️ Pagos electrónicos (§7)**
- Busca: `Para medios electrónicos como TRANSFERENCIA o QR, la confirmación del pago requiere conectividad.`
- Cambia a: `Sin conexión solo se acepta EFECTIVO al cerrar. Con TRANSFERENCIA o QR, el cierre se envía cuando hay conexión y el usuario confirma que recibió el pago; mientras tanto la sesión permanece ABIERTA.`

**[ ] 2.8 Consumos al entregar (§8)**
- Al final del párrafo que termina en `…se generan los movimientos de salida de inventario correspondientes.` agrega: ` Esto ocurre cuando PATCH /estado/ cambia la orden a ENTREGADO, en la misma transacción.`

**[ ] 2.9 Ajustes de inventario (§9)**
- Debajo del ejemplo de ingreso de mercancía, pega:

```
Ejemplo — ajuste manual (CU-13, solo ADMIN)
{
  "operation_id": "71b2...",
  "producto_id": "f21c...",
  "tipo": "AJUSTE_MANUAL",
  "sentido": "RESTA",
  "cantidad": 2,
  "motivo": "Diferencia encontrada en conteo físico"
}

motivo es obligatorio para MERMA y AJUSTE_MANUAL; sentido es obligatorio para AJUSTE_MANUAL.
```

**[ ] 2.10 Resumen diario de caja (§10)**
- En la tabla de movimientos de caja agrega la fila:

| GET | /api/movimientos-caja/resumen/?fecha= | ADMIN | Resumen del día calculado por el servidor: ingresos por ventas, ingresos por abonos, gastos y neto, discriminados por medio de pago (CU-20). |
|---|---|---|---|

- Y debajo del ejemplo de gasto, pega:

```
Ejemplo — resumen diario (CU-20)
// GET /api/movimientos-caja/resumen/?fecha=2026-09-20
// Response 200
{
  "fecha": "2026-09-20",
  "ingresos_ventas": 180000.00,
  "ingresos_abonos": 40000.00,
  "gastos": 12000.00,
  "neto": 208000.00,
  "por_medio_pago": {
    "EFECTIVO": 120000.00,
    "TRANSFERENCIA": 60000.00,
    "QR": 40000.00
  }
}
```

**[ ] 2.11 Cierre de caja (§11)**
- Reemplaza el ejemplo completo del cierre por:

```
Ejemplo — cierre de caja (CU-15)
{
  "fecha": "2026-08-22",
  "efectivo_contado": 150000.00,
  "observaciones": "Sin novedades"
}

// Response 201
{
  "id": "c921...",
  "fecha": "2026-08-22",
  "total_ingresos": 226000.00,
  "total_gastos": 0.00,
  "total_neto": 226000.00,
  "totales_por_medio_pago": {
    "EFECTIVO": 150000.00,
    "TRANSFERENCIA": 50000.00,
    "QR": 26000.00
  },
  "efectivo_esperado": 150000.00,
  "diferencia_efectivo": 0.00
}
```

- Debajo, agrega: `El cierre requiere conexión. Los movimientos incluidos quedan asociados al cierre (cierre_caja_id) y no pueden incluirse en otro.`

**[ ] 2.12 Configuración de módulos (§12)**
- En la fila `GET /api/configuracion/modulos/`, cambia el rol `ADMIN` por `ADMIN, OPERADOR (solo lectura)`.

> Por qué: la pantalla del Operador necesita saber qué módulos están apagados para ocultarlos. Con solo ADMIN, la app del Operador no podría saberlo.

**[ ] 2.13 Sincronización (§13)**
- Al final de la sección agrega: `Valores posibles de status: APPLIED (aplicada), ALREADY_PROCESSED (ya se había aplicado; no se repite) y REJECTED (incumple una regla de negocio; incluye code y message para mostrar al usuario).`

**[ ] 2.14 Catálogo de códigos de error (§14)**
- Debajo del ejemplo de error, pega:

```
Códigos de error de negocio
| code                 | HTTP | Cuándo |
| VALIDATION_ERROR     | 400  | Datos inválidos o faltantes. |
| INSUFFICIENT_STOCK   | 400  | Cantidad mayor al stock disponible. |
| ABONO_EXCEDE_SALDO   | 400  | El abono supera el saldo pendiente. |
| PERMISSION_DENIED    | 403  | El rol no tiene permiso. |
| MODULE_DISABLED      | 403  | El módulo de la ruta está desactivado. |
| MESA_OCUPADA         | 409  | La mesa ya tiene una sesión ABIERTA. |
| TRANSICION_INVALIDA  | 409  | Cambio de estado no permitido. |
```

**[ ] 2.15 Trazabilidad (§15):** agrega tres filas: `CU-18 | Usuarios | /api/usuarios/`, `CU-19 | Mesas | /api/mesas/` y `CU-20 | Resumen de caja | /api/movimientos-caja/resumen/`.

---

## 3. Casos de Uso — `03_Casos_de_Uso_SADIM`

**[ ] 3.1 Encabezado:** igual que el paso 1.1.

**[ ] 3.2 Cantidad de casos**
- Busca: `Se documentan 17 casos de uso`
- Cambia a: `Se documentan 20 casos de uso`

**[ ] 3.3 CU-07 sube a prioridad Alta**
- En la tabla del Módulo 2, fila CU-07: cambia `Media` por `Alta`. En el detalle de CU-07, línea "Prioridad": `Alta`.

> Por qué: pasar la orden a ENTREGADO es lo que aplica los consumos al inventario; sin CU-07 el Módulo 2 no se cierra. HU-021 ya estaba en Alta.

**[ ] 3.4 CU-15 requiere conexión**
- En la tabla del Módulo 3, fila CU-15, columna Conexión: cambia `No (offline-first)` por `Sí: el servidor calcula los totales`.
- En el detalle de CU-15, Precondiciones, agrega al final: ` Dispositivo con conexión.`
- Busca: `El Administrador compara el efectivo esperado con el efectivo físico contado.`
- Cambia a: `El Administrador registra el efectivo físico contado y el sistema calcula la diferencia con el efectivo esperado.`

> Por qué: el Contrato dice que los totales los calcula el servidor, y el propio CU-15 dice que no se deben presentar como confirmadas las operaciones sin sincronizar. Un cierre sin conexión contradice ambas cosas.

**[ ] 3.5 CU-04: cancelar una sesión abierta por error**
- En "Flujos alternativos" de CU-04, agrega la viñeta:

```
Si la sesión se abrió por error, el usuario puede cancelarla: la venta queda CANCELADA, sin efectos en inventario ni caja, y la mesa queda DISPONIBLE (RN-16).
```

> Por qué: la precondición de CU-04 exige al menos un consumo para cerrar. Una mesa abierta por equivocación quedaba ocupada para siempre.

**[ ] 3.6 ⚠️ Pagos electrónicos en CU-01, CU-04 y CU-08**
- CU-01. Busca: `Si el medio de pago es electrónico y no existe conectividad para confirmar el pago, el sistema no debe marcar el pago electrónico como confirmado.` Cambia a: `Sin conexión, la venta rápida solo admite EFECTIVO; TRANSFERENCIA y QR requieren conexión y que el usuario confirme que recibió el pago.`
- CU-04. Busca: `Para pagos electrónicos sin conectividad, el sistema no debe confirmar el pago; el flujo queda pendiente hasta contar con la conectividad requerida.` Cambia a: `Sin conexión solo se permite cerrar en EFECTIVO. Si el cliente paga por TRANSFERENCIA o QR, la sesión permanece ABIERTA hasta tener conexión y que el usuario confirme que recibió el pago.`
- CU-08. Busca: `Si el pago electrónico no puede confirmarse por falta de conectividad, el sistema no lo registra como pago electrónico confirmado.` Cambia a: `Sin conexión, el abono solo admite EFECTIVO.`

**[ ] 3.7 ⚠️ CU-10: fórmula de utilidad (decisión "Utilidad neta")**
- Busca: `El sistema calcula o presenta la utilidad neta según las reglas definidas para el proyecto.`
- Cambia a: `El sistema calcula la utilidad neta como el costo total acordado menos la suma de los costos operativos registrados.`

**[ ] 3.8 CU-13: sentido del ajuste**
- Busca: `El Administrador indica el tipo de ajuste, cantidad y motivo.`
- Cambia a: `El Administrador indica el tipo (MERMA o AJUSTE_MANUAL), la cantidad, el motivo y, si es AJUSTE_MANUAL, si suma o resta.`

**[ ] 3.9 Nuevo CU-19 (Módulo 1)**
- En la tabla del Módulo 1 agrega la fila: `CU-19 | Gestionar mesas | Administrador | Alta | No (offline-first; sincronización posterior)`.
- Después del detalle de CU-05, pega:

```
CU-19 — Gestionar mesas
Actor(es): Administrador
Prioridad: Alta
Precondiciones: Usuario autenticado con rol Administrador.

Flujo principal
- El Administrador accede a la gestión de mesas.
- El sistema muestra las mesas registradas con su número, estado y si están activas.
- El Administrador registra una mesa nueva indicando su número, o activa/desactiva una existente.
- El sistema valida que no se superen 15 mesas activas y guarda el cambio.

Flujos alternativos / excepciones
- Si ya existen 15 mesas activas, el sistema rechaza activar o crear otra.
- Si la mesa está OCUPADA, el sistema no permite desactivarla.
- Si un Operador intenta acceder, el backend deniega la operación mediante RBAC.

Postcondiciones
Las mesas activas quedan disponibles para abrir sesiones dinámicas (CU-02).
```

**[ ] 3.10 Nuevo CU-20 (Módulo 3)**
- En la tabla del Módulo 3 agrega: `CU-20 | Consultar resumen diario de caja | Administrador | Alta | Sí: el servidor calcula los totales`.
- Después del detalle de CU-15, pega:

```
CU-20 — Consultar resumen diario de caja
Actor(es): Administrador
Prioridad: Alta
Precondiciones: Usuario autenticado con rol Administrador; dispositivo con conexión.

Flujo principal
- El Administrador abre el tablero de flujo de caja y elige una fecha (por defecto, hoy).
- El sistema muestra los ingresos por ventas, los ingresos por abonos, los gastos y el neto del día, calculados por el servidor.
- El sistema muestra los mismos totales discriminados por medio de pago.

Flujos alternativos / excepciones
- Si existen operaciones pendientes de sincronización, el sistema lo indica y no las presenta como confirmadas.
- Si un Operador intenta acceder, el backend deniega la operación mediante RBAC.

Postcondiciones
El Administrador conoce el flujo de caja del día sin modificar ningún registro.
```

**[ ] 3.11 Nuevo CU-18 (transversal)**
- Después de la sección "Caso de uso transversal — Autenticación", pega:

```
Caso de uso transversal — Gestión de usuarios

CU-18 — Gestionar usuarios
Actor(es): Administrador
Prioridad: Alta
Conexión: Sí (la creación de usuarios se valida en el servidor)
Precondiciones: Usuario autenticado con rol Administrador.

Flujo principal
- El Administrador accede a la gestión de usuarios.
- El sistema lista los usuarios con su nombre, usuario, rol y estado.
- El Administrador crea un usuario Operador (nombre completo, usuario y contraseña) o edita/desactiva uno existente.
- El sistema valida que el nombre de usuario no esté repetido y guarda el cambio.

Flujos alternativos / excepciones
- Si el nombre de usuario ya existe, el sistema solicita otro.
- Un usuario desactivado no puede iniciar sesión.
- Si un Operador intenta acceder, el backend deniega la operación mediante RBAC.

Postcondiciones
El Operador puede iniciar sesión (CU-17) con los permisos de su rol.
```

---

## 4. ADR — `01_ADR_Arquitectura_SADIM`

**[ ] 4.1 Encabezado:** igual que el paso 1.1.

**[ ] 4.2 ADR-005: completar los permisos del Operador**
- Busca: `El Operador tendrá acceso a las operaciones autorizadas de ventas, sesiones dinámicas y registro de abonos, sin acceso a información financiera sensible.`
- Cambia a: `El Operador tendrá acceso a las operaciones diarias autorizadas: ventas, sesiones dinámicas, órdenes de trabajo (registro, cambio de estado, abonos y consumos), consulta de inventario, ingreso de mercancía y registro de gastos, sin acceso a información financiera sensible (costos operativos, márgenes, histórico de caja y cierres). El detalle por operación se define en la columna Actor(es) de los casos de uso y en la columna Rol requerido del contrato de API.`

> Por qué: el ADR solo mencionaba ventas, sesiones y abonos, pero los casos de uso también le dan al Operador órdenes, inventario y gastos. Así el ADR y los CU dicen lo mismo.

**[ ] 4.3 ADR-006: quién puede ver la configuración**
- Busca: `No se realizará carga o descarga dinámica del código del módulo.`
- Después de esa frase agrega: ` El estado de activación de los módulos puede ser consultado por ambos roles para que la interfaz oculte las funciones desactivadas; solo el Administrador puede modificarlo.`

**[ ] 4.4 ADR-003: librería auxiliar**
- Busca: `mecanismos de almacenamiento local mediante IndexedDB para soportar la estrategia offline-first definida en ADR-004.`
- Después agrega: ` El uso de una librería auxiliar sobre IndexedDB (por ejemplo, Dexie) es una decisión de implementación y no modifica esta decisión.`

---

## 5. Anteproyecto — `SADIM_Anteproyecto_v2`

> Antes de empezar: si el anteproyecto ya fue aprobado formalmente por la universidad, pregúntenle al director si se puede modificar o si los ajustes se documentan en la monografía final. Los pasos 5.1 a 5.4 son correcciones de coherencia; los pasos con ⚠️ cambian compromisos del proyecto.

**[ ] 5.1 Firebase en costos (completa HU-006)**
- Busca: `(frameworks de desarrollo, Visual Studio Code, Firebase)`
- Cambia a: `(Django, React, PostgreSQL, Visual Studio Code y Git)`

**[ ] 5.2 Base de datos en la Tabla 2**
- Busca: `Base de Datos Relacional (PostgreSQL/SQLite)`
- Cambia a: `Base de Datos Relacional (PostgreSQL)`

**[ ] 5.3 Activación de módulos (§2.1.3)**
- Busca: `utilizando clases abstractas para la activación dinámica de módulos según el perfil del negocio`
- Cambia a: `con módulos que se activan o desactivan mediante configuración según el perfil del negocio, sin cargar ni eliminar código`

> Por qué: ADR-006 descarta explícitamente la carga dinámica de módulos. Un jurado podría preguntar por la contradicción.

**[ ] 5.4 Venta rápida (§1.5.1)**
- Busca: `venta inmediata de un solo producto sin necesidad de abrir sesión`
- Cambia a: `venta inmediata de uno o varios productos sin necesidad de abrir sesión`

**[ ] 5.5 ⚠️ Descuento de insumos (decisión "Recetas", opción A)**
- Busca: `ambos con descuento automático tras cada venta`
- Cambia a: `los productos vendidos se descuentan automáticamente al cerrar cada venta, y los insumos de producción se controlan mediante ingresos, consumos de órdenes, mermas y ajustes`

**[ ] 5.6 Casos extras (§1.5.2, opcional pero recomendado)**
- Busca: `(compras hormiga y cambios de moneda)`
- Cambia a: `(gastos hormiga y otros egresos menores)`

> Por qué: los casos de uso aclaran que el cambio entregado al cliente no se registra como movimiento de caja; mejor no prometerlo.

**[ ] 5.7 ⚠️ Calendario (decisión "Calendario")**
- **Si eligen la opción A (actualizar el anteproyecto):**
  - Busca `12 semanas (3 meses)` en §1.6 y ajústalo a la duración real (17 de agosto a 18 de octubre: 9 semanas).
  - Busca `cuatro sprints de tres semanas cada uno, abarcando un total de doce semanas` (§3.2) y `cuatro sprints de tres semanas cada uno, para un total de doce semanas` (§4) y ajústalos a: `cuatro sprints (tres de dos semanas y uno de tres semanas), para un total de nueve semanas`.
  - En §5 Costos, las 240 horas salen de 12 semanas; con 9 semanas serían 180 horas por desarrollador y hay que recalcular las tablas del Anexo G. Pídanme ayuda con este recálculo.
  - En el Anexo E, reemplaza la tabla por el contenido de la hoja Sprints del backlog (objetivos de cada sprint).
- **Si eligen la opción B:** no cambien nada aquí y anoten el ajuste de cronograma en la monografía final.

---

## 6. Al terminar

1. **[ ]** Guarda las versiones nuevas de los cinco documentos.
2. **[ ]** Súbelos a este proyecto de Claude y pídeme que regenere los archivos de `docs/referencia/` y actualice `INCONSISTENCIAS.md`. Alternativa manual: `pandoc archivo.docx -t gfm -o archivo.md` y copiar el resultado a `docs/referencia/` (Claude Code tiene prohibido editar esa carpeta, así que ese paso lo haces tú).
3. **[ ]** En el backlog, marca **HU-047** y **HU-006** como terminadas y registra las decisiones tomadas en la hoja **Decisiones pendientes** (columna Estado = Cerrada).
