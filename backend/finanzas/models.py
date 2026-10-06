import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class MovimientoCaja(models.Model):
    """
    ERD §5.15. Detalle histórico de caja (ADR-008); CierreCaja solo consolida
    un resumen (Bloque 4 de Sprint 4).

    D15 (Bloque 4): agrega ANULADO al enum estado_pago y el campo
    motivo_anulacion (no está en el ERD) para anular un pago electrónico que
    nunca llega — PATCH /api/movimientos-caja/{id}/anular/.
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
        ANULADO = 'ANULADO'

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
    # Bloque 4: cierra el pendiente del Bloque 2/3. NULL mientras el
    # movimiento no ha sido incluido en ningún cierre (D-07).
    cierre_caja = models.ForeignKey(
        'CierreCaja', on_delete=models.PROTECT, null=True, blank=True, related_name='movimientos',
    )
    # D31 (Lote 7, E-23): no está en el ERD. Gasto de la compra registrada
    # junto con un ingreso de mercancía; UNIQUE y solo permitido en GASTO.
    movimiento_inventario = models.OneToOneField(
        'inventario.MovimientoInventario', on_delete=models.PROTECT, null=True, blank=True,
        related_name='gasto_compra',
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
    # D15: no está en el ERD. Obligatorio cuando estado_pago = ANULADO.
    motivo_anulacion = models.CharField(max_length=255, null=True, blank=True)

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
            # ERD §5.15: impide cierre_caja_id NOT NULL mientras el pago
            # sigue pendiente de verificación.
            models.CheckConstraint(
                condition=~Q(estado_pago='PENDIENTE_VERIFICACION') | Q(cierre_caja__isnull=True),
                name='movcaja_sin_cierre_si_pendiente',
            ),
            # D15.
            models.CheckConstraint(
                condition=~Q(estado_pago='ANULADO') | Q(motivo_anulacion__isnull=False),
                name='movcaja_motivo_anulacion_si_anulado',
            ),
            # D31.
            models.CheckConstraint(
                condition=Q(tipo='GASTO') | Q(movimiento_inventario__isnull=True),
                name='movcaja_movinv_solo_en_gasto',
            ),
        ]

    def __str__(self):
        return f'{self.tipo} {self.valor}'


class CierreCaja(models.Model):
    """
    ERD §5.16 (HU-027/HU-028, Bloque 4). Resumen o corte de caja; MovimientoCaja
    conserva el detalle histórico (ADR-008).

    D14: consolida los MovimientoCaja CONFIRMADO con cierre_caja_id nulo cuya
    fecha sea <= periodo_fin (el criterio es "no incluido en ningún cierre
    todavía", no un rango fijo de fechas). periodo_inicio es el periodo_fin
    del último cierre, o la fecha del primer movimiento si no hay cierres
    previos; periodo_fin es el momento del POST.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='cierres_caja',
    )
    # Fecha contable del corte, declarada por el ADMIN al hacer el cierre
    # (Contrato v2 §11); distinta de periodo_fin, que es el momento real del POST.
    fecha = models.DateField(unique=True)
    periodo_inicio = models.DateTimeField()
    periodo_fin = models.DateTimeField()
    total_ingresos_ventas = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_ingresos_abonos = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_gastos = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_neto = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    efectivo_esperado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    efectivo_contado = models.DecimalField(max_digits=10, decimal_places=2)
    diferencia = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    observaciones = models.TextField(null=True, blank=True)
    fecha_creacion = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(efectivo_contado__gte=0), name='cierrecaja_efectivo_contado_no_negativo'),
            models.CheckConstraint(condition=Q(periodo_fin__gt=models.F('periodo_inicio')), name='cierrecaja_periodo_fin_mayor'),
            # Contrato v2 §11: observaciones es obligatorio si la diferencia no es cero.
            models.CheckConstraint(
                condition=Q(diferencia=0) | Q(observaciones__isnull=False),
                name='cierrecaja_observaciones_si_diferencia',
            ),
        ]

    def __str__(self):
        return f'Cierre {self.fecha}'
