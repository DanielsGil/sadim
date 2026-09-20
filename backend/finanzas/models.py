import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class MovimientoCaja(models.Model):
    """
    ERD §5.15. Detalle histórico de caja (ADR-008); CierreCaja (Sprint 4) solo
    consolida un resumen.

    Bloque 3 de Sprint 3 cierra abono_id (FK → Abono, UNIQUE) y genera
    INGRESO_ABONO como efecto de un abono (HU-022). cierre_caja_id sigue
    pendiente porque CierreCaja no existe todavía (Sprint 4); el CHECK
    "cierre_caja_id NULL si PENDIENTE_VERIFICACION" queda pendiente con él.
    """

    class Tipo(models.TextChoices):
        INGRESO_VENTA = 'INGRESO_VENTA'
        INGRESO_ABONO = 'INGRESO_ABONO'
        GASTO = 'GASTO'

    class MedioPago(models.TextChoices):
        EFECTIVO = 'EFECTIVO'
        TRANSFERENCIA = 'TRANSFERENCIA'
        QR = 'QR'

    class EstadoPago(models.TextChoices):
        CONFIRMADO = 'CONFIRMADO'
        PENDIENTE_VERIFICACION = 'PENDIENTE_VERIFICACION'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='movimientos_caja',
    )
    # UNIQUE: una venta genera un único movimiento de caja.
    venta = models.OneToOneField(
        'ventas.Venta', on_delete=models.PROTECT, null=True, blank=True, related_name='movimiento_caja',
    )
    # UNIQUE: un abono genera un único movimiento de caja.
    abono = models.OneToOneField(
        'servicios.Abono', on_delete=models.PROTECT, null=True, blank=True, related_name='movimiento_caja',
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    medio_pago = models.CharField(max_length=20, choices=MedioPago.choices)
    estado_pago = models.CharField(
        max_length=30, choices=EstadoPago.choices, default=EstadoPago.CONFIRMADO,
    )
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    concepto = models.CharField(max_length=255, null=True, blank=True)
    fecha = models.DateTimeField(default=timezone.now)
    fecha_confirmacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(valor__gt=0), name='movcaja_valor_positivo'),
            models.CheckConstraint(
                condition=~Q(tipo='INGRESO_VENTA') | Q(venta__isnull=False),
                name='movcaja_venta_requerida_en_ingreso_venta',
            ),
            models.CheckConstraint(
                condition=Q(tipo='INGRESO_VENTA') | Q(venta__isnull=True),
                name='movcaja_venta_nula_fuera_de_ingreso_venta',
            ),
            models.CheckConstraint(
                condition=~Q(tipo='GASTO') | Q(concepto__isnull=False),
                name='movcaja_concepto_requerido_en_gasto',
            ),
            models.CheckConstraint(
                condition=~Q(tipo='INGRESO_ABONO') | Q(abono__isnull=False),
                name='movcaja_abono_requerido_en_ingreso_abono',
            ),
            models.CheckConstraint(
                condition=Q(tipo='INGRESO_ABONO') | Q(abono__isnull=True),
                name='movcaja_abono_nulo_fuera_de_ingreso_abono',
            ),
            # Solo el efectivo se confirma sin verificación adicional: si ya
            # quedó CONFIRMADO sin fecha_confirmacion, el medio tuvo que ser
            # EFECTIVO (TRANSFERENCIA/QR solo llegan a CONFIRMADO al
            # confirmarse, momento en que se registra fecha_confirmacion).
            models.CheckConstraint(
                condition=(
                    ~Q(estado_pago='CONFIRMADO', fecha_confirmacion__isnull=True)
                    | Q(medio_pago='EFECTIVO')
                ),
                name='movcaja_confirmado_sin_fecha_solo_efectivo',
            ),
        ]

    def __str__(self):
        return f'{self.tipo} {self.valor}'
