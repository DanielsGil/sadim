import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Mesa(models.Model):
    """ERD §5.7 (HU-043). Máximo 15 mesas activas (R-06)."""

    class Estado(models.TextChoices):
        DISPONIBLE = 'DISPONIBLE'
        OCUPADA = 'OCUPADA'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    numero = models.SmallIntegerField(unique=True)
    activa = models.BooleanField(default=True)
    # Valor derivado de la existencia de una Venta SESION_DINAMICA ABIERTA;
    # el cliente nunca lo escribe (lo mantiene la capa de servicios de ventas).
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.DISPONIBLE)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(numero__gte=1) & Q(numero__lte=15),
                name='mesa_numero_entre_1_y_15',
            ),
        ]

    def __str__(self):
        return f'Mesa {self.numero}'


class Venta(models.Model):
    """ERD §5.8. Venta rápida (RAPIDA) o sesión dinámica (SESION_DINAMICA)."""

    class Tipo(models.TextChoices):
        RAPIDA = 'RAPIDA'
        SESION_DINAMICA = 'SESION_DINAMICA'

    class Estado(models.TextChoices):
        ABIERTA = 'ABIERTA'
        CERRADA = 'CERRADA'
        CANCELADA = 'CANCELADA'

    class MedioPago(models.TextChoices):
        EFECTIVO = 'EFECTIVO'
        TRANSFERENCIA = 'TRANSFERENCIA'
        QR = 'QR'

    class EstadoPago(models.TextChoices):
        CONFIRMADO = 'CONFIRMADO'
        PENDIENTE_VERIFICACION = 'PENDIENTE_VERIFICACION'
        # D15 (Bloque 4): un pago electrónico que nunca llega se anula desde
        # su MovimientoCaja (PATCH /api/movimientos-caja/{id}/anular/).
        ANULADO = 'ANULADO'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    # D7: PROTECT en toda FK del dominio.
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='ventas',
    )
    mesa = models.ForeignKey(
        Mesa, on_delete=models.PROTECT, null=True, blank=True, related_name='ventas',
    )
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ABIERTA)
    fecha_apertura = models.DateTimeField(default=timezone.now)
    fecha_cierre = models.DateTimeField(null=True, blank=True)
    medio_pago = models.CharField(max_length=20, choices=MedioPago.choices, null=True, blank=True)
    estado_pago = models.CharField(max_length=30, choices=EstadoPago.choices, null=True, blank=True)
    # CALCULADO: suma de los subtotales de DetalleVenta; solo lo escribe el backend.
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        constraints = [
            # R-07: SESION_DINAMICA exige mesa; RAPIDA no la lleva.
            models.CheckConstraint(
                condition=(
                    Q(tipo='SESION_DINAMICA', mesa__isnull=False)
                    | Q(tipo='RAPIDA', mesa__isnull=True)
                ),
                name='venta_mesa_segun_tipo',
            ),
            # R-08: como máximo una sesión ABIERTA por mesa (índice único parcial).
            models.UniqueConstraint(
                fields=['mesa'],
                condition=Q(estado='ABIERTA'),
                name='venta_una_sesion_abierta_por_mesa',
            ),
            models.CheckConstraint(
                condition=(
                    ~Q(estado='CERRADA')
                    | (
                        Q(fecha_cierre__isnull=False)
                        & ~Q(medio_pago='')
                        & Q(medio_pago__isnull=False)
                        & Q(estado_pago__isnull=False)
                    )
                ),
                name='venta_cerrada_exige_cierre_medio_y_estado_pago',
            ),
        ]

    def __str__(self):
        return f'Venta {self.id} ({self.estado})'


class DetalleVenta(models.Model):
    """ERD §5.9. Solo puede tocarse mientras la Venta está ABIERTA (VENTA_YA_CERRADA)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    venta = models.ForeignKey(Venta, on_delete=models.PROTECT, related_name='detalles')
    producto = models.ForeignKey('inventario.Producto', on_delete=models.PROTECT, related_name='+')
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    # CALCULADO: cantidad * precio_unitario; solo lo escribe el backend.
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(cantidad__gt=0), name='detalleventa_cantidad_positiva'),
            models.CheckConstraint(
                condition=Q(precio_unitario__gte=0), name='detalleventa_precio_unitario_no_negativo',
            ),
        ]

    def __str__(self):
        return f'{self.cantidad} x {self.producto_id} ({self.venta_id})'
