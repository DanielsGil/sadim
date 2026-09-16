---
paths:
  - "**/models.py"
  - "**/models/**/*.py"
  - "**/migrations/*.py"
---

# Reglas para modelos Django y migraciones

Fuente: `docs/referencia/02_ERD_SADIM_v3.md` §5 (diccionario lógico) y §7 (reglas de negocio R-01..R-33). Antes de crear o modificar un modelo, abre su tabla en el ERD y compárala campo por campo.

- Clases con los nombres del ERD: Usuario, ConfiguracionModulo, Categoria, Producto, Mesa, Venta, DetalleVenta, OrdenTrabajo, Abono, ConsumoOrden, CostoOperativoOrden, MovimientoInventario, MovimientoCaja, CierreCaja. No existen entidades "Inventario" ni "Negocio".
- `id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)` en todas.
- ENUM del ERD ⇒ `models.TextChoices` con los valores exactos (RAPIDA, SESION_DINAMICA, ABIERTA, CERRADA, CANCELADA, EFECTIVO, TRANSFERENCIA, QR, INSUMO_PRODUCCION, REVENTA_DIRECTA, RECIBIDO, EN_PROCESO, LISTO, ENTREGADO, PENDIENTE, APLICADO, ENTRADA, SALIDA_VENTA, SALIDA_SERVICIO, MERMA, AJUSTE_MANUAL, INGRESO_VENTA, INGRESO_ABONO, GASTO, ADMIN, OPERADOR, DISPONIBLE, OCUPADA).
- DECIMAL(10,2) ⇒ `DecimalField(max_digits=10, decimal_places=2)`.
- Campos CALCULADOS (subtotal, saldo_pendiente, total_ingresos, total_gastos, total_neto) nunca son editables por el usuario: se calculan en servicios/propiedades o, si se persisten, solo los escribe el backend.
- Restricciones en la BD cuando sea posible: `UniqueConstraint`, `CheckConstraint` (cantidad > 0, valor > 0) y "una sola SESION_DINAMICA ABIERTA por mesa" como `UniqueConstraint(fields=["mesa"], condition=Q(tipo="SESION_DINAMICA", estado="ABIERTA"))`.
- Usuario: el ERD dice `password_hash`; si se usa el modelo de usuario de Django (AbstractUser/AbstractBaseUser), el campo se llama `password` y ya guarda un hash. Es una diferencia de nombre aceptable, pero hay que mencionarla, no ocultarla. Igual con `fecha_creacion` vs `date_joined`.

## Puntos ya corregidos en el ERD v3 (no aplican más)
La v3 (`02_ERD_SADIM_v3.md` §12 y §12.1) ya corrigió lo que en el ERD v2 estaba mal — INC-01, INC-02, INC-03, INC-04, INC-05, INC-08 (ver `docs/INCONSISTENCIAS.md`, aunque esa tabla todavía las marca "Pendiente HU-047": la corrección ya está en el documento, falta que el equipo actualice el estado). En concreto, en v3: `DetalleVenta.venta_id` es FK NOT NULL sin UNIQUE; `MovimientoInventario.venta_id` es FK NULL sin UNIQUE; Categoria, Producto, DetalleVenta y CostoOperativoOrden ya tienen `operation_id` UNIQUE NOT NULL; `MovimientoCaja` ya tiene `cierre_caja_id` y `abono_id` UNIQUE; `MovimientoInventario` ya tiene `sentido` para AJUSTE_MANUAL. No repliques el ERD v2 ni esta lista antigua: usa siempre la tabla vigente de la v3.

## Migraciones
- Nunca edites una migración ya aplicada o commiteada; crea una nueva.
- Tras cambiar modelos, ejecuta `makemigrations --check --dry-run`, explica qué se generaría y espera aprobación antes de crearla.
