import uuid
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

class Categoria(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ERD §5.5: identificador de la operación de creación, para sincronización idempotente (R-30).
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    nombre = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nombre


class MovimientoInventario(models.Model):
    """
    ERD §5.14. Histórico: no se edita ni se elimina (R-17); una corrección es
    un nuevo movimiento de AJUSTE_MANUAL.

    Bloque 3 de Sprint 3 cierra consumo_orden_id (FK → ConsumoOrden, UNIQUE)
    y genera SALIDA_SERVICIO al entregar una orden (HU-023/HU-041). MERMA y
    AJUSTE_MANUAL quedan para Sprint 4 (HU-026).
    """

    class Tipo(models.TextChoices):
        ENTRADA = 'ENTRADA'
        SALIDA_VENTA = 'SALIDA_VENTA'
        SALIDA_SERVICIO = 'SALIDA_SERVICIO'
        MERMA = 'MERMA'
        AJUSTE_MANUAL = 'AJUSTE_MANUAL'

    class Sentido(models.TextChoices):
        SUMA = 'SUMA'
        RESTA = 'RESTA'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    producto = models.ForeignKey('Producto', on_delete=models.PROTECT, related_name='movimientos')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='movimientos_inventario',
    )
    # Sin restricción UNIQUE: una venta genera un movimiento por cada línea.
    venta = models.ForeignKey(
        'ventas.Venta', on_delete=models.PROTECT, null=True, blank=True, related_name='movimientos_inventario',
    )
    # UNIQUE: la relación ConsumoOrden 1:1 MovimientoInventario (ERD §5.14).
    consumo_orden = models.OneToOneField(
        'servicios.ConsumoOrden', on_delete=models.PROTECT, null=True, blank=True,
        related_name='movimiento_inventario',
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    sentido = models.CharField(max_length=10, choices=Sentido.choices, null=True, blank=True)
    fecha = models.DateTimeField(default=timezone.now)
    motivo = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(cantidad__gt=0), name='movinv_cantidad_positiva'),
            models.CheckConstraint(
                condition=~Q(tipo__in=['MERMA', 'AJUSTE_MANUAL']) | Q(motivo__isnull=False),
                name='movinv_motivo_si_merma_o_ajuste',
            ),
            models.CheckConstraint(
                condition=~Q(tipo='AJUSTE_MANUAL') | Q(sentido__isnull=False),
                name='movinv_sentido_requerido_en_ajuste',
            ),
            models.CheckConstraint(
                condition=Q(tipo='AJUSTE_MANUAL') | Q(sentido__isnull=True),
                name='movinv_sentido_nulo_fuera_de_ajuste',
            ),
            models.CheckConstraint(
                condition=~Q(tipo='SALIDA_VENTA') | Q(venta__isnull=False),
                name='movinv_venta_requerida_en_salida_venta',
            ),
            models.CheckConstraint(
                condition=Q(tipo='SALIDA_VENTA') | Q(venta__isnull=True),
                name='movinv_venta_nula_fuera_de_salida_venta',
            ),
            models.CheckConstraint(
                condition=~Q(tipo='SALIDA_SERVICIO') | Q(consumo_orden__isnull=False),
                name='movinv_consumo_requerido_en_salida_servicio',
            ),
            models.CheckConstraint(
                condition=Q(tipo='SALIDA_SERVICIO') | Q(consumo_orden__isnull=True),
                name='movinv_consumo_nulo_fuera_de_salida_servicio',
            ),
        ]
        indexes = [
            models.Index(fields=['producto', 'fecha']),
        ]

    def __str__(self):
        return f'{self.tipo} {self.cantidad} — {self.producto_id}'


class Producto(models.Model):
    TIPO_CHOICES = (
        ('INSUMO_PRODUCCION', 'Insumo de producción'),
        ('REVENTA_DIRECTA', 'Reventa directa'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ERD §5.6: identificador de la operación de creación, para sincronización idempotente (R-30).
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    # D7: PROTECT en toda FK del dominio — nada se borra físicamente (R-17, baja lógica del Contrato).
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name='productos')
    nombre = models.CharField(max_length=150)
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    precio_venta = models.DecimalField(max_digits=10, decimal_places=2)
    costo_produccion = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stock_actual = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_minimo = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # ERD §5.6: false en preparados al momento, que no llevan existencias propias (R-18).
    controla_stock = models.BooleanField(default=True)
    unidad_medida = models.CharField(max_length=20)
    activo = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['categoria', 'nombre'],
                name='producto_categoria_nombre_unico',
            ),
            models.CheckConstraint(
                condition=Q(precio_venta__gte=0),
                name='producto_precio_venta_no_negativo',
            ),
            models.CheckConstraint(
                condition=Q(costo_produccion__isnull=True) | Q(costo_produccion__gte=0),
                name='producto_costo_produccion_no_negativo',
            ),
        ]

    def __str__(self):
        return self.nombre