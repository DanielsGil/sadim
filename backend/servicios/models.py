import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class OrdenTrabajo(models.Model):
    """ERD §5.10. Pedido por encargo o servicio con fecha de entrega (HU-020)."""

    class Estado(models.TextChoices):
        RECIBIDO = 'RECIBIDO'
        EN_PROCESO = 'EN_PROCESO'
        LISTO = 'LISTO'
        ENTREGADO = 'ENTREGADO'
        # D29 (Lote 7, E-20): una orden no se borra (D7), se cancela.
        CANCELADA = 'CANCELADA'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    # D7: PROTECT en toda FK del dominio.
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='ordenes_trabajo',
    )
    cliente_nombre = models.CharField(max_length=150)
    cliente_telefono = models.CharField(max_length=20, null=True, blank=True)
    descripcion = models.TextField()
    fecha_solicitud = models.DateTimeField(default=timezone.now)
    fecha_entrega_estimada = models.DateField()
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.RECIBIDO)
    costo_total = models.DecimalField(max_digits=10, decimal_places=2)
    # CALCULADO: costo_total menos la suma de los abonos; solo lo escribe el backend.
    saldo_pendiente = models.DecimalField(max_digits=10, decimal_places=2)
    # CALCULADO: costo_total menos la suma de CostoOperativoOrden; expuesto
    # únicamente al rol ADMIN (CU-10), nunca al OPERADOR (igual que
    # Producto.costo_produccion, D5).
    utilidad_neta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # D29: no están en el ERD. Obligatorios cuando estado = CANCELADA.
    motivo_cancelacion = models.CharField(max_length=255, null=True, blank=True)
    cancelada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='+',
    )
    fecha_cancelacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(costo_total__gte=0), name='orden_costo_total_no_negativo'),
            models.CheckConstraint(
                condition=~Q(estado='CANCELADA') | (
                    Q(motivo_cancelacion__isnull=False)
                    & Q(cancelada_por__isnull=False)
                    & Q(fecha_cancelacion__isnull=False)
                ),
                name='orden_datos_cancelacion_si_cancelada',
            ),
        ]

    def __str__(self):
        return f'Orden {self.id} ({self.estado})'


class Abono(models.Model):
    """ERD §5.11. Pago parcial sobre una OrdenTrabajo (HU-022, R-12..R-14)."""

    class MedioPago(models.TextChoices):
        EFECTIVO = 'EFECTIVO'
        TRANSFERENCIA = 'TRANSFERENCIA'
        QR = 'QR'

    class EstadoPago(models.TextChoices):
        CONFIRMADO = 'CONFIRMADO'
        PENDIENTE_VERIFICACION = 'PENDIENTE_VERIFICACION'
        # D15 (Bloque 4): al anular su MovimientoCaja, el abono también queda
        # ANULADO y su valor vuelve al saldo_pendiente de la orden.
        ANULADO = 'ANULADO'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    orden = models.ForeignKey(OrdenTrabajo, on_delete=models.PROTECT, related_name='abonos')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='abonos',
    )
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    medio_pago = models.CharField(max_length=20, choices=MedioPago.choices)
    estado_pago = models.CharField(
        max_length=30, choices=EstadoPago.choices, default=EstadoPago.CONFIRMADO,
    )
    fecha = models.DateTimeField(default=timezone.now)
    observacion = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(valor__gt=0), name='abono_valor_positivo'),
        ]

    def __str__(self):
        return f'Abono {self.valor} a orden {self.orden_id}'


class ConsumoOrden(models.Model):
    """ERD §5.12. Producto/insumo usado en una orden, pendiente hasta ENTREGADO (HU-041, R-15)."""

    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE'
        APLICADO = 'APLICADO'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    orden = models.ForeignKey(OrdenTrabajo, on_delete=models.PROTECT, related_name='consumos')
    producto = models.ForeignKey('inventario.Producto', on_delete=models.PROTECT, related_name='+')
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE)
    fecha_registro = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(cantidad__gt=0), name='consumoorden_cantidad_positiva'),
        ]

    def __str__(self):
        return f'{self.cantidad} x {self.producto_id} (orden {self.orden_id})'


class CostoOperativoOrden(models.Model):
    """ERD §5.13. Desglose de costos operativos de una orden; solo ADMIN (CU-10)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    orden = models.ForeignKey(OrdenTrabajo, on_delete=models.PROTECT, related_name='costos')
    concepto = models.CharField(max_length=150)
    valor = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(valor__gt=0), name='costooperativoorden_valor_positivo'),
        ]

    def __str__(self):
        return f'{self.concepto}: {self.valor} (orden {self.orden_id})'
