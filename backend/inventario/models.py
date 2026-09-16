import uuid
from django.db import models
from django.db.models import Q

class Categoria(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ERD §5.5: identificador de la operación de creación, para sincronización idempotente (R-30).
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    nombre = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nombre

class Producto(models.Model):
    TIPO_CHOICES = (
        ('INSUMO_PRODUCCION', 'Insumo de producción'),
        ('REVENTA_DIRECTA', 'Reventa directa'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ERD §5.6: identificador de la operación de creación, para sincronización idempotente (R-30).
    operation_id = models.UUIDField(unique=True, default=uuid.uuid4)
    categoria = models.ForeignKey(Categoria, on_delete=models.CASCADE, related_name='productos')
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